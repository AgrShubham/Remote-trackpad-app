import dgram from 'react-native-udp';

export interface DiscoveredHost {
  name: string;
  ip: string;
  allIps?: string[];
  port: number;
  udpPort?: number;
  lastSeen: number;
  version?: string;
}

type DiscoveryListener = (hosts: DiscoveredHost[]) => void;
type BeaconListener = (host: DiscoveredHost) => void;

class DiscoveryService {
  private socket: any = null;
  private hosts: Map<string, DiscoveredHost> = new Map();
  private hostsByName: Map<string, DiscoveredHost> = new Map();
  private listeners: Set<DiscoveryListener> = new Set();
  private beaconListeners: Set<BeaconListener> = new Set();
  private cleanupInterval: any = null;
  private isListening: boolean = false;

  public subscribe(listener: DiscoveryListener): () => void {
    this.listeners.add(listener);
    listener(Array.from(this.hosts.values()));
    return () => this.listeners.delete(listener);
  }

  public onBeacon(listener: BeaconListener): () => void {
    this.beaconListeners.add(listener);
    return () => this.beaconListeners.delete(listener);
  }

  private notify() {
    const list = Array.from(this.hosts.values());
    this.listeners.forEach((listener) => listener(list));
  }

  public getHostByName(name: string): DiscoveredHost | undefined {
    return this.hostsByName.get(name.toLowerCase());
  }

  public getAllHosts(): DiscoveredHost[] {
    return Array.from(this.hosts.values());
  }

  public startListening(port: number = 5001) {
    if (this.isListening) return;

    try {
      this.socket = dgram.createSocket({ type: 'udp4' });

      this.socket.on('message', (msg: any, rinfo: any) => {
        try {
          const text = msg.toString('utf8');
          const data = JSON.parse(text);
          if (data.app === 'RemoteTrackpadPro') {
            // Prefer rinfo.address as the actual interface IP the packet arrived from
            const hostIp = (rinfo && rinfo.address) ? rinfo.address : data.ip;
            if (hostIp) {
              const hostPort = data.port || 5000;
              const hostKey = `${hostIp}:${hostPort}`;
              const hostObj: DiscoveredHost = {
                name: data.name || hostIp,
                ip: hostIp,
                allIps: data.all_ips || [hostIp],
                port: hostPort,
                udpPort: data.udp_port || 5002,
                lastSeen: Date.now(),
                version: data.version || '1.0.0',
              };

              this.hosts.set(hostKey, hostObj);
              if (data.name) {
                this.hostsByName.set(data.name.toLowerCase(), hostObj);
              }
              this.notify();

              // Trigger real-time per-beacon subscribers for instant auto-connect
              this.beaconListeners.forEach((listener) => listener(hostObj));
            }
          }
        } catch (e) {
          // Ignore non-json or malformed datagrams
        }
      });

      this.socket.on('error', (err: any) => {
        console.warn('UDP Discovery error:', err);
      });

      this.socket.bind(port, () => {
        this.isListening = true;
      });

      // Periodically remove hosts that haven't sent a beacon in 6 seconds
      this.cleanupInterval = setInterval(() => {
        const now = Date.now();
        let changed = false;
        this.hosts.forEach((host, key) => {
          if (now - host.lastSeen > 6000) {
            this.hosts.delete(key);
            if (host.name) {
              this.hostsByName.delete(host.name.toLowerCase());
            }
            changed = true;
          }
        });
        if (changed) this.notify();
      }, 2000);
    } catch (e) {
      console.warn('Could not initialize UDP discovery socket:', e);
    }
  }

  public rescan(port: number = 5001) {
    this.stopListening();
    this.hosts.clear();
    this.hostsByName.clear();
    this.notify();
    this.startListening(port);
  }

  public stopListening() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
      this.socket = null;
    }
    this.isListening = false;
  }
}

export const discoveryService = new DiscoveryService();
