# Changelog

All notable changes to the **Remote Mouse & Gamepad Pro** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] - 2026-11-22

### Added
- **Startup Loading Animation & Splash Screen Engine (`SplashScreen.tsx`)**:
  - Fullscreen dark obsidian splash screen displaying on cold launch with concentric pulsing radar rings and glowing vector core.
  - Native driver hardware-accelerated animations: breathing logo core, dual expanding radar rings, progressive subsystem initialization bar, and smooth crossfade unmount into authentication/app interface.
- **Authentication Screen & Zero-Credential Offline-First Architecture (`LoginScreen.tsx`, `AuthService.ts`, `authConfig.ts`)**:
  - First interactive UI screen after splash on cold boot (if unauthenticated and unskipped).
  - Official Google Sign-In button with authentic vector branding and loading indicators.
  - Zero-Credential Offline-First Architecture: Enables instant Google login simulation and profile testing without requiring a Google Cloud project or OAuth Client ID upfront. Once acquired, entering `GOOGLE_WEB_CLIENT_ID` in `authConfig.ts` activates native Google Play Services OAuth automatically.
  - **Frictionless Skip Option**: "Skip & Continue as Guest ➔" button allows users to immediately enter the app interface without registering or signing in.
- **Dual-Mode Cloud & Local Storage Engine (`UserStorageService.ts`)**:
  - Unified persistence layer synchronizing app settings, custom gamepad button rebinds, joystick deadzones, cursor sensitivity presets, and recent servers.
  - Authenticated mode: Synchronizes profile preferences to cloud storage (`@remote_mouse_cloud_backup_${uid}`).
  - Guest mode: Automatically persists all configurations to local `AsyncStorage`.
  - Automatic migration: Upgrades local guest settings to the cloud upon subsequent Google sign-in.
- **Account & Cloud Sync Hub (`SettingsModal.tsx`)**:
  - Added dedicated "ACCOUNT & PREFERENCE BACKUP" section to `SettingsModal`.
  - Displays user avatar, display name, email, live sync status badge (`✔ Cloud Synced`), manual "Sync Now" button, and "Sign Out" button.
  - Allows guest users to sign into Google directly from Settings at any time without losing active inputs.
- **Connection Gating Modal (`ConnectionGateModal.tsx`)**:
  - Enforces server connection on launch before exposing controls, preventing confusion from disconnected inputs.
  - Live Wi-Fi radar scanner showing discovered host PCs with 1-tap connection.
  - Prominent **"Skip & Use Offline ➔"** action giving the user complete autonomy to bypass connection gating and test controls offline.
- **Persistent Dedicated Server Switcher Bar (`ServerSwitcherBar.tsx`)**:
  - Dedicated status and navigation bar placed directly under the app tabs, visible across Trackpad, Gamepad, Keyboard, and Media decks.
  - Real-time status indicator dot (green/yellow/red), server name, latency badge (`⚡ 3ms`), and dedicated `Switch ⇄` button.
- **Quick Server Switcher Drawer (`ServerSwitcherDrawer.tsx`)**:
  - Bottom sheet drawer accessible from the Switcher Bar or header status.
  - Active connection card with live host info and 1-tap "Disconnect".
  - Discovered Wi-Fi PCs list with 1-tap server migration without leaving the active control deck.
  - Recent servers history with quick-reconnect shortcuts.
  - Collapsible manual IP and port configuration.
- **Extended Haptics (`HapticsService.ts`)**:
  - Added `medium()` haptic pulse profile for UI modal confirmations and connection events.

---

## [1.3.0] - 2026-11-21

### Added
- **Autonomous Instant-Connect Engine (`AutoConnectService.ts`)**:
  - Global, lifecycle-wide UDP beacon listener that detects and auto-connects to known or sole local servers in under 1 second without opening the connection modal.
  - **Dynamic Host IP Migration (Zero-Touch Reconnection)**: Tracks host PCs by `hostname` rather than static IP. If the PC or mobile changes networks (e.g. Wi-Fi router to mobile hotspot, IP lease renewal), the app recognizes the host's new IP address from real-time beacons and hot-migrates the active socket and UDP motion target immediately.
  - **AppState Sleep/Wake Adaptation**: Listens to React Native `AppState` transitions. When the phone wakes from sleep or returns from background, it triggers an instant discovery rescan and fast socket health verification.
  - **Persistent Server Memory**: Caches the last connected server (`name`, `ip`, `port`, `udpPort`) in `AsyncStorage` and initiates immediate boot reconnect.
