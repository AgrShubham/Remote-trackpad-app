import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { discoveryService, DiscoveredHost } from './DiscoveryService';
import { socketService } from './SocketService';
import { settingsService } from './SettingsService';

export interface StoredServerInfo {
  name: string;
  ip: string;
  port: number;
  udpPort: number;
  lastConnected: number;
}

const LAST_SERVER_KEY = '@remote_mouse_last_connected_server_v1';

class AutoConnectService {
  private lastKnownServer: StoredServerInfo | null = null;
  private isInitialized: boolean = false;
  private appStateSubscription: any = null;
  private beaconUnsub: any = null;
  private discoveryUnsub: any = null;
  private connectCooldownUntil: number = 0;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Load persisted last connected server
    try {
      const data = await AsyncStorage.getItem(LAST_SERVER_KEY);
      if (data) {
        this.lastKnownServer = JSON.parse(data);
      }
    } catch (e) {
      console.warn('[AutoConnectService] Failed to load cached server:', e);
    }

    // 2. Start global persistent UDP discovery
    discoveryService.startListening();

    // 3. Subscribe to real-time incoming beacons for instant auto-connect (<1s)
    this.beaconUnsub = discoveryService.onBeacon((host) => {
      this.handleBeacon(host);
    });

    // 4. Also listen to batch discovery updates
    this.discoveryUnsub = discoveryService.subscribe((hosts) => {
      this.handleHostsList(hosts);
    });

    // 5. Handle phone sleep/wake & app background/foreground transitions
    this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      this.handleAppStateChange(nextState);
    });

    // 6. Cold boot auto-connect: if we have a known server, immediately attempt fast connect
    setTimeout(() => {
      if (this.shouldAutoReconnect() && this.lastKnownServer) {
        const { ip, port, udpPort, name } = this.lastKnownServer;
        console.log(`[AutoConnectService] Boot reconnect to known server: ${name} (${ip})`);
        socketService.connect(ip, port, udpPort, name);
      }
    }, 300);
  }

  private shouldAutoReconnect(): boolean {
    return settingsService.getSettings().autoReconnect;
  }

  public async rememberServer(server: { name: string; ip: string; port: number; udpPort?: number }) {
    this.lastKnownServer = {
      name: server.name,
      ip: server.ip,
      port: server.port,
      udpPort: server.udpPort || 5002,
      lastConnected: Date.now(),
    };
    try {
      await AsyncStorage.setItem(LAST_SERVER_KEY, JSON.stringify(this.lastKnownServer));
    } catch (e) {}
  }

  public getLastKnownServer(): StoredServerInfo | null {
    return this.lastKnownServer;
  }

  private handleAppStateChange(nextState: AppStateStatus) {
    if (nextState === 'active') {
      console.log('[AutoConnectService] App resumed (active). Refreshing discovery & verifying connection...');
      // Re-trigger UDP discovery socket to refresh OS network routing tables
      discoveryService.rescan();

      const status = socketService.getStatus();
      if (status !== 'connected' && this.shouldAutoReconnect()) {
        if (this.lastKnownServer) {
          socketService.connect(
            this.lastKnownServer.ip,
            this.lastKnownServer.port,
            this.lastKnownServer.udpPort,
            this.lastKnownServer.name
          );
        }
      }
    }
  }

  private handleBeacon(host: DiscoveredHost) {
    if (!this.shouldAutoReconnect()) return;

    const now = Date.now();
    const currentStatus = socketService.getStatus();
    const currentIp = socketService.getHostIp();
    const currentServerName = socketService.getServerName();
    const targetName = currentServerName || (this.lastKnownServer ? this.lastKnownServer.name : null);

    // Matching condition: same server name (case-insensitive) or same IP
    const isMatchingServer = targetName && host.name.toLowerCase() === targetName.toLowerCase();

    if (isMatchingServer) {
      // 1. IP MIGRATION DETECTED: The server moved to a new IP (e.g. Wi-Fi -> Hotspot)
      if (host.ip !== currentIp) {
        if (now > this.connectCooldownUntil) {
          console.log(`[AutoConnectService] Host ${host.name} migrated IP: ${currentIp || 'none'} -> ${host.ip}. Migrating socket instantly!`);
          this.connectCooldownUntil = now + 1200;
          this.rememberServer(host);
          socketService.connect(host.ip, host.port, host.udpPort, host.name);
          return;
        }
      }

      // 2. DISCONNECTED / ERROR RECONNECT: The server is online and we are disconnected
      if (currentStatus === 'disconnected' || currentStatus === 'error') {
        if (now > this.connectCooldownUntil) {
          console.log(`[AutoConnectService] Known host ${host.name} beacon received. Reconnecting to ${host.ip}...`);
          this.connectCooldownUntil = now + 1200;
          this.rememberServer(host);
          socketService.connect(host.ip, host.port, host.udpPort, host.name);
          return;
        }
      }
    }
  }

  private handleHostsList(hosts: DiscoveredHost[]) {
    if (!this.shouldAutoReconnect() || hosts.length === 0) return;

    const now = Date.now();
    const currentStatus = socketService.getStatus();

    // Zero-config fallback: If no last server is saved and we are disconnected, auto-connect to sole host
    if (!this.lastKnownServer && (currentStatus === 'disconnected' || currentStatus === 'error')) {
      if (hosts.length === 1 && now > this.connectCooldownUntil) {
        const soleHost = hosts[0];
        console.log(`[AutoConnectService] Sole LAN host discovered: ${soleHost.name} (${soleHost.ip}). Auto-connecting...`);
        this.connectCooldownUntil = now + 1500;
        this.rememberServer(soleHost);
        socketService.connect(soleHost.ip, soleHost.port, soleHost.udpPort, soleHost.name);
      }
    }
  }

  public destroy() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    if (this.beaconUnsub) {
      this.beaconUnsub();
      this.beaconUnsub = null;
    }
    if (this.discoveryUnsub) {
      this.discoveryUnsub();
      this.discoveryUnsub = null;
    }
  }
}

export const autoConnectService = new AutoConnectService();

