from gevent import monkey
monkey.patch_all()

import os
import socket
import threading
import json
import time

try:
    import qrcode
except ImportError:
    qrcode = None

from flask import Flask, render_template
from flask_socketio import SocketIO
from pynput.mouse import Controller as MouseController, Button
from pynput.keyboard import Controller as KeyboardController, Key

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Explicitly tell Flask where templates and static files are
app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static"),
)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")

mouse = MouseController()
keyboard = KeyboardController()

# Map simple string names from client -> pynput Key objects
KEY_MAP = {
    # Basic control keys
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
    "win": Key.cmd,
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

    # Function keys F1 - F12
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

    # Media keys (support can vary by OS)
    "media_play_pause": Key.media_play_pause,
    "media_next": Key.media_next,
    "media_previous": Key.media_previous,
    "media_volume_up": Key.media_volume_up,
    "media_volume_down": Key.media_volume_down,
    "media_volume_mute": Key.media_volume_mute,
}


@app.route("/")
def index():
    return render_template("index.html")


# ----------------- Mouse handlers (Native Windows user32 + pynput fallback) ----------------- #

import sys
import ctypes

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
    """
    Ensure the current thread/greenlet is attached to the active interactive
    desktop (WinSta0\Default) so user32.mouse_event / SendInput has permission to inject input.
    Cached per-thread to eliminate repeated kernel handle opens.
    """
    if getattr(_desktop_attached, "attached", False):
        return
    if sys.platform == "win32" and user32:
        try:
            hdesk = user32.OpenInputDesktop(0, False, 0x01FF)
            if hdesk:
                user32.SetThreadDesktop(hdesk)
                _desktop_attached.attached = True
                _desktop_attached.hdesk = hdesk
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
    except Exception as e:
        print("Fallback mouse.move error:", e, flush=True)


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
    except Exception as e:
        print("Fallback mouse.click error:", e, flush=True)


def native_mouse_down(button="left"):
    ensure_desktop()
    if user32:
        try:
            down_flag = MOUSEEVENTF_LEFTDOWN if button == "left" else MOUSEEVENTF_RIGHTDOWN if button == "right" else MOUSEEVENTF_MIDDLEDOWN
            user32.mouse_event(down_flag, 0, 0, 0, 0)
            return
        except Exception:
            pass
    try:
        btn = Button.right if button == "right" else Button.middle if button == "middle" else Button.left
        mouse.press(btn)
    except Exception as e:
        print("Fallback mouse.press error:", e, flush=True)


def native_mouse_up(button="left"):
    ensure_desktop()
    if user32:
        try:
            up_flag = MOUSEEVENTF_LEFTUP if button == "left" else MOUSEEVENTF_RIGHTUP if button == "right" else MOUSEEVENTF_MIDDLEUP
            user32.mouse_event(up_flag, 0, 0, 0, 0)
            return
        except Exception:
            pass
    try:
        btn = Button.right if button == "right" else Button.middle if button == "middle" else Button.left
        mouse.release(btn)
    except Exception as e:
        print("Fallback mouse.release error:", e, flush=True)


def native_mouse_scroll(dx, dy):
    ensure_desktop()
    if user32:
        try:
            if dy != 0:
                wheel_delta = int(dy * 20)
                user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, wheel_delta, 0)
            if dx != 0:
                hwheel_delta = int(dx * 20)
                user32.mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, hwheel_delta, 0)
            return
        except Exception:
            pass
    try:
        mouse.scroll(int(dx), int(dy))
    except Exception as e:
        print("Fallback mouse.scroll error:", e, flush=True)


# Subpixel precision accumulators with balanced rounding (eliminates deadzone & stickiness)
subpixel_x = 0.0
subpixel_y = 0.0

def process_mouse_delta(raw_dx, raw_dy):
    global subpixel_x, subpixel_y
    total_x = raw_dx + subpixel_x
    total_y = raw_dy + subpixel_y

    # Round to nearest integer when >= 0.5 to prevent deadzones during slow aiming
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
        print(f"  * UDP Motion Engine: Active on port {port} (<1ms direct pipeline)", flush=True)
    except Exception as e:
        print(f"  * Warning: Failed to bind UDP Motion Engine on port {port}: {e}", flush=True)
        return

    while True:
        try:
            data, _ = sock.recvfrom(256)
            if not data:
                continue
            # Format: 'M <dx> <dy>' for move, 'S <dx> <dy>' for scroll
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


