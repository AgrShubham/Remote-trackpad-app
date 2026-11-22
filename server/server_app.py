# ==============================================================================
# Remote Mouse & Gamepad Pro - Dedicated Windows Host Server & System Tray App
# ==============================================================================
import sys
import os

# If invoked as background worker, execute pure server without GUI imports
if "--worker" in sys.argv:
    from server import start_server_worker
    start_server_worker()
    sys.exit(0)

# ==============================================================================
# GUI & System Tray Host (Runs without gevent monkey-patching for native Win32 loops)
# ==============================================================================
import subprocess
import atexit
import socket
import threading
import time
import ctypes
import webbrowser
import winreg
import json
import urllib.request

from PIL import Image, ImageDraw, ImageTk
import pystray
import qrcode
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

# Resolve base path whether running as script or PyInstaller frozen bundle
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
    APP_EXE_PATH = sys.executable
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    APP_EXE_PATH = os.path.abspath(__file__)

TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# ----------------- Single Instance Named Mutex ----------------- #
mutex_handle = None

def acquire_single_instance_mutex():
    global mutex_handle
    if sys.platform == "win32":
        try:
            ERROR_ALREADY_EXISTS = 183
            mutex_name = "Global\\RemoteMouseProServer_SingleInstanceMutex"
            mutex_handle = ctypes.windll.kernel32.CreateMutexW(None, False, mutex_name)
            if ctypes.windll.kernel32.GetLastError() == ERROR_ALREADY_EXISTS:
                return False
        except Exception:
            pass
    return True

# ----------------- Subprocess Worker Management ----------------- #
worker_proc = None
watchdog_active = True

def kill_port_process(port=5000):
    """Find and kill any stale process holding the given TCP port."""
    if sys.platform != "win32":
        return
    try:
        res = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
        my_pid = os.getpid()
        killed = []
        for line in res.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.strip().split()
                if len(parts) >= 5:
                    pid = int(parts[-1])
                    if pid != my_pid and pid > 0 and pid not in killed:
                        subprocess.run(["taskkill", "/F", "/PID", str(pid)], capture_output=True)
                        killed.append(pid)
    except Exception as e:
        print("Error freeing port:", e)

def start_worker_process():
    global worker_proc
    kill_port_process(5000)
    time.sleep(0.3)

    if getattr(sys, 'frozen', False):
        cmd = [sys.executable, "--worker"]
    else:
        cmd = [sys.executable, os.path.abspath(__file__), "--worker"]

    creationflags = 0x08000000 if sys.platform == "win32" else 0  # CREATE_NO_WINDOW
    try:
        worker_proc = subprocess.Popen(cmd, creationflags=creationflags)
    except Exception as e:
        print("Failed to spawn background server worker:", e)

def watchdog_loop():
    """Background watchdog that restarts the server worker if it ever exits unexpectedly."""
    global worker_proc, watchdog_active
    while watchdog_active:
        time.sleep(3.0)
        if not watchdog_active:
            break
        if worker_proc is not None and worker_proc.poll() is not None:
            print("Background server worker exited unexpectedly. Auto-restarting...", flush=True)
            start_worker_process()

def cleanup_worker():
    global worker_proc, watchdog_active
    watchdog_active = False
    if worker_proc and worker_proc.poll() is None:
        try:
            worker_proc.terminate()
            worker_proc.wait(timeout=2)
        except Exception:
            try:
                worker_proc.kill()
            except Exception:
                pass
        worker_proc = None

atexit.register(cleanup_worker)

# ----------------- Network Helper ----------------- #
def get_all_lan_ips():
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        if ip and not ip.startswith("127."):
            ips.append(ip)
        s.close()
    except Exception:
        pass

    try:
        hostname = socket.gethostname()
        _, _, host_ips = socket.gethostbyname_ex(hostname)
        for hip in host_ips:
            if not hip.startswith("127.") and not hip.startswith("169.254.") and hip not in ips:
                ips.append(hip)
    except Exception:
        pass

    if not ips:
        ips.append("127.0.0.1")
    return ips

