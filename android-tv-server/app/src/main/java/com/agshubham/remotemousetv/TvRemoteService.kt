package com.agshubham.remotemousetv

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONArray
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.text.SimpleDateFormat
import java.util.Collections
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean

class TvRemoteService : Service() {

    data class ClientSession(
        val sid: String,
        val ip: String,
        val connectedAtMs: Long,
        var packets: Long = 0L
    )

    companion object {
        const val CHANNEL_ID = "remote_mouse_tv_channel"
        const val TCP_PORT = 5000
        const val BEACON_PORT = 5001
        const val UDP_INPUT_PORT = 5002

        @Volatile
        var isRunning = false
            private set

        @Volatile
        var inputsPaused = false

        @Volatile
        var connectedClients = 0
            private set

        @Volatile
        var udpPackets = 0L
            private set

        @Volatile
        var udpRatePerSec = 0L
            private set

        @Volatile
        var serverStartedAtMs = 0L
            private set

        val clientSessions = ConcurrentHashMap<WebSocket, ClientSession>()
        val recentLogs = CopyOnWriteArrayList<String>()

        var onStatusChanged: (() -> Unit)? = null

        fun addLog(msg: String) {
            val ts = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
            recentLogs.add(0, "[$ts] $msg")
            while (recentLogs.size > 12) {
                recentLogs.removeAt(recentLogs.size - 1)
            }
        }
    }

    private val activeFlag = AtomicBoolean(false)
    private var wsServer: SocketIoWsServer? = null
    private var udpInputSocket: DatagramSocket? = null
    private var beaconThread: Thread? = null
    private var udpThread: Thread? = null
    private var heartbeatThread: Thread? = null

