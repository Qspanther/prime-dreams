# 🤖 Prime Dreems Autonomous Bot Service

This service runs the **Prime Dreems 10,000 Bot Network & Organic 72-Hour Deployment Engine** completely decoupled from the user-facing backend API.

---

## 🎯 Why is Bot Service Separated from User Backend?

1. **Zero Connection Contention on Neon Free Tier**:
   - The Neon Free PostgreSQL tier limits total pooled connections to ~100.
   - The user backend (`port 5000`) uses `PG_POOL_MAX=5` strictly for real users.
   - The bot service (`port 5100`) uses an isolated pool (`BOT_PG_POOL_MAX=3`) with `min: 0` idle shrinkage.
   - Total database connections for the entire platform are at most **8**, leaving ample room below Neon's 100 limit.

2. **Zero CPU Starvation on Render Free Tier**:
   - Render Free Web Services provide 512 MB RAM and 0.1 vCPU.
   - Running 10,000 bots and 72-hour scheduling inside the user backend would cause latency spikes, OOMs, and 502/504 Bad Gateway errors for real users.
   - Isolating bots into their own service ensures the main user API responds in **< 10ms**.

3. **Isolated WebSocket Traffic**:
   - Real users connect to `/ws` on the main user backend.
   - Bots communicate on internal `/ws-bots` on the bot service.

4. **Strict Fairplay Rules**:
   - Bots **NEVER** join Head-to-Head (H2H) duels or Private contests.
   - Batched joins are capped at **5 bots per tick** on the free tier.
   - **Neon Connection Guard**: If active DB connections exceed 60, the bot service automatically skips its tick to prioritize real users.

---

## 🚀 Render Free Web Service Deployment Guide

You can deploy this service on Render as a **separate Free Web Service** from the same GitHub repository:

1. In Render Dashboard, click **New +** → **Web Service**.
2. Connect your repository: `https://github.com/Qspanther/prime-dreams`.
3. Configure the service settings:
   - **Name**: `prime-dreems-bot-service`
   - **Region**: Same region as your backend (e.g. `Oregon` or `Ohio`)
   - **Branch**: `main`
   - **Root Directory**: `backend/bot-service`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free (512 MB RAM / 0.1 CPU)`

4. Add Environment Variables:
   | Key | Value | Description |
   |-----|-------|-------------|
   | `PORT` | `5100` | Port for the bot service |
   | `BOT_DATABASE_URL` | `postgresql://...` | Neon pooled connection string with `?sslmode=require` |
   | `BOT_MANAGER_KEY` | `c11_bot_mgr_sec_9938a7fbc21d49e` | API key for admin management |
   | `BOT_INTERVAL_MS` | `60000` | Tick interval (60 seconds) |
   | `BOT_MAX_ACTIVE` | `1000` | Max active bot roster for free tier |
   | `BOT_BATCH_PER_TICK` | `5` | Maximum bots joined per tick |
   | `BOT_PG_POOL_MAX` | `3` | Connection pool limit for Neon free tier |

5. Click **Create Web Service**.

---

## 🩺 Health Check & Monitoring
- **Health check URL**: `https://<your-bot-service>.onrender.com/health`
- Returns:
  ```json
  {
    "status": "ok",
    "service": "prime-dreems-bot-service",
    "neon_active_connections": 4,
    "scheduler": {
      "running": true,
      "totalBotsJoined": 42,
      "maxBatchPerTick": 5
    }
  }
  ```