def get_lan_ip():
    ips = get_all_lan_ips()
    return ips[0] if ips else "127.0.0.1"

# ----------------- IPC REST Helpers ----------------- #
def api_get(endpoint):
    try:
        url = f"http://127.0.0.1:5000{endpoint}"
        req = urllib.request.Request(url, headers={"User-Agent": "RemoteMouseServerGUI"})
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None

def api_post(endpoint, payload=None):
    try:
        url = f"http://127.0.0.1:5000{endpoint}"
        data = json.dumps(payload or {}).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", "User-Agent": "RemoteMouseServerGUI"})
        with urllib.request.urlopen(req, timeout=0.8) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None

# ----------------- Windows Startup Registry Helper ----------------- #
REG_RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
REG_APP_NAME = "RemoteMouseProServer"

def is_auto_start_enabled():
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_RUN_KEY, 0, winreg.KEY_READ) as key:
            val, _ = winreg.QueryValueEx(key, REG_APP_NAME)
            return bool(val)
    except Exception:
        return False

def set_auto_start(enabled: bool):
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            if enabled:
                cmd = f'"{APP_EXE_PATH}"'
                winreg.SetValueEx(key, REG_APP_NAME, 0, winreg.REG_SZ, cmd)
            else:
                try:
                    winreg.DeleteValue(key, REG_APP_NAME)
                except FileNotFoundError:
                    pass
        return True
    except Exception as e:
        print("Failed to update auto start registry:", e)
        return False

