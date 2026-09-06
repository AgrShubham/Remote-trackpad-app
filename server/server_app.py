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

from PIL import Image, ImageDraw, ImageTk
import pystray
import qrcode
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

def start_worker_process():
    global worker_proc
    if getattr(sys, 'frozen', False):
        cmd = [sys.executable, "--worker"]
    else:
        cmd = [sys.executable, os.path.abspath(__file__), "--worker"]

    creationflags = 0x08000000 if sys.platform == "win32" else 0  # CREATE_NO_WINDOW
    try:
        worker_proc = subprocess.Popen(cmd, creationflags=creationflags)
    except Exception as e:
        print("Failed to spawn background server worker:", e)

def cleanup_worker():
    global worker_proc
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
                self.root.focus_force()
                return
            except Exception:
                self.root = None

        self.root = tk.Tk()
        self.root.title("Remote Trackpad & Gamepad Pro - Host Server")
        self.root.geometry("440x600")
        self.root.resizable(False, False)
        self.root.configure(bg="#0f1015")

        # Header card
        header = tk.Frame(self.root, bg="#161822", pady=16)
        header.pack(fill="x")

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
        threading.Thread(target=dashboard.show, daemon=True).start()

def on_tray_web(icon, item):
    ip = get_lan_ip()
    webbrowser.open(f"http://{ip}:5000")

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
        pystray.MenuItem("Remote Mouse Pro (Active)", None, enabled=False),
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

    # 1. Enforce Single-Instance Mutex
    if not acquire_single_instance_mutex():
        # Instance is already running in tray
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

    dashboard = ControlDashboard(lan_ip, port)

    # 3. If run by user double-click, pop up the dashboard initially
    threading.Thread(target=dashboard.show, daemon=True).start()

    # 4. Run System Tray on main thread
    setup_system_tray(lan_ip, port)

if __name__ == "__main__":
    main()
