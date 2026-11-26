package com.agshubham.remotemousetv

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
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
import java.util.Collections
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

class TvRemoteService : Service() {

    companion object {
        const val CHANNEL_ID = "remote_mouse_tv_channel"
        const val TCP_PORT = 5000
        const val BEACON_PORT = 5001
        const val UDP_INPUT_PORT = 5002

        @Volatile
        var isRunning = false
            private set

        @Volatile
        var connectedClients = 0
            private set

        @Volatile
        var udpPackets = 0L
            private set

        var onStatusChanged: (() -> Unit)? = null
    }

    private val activeFlag = AtomicBoolean(false)
    private var wsServer: SocketIoWsServer? = null
    private var udpInputSocket: DatagramSocket? = null
    private var beaconThread: Thread? = null
    private var udpThread: Thread? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(101, buildNotification())
        if (activeFlag.compareAndSet(false, true)) {
            isRunning = true
            startSocketIoServer()
            startUdpInputServer()
            startDiscoveryBeacon()
            onStatusChanged?.invoke()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        activeFlag.set(false)
        isRunning = false
        connectedClients = 0
        try { wsServer?.stop(500) } catch (_: Exception) {}
        try { udpInputSocket?.close() } catch (_: Exception) {}
        beaconThread?.interrupt()
        udpThread?.interrupt()
        onStatusChanged?.invoke()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startSocketIoServer() {
        val server = SocketIoWsServer(InetSocketAddress(TCP_PORT))
        server.isReuseAddr = true
        server.start()
        wsServer = server
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
                            put("version", "1.4.0")
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
        private val sids = ConcurrentHashMap<WebSocket, String>()

        override fun onOpen(conn: WebSocket, handshake: ClientHandshake?) {
            val sid = UUID.randomUUID().toString().replace("-", "").take(16)
            sids[conn] = sid
            // Engine.IO v4 OPEN packet
            val openJson = JSONObject().apply {
                put("sid", sid)
                put("upgrades", JSONArray())
                put("pingInterval", 25000)
                put("pingTimeout", 20000)
                put("maxPayload", 1000000)
            }
            conn.send("0$openJson")
            connectedClients = sids.size
            onStatusChanged?.invoke()
        }

        override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) {
            sids.remove(conn)
            connectedClients = sids.size
            onStatusChanged?.invoke()
        }

        override fun onMessage(conn: WebSocket, message: String) {
            if (message == "2") {
                conn.send("3")
                return
            }
            if (message == "3") return

            // Socket.IO CONNECT ('40' or '40{...}')
            if (message.startsWith("40")) {
                val sid = sids[conn] ?: "tv"
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
            val svc = TvAccessibilityService.instance
            when (event) {
                "ping_check" -> {
                    if (ackId.isNotEmpty()) {
                        conn.send("43$ackId[]")
                    }
                }
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