@socketio.on("connect")
def handle_connect(auth=None):
    from flask import request
    print(f"\n>>> [CLIENT CONNECTED] SID: {request.sid} from IP: {request.remote_addr}", flush=True)

@socketio.on("disconnect")
def handle_disconnect():
    from flask import request
    print(f"\n<<< [CLIENT DISCONNECTED] SID: {request.sid}", flush=True)

@socketio.on("ping_check")
def handle_ping_check():
    return {"status": "ok"}


@socketio.on("move")
def handle_move(data):
    try:
        dx = float(data.get("dx", 0))
        dy = float(data.get("dy", 0))
        process_mouse_delta(dx, dy)
    except Exception as e:
        print("Error in move:", e, flush=True)


@socketio.on("click")
def handle_click(data):
    try:
        button_name = data.get("button", "left")
        count = int(data.get("count", 1))
        native_mouse_click(button_name, count)
    except Exception as e:
        print("Error in click:", e, flush=True)


@socketio.on("mouse_down")
def handle_mouse_down(data):
    try:
        button_name = data.get("button", "left")
        native_mouse_down(button_name)
    except Exception as e:
        print("Error in mouse_down:", e, flush=True)


@socketio.on("mouse_up")
def handle_mouse_up(data):
    try:
        button_name = data.get("button", "left")
        native_mouse_up(button_name)
    except Exception as e:
        print("Error in mouse_up:", e, flush=True)


@socketio.on("scroll")
def handle_scroll(data):
    global subpixel_scroll_x, subpixel_scroll_y
    try:
        dx = float(data.get("dx", 0)) + subpixel_scroll_x
        dy = float(data.get("dy", 0)) + subpixel_scroll_y

        int_dx = int(dx)
        int_dy = int(dy)

        subpixel_scroll_x = dx - int_dx
        subpixel_scroll_y = dy - int_dy

        if int_dx != 0 or int_dy != 0:
            native_mouse_scroll(int_dx, int_dy)
    except Exception as e:
        print("Error in scroll:", e, flush=True)



# ----------------- Keyboard handlers ----------------- #

@socketio.on("text")
def handle_text(data):
    """
    Type a full string as if from keyboard.
    """
    ensure_desktop()
    try:
        text = data.get("text", "")
        if text:
            keyboard.type(text)
    except Exception as e:
        print("Error in text:", e, flush=True)


@socketio.on("key")
def handle_key(data):
    """
    Handle single special keys and media keys.
    data: { "name": "enter" | "media_volume_up" | ..., "action": "tap"|"press"|"release" }
    """
    ensure_desktop()
    try:
        name = data.get("name")
        if not name:
            return

        name_str = str(name)
        key = KEY_MAP.get(name_str.lower())
        if not key:
            if len(name_str) == 1:
                key = name_str
            else:
                print(f"Unknown key requested: {name}")
                return

        action = data.get("action", "tap")

        if action == "press":
            keyboard.press(key)
        elif action == "release":
            keyboard.release(key)
        else:  # "tap" (default)
            keyboard.press(key)
            keyboard.release(key)
    except Exception as e:
        print("Error in key:", e)


# ----------------- Gamepad handlers ----------------- #

def resolve_gamepad_input(code):
    """
    Resolves input code like 'w', 'space', 'shift', 'mouse_left', etc.
    Returns (type, resolved_obj) where type is 'key' or 'mouse'.
    """
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
        "space": Key.space,
        "shift": Key.shift,
        "shift_l": Key.shift_l,
        "ctrl": Key.ctrl,
        "ctrl_l": Key.ctrl_l,
        "alt": Key.alt,
        "tab": Key.tab,
        "esc": Key.esc,
        "enter": Key.enter,
        "up": Key.up,
        "down": Key.down,
        "left": Key.left,
        "right": Key.right,
        "backspace": Key.backspace,
        "caps_lock": Key.caps_lock,
        "delete": Key.delete,
        "page_up": Key.page_up,
        "page_down": Key.page_down,
        "home": Key.home,
        "end": Key.end,
        "f1": Key.f1,
        "f2": Key.f2,
        "f3": Key.f3,
        "f4": Key.f4,
        "f5": Key.f5,
        "f6": Key.f6,
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
        input_code = data.get("input")
        in_type, resolved = resolve_gamepad_input(input_code)
        if in_type == "key":
            keyboard.press(resolved)
            held_gamepad_keys.add(resolved)
        elif in_type == "mouse":
            btn_name = "right" if resolved == Button.right else "middle" if resolved == Button.middle else "left"
            native_mouse_down(btn_name)
    except Exception as e:
        print("Error in gamepad_button_down:", e)


