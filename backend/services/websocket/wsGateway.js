// 🏏 PRIME DREEMS — REAL-TIME WEBSOCKET GATEWAY & REDIS PUB/SUB
// Section 3: High-concurrency fan-out, 500-conn cap (503 backpressure), 30s heartbeat & dead-socket pruning

const { WebSocketServer, WebSocket } = require('ws');
const redisPubSub = require('../../ws/redisPubSub');

class WebSocketGateway {
  constructor() {
    this.wss = null;
    this.rooms = new Map(); // matchId -> Set of WebSockets
    this.clientSubscriptions = new Map(); // ws -> Set of matchIds
    this.heartbeatInterval = null;
    this.stats = {
      active_connections: 0,
      total_messages_sent: 0,
      dropped_slow_messages: 0,
      rejected_over_capacity: 0,
    };

    // Listen to Redis / Local PubSub events
    redisPubSub.onDelta(({ matchId, payload }) => {
      this.broadcastDelta(matchId, payload);
    });
  }

  /**
   * Attach WebSocket server with max connection guard (Free Tier: 500 connections)
   */
  initialize(server) {
    const maxConnections = parseInt(process.env.MAX_WS_CONNECTIONS || '500', 10);

    this.wss = new WebSocketServer({
      noServer: true,
      path: '/ws',
      clientTracking: true,
      maxPayload: 16 * 1024, // 16KB max payload
    });

    // Handle HTTP upgrade with 503 limit check
    server.on('upgrade', (request, socket, head) => {
      try {
        const { pathname } = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
        if (pathname === '/ws') {
          if (this.stats.active_connections >= maxConnections) {
            this.stats.rejected_over_capacity += 1;
            socket.write('HTTP/1.1 503 Service Unavailable\r\nRetry-After: 30\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
          }

          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss.emit('connection', ws, request);
          });
        }
      } catch (err) {
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // 30s Heartbeat Ping/Pong & 60s Dead-socket Pruning
    this.startHeartbeat();

    console.log(`⚡ [WS Gateway] Attached on /ws (Cap: ${maxConnections} concurrent clients, 30s heartbeat active)`);
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      for (const ws of this.wss.clients) {
        if (ws.isAlive === false) {
          // Did not reply to previous ping within 30s -> close dead socket
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch (_) {
          ws.terminate();
        }
      }
    }, 30000);
    this.heartbeatInterval.unref();
  }

  handleConnection(ws, _req) {
    this.stats.active_connections += 1;
    this.clientSubscriptions.set(ws, new Set());
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Send connection greeting with recommended reconnection jitter
    this.sendJson(ws, {
      type: 'CONNECTED',
      server_time: new Date().toISOString(),
      reconnect_jitter_ms: Math.floor(Math.random() * 3000),
    });

    ws.on('message', (message) => {
      try {
        ws.isAlive = true;
        const payload = JSON.parse(message.toString());
        this.handleClientMessage(ws, payload);
      } catch (err) {
        this.sendJson(ws, { type: 'ERROR', message: 'Malformed JSON payload' });
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (_err) => {
      this.handleDisconnection(ws);
    });
  }

  handleClientMessage(ws, payload) {
    const { action, matchId } = payload;

    if (action === 'ping') {
      ws.isAlive = true;
      this.sendJson(ws, { type: 'PONG', timestamp: Date.now() });
      return;
    }

    if (action === 'subscribe' && matchId) {
      if (!this.rooms.has(matchId)) {
        this.rooms.set(matchId, new Set());
      }
      this.rooms.get(matchId).add(ws);
      this.clientSubscriptions.get(ws).add(matchId);

      // Fetch snapshot from Cache / HotStore
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
   * Broadcast Delta Update to all clients watching this match
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
        // Slow Client Backpressure Handling: drop delta if buffer > 64KB
        if (ws.bufferedAmount > 64 * 1024) {
          this.stats.dropped_slow_messages += 1;
          this.sendJson(ws, {
            type: 'RESYNC_REQUIRED',
            match_id: matchId,
            reason: 'Network backpressure detected. Please fetch clean snapshot via REST.',
          });
          continue;
        }

        try {
          ws.send(message);
          this.stats.total_messages_sent += 1;
        } catch (_) {}
      }
    }
  }

  /**
   * Helper to safely send JSON to a single client
   */
  sendJson(ws, obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(obj));
        this.stats.total_messages_sent += 1;
      } catch (_) {}
    }
  }

  getStats() {
    return {
      active_connections: this.stats.active_connections,
      active_rooms: this.rooms.size,
      total_messages_sent: this.stats.total_messages_sent,
      dropped_slow_messages: this.stats.dropped_slow_messages,
      rejected_over_capacity: this.stats.rejected_over_capacity,
    };
  }
}

module.exports = new WebSocketGateway();