- **Multi-Adapter Host Beacon Broadcast (`server/server.py`)**:
  - Replaced single-IP detection with `get_all_lan_ips()` to discover all active network interfaces simultaneously (Wi-Fi, Ethernet, Windows Mobile Hotspot virtual adapters `192.168.137.x`, Wi-Fi Direct).
  - Broadcasts UDP beacons on all local subnet broadcast addresses (`x.x.x.255`) and global broadcast (`255.255.255.255`) every 1.0 second.
  - Added periodic 60-second broadcast socket recycling and exception recreation to prevent stale adapter handles when Windows network interfaces are toggled.
- **Real-Time Per-Beacon Subscription (`DiscoveryService.ts`)**:
  - Added `onBeacon()` event listener to trigger instant callback execution immediately upon receiving UDP packets, reducing auto-connect latency from 3000ms polling to <1000ms.
  - Added case-insensitive hostname index mapping (`hostsByName`) and reduced stale host cleanup window to 6.0 seconds.
- **Resilient Infinite Backoff & Fast Heartbeat Timeout (`SocketService.ts`)**:
  - Configured Socket.IO with `reconnectionAttempts: Infinity` and capped fast backoff (500ms initial, 2500ms max) to maintain persistent reconnection attempts across prolonged network transitions.
  - Added 2-cycle missed ping watchdog (2500ms interval, 1800ms ping timeout) that flags disconnected state within ~4 seconds if a network interface drops silently without a TCP FIN/RST packet.
- **Dynamic UDP Socket Re-Binding (`UdpInputService.ts`)**:
  - Recreates and rebinds the native ephemeral UDP sending socket whenever the target IP changes, ensuring motion packets correctly route out the newly active network adapter.

---

## [1.2.1] - 2026-11-16

### Added
- **Three-Finger Tap Gesture**: Mapped three-finger tap ($\text{duration} < 300\text{ms}$) to **Middle Click** (`socketService.click('middle')`), enabling instant tab closing and background link opening in web browsers.
- **Subpixel Wheel Accumulators**: Added persistent floating-point accumulators (`scroll_accum_x`, `scroll_accum_y`) in `server/server.py` to preserve fractional scroll increments and dispatch native Windows `WHEEL_DELTA` steps smoothly without drift or deadzones.
- **Multi-Touch Transition Frame Suppression**: Added touch count state comparison (`touches.length !== prevTouchCount.current`) in `TrackpadScreen.tsx` that re-anchors centroid coordinates without dispatching deltas, eliminating violent 50px+ coordinate leap spikes when fingers are added or lifted.
- **One-Tap Network Rescan**: Added an interactive `🔄 Rescan` button to `ConnectionModal.tsx` and exposed `rescan()` in `DiscoveryService.ts`.
- **Dynamic Hotspot LAN Discovery**: Added multi-subnet broadcast broadcasting on both `255.255.255.255` and dynamic subnet broadcast (e.g., `172.20.10.255` / `192.168.x.255`), ensuring seamless automatic pairing on mobile personal hotspots without internet access.
- **Automatic Server Process Watchdog**: Added `kill_port_process(5000)` and a background watchdog thread in `server_app.py` to terminate orphan zombie processes holding port 5000 in `CLOSE_WAIT` and automatically restart failed worker processes.

### Fixed
- **Tap-to-Click Recognition**: Replaced the flawed `0.05px` movement threshold in `TrackpadScreen.tsx` with a standard 14px Euclidean Touch Slop ($\text{totalTravel} = \sqrt{\Delta x^2 + \Delta y^2} < 14\text{px}$). This absorbs capacitive digitizer micro-tremors and restores 100% reliable tap-to-click.
- **Two-Finger Right Click Gesture**: Fixed an issue where asynchronous two-finger touch-down set initial touch count to 1 and immediately marked movement as true. Implemented `maxTouches.current` high-water mark tracking across the touch lifecycle, ensuring two-finger taps reliably trigger Right Click.
- **Inverted Windows Scroll Direction**: Fixed an issue in `server.py` where moving two fingers down produced positive `dy`, which Win32 `MOUSEEVENTF_WHEEL` interpreted as wheel-up (scrolling in reverse). Inverted vertical delta scaling so moving fingers down scrolls down naturally.
- **Double-Tap Drag Lock Inoperability**: Fixed double-tap drag detection by allowing the second tap within 350ms and 45px radius of the registered first tap, maintaining mouse left-button down (`mouseDown('left')`) during motion and releasing on finger lift.
- **Discovery Service IP Prioritization**: Updated `DiscoveryService.ts` to prioritize `rinfo.address` (the actual socket sender IP) over payload-reported IPs, preventing outdated or mismatched network adapter IPs.