@socketio.on("gamepad_button_up")
def handle_gamepad_button_up(data):
    try:
        input_code = data.get("input")
        in_type, resolved = resolve_gamepad_input(input_code)
        if in_type == "key":
            keyboard.release(resolved)
            held_gamepad_keys.discard(resolved)
        elif in_type == "mouse":
            btn_name = "right" if resolved == Button.right else "middle" if resolved == Button.middle else "left"
            native_mouse_up(btn_name)
    except Exception as e:
        print("Error in gamepad_button_up:", e)


@socketio.on("gamepad_stick_sync")
def handle_gamepad_stick_sync(data):
    """
    Syncs active movement keys from analog thumbstick (e.g. ['w', 'd'] or ['a']).
    Releases keys that became inactive and presses newly active keys.
    """
    global current_stick_keys
    try:
        desired_keys = set(data.get("keys", []))
        to_release = current_stick_keys - desired_keys
        to_press = desired_keys - current_stick_keys

        for k in to_release:
            in_type, resolved = resolve_gamepad_input(k)
            if in_type == "key":
                keyboard.release(resolved)

        for k in to_press:
            in_type, resolved = resolve_gamepad_input(k)
            if in_type == "key":
                keyboard.press(resolved)

        current_stick_keys = desired_keys
    except Exception as e:
        print("Error in gamepad_stick_sync:", e)


@socketio.on("gamepad_release_all")
def handle_gamepad_release_all():
    global current_stick_keys, held_gamepad_keys
    try:
        for k in current_stick_keys:
            in_type, resolved = resolve_gamepad_input(k)
            if in_type == "key":
                keyboard.release(resolved)
        current_stick_keys.clear()

        for k in list(held_gamepad_keys):
            keyboard.release(k)
        held_gamepad_keys.clear()

        native_mouse_up("left")
        native_mouse_up("right")
    except Exception as e:
        print("Error in gamepad_release_all:", e)



def get_lan_ip():
    """Detect local Wi-Fi / LAN IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't have to be reachable; just selects the outbound interface
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def run_udp_discovery_beacon(lan_ip, port=5000, beacon_port=5001, udp_input_port=5002):
    """
    Broadcasts UDP announcements periodically on the LAN so mobile apps
    can auto-discover the host PC without typing IP addresses.
    """
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

    while True:
        try:
            sock.sendto(payload, ("255.255.255.255", beacon_port))
            if subnet_bcast:
                sock.sendto(payload, (subnet_bcast, beacon_port))
        except Exception:
            pass
        time.sleep(2.0)


def print_startup_banner(lan_ip, port=5000, udp_port=5002):
    import sys
    try:
        if sys.stdout.encoding.lower() != "utf-8":
            sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    url = f"http://{lan_ip}:{port}"
    print("\n" + "=" * 62)
    print("      [REMOTE TRACKPAD & GAMEPAD PRO - HOST SERVER]")
    print("=" * 62)
    print(f"  * Host PC:           {socket.gethostname()}")
    print(f"  * Local IP:          {lan_ip}")
    print(f"  * WebSocket:         {url}")
    print(f"  * UDP Discovery:     Port 5001 (Active Auto-Beacon)")
    print(f"  * UDP Motion Engine: Port {udp_port} (<1ms Direct Hardware Pipeline)")
    print("=" * 62)

    if qrcode:
        try:
            print("\n  * Scan with mobile camera to pair instantly:\n")
            qr = qrcode.QRCode(box_size=1, border=1)
            qr.add_data(url)
            qr.make(fit=True)
            qr.print_ascii(invert=True)
        except Exception:
            pass
    print("=" * 62 + "\n")


def start_server_worker(port=5000, udp_beacon_port=5001, udp_input_port=5002):
    lan_ip = get_lan_ip()
    print_startup_banner(lan_ip, port=port, udp_port=udp_input_port)

    # 1. Start UDP Discovery Beacon in background daemon thread
    beacon_thread = threading.Thread(
        target=run_udp_discovery_beacon,
        args=(lan_ip, port, udp_beacon_port, udp_input_port),
        daemon=True
    )
    beacon_thread.start()

    # 2. Start Ultra-Low Latency UDP Motion Engine in background daemon thread
    udp_thread = threading.Thread(
        target=run_udp_input_server,
        args=(udp_input_port,),
        daemon=True
    )
    udp_thread.start()

    # 3. Start Gevent WebSocket / HTTP Server
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)


if __name__ == "__main__":
    start_server_worker()
