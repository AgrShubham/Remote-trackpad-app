# ==============================================================================
# Remote Mouse & Gamepad Pro - Dedicated Windows Host Server & System Tray App
# ==============================================================================
from gevent import monkey
monkey.patch_all()

import sys
import os
import socket
import threading
import json
import time
import ctypes
import webbrowser
import winreg

from PIL import Image, ImageDraw, ImageTk
import pystray
import qrcode
from flask import Flask, render_template, send_from_directory
from flask_socketio import SocketIO
from pynput.mouse import Controller as MouseController, Button
from pynput.keyboard import Controller as KeyboardController, Key
import tkinter as tk
from tkinter import ttk, messagebox

# Resolve base path whether running as script or PyInstaller frozen bundle
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
    APP_EXE_PATH = sys.executable
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    APP_EXE_PATH = os.path.abspath(__file__)

TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(__name__, template_folder=TEMPLATES_DIR, static_folder=STATIC_DIR)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")

mouse = MouseController()
keyboard = KeyboardController()

# Track connected mobile clients
connected_clients = set()
server_running = True

# Key mappings
KEY_MAP = {
    "enter": Key.enter,
    "backspace": Key.backspace,
    "tab": Key.tab,
    "esc": Key.esc,
    "space": Key.space,
    "shift": Key.shift,
    "shift_l": Key.shift_l,
    "shift_r": Key.shift_r,
    "ctrl": Key.ctrl,
    "ctrl_l": Key.ctrl_l,
    "ctrl_r": Key.ctrl_r,
    "alt": Key.alt,
    "alt_l": Key.alt_l,
    "alt_r": Key.alt_r,
    "caps_lock": Key.caps_lock,
    "cmd": Key.cmd,
    "up": Key.up,
    "down": Key.down,
    "left": Key.left,
    "right": Key.right,
    "delete": Key.delete,
    "insert": Key.insert,
    "home": Key.home,
    "end": Key.end,
    "page_up": Key.page_up,
    "page_down": Key.page_down,
    "print_screen": Key.print_screen,
    "scroll_lock": Key.scroll_lock,
    "pause": Key.pause,
    "f1": Key.f1,
    "f2": Key.f2,
    "f3": Key.f3,
    "f4": Key.f4,
    "f5": Key.f5,
    "f6": Key.f6,
    "f7": Key.f7,
    "f8": Key.f8,
    "f9": Key.f9,
    "f10": Key.f10,
    "f11": Key.f11,
    "f12": Key.f12,
    "media_play_pause": Key.media_play_pause,
    "media_next": Key.media_next,
    "media_previous": Key.media_previous,
    "media_volume_up": Key.media_volume_up,
    "media_volume_down": Key.media_volume_down,
    "media_volume_mute": Key.media_volume_mute,
}

@app.route("/")
def index():
    if os.path.exists(os.path.join(TEMPLATES_DIR, "index.html")):
        return render_template("index.html")
    return "<h1>Remote Mouse Pro Server is Active</h1><p>Connect using the mobile app.</p>"

# ----------------- Windows Kernel Input Injection (Zero-Lag) ----------------- #
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_HWHEEL = 0x1000

user32 = None
if sys.platform == "win32":
    try:
        user32 = ctypes.windll.user32
    except Exception:
        pass

# SendInput structures for ultra-low latency hardware injection
if user32:
    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [
            ("dx", ctypes.c_long),
            ("dy", ctypes.c_long),
            ("mouseData", ctypes.c_ulong),
            ("dwFlags", ctypes.c_ulong),
            ("time", ctypes.c_ulong),
            ("dwExtraInfo", ctypes.c_void_p),
        ]

    class INPUT_UNION(ctypes.Union):
        _fields_ = [("mi", MOUSEINPUT)]

    class INPUT(ctypes.Structure):
        _fields_ = [
            ("type", ctypes.c_ulong),
            ("u", INPUT_UNION),
        ]

    INPUT_MOUSE = 0


_desktop_attached = threading.local()

