# Master Execution Prompt: Remote Trackpad Pro — React Native Mobile Application

> **Purpose**: This prompt file serves as the definitive, autonomous engineering specification for converting **Remote Trackpad Pro** from a web client into a 100% Full Native **React Native Android Mobile Application** ready for publication on the **Google Play Store**.

---

## 1. Project Mission & High-Level Architecture

Convert the existing web-based client (`templates/index.html` + `server.py`) into a high-performance React Native Android application (`mobile/`) that connects over local Wi-Fi to the Python host server.

### System Topology
```
+-------------------------------------------------------------------------------+
|                       Android Device (React Native Client)                   |
|                                                                               |
|  [Tab Navigation: Trackpad | Gamepad (Asym/Sym) | Mechanical Keyboard | Media]|
|                                     |                                         |
|  [Touch & Gesture Layer: React Native Gesture Handler + Reanimated 3]         |
|   - Piecewise Acceleration Ballistics                                         |
|   - Decaying Inertial Momentum Scrolling                                      |
|   - Concentric 360° Sticks (Octant Key Classifier + Deadzone + Sprint Ring)   |
|                                     |                                         |
|  [Hardware & Multimedia Engines]                                              |
|   - Native SoundPool (0-Latency Cherry MX Switch Clacks)                      |
|   - Native Vibration Motor Waveforms (Vibrator / Haptics)                     |
|   - Auto-Orientation Lock (Landscape for Gamepad, Portrait for Trackpad)      |
|   - Immersive Sticky Fullscreen + Keep Awake                                  |
|                                     |                                         |
|  [Network Layer: Socket.IO Client + UDP Discovery + QR Scanner]               |
+-------------------------------------+-----------------------------------------+
                                      |
                                  Wi-Fi LAN
                          (Port 5000: WebSocket / TCP)
                          (Port 5001: UDP Auto-Beacon)
                                      |
+-------------------------------------+-----------------------------------------+
|                         Host PC (Python 3.9+ Server)                          |
|  - Flask-SocketIO (Threading Async Mode)                                      |
|  - Subpixel Floating Remainder Accumulator                                    |
|  - pynput (Mouse, Keyboard, Gamepad input injection)                         |
|  - UDP Auto-Discovery Beacon Broadcast (Port 5001)                            |
|  - Terminal ASCII QR Code Generator for Camera Pairing                        |
+-----------------------------------------------+
```

---

## 2. Mathematical Models & Physics Implementations

When developing the gesture handlers in React Native (using `react-native-reanimated` worklets or high-frequency event listeners), apply the following formulas exactly:

### 2.1 macOS Pointer Acceleration Ballistics
Convert raw touch deltas $(\Delta x, \Delta y)$ and the elapsed time $\Delta t$ into accelerated pointer deltas:

$$\text{velocity} = \frac{\sqrt{\Delta x^2 + \Delta y^2}}{\max(\Delta t, 4\text{ ms})}$$

Piecewise acceleration curve:
$$\text{curveFactor}(v) = \begin{cases} 
0.85 + \left(\frac{v}{0.25}\right) \times 0.25 & \text{if } v < 0.25 \\
1.10 + \left(\frac{v - 0.25}{0.95}\right)^{1.35} \times 1.20 & \text{if } 0.25 \le v < 1.20 \\
2.30 + \min((v - 1.20) \times 1.50, 2.00) & \text{if } v \ge 1.20 
\end{cases}$$

$$\Delta x_{\text{accelerated}} = \Delta x \times \text{curveFactor}(v) \times \text{userMultiplier}$$
$$\Delta y_{\text{accelerated}} = \Delta y \times \text{curveFactor}(v) \times \text{userMultiplier}$$

### 2.2 Inertial Momentum Scrolling Decay
When two fingers release after scrolling:
$$v_y(t + 1) = v_y(t) \times \lambda, \quad \lambda = 0.92$$
Terminate the animation frame glide loop when $|v_y| < 0.05\text{ px/frame}$ or when the user touches the trackpad again.

### 2.3 Subpixel Coordinate Accumulator (Client & Server)
OS mouse coordinates are integer-based. Accumulate remainders:
$$\begin{aligned}
x_{\text{total}} &= \Delta x + x_{\text{remainder}} \\
\Delta x_{\text{int}} &= \text{int}(x_{\text{total}}) \\
x_{\text{remainder}} &= x_{\text{total}} - \Delta x_{\text{int}}
\end{aligned}$$

### 2.4 Concentric Stick Octant Classifier & Sprint Ring
Normalize joystick thumb position to unit circle $[-1.0, 1.0]$:
$$r = \frac{\sqrt{x^2 + y^2}}{r_{\text{max}}}, \quad \theta = \text{atan2}(y, x)$$

