import dgram from 'react-native-udp';

export interface DiscoveredHost {
  name: string;
  ip: string;
  port: number;
  udpPort?: number;
  lastSeen: number;
}

type DiscoveryListener = (hosts: DiscoveredHost[]) => void;

class DiscoveryService {
  private socket: any = null;
  private hosts: Map<string, DiscoveredHost> = new Map();
  private listeners: Set<DiscoveryListener> = new Set();
  private cleanupInterval: any = null;
  private isListening: boolean = false;

  public subscribe(listener: DiscoveryListener): () => void {
    this.listeners.add(listener);
    listener(Array.from(this.hosts.values()));
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const list = Array.from(this.hosts.values());
    this.listeners.forEach((listener) => listener(list));
  }

  public startListening(port: number = 5001) {
    if (this.isListening) return;

    try {
      this.socket = dgram.createSocket({ type: 'udp4' });

      this.socket.on('message', (msg: any, rinfo: any) => {
        try {
          const text = msg.toString('utf8');
          const data = JSON.parse(text);
          if (data.app === 'RemoteTrackpadPro' && data.ip) {
            const hostKey = `${data.ip}:${data.port || 5000}`;
            this.hosts.set(hostKey, {
              name: data.name || rinfo.address,
              ip: data.ip,
              port: data.port || 5000,
              udpPort: data.udp_port || 5002,
              lastSeen: Date.now(),
            });
            this.notify();
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

      // Periodically remove hosts that haven't sent a beacon in 8 seconds
      this.cleanupInterval = setInterval(() => {
        const now = Date.now();
        let changed = false;
        this.hosts.forEach((host, key) => {
          if (now - host.lastSeen > 8000) {
            this.hosts.delete(key);
            changed = true;
          }
        });
        if (changed) this.notify();
      }, 3000);
    } catch (e) {
      console.warn('Could not initialize UDP discovery socket:', e);
    }
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
