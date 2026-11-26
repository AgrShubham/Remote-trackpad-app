package com.agshubham.remotemousetv

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
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
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections

class MainActivity : AppCompatActivity() {

    private lateinit var statusBadge: TextView
    private lateinit var ipText: TextView
    private lateinit var portsText: TextView
    private lateinit var deviceModelText: TextView
    private lateinit var qrImageView: ImageView
    private lateinit var clientsListText: TextView

    private lateinit var metricPhonesVal: TextView
    private lateinit var metricUdpVal: TextView
    private lateinit var metricUptimeVal: TextView

    private lateinit var permAccessText: TextView
    private lateinit var permImeText: TextView
    private lateinit var permWifiText: TextView

    private lateinit var logConsoleText: TextView

    private lateinit var pauseBtn: Button
    private lateinit var toggleServerBtn: Button
    private lateinit var accessBtn: Button
    private lateinit var appInfoBtn: Button
    private lateinit var imeBtn: Button

    private val uiHandler = Handler(Looper.getMainLooper())
    private var permissionDialog: AlertDialog? = null
    private var hasPromptedOnLaunch = false
    private var lastQrUrl: String = ""

    private val refreshRunnable = object : Runnable {
        override fun run() {
            refreshStatus()
            uiHandler.postDelayed(this, 1000L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildTvDashboard()
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

    private fun isImeEnabled(): Boolean {
        return try {
            val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
            imm.enabledInputMethodList.any { it.packageName == packageName }
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
            .setPositiveButton("Open Accessibility Settings") { _, _ -> openAccessibilitySettings() }
            .setNeutralButton("Open App Info") { _, _ -> openAppInfoSettings() }
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

    private fun buildTvDashboard() {
        val scrollRoot = ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#07080B"))
            isFillViewport = true
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(44, 28, 44, 28)
        }

        // ================= HEADER BAR =================
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, 20)
        }

        val titleCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val titleRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val brandTitle = TextView(this).apply {
            text = "Remote Mouse & Gamepad Pro"
            textSize = 22f
            setTextColor(Color.WHITE)
            setTypeface(null, Typeface.BOLD)
        }

        val badgeTv = TextView(this).apply {
            text = "TV SERVER v1.5.0"
            textSize = 10.5f
            setTextColor(Color.parseColor("#14B8A6"))
            setTypeface(null, Typeface.BOLD)
            setPadding(12, 4, 12, 4)
            background = pillDrawable("#112927", "#14B8A6", 1)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { marginStart = 14 }
        }

        titleRow.addView(brandTitle)
        titleRow.addView(badgeTv)

        val subtitle = TextView(this).apply {
            text = "Zero-Lag Wi-Fi Touchpad, Keyboard, Gamepad & Media Receiver for Android TV"
            textSize = 12.5f
            setTextColor(Color.parseColor("#94A3B8"))
            setPadding(0, 4, 0, 0)
        }

        titleCol.addView(titleRow)
        titleCol.addView(subtitle)

        statusBadge = TextView(this).apply {
            textSize = 12.5f
            setTypeface(null, Typeface.BOLD)
            setPadding(18, 8, 18, 8)
        }

        header.addView(titleCol)
        header.addView(statusBadge)
        root.addView(header)

        // ================= 2-COLUMN BODY =================
        val columns = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        // ---------- LEFT COLUMN: PAIRING & CONNECTED PHONES ----------
        val leftCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.95f).apply {
                marginEnd = 18
            }
        }

        val pairingCard = cardContainer().apply {
            setPadding(24, 22, 24, 22)
        }

        val pairingHeader = sectionLabel("PAIRING & NETWORK")
        val qrRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 10, 0, 14)
        }

        qrImageView = ImageView(this).apply {
            layoutParams = LinearLayout.LayoutParams(140, 140).apply { marginEnd = 18 }
            background = GradientDrawable().apply {
                setColor(Color.WHITE)
                cornerRadius = 14f
            }
            setPadding(8, 8, 8, 8)
        }

        val netInfoCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        ipText = TextView(this).apply {
            textSize = 18f
            setTextColor(Color.parseColor("#2DD4BF"))
            setTypeface(null, Typeface.BOLD)
        }

        portsText = TextView(this).apply {
            textSize = 12f
            setTextColor(Color.parseColor("#CBD5E1"))
            setPadding(0, 6, 0, 6)
        }

        deviceModelText = TextView(this).apply {
            text = "TV Device: ${Build.MODEL ?: "Android TV"} (Android ${Build.VERSION.RELEASE})"
            textSize = 11.5f
            setTextColor(Color.parseColor("#64748B"))
        }

        netInfoCol.addView(ipText)
        netInfoCol.addView(portsText)
        netInfoCol.addView(deviceModelText)

        qrRow.addView(qrImageView)
        qrRow.addView(netInfoCol)

        pairingCard.addView(pairingHeader)
        pairingCard.addView(qrRow)
        leftCol.addView(pairingCard)

        val clientsCard = cardContainer().apply {
            setPadding(24, 18, 24, 18)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 14 }
        }
        clientsCard.addView(sectionLabel("CONNECTED PHONES"))
        clientsListText = TextView(this).apply {
            textSize = 12.5f
            setTextColor(Color.parseColor("#CBD5E1"))
            setPadding(0, 8, 0, 0)
            setLineSpacing(6f, 1f)
        }
        clientsCard.addView(clientsListText)
        leftCol.addView(clientsCard)

        // ---------- RIGHT COLUMN: TELEMETRY, PERMISSIONS, CONTROLS & LOGS ----------
        val rightCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.15f)
        }

        // Telemetry Metrics Row
        val metricsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val (c1, v1) = metricTile("CONNECTED")
        val (c2, v2) = metricTile("UDP MOTION")
        val (c3, v3) = metricTile("UPTIME")
        metricPhonesVal = v1
        metricUdpVal = v2
        metricUptimeVal = v3

        c1.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = 10 }
        c2.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = 10 }
        c3.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)

        metricsRow.addView(c1)
        metricsRow.addView(c2)
        metricsRow.addView(c3)
        rightCol.addView(metricsRow)

        // Permissions Checklist Card
        val permsCard = cardContainer().apply {
            setPadding(24, 18, 24, 18)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 14 }
        }
        permsCard.addView(sectionLabel("SYSTEM PERMISSIONS & ENGINE"))

        permAccessText = TextView(this).apply { textSize = 13f; setPadding(0, 8, 0, 4) }
        permImeText = TextView(this).apply { textSize = 13f; setPadding(0, 4, 0, 4) }
        permWifiText = TextView(this).apply { textSize = 13f; setPadding(0, 4, 0, 0) }

        permsCard.addView(permAccessText)
        permsCard.addView(permImeText)
        permsCard.addView(permWifiText)
        rightCol.addView(permsCard)

        // Live Activity Logs Card
        val logsCard = cardContainer().apply {
            setPadding(24, 16, 24, 16)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 14 }
        }
        logsCard.addView(sectionLabel("LIVE ACTIVITY LOG"))
        logConsoleText = TextView(this).apply {
            textSize = 11.5f
            typeface = Typeface.MONOSPACE
            setTextColor(Color.parseColor("#94A3B8"))
            setPadding(0, 8, 0, 0)
            setLineSpacing(4f, 1f)
        }
        logsCard.addView(logConsoleText)
        rightCol.addView(logsCard)

        columns.addView(leftCol)
        columns.addView(rightCol)
        root.addView(columns)

        // ================= BOTTOM ACTION BAR =================
        val btnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.START
            setPadding(0, 18, 0, 0)
        }

        pauseBtn = createTvButton("Pause Inputs", "#1E293B") {
            TvRemoteService.inputsPaused = !TvRemoteService.inputsPaused
            TvRemoteService.addLog(if (TvRemoteService.inputsPaused) "Inputs PAUSED by TV" else "Inputs RESUMED")
            refreshStatus()
        }

        toggleServerBtn = createTvButton("Stop Server", "#1E293B") {
            if (TvRemoteService.isRunning) {
                stopService(Intent(this, TvRemoteService::class.java))
            } else {
                startServerService()
            }
            refreshStatus()
        }.apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { marginStart = 12 }
        }

        accessBtn = createTvButton("Enable Accessibility", "#14B8A6", Color.parseColor("#071312")) {
            openAccessibilitySettings()
        }.apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { marginStart = 12 }
        }

        imeBtn = createTvButton("TV Keyboard Setup", "#2563EB") {
            try {
                startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
            } catch (_: Exception) {
                startActivity(Intent(Settings.ACTION_SETTINGS))
            }
        }.apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { marginStart = 12 }
        }

        appInfoBtn = createTvButton("App Info", "#334155") {
            openAppInfoSettings()
        }.apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { marginStart = 12 }
        }

        btnRow.addView(pauseBtn)
        btnRow.addView(toggleServerBtn)
        btnRow.addView(accessBtn)
        btnRow.addView(imeBtn)
        btnRow.addView(appInfoBtn)
        root.addView(btnRow)

        scrollRoot.addView(root)
        setContentView(scrollRoot)
    }

    private fun cardContainer(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#11141E"))
                cornerRadius = 20f
                setStroke(2, Color.parseColor("#1E293B"))
            }
        }
    }

    private fun sectionLabel(textValue: String): TextView {
        return TextView(this).apply {
            text = textValue
            textSize = 11f
            setTypeface(null, Typeface.BOLD)
            letterSpacing = 0.08f
            setTextColor(Color.parseColor("#64748B"))
        }
    }

    private fun metricTile(label: String): Pair<LinearLayout, TextView> {
        val box = cardContainer().apply {
            setPadding(18, 14, 18, 14)
        }
        val title = TextView(this).apply {
            text = label
            textSize = 10.5f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.parseColor("#64748B"))
        }
        val valView = TextView(this).apply {
            text = "0"
            textSize = 18f
            setTypeface(null, Typeface.BOLD)
            setTextColor(Color.WHITE)
            setPadding(0, 4, 0, 0)
        }
        box.addView(title)
        box.addView(valView)
        return Pair(box, valView)
    }

    private fun pillDrawable(bgHex: String, strokeHex: String, strokeWidth: Int): GradientDrawable {
        return GradientDrawable().apply {
            setColor(Color.parseColor(bgHex))
            cornerRadius = 999f
            setStroke(strokeWidth, Color.parseColor(strokeHex))
        }
    }

    private fun createTvButton(
        label: String,
        bgHex: String,
        textColor: Int = Color.WHITE,
        onClick: () -> Unit
    ): Button {
        return Button(this).apply {
            text = label
            textSize = 13f
            isAllCaps = false
            isFocusable = true
            isFocusableInTouchMode = true
            setTextColor(textColor)
            setPadding(26, 14, 26, 14)
            background = GradientDrawable().apply {
                setColor(Color.parseColor(bgHex))
                cornerRadius = 999f
            }
            setOnFocusChangeListener { v, hasFocus ->
                v.scaleX = if (hasFocus) 1.07f else 1.0f
                v.scaleY = if (hasFocus) 1.07f else 1.0f
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

    private fun updateQrBitmap(url: String) {
        if (url == lastQrUrl) return
        lastQrUrl = url
        try {
            val size = 240
            val matrix = QRCodeWriter().encode(url, BarcodeFormat.QR_CODE, size, size)
            val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
            for (x in 0 until size) {
                for (y in 0 until size) {
                    bmp.setPixel(x, y, if (matrix.get(x, y)) Color.BLACK else Color.WHITE)
                }
            }
            qrImageView.setImageBitmap(bmp)
        } catch (_: Exception) {
        }
    }

    private fun refreshStatus() {
        val lanIp = getFirstLanIp() ?: "No Wi-Fi IP"
        val url = "http://$lanIp:5000"
        ipText.text = "$lanIp:5000"
        portsText.text = "Discovery: UDP 5001  •  Motion: UDP 5002\nAuto-Discovered as '${Build.MODEL} (TV)'"
        if (lanIp != "No Wi-Fi IP") {
            updateQrBitmap(url)
        }

        val running = TvRemoteService.isRunning
        val paused = TvRemoteService.inputsPaused
        if (!running) {
            statusBadge.text = "○ STOPPED"
            statusBadge.setTextColor(Color.parseColor("#F87171"))
            statusBadge.background = pillDrawable("#2A1215", "#EF4444", 2)
        } else if (paused) {
            statusBadge.text = "⏸ INPUTS PAUSED"
            statusBadge.setTextColor(Color.parseColor("#FBBF24"))
            statusBadge.background = pillDrawable("#2A200E", "#F59E0B", 2)
        } else {
            statusBadge.text = "● ONLINE • ZERO-LAG"
            statusBadge.setTextColor(Color.parseColor("#4ADE80"))
            statusBadge.background = pillDrawable("#0F291E", "#10B981", 2)
        }

        toggleServerBtn.text = if (running) "Stop Server" else "Start Server"
        pauseBtn.text = if (paused) "Resume Inputs" else "Pause Inputs"

        val sessions = TvRemoteService.clientSessions.values.toList()
        metricPhonesVal.text = "${sessions.size}"
        metricUdpVal.text = "${TvRemoteService.udpRatePerSec}/s  (${TvRemoteService.udpPackets})"

        val uptimeSec = if (running && TvRemoteService.serverStartedAtMs > 0) {
            ((System.currentTimeMillis() - TvRemoteService.serverStartedAtMs) / 1000L).coerceAtLeast(0L)
        } else 0L
        val mins = uptimeSec / 60
        val secs = uptimeSec % 60
        metricUptimeVal.text = String.format("%02d:%02d", mins, secs)

        if (sessions.isEmpty()) {
            clientsListText.text = "Waiting for Remote Mouse Pro on your phone...\nOpen the phone app on the same Wi-Fi to auto-connect."
        } else {
            val now = System.currentTimeMillis()
            clientsListText.text = sessions.joinToString("\n") { s ->
                val dur = ((now - s.connectedAtMs) / 1000L).coerceAtLeast(0L)
                "● ${s.ip}  •  Connected ${dur}s  •  ${s.packets} ctrl events"
            }
        }

        val accessOk = isAccessibilityEnabledInSettings()
        if (accessOk) {
            permAccessText.text = "✔ Accessibility Control: ENABLED (Cursor, Clicks & Scroll ready)"
            permAccessText.setTextColor(Color.parseColor("#4ADE80"))
            accessBtn.visibility = View.GONE
            appInfoBtn.visibility = View.GONE
            permissionDialog?.dismiss()
            permissionDialog = null
        } else {
            permAccessText.text = "⚠ Accessibility Control: REQUIRED — Select 'Enable Accessibility' below"
            permAccessText.setTextColor(Color.parseColor("#FBBF24"))
            accessBtn.visibility = View.VISIBLE
            appInfoBtn.visibility = View.VISIBLE
        }

        val imeOk = isImeEnabled()
        if (imeOk) {
            permImeText.text = "✔ TV Keyboard (IME): ENABLED (Works in YouTube, Netflix & Search)"
            permImeText.setTextColor(Color.parseColor("#4ADE80"))
        } else {
            permImeText.text = "ℹ TV Keyboard (IME): Optional — Enable for YouTube/App typing"
            permImeText.setTextColor(Color.parseColor("#93C5FD"))
        }

        permWifiText.text = if (running) {
            "✔ Wi-Fi High-Perf Lock & Engine.IO v4 Heartbeat: ACTIVE"
        } else {
            "○ Wi-Fi Engine: Stopped"
        }
        permWifiText.setTextColor(Color.parseColor(if (running) "#4ADE80" else "#64748B"))

        val logs = TvRemoteService.recentLogs.take(5)
        logConsoleText.text = if (logs.isEmpty()) "No events yet." else logs.joinToString("\n")
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