- **Deadzone**: If $r < 0.18$, emit empty keys `[]`.
- **Directional Angular Octants**:
  - $-\frac{\pi}{8} \le \theta < \frac{\pi}{8} \implies \text{D (Right)}$
  - $\frac{\pi}{8} \le \theta < \frac{3\pi}{8} \implies \text{S + D (Down-Right)}$
  - $\frac{3\pi}{8} \le \theta < \frac{5\pi}{8} \implies \text{S (Down)}$
  - $\frac{5\pi}{8} \le \theta < \frac{7\pi}{8} \implies \text{S + A (Down-Left)}$
  - $\theta \ge \frac{7\pi}{8} \lor \theta < -\frac{7\pi}{8} \implies \text{A (Left)}$
  - $-\frac{7\pi}{8} \le \theta < -\frac{5\pi}{8} \implies \text{W + A (Up-Left)}$
  - $-\frac{5\pi}{8} \le \theta < -\frac{3\pi}{8} \implies \text{W (Up)}$
  - $-\frac{3\pi}{8} \le \theta < -\frac{\pi}{8} \implies \text{W + D (Up-Right)}$
- **Sprint Threshold**: If $r > 0.82$, append `Shift` to active keys and trigger haptic pulse `[35ms, 25ms, 45ms]`.
- **Key State Diffing**: Compare `currentStickKeys` with `newStickKeys`, and only emit changes over `gamepad_stick_sync`.

---

## 3. Network Protocol & WebSocket API Reference

All events are transmitted via Socket.IO over TCP port `5000`:

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `move` | Client $\rightarrow$ Server | `{"dx": number, "dy": number}` | Batched cursor position delta |
| `click` | Client $\rightarrow$ Server | `{"button": "left" \| "right", "count": number}` | Single/double mouse click |
| `mouse_down` | Client $\rightarrow$ Server | `{"button": "left" \| "right"}` | Mouse button down (drag start) |
| `mouse_up` | Client $\rightarrow$ Server | `{"button": "left" \| "right"}` | Mouse button up (drag release) |
| `scroll` | Client $\rightarrow$ Server | `{"dx": number, "dy": number}` | Vertical / horizontal scrolling |
| `key` | Client $\rightarrow$ Server | `{"name": string, "action": "tap" \| "press" \| "release"}` | Key press, release, or tap |
| `text` | Client $\rightarrow$ Server | `{"text": string}` | Full string typing injection |
| `gamepad_button_down` | Client $\rightarrow$ Server | `{"input": string}` | Gamepad button pressed down |
| `gamepad_button_up` | Client $\rightarrow$ Server | `{"input": string}` | Gamepad button released |
| `gamepad_stick_sync` | Client $\rightarrow$ Server | `{"keys": string[]}` | Syncs active thumbstick keys |
| `gamepad_release_all`| Client $\rightarrow$ Server | `{}` | Emergency safety release of all keys |

### UDP Auto-Discovery Protocol (Port 5001)
- Host server broadcasts UDP datagram every 2s:
  `{"app": "RemoteTrackpadPro", "name": "<PC_NAME>", "ip": "<PC_IP>", "port": 5000}`
- React Native client listens on UDP port `5001`, decodes the payload, and displays discovered servers in the connection modal.

---

## 4. Tactility & Audio Synthesizer Specifications

### 4.1 Native Vibration Waveforms
Trigger native Android vibration patterns using `Vibration.vibrate(pattern)`:
- **Left Click**: `[0, 30]` ms
- **Right Click**: `[0, 35, 40, 35]` ms
- **Drag Lock Engaged**: `[0, 45]` ms
- **Gamepad Triggers (`LT`/`RT`)**: `[0, 45, 30, 45]` ms
- **Gamepad Face Buttons (`ABXY`)**: `[0, 35]` ms
- **Gamepad Bumpers (`LB`/`RB`)**: `[0, 38]` ms
- **D-Pad Petals**: `[0, 30]` ms
- **Sprint Ring Actuation**: `[0, 35, 25, 45]` ms
- **Mechanical Key**: `[0, 28]` ms (Spacebar: `[0, 36]` ms)

### 4.2 Native SoundPool Audio Engine
To achieve 0-latency acoustic feedback in React Native without Web Audio API overhead:
- Pre-generate 4 pristine 16-bit 44.1kHz PCM micro-sample WAVs:
  1. `key_standard.wav`: 1750Hz $\rightarrow$ 320Hz click transient (18ms) + 220Hz $\rightarrow$ 60Hz clack (32ms).
  2. `key_spacebar.wav`: 140Hz hollow resonant stabilizer thud (45ms) + 2100Hz metallic snap (15ms).
  3. `key_enter.wav`: 1200Hz $\rightarrow$ 90Hz heavy clack (35ms).
  4. `click_haptic.wav`: 1600Hz micro-sine pulse (4ms).
