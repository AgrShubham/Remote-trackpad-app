# Privacy Policy for Remote Trackpad Pro

**Last Updated**: September 2026

**Remote Trackpad Pro** ("the Application") is an offline wireless peripheral utility designed to convert your mobile device into a trackpad, gamepad, and mechanical keyboard for your computer over a local area network (LAN).

Your privacy is paramount. This Privacy Policy details how the Application operates and our commitment to zero data collection.

---

## 1. Information Collection & Usage

- **Zero Data Collection**: The Application does **not** collect, store, transmit, or share any personal data, identifiers, location information, usage analytics, or device diagnostics.
- **Zero Cloud Servers**: The Application does not communicate with any external cloud servers, third-party backend databases, or advertising networks.
- **100% Local Wi-Fi (LAN) Communication**: All network communications (mouse movements, keyboard presses, gamepad inputs, and discovery beacons) are strictly confined to your private local Wi-Fi network between your mobile phone and your personal computer.

---

## 2. Permissions & Why They Are Needed

The Application requests only the minimal set of Android system permissions required to function as a wireless controller:

| Permission | Technical Name | Purpose / Justification |
| :--- | :--- | :--- |
| **Internet Access** | `android.permission.INTERNET` | Enables the WebSocket client to communicate directly with your PC server on your local Wi-Fi network. |
| **Network State** | `android.permission.ACCESS_NETWORK_STATE` | Detects when your device connects or disconnects from your local Wi-Fi network to manage socket reconnection. |
| **Wi-Fi & Multicast** | `android.permission.ACCESS_WIFI_STATE`<br/>`android.permission.CHANGE_WIFI_MULTICAST_STATE` | Allows the Application to receive UDP auto-discovery announcements broadcast by your host PC server on port 5001. |
| **Vibration** | `android.permission.VIBRATE` | Powers the tactile haptic feedback motor on physical trackpad clicks, gamepad triggers, and mechanical key actuations. |
| **Keep Awake** | `android.permission.WAKE_LOCK` | Prevents your smartphone display from sleeping while actively using the trackpad or gamepad during gaming or productivity. |
| **Camera** | `android.permission.CAMERA` | Used exclusively on-device to scan the pairing QR code displayed by the PC server. No photos or video recordings are ever stored or transmitted. |

---

## 3. Third-Party Services & Analytics

The Application contains:
- **Zero** advertising SDKs (no AdMob, Unity Ads, etc.)
- **Zero** third-party trackers or telemetry (no Google Analytics, Firebase Analytics, or Crashlytics)
- **Zero** user accounts or authentication requirements

---

## 4. Children's Privacy

The Application does not address anyone under the age of 13 and collects zero information from any user, including children.

---

## 5. Security

Because all communication is direct peer-to-peer over your private local Wi-Fi network, your inputs never leave your personal network environment. We recommend using a WPA2/WPA3 password-protected Wi-Fi network for optimal security.

---

## 6. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Any changes will be published in this document.

---

## 7. Contact Information

If you have any questions or concerns regarding this Privacy Policy, please contact:
- **Developer**: AgrShubham
- **Project Repository**: [Remote Trackpad Pro on GitHub](https://github.com/AgrShubham/remote_mouse)
