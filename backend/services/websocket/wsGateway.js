// 🏏 PRIME DREEMS — REAL-TIME WEBSOCKET GATEWAY & DELTA PUB/SUB
// Section 3: High-concurrency fan-out, lean 200-byte delta streaming & backpressure handling

const { WebSocketServer, WebSocket } = require('ws');

class WebSocketGateway {
  constructor() {
    this.wss = null;
    this.rooms = new Map(); // matchId -> Set of WebSockets
    this.clientSubscriptions = new Map(); // ws -> Set of matchIds
    this.stats = {
      active_connections: 0,
      total_messages_sent: 0,
      dropped_slow_messages: 0,
    };
  }

  /**
   * Attach WebSocket server to Node.js HTTP server
   */
  initialize(server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      clientTracking: true,
      maxPayload: 16 * 1024, // 16KB max incoming payload
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    console.log('⚡ [WS Gateway] Real-time WebSocket Gateway attached on /ws');
  }

  handleConnection(ws, req) {
    this.stats.active_connections += 1;
    this.clientSubscriptions.set(ws, new Set());

    // Send connection greeting with recommended reconnection jitter (Section 3.4)
    this.sendJson(ws, {
      type: 'CONNECTED',
      server_time: new Date().toISOString(),
      reconnect_jitter_ms: Math.floor(Math.random() * 3000), // 0-3s jitter
    });

    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message.toString());
        this.handleClientMessage(ws, payload);
      } catch (err) {
        this.sendJson(ws, { type: 'ERROR', message: 'Malformed JSON payload' });
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (err) => {
      console.warn('⚠️ [WS Gateway] Client error:', err.message);
    });
  }

  handleClientMessage(ws, payload) {
    const { action, matchId } = payload;

    if (action === 'ping') {
      this.sendJson(ws, { type: 'PONG', timestamp: Date.now() });
      return;
    }

    if (action === 'subscribe' && matchId) {
      if (!this.rooms.has(matchId)) {
        this.rooms.set(matchId, new Set());
      }
      this.rooms.get(matchId).add(ws);
      this.clientSubscriptions.get(ws).add(matchId);

      // Fetch and send immediate snapshot for fast startup
      const hotStore = require('../ingestion/hotStore');
      const snap = hotStore.getSnapshot(matchId);
      if (snap) {
        this.sendJson(ws, {
          type: 'MATCH_SNAPSHOT',
          match_id: matchId,
          data: snap.score,
          updated_seconds_ago: snap.updated_seconds_ago,
        });
      } else {
        this.sendJson(ws, {
          type: 'SUBSCRIBED',
          match_id: matchId,
        });
      }
      return;
    }

    if (action === 'unsubscribe' && matchId) {
      if (this.rooms.has(matchId)) {
        this.rooms.get(matchId).delete(ws);
      }
      if (this.clientSubscriptions.has(ws)) {
        this.clientSubscriptions.get(ws).delete(matchId);
      }
      this.sendJson(ws, { type: 'UNSUBSCRIBED', match_id: matchId });
      return;
    }
  }

  handleDisconnection(ws) {
    this.stats.active_connections = Math.max(0, this.stats.active_connections - 1);
    const subs = this.clientSubscriptions.get(ws);
    if (subs) {
      for (const matchId of subs) {
        const room = this.rooms.get(matchId);
        if (room) room.delete(ws);
      }
      this.clientSubscriptions.delete(ws);
    }
  }

  /**
   * Broadcast Delta Update to all clients watching this match (Section 3.2)
   */
  broadcastDelta(matchId, deltaPayload) {
    const room = this.rooms.get(matchId);
    if (!room || room.size === 0) return;

    const message = JSON.stringify({
      type: 'BALL_DELTA',
      match_id: matchId,
      ...deltaPayload,
      timestamp: Date.now(),
    });

    for (const ws of room) {
      if (ws.readyState === WebSocket.OPEN) {
        // Slow Client Backpressure Handling (Section 3.3)
        // If client's send buffer > 64KB, client is lagging (e.g. 2G network). Drop delta and send RESYNC_REQUIRED.
        if (ws.bufferedAmount > 64 * 1024) {
          this.stats.dropped_slow_messages += 1;
          this.sendJson(ws, {
            type: 'RESYNC_REQUIRED',
            match_id: matchId,
            reason: 'Network backpressure detected. Please fetch clean snapshot via REST.',
          });
          continue;
        }

        ws.send(message);
        this.stats.total_messages_sent += 1;
      }
    }
  }

  /**
   * Helper to safely send JSON to a single client
   */
  sendJson(ws, obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
      this.stats.total_messages_sent += 1;
    }
  }

  getStats() {
    return {
      active_connections: this.stats.active_connections,
      active_rooms: this.rooms.size,
      total_messages_sent: this.stats.total_messages_sent,
      dropped_slow_messages: this.stats.dropped_slow_messages,
    };
  }
}

module.exports = new WebSocketGateway();

