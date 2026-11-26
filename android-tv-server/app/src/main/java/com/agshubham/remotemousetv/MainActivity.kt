package com.agshubham.remotemousetv

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections

class MainActivity : AppCompatActivity() {

    private lateinit var serverStatusText: TextView
    private lateinit var accessStatusText: TextView
    private lateinit var ipText: TextView
    private lateinit var clientsText: TextView
    private lateinit var toggleServerBtn: Button
    private lateinit var accessBtn: Button
    private lateinit var appInfoBtn: Button

    private val uiHandler = Handler(Looper.getMainLooper())
    private var permissionDialog: AlertDialog? = null
    private var hasPromptedOnLaunch = false

    private val refreshRunnable = object : Runnable {
        override fun run() {
            refreshStatus()
            uiHandler.postDelayed(this, 1000L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildTvUi()
        requestRuntimePermissions()
        startServerService()
    }

    override fun onResume() {
        super.onResume()
        TvRemoteService.onStatusChanged = { runOnUiThread { refreshStatus() } }
        uiHandler.removeCallbacks(refreshRunnable)
        uiHandler.post(refreshRunnable)
        checkAndPromptMissingPermissions()
    }

    override fun onPause() {
        super.onPause()
        TvRemoteService.onStatusChanged = null
        uiHandler.removeCallbacks(refreshRunnable)
    }

    private fun requestRuntimePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    1001
                )
            }
        }
    }

    private fun isAccessibilityEnabledInSettings(): Boolean {
        if (TvAccessibilityService.isRunning()) return true
        return try {
            val expected = "${packageName}/${TvAccessibilityService::class.java.name}"
            val enabled = Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false
            val splitter = TextUtils.SimpleStringSplitter(':')
            splitter.setString(enabled)
            while (splitter.hasNext()) {
                val component = splitter.next()
                if (component.equals(expected, ignoreCase = true) ||
                    component.contains("TvAccessibilityService", ignoreCase = true)
                ) {
                    return true
                }
            }
            false
        } catch (_: Exception) {
            false
        }
    }

    private fun checkAndPromptMissingPermissions() {
        if (isAccessibilityEnabledInSettings()) {
            permissionDialog?.dismiss()
            permissionDialog = null
            return
        }

        if (!hasPromptedOnLaunch) {
            hasPromptedOnLaunch = true
            uiHandler.postDelayed({ showAccessibilityWizard() }, 350L)
        }
    }

    private fun showAccessibilityWizard() {
        if (isFinishing || isDestroyed || isAccessibilityEnabledInSettings()) return
        permissionDialog?.dismiss()

        permissionDialog = AlertDialog.Builder(this)
            .setTitle("Enable TV Remote Control")
            .setMessage(
                "To draw the mouse cursor, click, scroll, and type on your TV, Android requires enabling 'Remote Mouse TV Control' in Accessibility Settings.\n\n" +
                    "1. Select 'Open Accessibility Settings'\n" +
                    "2. Go to Services -> Remote Mouse TV Control -> ON\n\n" +
                    "Tip (Android 13+): If the toggle is greyed out, select 'Open App Info' first and enable 'Allow restricted settings'."
            )
            .setCancelable(true)
            .setPositiveButton("Open Accessibility Settings") { _, _ ->
                openAccessibilitySettings()
            }
            .setNeutralButton("Open App Info") { _, _ ->
                openAppInfoSettings()
            }
            .setNegativeButton("Later", null)
            .show()
    }

    private fun openAccessibilitySettings() {
        try {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        } catch (_: Exception) {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    private fun openAppInfoSettings() {
        try {
            startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.fromParts("package", packageName, null)
                }
            )
        } catch (_: Exception) {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    private fun buildTvUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#07080B"))
            setPadding(72, 48, 72, 48)
        }

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 40, 48, 40)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#12141F"))
                cornerRadius = 28f
                setStroke(2, Color.parseColor("#1E293B"))
            }
        }

        val title = TextView(this).apply {
            text = "Remote Mouse & Gamepad Pro — TV Server"
            textSize = 26f
            setTextColor(Color.WHITE)
            setTypeface(null, android.graphics.Typeface.BOLD)
        }

        val subtitle = TextView(this).apply {
            text = "Control your Android TV wirelessly from your phone over Wi-Fi (TCP 5000 / UDP 5002)"
            textSize = 14f
            setTextColor(Color.parseColor("#94A3B8"))
            setPadding(0, 8, 0, 24)
        }

        ipText = TextView(this).apply {
            textSize = 20f
            setTextColor(Color.parseColor("#14B8A6"))
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, 14)
        }

        serverStatusText = TextView(this).apply {
            textSize = 15f
            setTextColor(Color.WHITE)
            setPadding(0, 0, 0, 8)
        }

        clientsText = TextView(this).apply {
            textSize = 14f
            setTextColor(Color.parseColor("#94A3B8"))
            setPadding(0, 0, 0, 8)
        }

        accessStatusText = TextView(this).apply {
            textSize = 15f
            setPadding(0, 0, 0, 24)
        }

        val btnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.START
        }

        toggleServerBtn = createTvButton("Stop Server", "#1E293B") {
            if (TvRemoteService.isRunning) {
                stopService(Intent(this, TvRemoteService::class.java))
            } else {
                startServerService()
            }
            refreshStatus()
        }

        accessBtn = createTvButton("Enable Remote Control Permission", "#14B8A6", Color.parseColor("#071312")) {
            openAccessibilitySettings()
        }.apply {
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                marginStart = 16
            }
            layoutParams = lp
        }

        appInfoBtn = createTvButton("App Info (Restricted Settings)", "#334155") {
            openAppInfoSettings()
        }.apply {
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                marginStart = 16
            }
            layoutParams = lp
        }

        btnRow.addView(toggleServerBtn)
        btnRow.addView(accessBtn)
        btnRow.addView(appInfoBtn)

        card.addView(title)
        card.addView(subtitle)
        card.addView(ipText)
        card.addView(serverStatusText)
        card.addView(clientsText)
        card.addView(accessStatusText)
        card.addView(btnRow)

        root.addView(card)
        setContentView(root)
    }

    private fun createTvButton(
        label: String,
        bgHex: String,
        textColor: Int = Color.WHITE,
        onClick: () -> Unit
    ): Button {
        return Button(this).apply {
            text = label
            textSize = 13.5f
            isAllCaps = false
            isFocusable = true
            isFocusableInTouchMode = true
            setTextColor(textColor)
            setPadding(30, 16, 30, 16)
            background = GradientDrawable().apply {
                setColor(Color.parseColor(bgHex))
                cornerRadius = 999f
            }
            setOnFocusChangeListener { v, hasFocus ->
                v.scaleX = if (hasFocus) 1.06f else 1.0f
                v.scaleY = if (hasFocus) 1.06f else 1.0f
            }
            setOnClickListener { onClick() }
        }
    }

    private fun startServerService() {
        val intent = Intent(this, TvRemoteService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun refreshStatus() {
        val lanIp = getFirstLanIp() ?: "No Wi-Fi IP detected"
        ipText.text = "TV Address: $lanIp:5000  •  UDP 5002"

        val running = TvRemoteService.isRunning
        serverStatusText.text = if (running) {
            "Server Status:  ● ACTIVE (Broadcasting Auto-Discovery on UDP 5001)"
        } else {
            "Server Status:  ○ STOPPED"
        }
        toggleServerBtn.text = if (running) "Stop Server" else "Start Server"

        clientsText.text = "Connected Phones: ${TvRemoteService.connectedClients}  •  UDP Packets: ${TvRemoteService.udpPackets}"

        val accessOk = isAccessibilityEnabledInSettings()
        if (accessOk) {
            accessStatusText.text = "Accessibility Control:  ✔ ENABLED (Cursor, Clicks, Scroll & Keys Ready)"
            accessStatusText.setTextColor(Color.parseColor("#4ADE80"))
            accessBtn.visibility = View.GONE
            appInfoBtn.visibility = View.GONE
            permissionDialog?.dismiss()
            permissionDialog = null
        } else {
            accessStatusText.text = "Accessibility Control:  ⚠ REQUIRED — Enable 'Remote Mouse TV Control' in TV Settings"
            accessStatusText.setTextColor(Color.parseColor("#FBBF24"))
            accessBtn.visibility = View.VISIBLE
            appInfoBtn.visibility = View.VISIBLE
        }
    }

    private fun getFirstLanIp(): String? {
        try {
            for (ni in Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp || ni.isLoopback) continue
                for (addr in Collections.list(ni.inetAddresses)) {
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        val host = addr.hostAddress ?: continue
                        if (!host.startsWith("169.254.")) return host
                    }
                }
            }
        } catch (_: Exception) {
        }
        return null
    }
}
