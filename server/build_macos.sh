#!/usr/bin/env bash
set -euo pipefail

# Build script for Remote Mouse & Gamepad Pro macOS Host Server (.app + .dmg)
# Must be executed on macOS.

cd "$(dirname "$0")"

echo "=== Installing Python dependencies ==="
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

echo "=== Building RemoteMouseProServer.app with PyInstaller ==="
python3 -m PyInstaller \
  --noconfirm \
  --clean \
  --windowed \
  --onedir \
  --name "RemoteMouseProServer" \
  --add-data "templates:templates" \
  --add-data "static:static" \
  --osx-bundle-identifier "com.remotemousepro.server" \
  server_app.py

echo "=== Build complete: server/dist/RemoteMouseProServer.app ==="
echo "Note: On first launch, grant Accessibility permission in:"
echo "  System Settings -> Privacy & Security -> Accessibility"