- Load into Android `SoundPool` on app startup (`maxStreams: 10`). Play streams instantly on touch down.

---

## 5. Mobile Component Hierarchy & Layout Specifications

```
mobile/
├── android/                   # Standard Android Studio / Gradle project
│   ├── app/
│   │   ├── build.gradle       # compileSdk 35, targetSdk 34, minSdk 24
│   │   └── src/main/
│   │       ├── AndroidManifest.xml # Permissions, Immersive Mode, Hardware Acceleration
│   │       └── res/           # Adaptive icons, SoundPool audio assets
├── src/
│   ├── assets/
│   │   └── sounds/            # Micro-transient WAV files for SoundPool
│   ├── components/
│   │   ├── Header.tsx         # Connection status chip, latency meter, tabs selector
│   │   ├── ConnectionModal.tsx# UDP discovery list, QR scanner, manual IP input, history
│   │   ├── ConcentricStick.tsx# Virtual 360° thumbstick with deadzone & sprint ring
│   │   ├── CloverDpad.tsx     # 4-way clover petal directional pad
│   │   ├── Keycap.tsx         # 3D sculpted mechanical keycap with physical depression
│   │   └── RebindModal.tsx    # Long-press (750ms) live button remapping dialog
│   ├── screens/
│   │   ├── TrackpadScreen.tsx # Monolithic satin glass trackpad + click strips
│   │   ├── GamepadScreen.tsx  # Layout 1 (Xbox Asymmetric) & Layout 2 (PS Symmetric)
│   │   ├── KeyboardScreen.tsx # 80% TKL Mechanical Keyboard layout (87 keys)
│   │   └── MediaScreen.tsx    # Media playback and volume controllers
│   ├── services/
│   │   ├── SocketService.ts   # Socket.IO client singleton + batching
│   │   ├── DiscoveryService.ts# UDP broadcast listener & mDNS
│   │   ├── AudioService.ts    # Native SoundPool wrapper
│   │   └── HapticsService.ts  # Hardware vibration motor engine
│   ├── theme/
│   │   └── colors.ts          # Dark-mode glassmorphism tokens
│   ├── App.tsx                # Root component, orientation listener, immersive setup
│   └── index.js               # AppRegistry entry point
├── package.json
└── tsconfig.json
```

---

## 6. Google Play Store Compliance & Packaging

1. **Android SDK Requirements**:
   - `compileSdkVersion = 35`
   - `targetSdkVersion = 34` (Strict Google Play requirement)
   - `minSdkVersion = 24` (Android 7.0+, covering 98%+ of global devices)
2. **Permissions Configuration**:
   ```xml
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
   <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
   <uses-permission android:name="android.permission.VIBRATE" />
   <uses-permission android:name="android.permission.WAKE_LOCK" />
   <uses-permission android:name="android.permission.CAMERA" /> <!-- Optional QR pairing -->
   ```
3. **Window & Display Flags**:
   - Hardware acceleration enabled: `android:hardwareAccelerated="true"`
   - Cutout / notch mode: `android:windowLayoutInDisplayCutoutMode="shortEdges"`
   - Immersive sticky mode (auto-hides system status bar and navigation pill)
4. **App Bundle & Release Keystore**:
   - Generate production signing keystore:
     ```powershell
     keytool -genkeypair -v -keystore release.keystore -alias remotemouse -keyalg RSA -keysize 2048 -validity 10000
     ```
   - Build Android App Bundle (`.aab`):
     ```powershell
     cd mobile/android && ./gradlew bundleRelease
     ```
   - Target output: `mobile/android/app/build/outputs/bundle/release/app-release.aab`
5. **Privacy Policy**:
   - Google Play strictly requires a live Privacy Policy URL. Maintain `PRIVACY_POLICY.md` confirming 100% offline, local LAN communication with zero data collection or third-party telemetry.

---

## 7. Autonomous Execution Rules for the Agent

1. **Follow the Planning Cycle**: For every major phase, plan the concrete steps, confirm alignment with user, execute with rigor, and verify via compilation and automated checks.
2. **Strict Preservation of Physics**: Never simplify the math or omit deadzones, octant mappings, sprint rings, or acceleration curves. The tactile precision of the mouse and controller is paramount.
3. **Zero UI Letterboxing**: Use responsive sizing (`Dimensions`, `Flexbox`, `aspectRatio`) so both Gamepad layouts adapt dynamically to any mobile aspect ratio (16:9, 19.5:9, 21:9).
4. **SoundPool for Audio**: Do not use browser Web Audio or high-latency media players for key clacks. Use native SoundPool micro-samples to maintain zero-latency responsiveness.
