package com.agshubham.remotemousetv

import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildTvUi()
        startServerService()
    }

    override fun onResume() {
        super.onResume()
        TvRemoteService.onStatusChanged = { runOnUiThread { refreshStatus() } }
        refreshStatus()
    }

    override fun onPause() {
        super.onPause()
        TvRemoteService.onStatusChanged = null
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
            setPadding(0, 8, 0, 28)
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
            setPadding(0, 0, 0, 28)
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
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }.apply {
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                marginStart = 20
            }
            layoutParams = lp
        }

        btnRow.addView(toggleServerBtn)
        btnRow.addView(accessBtn)

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
            textSize = 14f
            isAllCaps = false
            isFocusable = true
            isFocusableInTouchMode = true
            setTextColor(textColor)
            setPadding(34, 18, 34, 18)
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

        val accessOk = TvAccessibilityService.isRunning()
        if (accessOk) {
            accessStatusText.text = "Accessibility Control:  ✔ ENABLED (Cursor, Clicks, Scroll & Keys Ready)"
            accessStatusText.setTextColor(Color.parseColor("#4ADE80"))
            accessBtn.visibility = View.GONE
        } else {
            accessStatusText.text = "Accessibility Control:  ⚠ REQUIRED — Enable 'Remote Mouse TV Control' in TV Settings"
            accessStatusText.setTextColor(Color.parseColor("#FBBF24"))
            accessBtn.visibility = View.VISIBLE
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

