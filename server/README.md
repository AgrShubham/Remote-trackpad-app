# 🖥️ Remote Mouse & Gamepad Pro - PC Host Server

This directory contains the PC Host Server implementations for **Remote Mouse & Gamepad Pro**.

---

## 📁 Components

1. **`server.py`**:
   - High-performance, zero-lag Gevent WebSocket server (port `5000`).
   - UDP broadcast auto-discovery beacon (port `5001`).
   - Cached Windows kernel desktop handle input injection.
   - Built-in web trackpad fallback interface.

2. **`server_app.py`**:
   - Dedicated Windows System Tray application with custom icon.
   - Dark-mode control dashboard with real-time status, hostname, local IP, and pairing QR code.
   - Toggle to "Start on Windows Boot" (registers in `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).

3. **`templates/` & `static/`**:
   - Responsive web trackpad HTML, CSS, and JS assets.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Server
- **Console / Dev Server**:
  ```bash
  python server.py
  ```
- **System Tray Desktop Application**:
  ```bash
  python server_app.py
  ```

### 3. Build Standalone Windows Executable (`RemoteMouseServer.exe`)
```bash
pyinstaller --onefile --noconsole --name "RemoteMouseServer" --add-data "templates;templates" --add-data "static;static" --hidden-import "gevent" --hidden-import "gevent.socket" --hidden-import "gevent.ssl" --hidden-import "geventwebsocket" --hidden-import "engineio.async_drivers.gevent" server_app.py
```
Outputs standalone `dist/RemoteMouseServer.exe` (no Python required on target PC).