    private var wifiLock: WifiManager.WifiLock? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(101, buildNotification())
        if (activeFlag.compareAndSet(false, true)) {
            isRunning = true
            serverStartedAtMs = System.currentTimeMillis()
            acquireLocks()
            addLog("TV Server started on TCP $TCP_PORT / UDP $UDP_INPUT_PORT")
            startSocketIoServer()
            startUdpInputServer()
            startDiscoveryBeacon()
            startHeartbeatLoop()
            onStatusChanged?.invoke()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        activeFlag.set(false)
        isRunning = false
        connectedClients = 0
        clientSessions.clear()
        releaseLocks()
        try { wsServer?.stop(500) } catch (_: Exception) {}
        try { udpInputSocket?.close() } catch (_: Exception) {}
        beaconThread?.interrupt()
        udpThread?.interrupt()
        heartbeatThread?.interrupt()
        addLog("TV Server stopped")
        onStatusChanged?.invoke()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    @Suppress("DEPRECATION")
    private fun acquireLocks() {
        try {
            val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "RemoteMouseTV:WifiLock").apply {
                setReferenceCounted(false)
                acquire()
            }
        } catch (_: Exception) {}

        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "RemoteMouseTV:WakeLock").apply {
                setReferenceCounted(false)
                acquire(12 * 60 * 60 * 1000L)
            }
        } catch (_: Exception) {}
    }

    private fun releaseLocks() {
        try {
            if (wifiLock?.isHeld == true) wifiLock?.release()
        } catch (_: Exception) {}
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {}
    }

    private fun startSocketIoServer() {
        val server = SocketIoWsServer(InetSocketAddress(TCP_PORT)).apply {
            isReuseAddr = true
            connectionLostTimeout = 0 // Managed explicitly by Engine.IO v4 ping/pong
        }
        server.start()
        wsServer = server
    }

    /**
     * Engine.IO v4 requires the SERVER to initiate '2' (ping) every pingInterval.
     * Without this, socket.io-client@4.8.1 disconnects after pingInterval + pingTimeout (~45s)!
     */
    private fun startHeartbeatLoop() {
        heartbeatThread = Thread {
            var lastUdpSnapshot = udpPackets
            var tick = 0
            while (activeFlag.get()) {
                try {
                    Thread.sleep(1000)
                    tick++

                    // Compute 1s UDP packet rate
                    val currentUdp = udpPackets
                    udpRatePerSec = (currentUdp - lastUdpSnapshot).coerceAtLeast(0L)
                    lastUdpSnapshot = currentUdp

                    // Send Engine.IO v4 server ping ('2') every 15 seconds
                    if (tick % 15 == 0) {
                        for (conn in clientSessions.keys) {
                            if (conn.isOpen) {
                                try {
                                    conn.send("2")
                                } catch (_: Exception) {}
                            }
                        }
                    }
                } catch (_: InterruptedException) {
                    break
                } catch (_: Exception) {
                }
            }
        }.apply {
            isDaemon = true
            start()
        }
    }

    private fun startUdpInputServer() {
        udpThread = Thread {
            try {
                val sock = DatagramSocket(null).apply {
                    reuseAddress = true
                    bind(InetSocketAddress(UDP_INPUT_PORT))
                }
                udpInputSocket = sock
                val buf = ByteArray(256)
                while (activeFlag.get()) {
                    val pkt = DatagramPacket(buf, buf.size)
                    sock.receive(pkt)
                    val msg = String(pkt.data, 0, pkt.length, Charsets.UTF_8).trim()
                    val parts = msg.split(" ")
                    if (parts.size >= 3) {
                        udpPackets++
                        if (inputsPaused) continue
                        val dx = parts[1].toFloatOrNull() ?: 0f
                        val dy = parts[2].toFloatOrNull() ?: 0f
                        val svc = TvAccessibilityService.instance
                        if (parts[0] == "M") {
                            svc?.moveCursor(dx, dy)
                        } else if (parts[0] == "S") {
                            svc?.scrollAtCursor(dx, dy)
                        }
                    }
                }
            } catch (_: Exception) {
            }
        }.apply {
            isDaemon = true
            start()
        }
    }

    private fun startDiscoveryBeacon() {
        beaconThread = Thread {
            var sock: DatagramSocket? = null
            try {
                sock = DatagramSocket().apply { broadcast = true }
                val tvName = Build.MODEL ?: "Android TV"
                while (activeFlag.get()) {
                    val ips = getAllLanIps()
                    for (ip in ips) {
                        val payload = JSONObject().apply {
                            put("app", "RemoteTrackpadPro")
                            put("name", "$tvName (TV)")
                            put("ip", ip)
                            put("all_ips", JSONArray(ips))
                            put("port", TCP_PORT)
                            put("udp_port", UDP_INPUT_PORT)
                            put("version", "1.5.0")
                        }.toString().toByteArray(Charsets.UTF_8)

                        try {
                            sock.send(
                                DatagramPacket(
                                    payload,
                                    payload.size,
                                    InetAddress.getByName("255.255.255.255"),
                                    BEACON_PORT
                                )
                            )
                        } catch (_: Exception) {
                        }

                        val segs = ip.split(".")
                        if (segs.size == 4 && !ip.startsWith("127.")) {
                            val bcast = "${segs[0]}.${segs[1]}.${segs[2]}.255"
                            try {
                                sock.send(
                                    DatagramPacket(
                                        payload,
                                        payload.size,
                                        InetAddress.getByName(bcast),
                                        BEACON_PORT
                                    )
                                )
                            } catch (_: Exception) {
                            }
                        }
                    }
                    Thread.sleep(2000)
                }
            } catch (_: Exception) {
            } finally {
                try { sock?.close() } catch (_: Exception) {}
            }
        }.apply {
            isDaemon = true
            start()
        }
    }

    private fun getAllLanIps(): List<String> {
        val list = mutableListOf<String>()
        try {
            for (ni in Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp || ni.isLoopback) continue
                for (addr in Collections.list(ni.inetAddresses)) {
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        val host = addr.hostAddress ?: continue
                        if (!host.startsWith("169.254.") && host !in list) {
                            list.add(host)
                        }
                    }
                }
            }
        } catch (_: Exception) {
        }
        return list
    }

    private inner class SocketIoWsServer(address: InetSocketAddress) : WebSocketServer(address) {
        override fun onOpen(conn: WebSocket, handshake: ClientHandshake?) {
            val sid = UUID.randomUUID().toString().replace("-", "").take(16)
            val remoteIp = conn.remoteSocketAddress?.address?.hostAddress ?: "Unknown"
            clientSessions[conn] = ClientSession(sid, remoteIp, System.currentTimeMillis())
            connectedClients = clientSessions.size

            // Engine.IO v4 OPEN packet
            val openJson = JSONObject().apply {
                put("sid", sid)
                put("upgrades", JSONArray())
                put("pingInterval", 25000)
                put("pingTimeout", 20000)
                put("maxPayload", 1000000)
            }
            conn.send("0$openJson")
            addLog("Phone connected ($remoteIp)")
            onStatusChanged?.invoke()
        }

        override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) {
            val session = clientSessions.remove(conn)
            connectedClients = clientSessions.size
            if (session != null) {
                addLog("Phone disconnected (${session.ip})")
            }
            onStatusChanged?.invoke()
        }

        override fun onMessage(conn: WebSocket, message: String) {
            if (message == "2") {
                conn.send("3")
                return
            }
            if (message == "3") {
                // Client pong response to server Engine.IO ping
                return
            }

            // Socket.IO CONNECT ('40' or '40{...}')
            if (message.startsWith("40")) {
                val sid = clientSessions[conn]?.sid ?: "tv"
                conn.send("40{\"sid\":\"$sid\"}")
                return
            }

            // Socket.IO EVENT ('42["event", ...]' or '42<ackId>["event", ...]')
            if (message.startsWith("42")) {
                val body = message.substring(2)
                val bracketIdx = body.indexOf('[')
                if (bracketIdx < 0) return
                val ackId = body.substring(0, bracketIdx).trim()
                val jsonStr = body.substring(bracketIdx)

                try {
                    val arr = JSONArray(jsonStr)
                    val event = arr.optString(0)
                    val payload = arr.optJSONObject(1) ?: JSONObject()
                    clientSessions[conn]?.let { it.packets++ }
                    handleSocketEvent(conn, event, payload, ackId)
                } catch (_: Exception) {
                }
            }
        }

        override fun onError(conn: WebSocket?, ex: Exception?) {}
        override fun onStart() {}

        private fun handleSocketEvent(
            conn: WebSocket,
            event: String,
            data: JSONObject,
            ackId: String
        ) {
            if (event == "ping_check") {
                if (ackId.isNotEmpty()) {
                    conn.send("43$ackId[]")
                }
                return
            }

            if (inputsPaused) return

            val svc = TvAccessibilityService.instance
            when (event) {
                "move" -> {
                    svc?.moveCursor(
                        data.optDouble("dx", 0.0).toFloat(),
                        data.optDouble("dy", 0.0).toFloat()
                    )
                }
                "click", "mouse_up" -> {
                    svc?.clickAtCursor(data.optString("button", "left"))
                }
                "scroll" -> {
                    svc?.scrollAtCursor(
                        data.optDouble("dx", 0.0).toFloat(),
                        data.optDouble("dy", 0.0).toFloat()
                    )
                }
                "text" -> {
                    val t = data.optString("text", "")
                    if (t.isNotEmpty()) svc?.injectText(t)
                }
                "key" -> {
                    val name = data.optString("name", "")
                    val action = data.optString("action", "tap")
                    if (name.isNotEmpty()) svc?.handleKey(name, action)
                }
                "gamepad_button_down" -> {
                    val code = data.optString("code", "")
                    if (code.isNotEmpty()) svc?.handleKey(code, "press")
                }
                "gamepad_button_up" -> {
                    val code = data.optString("code", "")
                    if (code.isNotEmpty()) svc?.handleKey(code, "release")
                }
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(
                CHANNEL_ID,
                "Remote Mouse TV Server",
                NotificationManager.IMPORTANCE_LOW
            )
            mgr.createNotificationChannel(ch)
        }
    }

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Remote Mouse TV Server Active")
            .setContentText("Listening on TCP 5000 & UDP 5002")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .build()
    }
}
