import dgram from 'react-native-udp';

class UdpInputService {
  private socket: any = null;
  private targetHost: string = '';
  private targetPort: number = 5002;
  private isBound: boolean = false;

  constructor() {
    this.initSocket();
  }

  private initSocket() {
    try {
      if (this.socket) {
        try {
          this.socket.close();
        } catch (e) {}
        this.socket = null;
      }

      this.socket = dgram.createSocket({ type: 'udp4' });

      this.socket.on('error', (err: any) => {
        console.warn('UdpInputService error:', err);
      });

      // Bind to an ephemeral port for sending
      this.socket.bind(0, () => {
        this.isBound = true;
      });
    } catch (e) {
      console.warn('Could not initialize UDP input socket:', e);
      this.isBound = false;
    }
  }

  public setTarget(host: string, port: number = 5002) {
    this.targetHost = host;
    this.targetPort = port;
    if (!this.socket || !this.isBound) {
      this.initSocket();
    }
  }

  public isReady(): boolean {
    return this.isBound && !!this.targetHost && !!this.socket;
  }

  public sendMove(dx: number, dy: number) {
    if (!this.isReady()) return false;
    try {
      // Compact ASCII payload: "M <dx> <dy>"
      const payload = `M ${dx.toFixed(2)} ${dy.toFixed(2)}`;
      this.socket.send(payload, 0, payload.length, this.targetPort, this.targetHost, (err: any) => {
        if (err) {
          console.warn('UDP send error:', err);
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  public sendScroll(dx: number, dy: number) {
    if (!this.isReady()) return false;
    try {
      // Compact ASCII payload: "S <dx> <dy>"
      const payload = `S ${dx.toFixed(2)} ${dy.toFixed(2)}`;
      this.socket.send(payload, 0, payload.length, this.targetPort, this.targetHost, (err: any) => {
        if (err) {
          console.warn('UDP scroll send error:', err);
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  public close() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
      this.socket = null;
    }
    this.isBound = false;
    this.targetHost = '';
  }
}

export const udpInputService = new UdpInputService();
