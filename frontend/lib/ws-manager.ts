import { getWebSocketUrl } from '@/app/lib/api';

type MessageHandler = (data: any) => void;

class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private socket: WebSocket | null = null;
  private subscribers: Map<string, Set<MessageHandler>> = new Map();
  private globalSubscribers: Set<MessageHandler> = new Set();
  private messageQueue: string[] = [];
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private baseReconnectDelay: number = 1000;
  private maxReconnectDelay: number = 15000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Singleton
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  public connect(): void {
    if (typeof window === 'undefined') return;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      const url = getWebSocketUrl();
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          if (msg && this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(msg);
          }
        }

        // Re-subscribe all active match channels
        for (const matchId of this.subscribers.keys()) {
          const subSet = this.subscribers.get(matchId);
          if (subSet && subSet.size > 0 && this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ action: 'subscribe', matchId }));
          }
        }
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);

          // Broadcast to global subscribers
          this.globalSubscribers.forEach((cb) => {
            try { cb(payload); } catch (e) { console.error('WS global cb error:', e); }
          });

          // Match-specific broadcast
          const matchId = payload.match_id || payload.matchId;
          if (matchId && this.subscribers.has(matchId)) {
            const set = this.subscribers.get(matchId);
            set?.forEach((cb) => {
              try { cb(payload); } catch (e) { console.error('WS match cb error:', e); }
            });
          }
        } catch {
          // Ignore malformed JSON
        }
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnecting = false;
        try { this.socket?.close(); } catch (_) {}
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Reset attempt counter after long delay to keep trying periodically
      this.reconnectAttempts = 0;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts) + Math.random() * 1000,
      this.maxReconnectDelay
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ action: 'ping' }));
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public subscribe(matchId: string, callback: MessageHandler): () => void {
    if (!this.subscribers.has(matchId)) {
      this.subscribers.set(matchId, new Set());
    }
    this.subscribers.get(matchId)!.add(callback);

    // Send subscribe action to server
    this.send({ action: 'subscribe', matchId });

    // Return cleanup / unsubscribe function
    return () => {
      this.unsubscribe(matchId, callback);
    };
  }

  public subscribeGlobal(callback: MessageHandler): () => void {
    this.globalSubscribers.add(callback);
    return () => {
      this.globalSubscribers.delete(callback);
    };
  }

  public unsubscribe(matchId: string, callback?: MessageHandler): void {
    if (!this.subscribers.has(matchId)) return;
    const set = this.subscribers.get(matchId)!;
    if (callback) {
      set.delete(callback);
    } else {
      set.clear();
    }

    if (set.size === 0) {
      this.subscribers.delete(matchId);
      this.send({ action: 'unsubscribe', matchId });
    }
  }

  public send(payload: any): void {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(raw);
    } else {
      this.messageQueue.push(raw);
      if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

export const wsManager = WebSocketManager.getInstance();
export default wsManager;