def ensure_desktop():
    if getattr(_desktop_attached, "attached", False):
        return
    if sys.platform == "win32" and user32:
        try:
            hdesk = user32.OpenInputDesktop(0, False, 0x01FF)
            if hdesk:
                user32.SetThreadDesktop(hdesk)
                user32.CloseDesktop(hdesk)
                _desktop_attached.attached = True
        except Exception:
            pass

def native_mouse_move(dx, dy):
    ensure_desktop()
    if user32:
        try:
            inp = INPUT()
            inp.type = INPUT_MOUSE
            inp.u.mi.dx = int(dx)
            inp.u.mi.dy = int(dy)
            inp.u.mi.mouseData = 0
            inp.u.mi.dwFlags = MOUSEEVENTF_MOVE
            inp.u.mi.time = 0
            inp.u.mi.dwExtraInfo = None
            if user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT)) == 1:
                return
        except Exception:
            pass
        try:
            user32.mouse_event(MOUSEEVENTF_MOVE, int(dx), int(dy), 0, 0)
            return
        except Exception:
            pass
    try:
        mouse.move(int(dx), int(dy))
    except Exception:
        pass

def native_mouse_click(button="left", count=1):
    ensure_desktop()
    if user32:
        try:
            down_flag = MOUSEEVENTF_LEFTDOWN if button == "left" else MOUSEEVENTF_RIGHTDOWN if button == "right" else MOUSEEVENTF_MIDDLEDOWN
            up_flag = MOUSEEVENTF_LEFTUP if button == "left" else MOUSEEVENTF_RIGHTUP if button == "right" else MOUSEEVENTF_MIDDLEUP
            for _ in range(count):
                user32.mouse_event(down_flag, 0, 0, 0, 0)
                user32.mouse_event(up_flag, 0, 0, 0, 0)
            return
        except Exception:
            pass
    try:
        btn = Button.right if button == "right" else Button.middle if button == "middle" else Button.left
        mouse.click(btn, count)
    except Exception:
        pass

def native_mouse_down(button="left"):
    ensure_desktop()
    if user32:
        try:
            flag = MOUSEEVENTF_LEFTDOWN if button == "left" else MOUSEEVENTF_RIGHTDOWN if button == "right" else MOUSEEVENTF_MIDDLEDOWN
            user32.mouse_event(flag, 0, 0, 0, 0)
            return
        except Exception:
            pass
    try:
        btn = Button.right if button == "right" else Button.middle if button == "middle" else Button.left
        mouse.press(btn)
    except Exception:
        pass

def native_mouse_up(button="left"):
    ensure_desktop()
    if user32:
        try:
            flag = MOUSEEVENTF_LEFTUP if button == "left" else MOUSEEVENTF_RIGHTUP if button == "right" else MOUSEEVENTF_MIDDLEUP
            user32.mouse_event(flag, 0, 0, 0, 0)
            return
        except Exception:
            pass
    try:
        btn = Button.right if button == "right" else Button.middle if button == "middle" else Button.left
        mouse.release(btn)
    except Exception:
        pass

def native_mouse_scroll(dx, dy):
    ensure_desktop()
    if user32:
        try:
            if dy != 0:
                user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, int(dy * 20), 0)
            if dx != 0:
                user32.mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, int(dx * 20), 0)
            return
        except Exception:
            pass
    try:
        mouse.scroll(int(dx), int(dy))
    except Exception:
        pass


# Subpixel precision accumulators with balanced rounding (eliminates deadzone & stickiness)
subpixel_x = 0.0
subpixel_y = 0.0

def process_mouse_delta(raw_dx, raw_dy):
    global subpixel_x, subpixel_y
    total_x = raw_dx + subpixel_x
    total_y = raw_dy + subpixel_y

    step_x = int(round(total_x)) if abs(total_x) >= 0.5 else 0
    step_y = int(round(total_y)) if abs(total_y) >= 0.5 else 0

    subpixel_x = total_x - step_x
    subpixel_y = total_y - step_y

    if step_x != 0 or step_y != 0:
        native_mouse_move(step_x, step_y)