---

## [1.2.0] - 2026-11-14

### Added
- **Monolithic Glass Trackpad**:
  - Overhauled trackpad with Apple MacBook-inspired glassmorphic surface (`macTrackpadFrame`).
  - Added expandable Cursor Sensitivity scrubber modal with visual live badge (Precision, Balanced, Fast, Ultra Fast) and instant speed presets (1.0×, 1.4×, 2.0×, 3.0×).
  - Added seamless bottom click zones with tactile hairline divider and press-hold left click support.
- **Modern Hifi Media Deck**:
  - Radial/circular touch volume scrubber with real-time level readout.
  - Floating transport control pod (Play, Pause, Previous, Next, Mute).
  - Dedicated video control suite with 10-second skip forward/backward and fullscreen hotkeys.
- **Mechanical Keyboard Suite**:
  - Realistic 3D keycaps with travel depth shadows and mechanical switch acoustics (Cherry MX click samples).
  - Added dedicated navigation arrow cluster and functional modifiers (Ctrl, Alt, Shift, Win, Esc, Tab).
- **Console-Grade Gamepad**:
  - 3-way layout switcher supporting Arcade layout, Xbox layout, and PlayStation layout.
  - Curved shoulder bumpers and analog triggers (L1/L2, R1/R2, LB/LT, RB/RT).
  - Tactile ABXY jewel diamond buttons and responsive dual virtual analog thumbsticks with dynamic centering.
  - Multi-tier haptic vibration waveforms calibrated for trigger pulls, bumper taps, and sprint toggles.
- **Glassmorphic Settings & Customization Drawer**:
  - Haptic feedback intensity selector (`Subtle`, `Medium`, `Strong`, `Off`).
  - Screen Keep-Awake toggle preventing phone lock during gaming or presentation sessions.
  - Zero-Lag UDP Motion toggle allowing users to switch between high-speed UDP (<1ms) and reliable TCP.
  - Visual theme engine with custom color palettes (Midnight OLED, Cyberpunk Neon, Slate Blue).
- **Interactive Connection Hub**:
  - Redesigned connection modal with animated Wi-Fi radar pulse effect.
  - Quick-connect server cards displaying server hostname, IP, port, and signal latency.
  - QR Code scanning pairing hub for instant zero-configuration setup.

---

## [1.1.0] - 2026-09-06

### Added
- **Zero-Lag UDP Motion Engine (Port 5002)**:
  - Implemented high-priority UDP socket server on port 5002, bypassing Gevent, HTTP, and WebSocket overhead for sub-millisecond input transit.
  - Compact ASCII motion protocol (`M <dx> <dy>`, `S <dx> <dy>`).
  - Built-in automatic fallback to TCP WebSocket if UDP communication is blocked or unavailable on the local network.
- **Windows Win32 SendInput & Input Desktop Attachment**:
  - Integrated `user32.SendInput` and `user32.mouse_event` for hardware-grade input synthesis, bypassing UAC restrictions.
  - Added `OpenInputDesktop` and `SetThreadDesktop` hooks to preserve mouse control across secure Windows desktop switches (Ctrl+Alt+Del, UAC prompts, lock screens).
- **Decoupled Architecture & System Tray App**:
  - Decoupled server into a lightweight background worker process and a native Windows System Tray application (`server_app.py`).
  - Added Windows named mutex (`Global\RemoteMouseProServer_SingleInstanceMutex`) preventing duplicate server instances.
  - Built standalone frozen executable `RemoteMouseServer.exe` via PyInstaller with bundled templates and icons.

---

## [1.0.0] - 2026-09-04

### Added
- **Initial Release of Remote Mouse & Gamepad Pro**:
  - React Native cross-platform mobile client for Android.
  - Python Flask + Socket.IO server for Windows host PCs.
  - Multi-interface LAN IP detection with QR code display on startup.
  - Background UDP discovery beacon on port 5001 broadcasting server availability.
  - Real-time mouse cursor gliding, left/right clicks, and basic scrolling.
  - Basic virtual keyboard text input and key combinations.
  - Standalone release APK compilation pipeline (`assembleRelease`) with automated packaging.
  - Comprehensive documentation including `README.md`, `PROJECT_DETAILS.md`, and `PLAY_STORE_PUBLISHING_GUIDE.md`.
