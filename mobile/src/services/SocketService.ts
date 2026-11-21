import io, { Socket } from 'socket.io-client';
import { udpInputService } from './UdpInputService';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type StatusListener = (status: ConnectionStatus, latencyMs: number) => void;

class SocketService {
  private socket: Socket | null = null;
  private currentHost: string = '';
  private currentServerName: string = '';
  private currentIp: string = '';
  private currentPort: number = 5000;
  private currentUdpPort: number = 5002;
  private status: ConnectionStatus = 'disconnected';
  private latency: number = 0;
  private listeners: Set<StatusListener> = new Set();
  private pingInterval: any = null;
  private missedPings: number = 0;

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.latency);
    return () => this.listeners.delete(listener);
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.status, this.latency));
  }

  public connect(ip: string, port: number = 5000, udpPort: number = 5002, serverName?: string) {
    const host = `http://${ip}:${port}`;

    // If already actively connected to this exact IP and port, ignore duplicate call
    if (this.socket && this.socket.connected && this.currentHost === host) {
      if (serverName) this.currentServerName = serverName;
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentHost = host;
    this.currentIp = ip;
    this.currentPort = port;
    this.currentUdpPort = udpPort;
    if (serverName) {
      this.currentServerName = serverName;
    }

    this.setStatus('connecting');

    // Initialize ultra-low latency UDP motion streamer
    udpInputService.setTarget(ip, udpPort);

    this.socket = io(host, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity, // Keep retrying while network is transitioning
      reconnectionDelay: 500,
      reconnectionDelayMax: 2500,
      timeout: 4000,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      this.missedPings = 0;
      this.setStatus('connected');
      this.startPingMonitor();
    });

    this.socket.on('disconnect', () => {
      this.setStatus('disconnected');
      this.stopPingMonitor();
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket connect error:', err);
      this.setStatus('error');
      this.stopPingMonitor();
    });
  }

  public disconnect() {
    this.stopPingMonitor();
    udpInputService.close();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getLatency(): number {
    return this.latency;
  }

  public getHost(): string {
    return this.currentHost;
  }

  public getHostIp(): string {
    return this.currentIp;
  }

  public getServerName(): string {
    return this.currentServerName;
  }

  public getPort(): number {
    return this.currentPort;
  }

  public getUdpPort(): number {
    return this.currentUdpPort;
  }

  private startPingMonitor() {
    this.stopPingMonitor();
    this.missedPings = 0;
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        const start = Date.now();
        let responded = false;

        this.socket.emit('ping_check', () => {
          responded = true;
          this.missedPings = 0;
          this.latency = Date.now() - start;
          this.notify();
        });

        // Fast timeout check: If no ping response after 1800ms, record missed ping
        setTimeout(() => {
          if (!responded && this.status === 'connected') {
            this.missedPings++;
            if (this.missedPings >= 2) {
              console.warn('[SocketService] Heartbeat dead: 2 missed pings. Flagging disconnected for auto-reconnect.');
              this.setStatus('disconnected');
            }
          }
        }, 1800);
      }
    }, 2500);
  }

  private stopPingMonitor() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.latency = 0;
    this.missedPings = 0;
  }

  // ==================== Mouse Operations (Zero-Lag UDP Motion Pipeline) ====================

  public move(dx: number, dy: number) {
    // 1. Try instantaneous UDP motion pipeline (<1ms, no Head-of-Line blocking)
    const sentViaUdp = udpInputService.sendMove(dx, dy);
    if (sentViaUdp) return;

    // 2. Reliable fallback to WebSocket TCP if UDP socket not ready
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('move', { dx, dy });
  }

  public click(button: 'left' | 'right' | 'middle' = 'left', count: number = 1) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('click', { button, count });
  }

  public mouseDown(button: 'left' | 'right' | 'middle' = 'left') {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('mouse_down', { button });
  }

  public mouseUp(button: 'left' | 'right' | 'middle' = 'left') {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('mouse_up', { button });
  }

  public scroll(dx: number, dy: number) {
    // 1. Try instantaneous UDP scroll pipeline
    const sentViaUdp = udpInputService.sendScroll(dx, dy);
    if (sentViaUdp) return;

    // 2. Reliable fallback to WebSocket TCP
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('scroll', { dx, dy });
  }

  // ==================== Keyboard Operations ====================

  public key(name: string, action: 'tap' | 'press' | 'release' = 'tap') {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('key', { name, action });
  }

  public shortcut(keys: string[]) {
    if (!this.socket || !this.socket.connected) return;
    for (const k of keys) {
      this.key(k, 'press');
    }
    for (let i = keys.length - 1; i >= 0; i--) {
      this.key(keys[i], 'release');
    }
  }

  public text(str: string) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('text', { text: str });
  }

  // ==================== Gamepad Operations ====================

  public gamepadButtonDown(input: string) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('gamepad_button_down', { input });
  }

  public gamepadButtonUp(input: string) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('gamepad_button_up', { input });
  }

  public gamepadStickSync(keys: string[]) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('gamepad_stick_sync', { keys });
  }

  public gamepadReleaseAll() {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('gamepad_release_all');
  }
}

export const socketService = new SocketService();