# ----------------- Tray Icon Generator ----------------- #
def create_tray_icon_image(paused=False):
    """Generate a clean 64x64 icon for the system tray."""
    img = Image.new("RGBA", (64, 64), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    body_outline = "#ef4444" if paused else "#3b82f6"
    dot_color = "#ef4444" if paused else "#4ade80"

    # Rounded trackpad body
    draw.rounded_rectangle([6, 8, 58, 56], radius=12, fill="#12141c", outline=body_outline, width=3)
    # Top divider
    draw.line([6, 26, 58, 26], fill="#26293a", width=2)
    # Center mouse dividing line
    draw.line([32, 8, 32, 26], fill=body_outline, width=2)
    # Status center dot
    draw.ellipse([28, 38, 36, 46], fill=dot_color)
    return img

# ==============================================================================
# Modernized Control Dashboard GUI
# ==============================================================================
class ControlDashboard:
    def __init__(self, lan_ip, port=5000):
        self.lan_ip = lan_ip
        self.port = port
        self.selected_ip = lan_ip
        self.root = None
        self.active_tab = "overview"
        self.is_paused = False
        self.known_client_count = 0
        self.known_client_ips = set()
        self.poll_active = True
        self.qr_photo = None

    def show(self):
        if self.root is not None:
            try:
                self.root.deiconify()
                self.root.lift()
                self.root.focus_force()
                return
            except Exception:
                self.root = None

        self.root = tk.Tk()
        self.root.title("Remote Mouse & Gamepad Pro - Host Server")
        self.root.geometry("540x690")
        self.root.minsize(500, 640)
        self.root.configure(bg="#0c0d14")

        # 1. Modern Top Header & Master Pause Bar
        self.create_header()

        # 2. Modern Segmented Tab Buttons
        self.create_tabs_navigation()

        # 3. Content Frame Holding Tab Views
        self.content_frame = tk.Frame(self.root, bg="#0c0d14")
        self.content_frame.pack(fill="both", expand=True, padx=16, pady=8)

        # Tab Frames
        self.tab_overview = tk.Frame(self.content_frame, bg="#0c0d14")
        self.tab_clients = tk.Frame(self.content_frame, bg="#0c0d14")
        self.tab_network = tk.Frame(self.content_frame, bg="#0c0d14")
        self.tab_settings = tk.Frame(self.content_frame, bg="#0c0d14")

        # Build each tab view
        self.build_overview_tab()
        self.build_clients_tab()
        self.build_network_tab()
        self.build_settings_tab()

        # Display default tab
        self.switch_tab("overview")

        # Bottom Action Bar
        self.create_bottom_bar()

        # Start periodic telemetry polling
        self.poll_telemetry()

        # Window Close Hook -> Hide to Tray
        self.root.protocol("WM_DELETE_WINDOW", self.hide)
        self.root.mainloop()

    # ----------------- UI Builders ----------------- #
    def create_header(self):
        self.header_frame = tk.Frame(self.root, bg="#12141c", pady=12, padx=16)
        self.header_frame.pack(fill="x")

        # Left Title Column
        left_col = tk.Frame(self.header_frame, bg="#12141c")
        left_col.pack(side="left")

        title_row = tk.Frame(left_col, bg="#12141c")
        title_row.pack(anchor="w")

        self.dot_canvas = tk.Canvas(title_row, width=10, height=10, bg="#12141c", highlightthickness=0)
        self.status_dot = self.dot_canvas.create_oval(1, 1, 9, 9, fill="#4ade80", outline="#22c55e")
        self.dot_canvas.pack(side="left", padx=(0, 6))

        lbl_app_name = tk.Label(title_row, text="Remote Trackpad Pro Server", fg="#f8fafc", bg="#12141c", font=("Segoe UI", 12, "bold"))
        lbl_app_name.pack(side="left")

        self.lbl_server_status = tk.Label(left_col, text="Active & Broadcasting on Local Network", fg="#94a3b8", bg="#12141c", font=("Segoe UI", 9))
        self.lbl_server_status.pack(anchor="w", pady=(2, 0))

        # Right Master Pause Button
        self.btn_master_pause = tk.Button(
            self.header_frame,
            text="⏸️ Pause Inputs",
            bg="#1c1f2e",
            fg="#93c5fd",
            activebackground="#262b3f",
            activeforeground="#ffffff",
            font=("Segoe UI", 9, "bold"),
            relief="flat",
            padx=12,
            pady=6,
            cursor="hand2",
            command=self.toggle_master_pause
        )
        self.btn_master_pause.pack(side="right")

    def create_tabs_navigation(self):
        nav_frame = tk.Frame(self.root, bg="#0c0d14", pady=6, padx=16)
        nav_frame.pack(fill="x")

        self.tab_buttons = {}
        tabs = [
            ("overview", "Overview"),
            ("clients", "Devices (0)"),
            ("network", "Adapters"),
            ("settings", "Settings & Logs"),
        ]

        for tab_id, label in tabs:
            btn = tk.Button(
                nav_frame,
                text=label,
                bg="#161824",
                fg="#94a3b8",
                activebackground="#1e2234",
                activeforeground="#ffffff",
                font=("Segoe UI", 9, "bold"),
                relief="flat",
                padx=14,
                pady=5,
                cursor="hand2",
                command=lambda t=tab_id: self.switch_tab(t)
            )
            btn.pack(side="left", padx=(0, 6))
            self.tab_buttons[tab_id] = btn

    def switch_tab(self, tab_id):
        self.active_tab = tab_id
        for tid, btn in self.tab_buttons.items():
            if tid == tab_id:
                btn.configure(bg="#2563eb", fg="#ffffff")
            else:
                btn.configure(bg="#161824", fg="#94a3b8")

        for frame in [self.tab_overview, self.tab_clients, self.tab_network, self.tab_settings]:
            frame.pack_forget()

        if tab_id == "overview":
            self.tab_overview.pack(fill="both", expand=True)
        elif tab_id == "clients":
            self.tab_clients.pack(fill="both", expand=True)
        elif tab_id == "network":
            self.tab_network.pack(fill="both", expand=True)
        elif tab_id == "settings":
            self.tab_settings.pack(fill="both", expand=True)

    # ----------------- Tab 1: Overview ----------------- #
    def build_overview_tab(self):
        # 1. Telemetry Stats Bar
        stats_frame = tk.Frame(self.tab_overview, bg="#12141c", padx=12, pady=10, relief="flat", highlightthickness=1, highlightbackground="#222534")
        stats_frame.pack(fill="x", pady=(0, 10))

        self.lbl_telemetry_clients = tk.Label(stats_frame, text="📱 Connected: 0", fg="#4ade80", bg="#12141c", font=("Segoe UI", 9, "bold"))
        self.lbl_telemetry_clients.pack(side="left", padx=8)

        self.lbl_telemetry_rate = tk.Label(stats_frame, text="⚡ 0 pkts/sec", fg="#60a5fa", bg="#12141c", font=("Segoe UI", 9, "bold"))
        self.lbl_telemetry_rate.pack(side="left", padx=8)

        lbl_telemetry_ports = tk.Label(stats_frame, text="🎯 UDP 5002 • WS 5000", fg="#94a3b8", bg="#12141c", font=("Segoe UI", 9))
        lbl_telemetry_ports.pack(side="right", padx=8)

        # 2. Main QR Code Card
        qr_card = tk.Frame(self.tab_overview, bg="#141724", padx=16, pady=14, relief="flat", highlightthickness=1, highlightbackground="#262a3e")
        qr_card.pack(fill="both", expand=True)

        lbl_qr_title = tk.Label(qr_card, text="Scan with Phone Camera to Pair Instantly", fg="#f8fafc", bg="#141724", font=("Segoe UI", 10, "bold"))
        lbl_qr_title.pack(pady=(0, 6))

        self.qr_label = tk.Label(qr_card, bg="#ffffff", relief="flat")
        self.qr_label.pack(pady=4)

        self.render_qr(self.selected_ip)

        # Pairing URL Display & Copy
        url_row = tk.Frame(qr_card, bg="#141724")
        url_row.pack(pady=(8, 2))

        self.lbl_pairing_url = tk.Label(url_row, text=f"http://{self.selected_ip}:{self.port}", fg="#60a5fa", bg="#141724", font=("Consolas", 10, "bold"), cursor="hand2")
        self.lbl_pairing_url.pack(side="left", padx=(0, 8))
        self.lbl_pairing_url.bind("<Button-1>", lambda e: self.copy_ip_to_clipboard())

        btn_copy = tk.Button(
            url_row,
            text="📋 Copy IP",
            bg="#1e2234",
            fg="#cbd5e1",
            activebackground="#2a3048",
            activeforeground="#ffffff",
            font=("Segoe UI", 8, "bold"),
            relief="flat",
            padx=8,
            pady=3,
            cursor="hand2",
            command=self.copy_ip_to_clipboard
        )
        btn_copy.pack(side="left")

        self.lbl_copy_toast = tk.Label(qr_card, text="", fg="#4ade80", bg="#141724", font=("Segoe UI", 8))
        self.lbl_copy_toast.pack(pady=(2, 0))

    def render_qr(self, ip):
        pair_url = f"http://{ip}:{self.port}"
        qr = qrcode.QRCode(box_size=4, border=1)
        qr.add_data(pair_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="#0c0d14", back_color="#ffffff")
        self.qr_photo = ImageTk.PhotoImage(qr_img)
        self.qr_label.configure(image=self.qr_photo)
        if hasattr(self, 'lbl_pairing_url'):
            self.lbl_pairing_url.configure(text=pair_url)

    def copy_ip_to_clipboard(self):
        pair_url = f"http://{self.selected_ip}:{self.port}"
        self.root.clipboard_clear()
        self.root.clipboard_append(pair_url)
        self.lbl_copy_toast.configure(text="✔ Copied connection URL to clipboard!")
        self.root.after(2500, lambda: self.lbl_copy_toast.configure(text=""))

    # ----------------- Tab 2: Connected Devices ----------------- #
    def build_clients_tab(self):
        header_row = tk.Frame(self.tab_clients, bg="#12141c", padx=12, pady=8)
        header_row.pack(fill="x", pady=(0, 8))

        lbl_info = tk.Label(header_row, text="Active Phone & Tablet Connections", fg="#f8fafc", bg="#12141c", font=("Segoe UI", 9, "bold"))
        lbl_info.pack(side="left")

        # Scrollable Clients Container
        self.clients_container = tk.Frame(self.tab_clients, bg="#0c0d14")
        self.clients_container.pack(fill="both", expand=True)

        self.render_clients_list([])

    def render_clients_list(self, clients):
        for widget in self.clients_container.winfo_children():
            widget.destroy()

        if not clients:
            empty_box = tk.Frame(self.clients_container, bg="#12141c", padx=20, pady=30, highlightthickness=1, highlightbackground="#222534")
            empty_box.pack(fill="x", pady=20)
            tk.Label(empty_box, text="📱 No Devices Currently Connected", fg="#e2e8f0", bg="#12141c", font=("Segoe UI", 11, "bold")).pack(pady=(0, 4))
            tk.Label(empty_box, text="Open Remote Trackpad Pro on your phone to connect automatically,\nor scan the QR code on the Overview tab.", fg="#64748b", bg="#12141c", font=("Segoe UI", 9), justify="center").pack()
            return

        for c in clients:
            item = tk.Frame(self.clients_container, bg="#141724", padx=14, pady=10, relief="flat", highlightthickness=1, highlightbackground="#262b3e")
            item.pack(fill="x", pady=4)

            left = tk.Frame(item, bg="#141724")
            left.pack(side="left")

            tk.Label(left, text=f"📱 {c.get('ip', 'Unknown')}", fg="#ffffff", bg="#141724", font=("Segoe UI", 10, "bold")).pack(anchor="w")
            dur = c.get("connected_seconds", 0)
            mins, secs = divmod(dur, 60)
            time_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
            tk.Label(left, text=f"Duration: {time_str} • Packets: {c.get('packets', 0)}", fg="#94a3b8", bg="#141724", font=("Segoe UI", 8)).pack(anchor="w")

            btn_kick = tk.Button(
                item,
                text="Disconnect ✖",
                bg="#261b22",
                fg="#f87171",
                activebackground="#3e1b24",
                activeforeground="#ffffff",
                font=("Segoe UI", 8, "bold"),
                relief="flat",
                padx=8,
                pady=4,
                cursor="hand2",
                command=lambda sid=c.get("sid"): self.kick_client(sid)
            )
            btn_kick.pack(side="right")

    def kick_client(self, sid):
        if sid:
            api_post("/api/kick", {"sid": sid})

    # ----------------- Tab 3: Network Adapters ----------------- #
    def build_network_tab(self):
        lbl_head = tk.Label(self.tab_network, text="Local Network Interfaces (Multi-Adapter Engine)", fg="#f8fafc", bg="#0c0d14", font=("Segoe UI", 10, "bold"))
        lbl_head.pack(anchor="w", pady=(0, 8))

        self.adapters_container = tk.Frame(self.tab_network, bg="#0c0d14")
        self.adapters_container.pack(fill="x", pady=(0, 12))

        self.render_adapters_list()

        # Ports Health Card
        ports_card = tk.Frame(self.tab_network, bg="#12141c", padx=14, pady=12, highlightthickness=1, highlightbackground="#222534")
        ports_card.pack(fill="x")

        tk.Label(ports_card, text="Engine Port Status", fg="#e2e8f0", bg="#12141c", font=("Segoe UI", 9, "bold")).pack(anchor="w", pady=(0, 6))

        ports_data = [
            ("TCP 5000", "WebSocket & HTTP Server", "ACTIVE (Auto-Linked)"),
            ("UDP 5001", "LAN Discovery Auto-Beacon", "BROADCASTING (1.0s)"),
            ("UDP 5002", "Ultra-Low Latency Motion Pipeline", "<1ms HARDWARE LINK"),
        ]

        for p_name, p_desc, p_status in ports_data:
            p_row = tk.Frame(ports_card, bg="#12141c")
            p_row.pack(fill="x", pady=2)
            tk.Label(p_row, text=f"{p_name}: {p_desc}", fg="#94a3b8", bg="#12141c", font=("Segoe UI", 8)).pack(side="left")
            tk.Label(p_row, text=p_status, fg="#4ade80", bg="#12141c", font=("Segoe UI", 8, "bold")).pack(side="right")

    def render_adapters_list(self):
        for widget in self.adapters_container.winfo_children():
            widget.destroy()

        ips = get_all_lan_ips()
        for ip in ips:
            card = tk.Frame(self.adapters_container, bg="#141724", padx=12, pady=10, highlightthickness=1, highlightbackground="#262b3e")
            card.pack(fill="x", pady=3)

            is_selected = (ip == self.selected_ip)
            adapter_type = "Windows Mobile Hotspot" if ip.startswith("192.168.137.") else "Wi-Fi / Ethernet Adapter"

            left = tk.Frame(card, bg="#141724")
            left.pack(side="left")

            tk.Label(left, text=f"🌐 {ip}", fg="#ffffff", bg="#141724", font=("Segoe UI", 10, "bold")).pack(anchor="w")
            tk.Label(left, text=adapter_type, fg="#94a3b8", bg="#141724", font=("Segoe UI", 8)).pack(anchor="w")

            if is_selected:
                tk.Label(card, text="✔ Active for QR", fg="#4ade80", bg="#141724", font=("Segoe UI", 8, "bold")).pack(side="right")
            else:
                btn_select = tk.Button(
                    card,
                    text="Use for QR ➔",
                    bg="#1e2234",
                    fg="#93c5fd",
                    activebackground="#2a3048",
                    font=("Segoe UI", 8, "bold"),
                    relief="flat",
                    padx=8,
                    pady=3,
                    cursor="hand2",
                    command=lambda target_ip=ip: self.select_adapter(target_ip)
                )
                btn_select.pack(side="right")

    def select_adapter(self, ip):
        self.selected_ip = ip
        self.render_qr(ip)
        self.render_adapters_list()

    # ----------------- Tab 4: Settings & Diagnostic Logs ----------------- #
    def build_settings_tab(self):
        settings_box = tk.Frame(self.tab_settings, bg="#12141c", padx=14, pady=10, highlightthickness=1, highlightbackground="#222534")
        settings_box.pack(fill="x", pady=(0, 10))

        self.auto_start_var = tk.BooleanVar(value=is_auto_start_enabled())
        chk_autostart = tk.Checkbutton(
            settings_box,
            text="Start Remote Mouse Server on Windows Boot",
            variable=self.auto_start_var,
            command=self.toggle_autostart,
            bg="#12141c",
            fg="#e2e8f0",
            selectcolor="#1a1c28",
            activebackground="#12141c",
            activeforeground="#ffffff",
            font=("Segoe UI", 9)
        )
        chk_autostart.pack(anchor="w", pady=4)

        # Embedded Diagnostic Log Console
        log_header = tk.Frame(self.tab_settings, bg="#0c0d14")
        log_header.pack(fill="x", pady=(6, 4))

        tk.Label(log_header, text="DIAGNOSTIC LOG CONSOLE", fg="#64748b", bg="#0c0d14", font=("Segoe UI", 8, "bold")).pack(side="left")

        btn_copy_log = tk.Button(
            log_header,
            text="Copy Log",
            bg="#161824",
            fg="#94a3b8",
            font=("Segoe UI", 8),
            relief="flat",
            padx=6,
            pady=2,
            cursor="hand2",
            command=self.copy_logs
        )
        btn_copy_log.pack(side="right")

        self.log_text = scrolledtext.ScrolledText(
            self.tab_settings,
            bg="#07080b",
            fg="#cbd5e1",
            insertbackground="#ffffff",
            font=("Consolas", 8),
            height=13,
            relief="flat",
            highlightthickness=1,
            highlightbackground="#1e2234"
        )
        self.log_text.pack(fill="both", expand=True)

    def append_log(self, time_str, level, msg):
        if hasattr(self, 'log_text'):
            self.log_text.insert(tk.END, f"[{time_str}] [{level:^10}] {msg}\n")
            self.log_text.see(tk.END)

    def copy_logs(self):
        if hasattr(self, 'log_text'):
            content = self.log_text.get("1.0", tk.END)
            self.root.clipboard_clear()
            self.root.clipboard_append(content)

    # ----------------- Bottom Action Bar ----------------- #
    def create_bottom_bar(self):
        bottom_bar = tk.Frame(self.root, bg="#0c0d14", padx=16, pady=8)
        bottom_bar.pack(fill="x")

        btn_browser = tk.Button(
            bottom_bar,
            text="🌐 Open Web Trackpad in Browser",
            bg="#2563eb",
            fg="#ffffff",
            font=("Segoe UI", 9, "bold"),
            relief="flat",
            padx=12,
            pady=7,
            cursor="hand2",
            command=lambda: webbrowser.open(f"http://{self.selected_ip}:{self.port}")
        )
        btn_browser.pack(side="left", expand=True, fill="x", padx=(0, 4))

        btn_hide = tk.Button(
            bottom_bar,
            text="Hide to Tray",
            bg="#1c1f2e",
            fg="#cbd5e1",
            font=("Segoe UI", 9),
            relief="flat",
            padx=12,
            pady=7,
            cursor="hand2",
            command=self.hide
        )
        btn_hide.pack(side="right", expand=True, fill="x", padx=(4, 0))

    # ----------------- Telemetry Poller & Master Switch ----------------- #
    def poll_telemetry(self):
        if not self.root:
            return

        try:
            status = api_get("/api/status")
            if status:
                # 1. Update Master Pause state
                is_paused = status.get("inputs_paused", False)
                self.set_pause_ui_state(is_paused)

                # 2. Update telemetry labels
                client_count = status.get("client_count", 0)
                rate = status.get("packet_stats", {}).get("rate_per_sec", 0)

                self.lbl_telemetry_clients.configure(text=f"📱 Connected: {client_count}")
                self.lbl_telemetry_rate.configure(text=f"⚡ {rate} pkts/s")
                self.tab_buttons["clients"].configure(text=f"Devices ({client_count})")

                # 3. Check for new client connect -> Windows Toast Notification
                clients = status.get("clients", [])
                current_ips = {c.get("ip") for c in clients if c.get("ip")}
                new_ips = current_ips - self.known_client_ips
                if new_ips and tray_icon:
                    for nip in new_ips:
                        try:
                            tray_icon.notify(f"📱 Remote device connected from {nip}", "Remote Mouse Pro")
                        except Exception:
                            pass

                self.known_client_ips = current_ips
                self.known_client_count = client_count

                # Update tray tooltip
                if tray_icon:
                    try:
                        tray_icon.title = f"Remote Mouse Pro: {client_count} device{'s' if client_count != 1 else ''} connected"
                    except Exception:
                        pass

                # If on clients tab, refresh client list
                if self.active_tab == "clients":
                    self.render_clients_list(clients)

                # Append any new logs
                logs = status.get("logs", [])
                if hasattr(self, 'log_text') and logs:
                    current_len = int(self.log_text.index('end-1c').split('.')[0])
                    if current_len <= len(logs) + 1:
                        self.log_text.delete("1.0", tk.END)
                        for l in logs:
                            self.append_log(l.get("time", ""), l.get("level", "INFO"), l.get("msg", ""))
        except Exception:
            pass

        # Schedule next poll in 1.0 second
        if self.poll_active and self.root:
            self.root.after(1000, self.poll_telemetry)

    def set_pause_ui_state(self, paused: bool):
        self.is_paused = paused
        if paused:
            self.dot_canvas.itemconfig(self.status_dot, fill="#fbbf24", outline="#f59e0b")
            self.lbl_server_status.configure(text="Remote Inputs PAUSED (Hardware Freeze Active)", fg="#fbbf24")
            self.btn_master_pause.configure(text="▶️ Resume Inputs", bg="#7f1d1d", fg="#fecaca", activebackground="#991b1b")
        else:
            self.dot_canvas.itemconfig(self.status_dot, fill="#4ade80", outline="#22c55e")
            self.lbl_server_status.configure(text="Active & Broadcasting on Local Network", fg="#94a3b8")
            self.btn_master_pause.configure(text="⏸️ Pause Inputs", bg="#1c1f2e", fg="#93c5fd", activebackground="#262b3f")

    def toggle_master_pause(self):
        api_post("/api/pause", {"paused": not self.is_paused})
        self.set_pause_ui_state(not self.is_paused)

    def toggle_autostart(self):
        enabled = self.auto_start_var.get()
        success = set_auto_start(enabled)
        if not success:
            messagebox.showerror("Error", "Could not update Windows Startup registry.")
            self.auto_start_var.set(not enabled)

    def hide(self):
        if self.root:
            self.root.withdraw()


# ==============================================================================
# System Tray Host
# ==============================================================================
dashboard = None
tray_icon = None

def on_tray_open(icon, item):
    global dashboard
    if dashboard:
        threading.Thread(target=dashboard.show, daemon=True).start()

def on_tray_web(icon, item):
    ip = get_lan_ip()
    webbrowser.open(f"http://{ip}:5000")

def on_tray_pause_toggle(icon, item):
    api_post("/api/pause")

def on_tray_autostart_toggle(icon, item):
    new_state = not is_auto_start_enabled()
    set_auto_start(new_state)

def on_tray_exit(icon, item):
    global tray_icon
    cleanup_worker()
    if tray_icon:
        tray_icon.stop()
    os._exit(0)

def setup_system_tray(lan_ip, port=5000):
    global tray_icon
    icon_image = create_tray_icon_image()

    menu = pystray.Menu(
        pystray.MenuItem("Remote Mouse Pro (Server Active)", None, enabled=False),
        pystray.MenuItem(f"Host IP: {lan_ip}:{port}", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Open Control Dashboard", on_tray_open, default=True),
        pystray.MenuItem("Open Web Trackpad in Browser", on_tray_web),
        pystray.MenuItem("Pause / Resume Remote Inputs", on_tray_pause_toggle),
        pystray.MenuItem(
            "Start on Windows Boot",
            on_tray_autostart_toggle,
            checked=lambda item: is_auto_start_enabled()
        ),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Exit Server", on_tray_exit)
    )

    tray_icon = pystray.Icon("RemoteMousePro", icon_image, "Remote Mouse & Gamepad Pro", menu)
    tray_icon.run()

# ----------------- Main Launcher ----------------- #
def main():
    global dashboard

    # 1. Enforce Single-Instance Mutex
    if not acquire_single_instance_mutex():
        root = tk.Tk()
        root.withdraw()
        messagebox.showinfo(
            "Remote Mouse Server",
            "Remote Mouse Server is already running in your Windows System Tray (near the taskbar clock)."
        )
        sys.exit(0)

    lan_ip = get_lan_ip()
    port = 5000

    # 2. Spawn isolated background server worker (Pure Gevent, Zero GUI interference)
    start_worker_process()

    # 3. Start background watchdog to auto-restart worker if ever terminated
    threading.Thread(target=watchdog_loop, daemon=True).start()

    dashboard = ControlDashboard(lan_ip, port)

    # 4. If run by user double-click, pop up the dashboard initially
    threading.Thread(target=dashboard.show, daemon=True).start()

    # 5. Run System Tray on main thread
    setup_system_tray(lan_ip, port)

if __name__ == "__main__":
    main()
