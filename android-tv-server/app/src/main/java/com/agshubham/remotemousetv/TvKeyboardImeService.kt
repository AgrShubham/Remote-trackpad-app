package com.agshubham.remotemousetv

import android.inputmethodservice.InputMethodService
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View

class TvKeyboardImeService : InputMethodService() {

    companion object {
        @Volatile
        var instance: TvKeyboardImeService? = null
            private set
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    override fun onDestroy() {
        if (instance === this) {
            instance = null
        }
        super.onDestroy()
    }

    override fun onCreateInputView(): View {
        // Minimal 1px view so the TV screen isn't obstructed while typing from the phone
        return View(this).apply {
            minimumHeight = 1
        }
    }

    fun commitTextFromRemote(text: String): Boolean {
        val ic = currentInputConnection ?: return false
        mainHandler.post {
            currentInputConnection?.commitText(text, 1)
        }
        return true
    }

    fun handleKeyFromRemote(name: String): Boolean {
        val ic = currentInputConnection ?: return false
        val lower = name.lowercase()
        mainHandler.post {
            val activeIc = currentInputConnection ?: return@post
            when (lower) {
                "backspace" -> {
                    activeIc.deleteSurroundingText(1, 0)
                }
                "enter" -> {
                    activeIc.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
                    activeIc.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER))
                }
                "space" -> {
                    activeIc.commitText(" ", 1)
                }
                "tab" -> {
                    activeIc.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_TAB))
                    activeIc.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_TAB))
                }
                "up" -> sendDpKey(activeIc, KeyEvent.KEYCODE_DPAD_UP)
                "down" -> sendDpKey(activeIc, KeyEvent.KEYCODE_DPAD_DOWN)
                "left" -> sendDpKey(activeIc, KeyEvent.KEYCODE_DPAD_LEFT)
                "right" -> sendDpKey(activeIc, KeyEvent.KEYCODE_DPAD_RIGHT)
                else -> {
                    if (name.length == 1) {
                        activeIc.commitText(name, 1)
                    }
                }
            }
        }
        return when (lower) {
            "backspace", "enter", "space", "tab", "up", "down", "left", "right" -> true
            else -> name.length == 1
        }
    }

    private fun sendDpKey(ic: android.view.inputmethod.InputConnection, keyCode: Int) {
        ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
        ic.sendKeyEvent(KeyEvent(KeyEvent.ACTION_UP, keyCode))
    }
}

