package com.agshubham.remotemousetv

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlin.math.max
import kotlin.math.min

class TvAccessibilityService : AccessibilityService() {

    companion object {
        @Volatile
        var instance: TvAccessibilityService? = null
            private set

        fun isRunning(): Boolean = instance != null
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var windowManager: WindowManager? = null
    private var cursorView: CursorOverlayView? = null
    private var cursorParams: WindowManager.LayoutParams? = null

    private var screenWidth = 1920f
    private var screenHeight = 1080f
    private var cursorX = 960f
    private var cursorY = 540f

    private var lastScrollTime = 0L
    private var pendingScrollDy = 0f

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        setupCursorOverlay()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not needed for passive injection; kept lightweight
    }

    override fun onInterrupt() {
        // Required override
    }

    override fun onDestroy() {
        instance = null
        removeCursorOverlay()
        super.onDestroy()
    }

    private fun setupCursorOverlay() {
        mainHandler.post {
            try {
                windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
                val metrics = DisplayMetrics()
                @Suppress("DEPRECATION")
                windowManager?.defaultDisplay?.getRealMetrics(metrics)
                screenWidth = metrics.widthPixels.toFloat().coerceAtLeast(1f)
                screenHeight = metrics.heightPixels.toFloat().coerceAtLeast(1f)
                cursorX = screenWidth / 2f
                cursorY = screenHeight / 2f

                val view = CursorOverlayView(this)
                val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_SYSTEM_OVERLAY
                }

                val params = WindowManager.LayoutParams(
                    44,
                    44,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.TOP or Gravity.START
                    x = cursorX.toInt()
                    y = cursorY.toInt()
                }

                windowManager?.addView(view, params)
                cursorView = view
                cursorParams = params
            } catch (_: Exception) {
            }
        }
    }

    private fun removeCursorOverlay() {
        mainHandler.post {
            try {
                cursorView?.let { windowManager?.removeView(it) }
            } catch (_: Exception) {
            }
            cursorView = null
            cursorParams = null
        }
    }

    fun moveCursor(dx: Float, dy: Float) {
        cursorX = min(screenWidth - 4f, max(0f, cursorX + dx))
        cursorY = min(screenHeight - 4f, max(0f, cursorY + dy))
        mainHandler.post {
            val params = cursorParams ?: return@post
            val view = cursorView ?: return@post
            params.x = cursorX.toInt()
            params.y = cursorY.toInt()
            try {
                windowManager?.updateViewLayout(view, params)
            } catch (_: Exception) {
            }
        }
    }

    fun clickAtCursor(button: String = "left") {
        if (button == "right") {
            performGlobalAction(GLOBAL_ACTION_BACK)
            return
        }
        mainHandler.post {
            val path = Path().apply { moveTo(cursorX, cursorY) }
            val stroke = GestureDescription.StrokeDescription(path, 0L, 45L)
            val gesture = GestureDescription.Builder().addStroke(stroke).build()
            dispatchGesture(gesture, null, null)
        }
    }

    fun scrollAtCursor(dx: Float, dy: Float) {
        pendingScrollDy += dy
        val now = System.currentTimeMillis()
        if (now - lastScrollTime < 90L) return
        val delta = pendingScrollDy
        pendingScrollDy = 0f
        if (kotlin.math.abs(delta) < 2f) return
        lastScrollTime = now

        mainHandler.post {
            val swipeDist = (delta * 8f).coerceIn(-400f, 400f)
            val startY = cursorY.coerceIn(120f, screenHeight - 120f)
            val endY = (startY + swipeDist).coerceIn(40f, screenHeight - 40f)
            val path = Path().apply {
                moveTo(cursorX, startY)
                lineTo(cursorX, endY)
            }
            val stroke = GestureDescription.StrokeDescription(path, 0L, 120L)
            val gesture = GestureDescription.Builder().addStroke(stroke).build()
            dispatchGesture(gesture, null, null)
        }
    }

    fun injectText(text: String) {
        mainHandler.post {
            val root = rootInActiveWindow ?: return@post
            val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return@post
            val existing = focused.text?.toString() ?: ""
            val args = Bundle().apply {
                putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    existing + text
                )
            }
            focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        }
    }

    fun handleKey(name: String, action: String = "tap") {
        if (action == "release") return
        val lower = name.lowercase()
        val audio = getSystemService(Context.AUDIO_SERVICE) as AudioManager

        when (lower) {
            "esc", "browser_back" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "win", "cmd", "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "media_volume_up" -> audio.adjustStreamVolume(
                AudioManager.STREAM_MUSIC,
                AudioManager.ADJUST_RAISE,
                AudioManager.FLAG_SHOW_UI
            )
            "media_volume_down" -> audio.adjustStreamVolume(
                AudioManager.STREAM_MUSIC,
                AudioManager.ADJUST_LOWER,
                AudioManager.FLAG_SHOW_UI
            )
            "media_volume_mute" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    audio.adjustStreamVolume(
                        AudioManager.STREAM_MUSIC,
                        AudioManager.ADJUST_TOGGLE_MUTE,
                        AudioManager.FLAG_SHOW_UI
                    )
                }
            }
            "media_play_pause" -> dispatchMediaKey(audio, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)
            "media_next" -> dispatchMediaKey(audio, KeyEvent.KEYCODE_MEDIA_NEXT)
            "media_previous" -> dispatchMediaKey(audio, KeyEvent.KEYCODE_MEDIA_PREVIOUS)
            "enter", "space" -> clickFocusedOrCursor()
            "backspace" -> handleBackspace()
            "up" -> moveFocusOrCursor(0f, -60f)
            "down" -> moveFocusOrCursor(0f, 60f)
            "left" -> moveFocusOrCursor(-60f, 0f)
            "right" -> moveFocusOrCursor(60f, 0f)
            else -> {
                if (name.length == 1) {
                    injectText(name)
                }
            }
        }
    }

    private fun dispatchMediaKey(audio: AudioManager, keyCode: Int) {
        audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
        audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, keyCode))
    }

    private fun clickFocusedOrCursor() {
        mainHandler.post {
            val focused = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_ACCESSIBILITY)
                ?: rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            if (focused != null && focused.isClickable) {
                focused.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            } else {
                clickAtCursor("left")
            }
        }
    }

    private fun handleBackspace() {
        mainHandler.post {
            val focused = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            if (focused != null) {
                val existing = focused.text?.toString() ?: ""
                if (existing.isNotEmpty()) {
                    val args = Bundle().apply {
                        putCharSequence(
                            AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                            existing.dropLast(1)
                        )
                    }
                    focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
                    return@post
                }
            }
            performGlobalAction(GLOBAL_ACTION_BACK)
        }
    }

    private fun moveFocusOrCursor(dx: Float, dy: Float) {
        moveCursor(dx, dy)
    }

    private class CursorOverlayView(context: Context) : View(context) {
        private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#14B8A6")
            style = Paint.Style.FILL
        }
        private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = 3.5f
        }
        private val pointerPath = Path().apply {
            moveTo(4f, 4f)
            lineTo(12f, 34f)
            lineTo(19f, 23f)
            lineTo(31f, 25f)
            close()
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            canvas.drawPath(pointerPath, fillPaint)
            canvas.drawPath(pointerPath, strokePaint)
        }
    }
}