# ----------------- Ultra-Low Latency UDP Input Server (Port 5002) ----------------- #
def run_udp_input_server(port=5002):
    """
    Dedicated high-priority UDP socket server for ultra-low latency motion streaming.
    Bypasses Gevent, HTTP, and WebSocket layers entirely for <1ms transit.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    except Exception:
        pass

    try:
        sock.bind(("0.0.0.0", port))
        print(f"  * UDP Motion Engine: Active on port {port} (<1ms direct hardware pipeline)", flush=True)
    except Exception as e:
        print(f"  * Warning: Failed to bind UDP Motion Engine on port {port}: {e}", flush=True)
        return

    while True:
        try:
            data, _ = sock.recvfrom(256)
            if not data:
                continue
            msg = data.decode("utf-8", errors="ignore").strip()
            parts = msg.split()
            if not parts:
                continue
            cmd = parts[0]
            if cmd == "M" and len(parts) >= 3:
                dx = float(parts[1])
                dy = float(parts[2])
                process_mouse_delta(dx, dy)
            elif cmd == "S" and len(parts) >= 3:
                dx = float(parts[1])
                dy = float(parts[2])
                native_mouse_scroll(dx, dy)
        except Exception:
            pass


# ----------------- SocketIO Event Handlers ----------------- #
@socketio.on("connect")
def handle_connect():
    from flask import request
    sid = request.sid
    connected_clients.add(sid)
    print(f">>> [CLIENT CONNECTED] {sid} | Total Active: {len(connected_clients)}")

@socketio.on("disconnect")
def handle_disconnect():
    from flask import request
    sid = request.sid
    connected_clients.discard(sid)
    print(f"<<< [CLIENT DISCONNECTED] {sid} | Total Active: {len(connected_clients)}")

@socketio.on("ping_check")
def handle_ping_check():
    return True

@socketio.on("move")
def handle_move(data):
    try:
        dx = float(data.get("dx", 0))
        dy = float(data.get("dy", 0))
        process_mouse_delta(dx, dy)
    except Exception:
        pass

@socketio.on("click")
def handle_click(data):
    try:
        btn = data.get("button", "left")
        cnt = int(data.get("count", 1))
        native_mouse_click(btn, cnt)
    except Exception:
        pass

@socketio.on("mouse_down")
def handle_mouse_down(data):
    try:
        btn = data.get("button", "left")
        native_mouse_down(btn)
    except Exception:
        pass

@socketio.on("mouse_up")
def handle_mouse_up(data):
    try:
        btn = data.get("button", "left")
        native_mouse_up(btn)
    except Exception:
        pass

@socketio.on("scroll")
def handle_scroll(data):
    try:
        dx = float(data.get("dx", 0))
        dy = float(data.get("dy", 0))
        native_mouse_scroll(dx, dy)
    except Exception:
        pass

@socketio.on("text")
def handle_text(data):
    try:
        text = data.get("text", "")
        if text:
            keyboard.type(text)
    except Exception:
        pass

@socketio.on("key")
def handle_key(data):
    try:
        name = data.get("key")
        if not name:
            return
        name_str = str(name)
        key = KEY_MAP.get(name_str.lower())
        if not key:
            if len(name_str) == 1:
                key = name_str
            else:
                return
        action = data.get("action", "tap")
        if action == "press":
            keyboard.press(key)
        elif action == "release":
            keyboard.release(key)
        else:
            keyboard.press(key)
            keyboard.release(key)
    except Exception:
        pass

# Gamepad handlers
def resolve_gamepad_input(code):
    if not code:
        return None, None
    code_lower = str(code).lower()
    if code_lower in ("mouse_left", "left_click", "mouse1"):
        return "mouse", Button.left
    if code_lower in ("mouse_right", "right_click", "mouse2"):
        return "mouse", Button.right
    if code_lower in ("mouse_middle", "middle_click", "mouse3"):
        return "mouse", Button.middle
    special_keys = {
        "space": Key.space, "shift": Key.shift, "ctrl": Key.ctrl, "alt": Key.alt,
        "tab": Key.tab, "esc": Key.esc, "enter": Key.enter, "up": Key.up,
        "down": Key.down, "left": Key.left, "right": Key.right, "backspace": Key.backspace,
        "caps_lock": Key.caps_lock, "delete": Key.delete, "page_up": Key.page_up,
        "page_down": Key.page_down, "home": Key.home, "end": Key.end,
        "f1": Key.f1, "f2": Key.f2, "f3": Key.f3, "f4": Key.f4, "f5": Key.f5, "f6": Key.f6,
    }
    if code_lower in special_keys:
        return "key", special_keys[code_lower]
    if len(code) == 1:
        return "key", code.lower()
    return None, None

held_gamepad_keys = set()
current_stick_keys = set()

@socketio.on("gamepad_button_down")
def handle_gamepad_button_down(data):
    try:
        in_type, resolved = resolve_gamepad_input(data.get("input"))
        if in_type == "key":
            keyboard.press(resolved)
            held_gamepad_keys.add(resolved)
        elif in_type == "mouse":
            btn = "right" if resolved == Button.right else "left"
            native_mouse_down(btn)
    except Exception:
        pass

@socketio.on("gamepad_button_up")
def handle_gamepad_button_up(data):
    try:
        in_type, resolved = resolve_gamepad_input(data.get("input"))
        if in_type == "key":
            keyboard.release(resolved)
            held_gamepad_keys.discard(resolved)
        elif in_type == "mouse":
            btn = "right" if resolved == Button.right else "left"
            native_mouse_up(btn)
    except Exception:
        pass

@socketio.on("gamepad_stick_sync")
def handle_gamepad_stick_sync(data):
    global current_stick_keys
    try:
        desired_keys = set(data.get("keys", []))
        to_release = current_stick_keys - desired_keys
        to_press = desired_keys - current_stick_keys
        for k_str in to_release:
            _, resolved = resolve_gamepad_input(k_str)
            if resolved:
                try:
                    keyboard.release(resolved)
                except Exception:
                    pass
        for k_str in to_press:
            _, resolved = resolve_gamepad_input(k_str)
            if resolved:
                try:
                    keyboard.press(resolved)
                except Exception:
                    pass
        current_stick_keys = desired_keys
    except Exception:
        pass

@socketio.on("gamepad_release_all")
def handle_gamepad_release_all():
    global current_stick_keys
    try:
        for k in current_stick_keys:
            _, resolved = resolve_gamepad_input(k)
            if resolved:
                try:
                    keyboard.release(resolved)
                except Exception:
                    pass
        current_stick_keys.clear()
        for k in list(held_gamepad_keys):
            try:
                keyboard.release(k)
            except Exception:
                pass
        held_gamepad_keys.clear()
        native_mouse_up("left")
        native_mouse_up("right")
    except Exception:
        pass

# ----------------- Network Helpers & UDP Discovery Beacon ----------------- #
def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def run_udp_discovery_beacon(lan_ip, port=5000, beacon_port=5001, udp_input_port=5002):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    payload = json.dumps({
        "app": "RemoteTrackpadPro",
        "name": socket.gethostname(),
        "ip": lan_ip,
        "port": port,
        "udp_port": udp_input_port
    }).encode("utf-8")
    parts = lan_ip.split(".")
    subnet_bcast = ".".join(parts[:3]) + ".255" if len(parts) == 4 else None
    while server_running:
        try:
            sock.sendto(payload, ("255.255.255.255", beacon_port))
            if subnet_bcast:
                sock.sendto(payload, (subnet_bcast, beacon_port))
        except Exception:
            pass
        time.sleep(2.0)

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

# ----------------- System Tray & Control Dashboard GUI ----------------- #
def create_tray_icon_image():
    """Generate a clean 64x64 blue trackpad/mouse icon for the system tray."""
    img = Image.new("RGBA", (64, 64), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Rounded trackpad body
    draw.rounded_rectangle([6, 8, 58, 56], radius=12, fill="#181a24", outline="#4f8cff", width=3)
    # Top divider
    draw.line([6, 26, 58, 26], fill="#3a405a", width=2)
    # Center mouse dividing line
    draw.line([32, 8, 32, 26], fill="#4f8cff", width=2)
    # Glowing center dot
    draw.ellipse([28, 38, 36, 46], fill="#4f8cff")
    return img

class ControlDashboard:
    def __init__(self, lan_ip, port=5000):
        self.lan_ip = lan_ip
        self.port = port
        self.root = None

    def show(self):
        if self.root is not None:
            try:
                self.root.deiconify()
                self.root.lift()
                return
            except Exception:
                self.root = None

        self.root = tk.Tk()
        self.root.title("Remote Trackpad Pro - Server Control")
        self.root.geometry("420x580")
        self.root.resizable(False, False)
        self.root.configure(bg="#0f1015")

        # Header card
        header = tk.Frame(self.root, bg="#161822", pady=14, padx=16)
        header.pack(fill="x", pady=(0, 10))

        title_frame = tk.Frame(header, bg="#161822")
        title_frame.pack(anchor="center")

        # Green pulse indicator
        dot_canvas = tk.Canvas(title_frame, width=12, height=12, bg="#161822", highlightthickness=0)
        dot_canvas.create_oval(2, 2, 10, 10, fill="#22c55e", outline="#4ade80")
        dot_canvas.pack(side="left", padx=(0, 8))

        lbl_title = tk.Label(title_frame, text="Remote Mouse Server", fg="#f8fafc", bg="#161822", font=("Segoe UI", 13, "bold"))
        lbl_title.pack(side="left")

        lbl_status = tk.Label(header, text="Active & Broadcasting on Local Network", fg="#94a3b8", bg="#161822", font=("Segoe UI", 9))
        lbl_status.pack(pady=(4, 0))

        # Network Info Card
        info_card = tk.Frame(self.root, bg="#1a1c28", padx=16, pady=12, relief="flat", highlightthickness=1, highlightbackground="#2d3248")
        info_card.pack(fill="x", padx=16, pady=6)

        self.add_info_row(info_card, "PC Hostname:", socket.gethostname(), 0)
        self.add_info_row(info_card, "Local IP:", self.lan_ip, 1)
        self.add_info_row(info_card, "WebSocket Port:", str(self.port), 2)
        self.add_info_row(info_card, "UDP Beacon:", "Port 5001 (Auto-Discovery)", 3)
        self.add_info_row(info_card, "UDP Motion Engine:", "Port 5002 (<1ms Hardware)", 4)

        # QR Code Card
        qr_card = tk.Frame(self.root, bg="#1a1c28", padx=14, pady=10, highlightthickness=1, highlightbackground="#2d3248")
        qr_card.pack(fill="x", padx=16, pady=8)

        lbl_qr = tk.Label(qr_card, text="Scan with Phone Camera to Pair Instantly", fg="#cbd5e1", bg="#1a1c28", font=("Segoe UI", 9, "bold"))
        lbl_qr.pack(pady=(0, 6))

        # Generate QR
        pair_url = f"http://{self.lan_ip}:{self.port}"
        qr = qrcode.QRCode(box_size=4, border=1)
        qr.add_data(pair_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="#0f1015", back_color="#ffffff")
        qr_photo = ImageTk.PhotoImage(qr_img)

        qr_label = tk.Label(qr_card, image=qr_photo, bg="#ffffff", relief="flat")
        qr_label.image = qr_photo
        qr_label.pack(pady=4)

        lbl_url = tk.Label(qr_card, text=pair_url, fg="#60a5fa", bg="#1a1c28", font=("Consolas", 10, "bold"), cursor="hand2")
        lbl_url.pack(pady=(4, 2))
        lbl_url.bind("<Button-1>", lambda e: webbrowser.open(pair_url))

        # Auto-start with Windows Checkbox
        self.auto_start_var = tk.BooleanVar(value=is_auto_start_enabled())
        chk_autostart = tk.Checkbutton(
            self.root,
            text="Start Remote Mouse Server on Windows Boot",
            variable=self.auto_start_var,
            command=self.toggle_autostart,
            bg="#0f1015",
            fg="#cbd5e1",
            selectcolor="#1a1c28",
            activebackground="#0f1015",
            activeforeground="#ffffff",
            font=("Segoe UI", 9)
        )
        chk_autostart.pack(pady=6)

        # Button Row
        btn_frame = tk.Frame(self.root, bg="#0f1015")
        btn_frame.pack(fill="x", padx=16, pady=10)

        btn_browser = tk.Button(
            btn_frame,
            text="Open Web Trackpad",
            bg="#2563eb",
            fg="#ffffff",
            font=("Segoe UI", 9, "bold"),
            relief="flat",
            padx=12,
            pady=6,
            cursor="hand2",
            command=lambda: webbrowser.open(pair_url)
        )
        btn_browser.pack(side="left", expand=True, fill="x", padx=(0, 4))

        btn_min = tk.Button(
            btn_frame,
            text="Hide to Tray",
            bg="#272938",
            fg="#e2e8f0",
            font=("Segoe UI", 9),
            relief="flat",
            padx=12,
            pady=6,
            cursor="hand2",
            command=self.hide
        )
        btn_min.pack(side="right", expand=True, fill="x", padx=(4, 0))

        # Intercept close window event to hide instead of exiting
        self.root.protocol("WM_DELETE_WINDOW", self.hide)
        self.root.mainloop()

    def add_info_row(self, parent, label, value, row):
        lbl = tk.Label(parent, text=label, fg="#94a3b8", bg="#1a1c28", font=("Segoe UI", 9))
        lbl.grid(row=row, column=0, sticky="w", pady=2)
        val = tk.Label(parent, text=value, fg="#f8fafc", bg="#1a1c28", font=("Segoe UI", 9, "bold"))
        val.grid(row=row, column=1, sticky="e", padx=(10, 0), pady=2)
        parent.grid_columnconfigure(1, weight=1)

    def toggle_autostart(self):
        enabled = self.auto_start_var.get()
        success = set_auto_start(enabled)
        if not success:
            messagebox.showerror("Error", "Could not update Windows Startup registry.")
            self.auto_start_var.set(not enabled)

    def hide(self):
        if self.root:
            self.root.withdraw()

dashboard = None
tray_icon = None

def on_tray_open(icon, item):
    global dashboard
    if dashboard:
        # Run dashboard.show on main thread
        threading.Thread(target=dashboard.show, daemon=True).start()

def on_tray_web(icon, item):
    ip = get_lan_ip()
    webbrowser.open(f"http://{ip}:5000")

def on_tray_autostart_toggle(icon, item):
    new_state = not is_auto_start_enabled()
    set_auto_start(new_state)

def on_tray_exit(icon, item):
    global server_running, tray_icon
    server_running = False
    if tray_icon:
        tray_icon.stop()
    os._exit(0)

def setup_system_tray(lan_ip, port=5000):
    global tray_icon
    icon_image = create_tray_icon_image()

    menu = pystray.Menu(
        pystray.MenuItem(f"Remote Mouse Pro (Active)", None, enabled=False),
        pystray.MenuItem(f"Host IP: {lan_ip}:{port}", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Open Control Dashboard / QR Code", on_tray_open, default=True),
        pystray.MenuItem("Open Web Trackpad in Browser", on_tray_web),
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
    lan_ip = get_lan_ip()
    port = 5000

    dashboard = ControlDashboard(lan_ip, port)

    # 1. Start UDP Discovery Beacon
    beacon_thread = threading.Thread(
        target=run_udp_discovery_beacon,
        args=(lan_ip, port, 5001, 5002),
        daemon=True
    )
    beacon_thread.start()

    # 2. Start Ultra-Low Latency UDP Motion Engine (Port 5002)
    udp_input_thread = threading.Thread(
        target=run_udp_input_server,
        args=(5002,),
        daemon=True
    )
    udp_input_thread.start()

    # 3. Start WebSocket Server in Gevent thread
    server_thread = threading.Thread(
        target=lambda: socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True),
        daemon=True
    )
    server_thread.start()

    # 4. If run by user double-click, pop up the dashboard initially
    threading.Thread(target=dashboard.show, daemon=True).start()

    # 5. Run System Tray in main thread (required on Windows for message loop)
    setup_system_tray(lan_ip, port)

if __name__ == "__main__":
    main()
