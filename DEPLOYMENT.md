# 🚀 Prime Dreems — Production Deployment Guide
## Render Free Tier + Neon Free PostgreSQL + Upstash Redis

This guide walks you through deploying the complete Prime Dreems platform on the **Render Free Tier (512MB RAM, 0.1 CPU)** with **Neon Free Serverless PostgreSQL** and **Upstash Redis Free Tier** with zero breaking changes and full connection isolation.

---

## 🏗️ Platform Architecture

```
                                  ┌─────────────────────────────┐
                                  │      Render Free Tier       │
                                  │    Keep-Alive Cron (*/14)   │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────┐  WebSocket /ws  ┌──────────────────────────────┐
│     prime-dreems-frontend    │ ──────────────▶ │     prime-dreems-backend     │
│   Next.js 15 Standalone      │                 │  Express REST API + WS Gate  │
│      Port 10000 (Free)       │ ──────────────▶ │       Port 5000 (Free)       │
└──────────────────────────────┘    REST /api    └──────────────┬───────────────┘
                                                                │
                                         Pool Max: 5            │ Redis Cache (5s-30s TTL)
                                         (Zero Contention)      ▼
                                                 ┌──────────────────────────────┐
                                                 │    Upstash Redis Free / KV   │
                                                 │     (In-Memory Fallback)     │
                                                 └──────────────┬───────────────┘
                                                                │
┌──────────────────────────────┐                 Pool Max: 3    │
│   prime-dreems-bot-service   │ ───────────────────────────────┼──────────────┐
│  Autonomous Bot Network &    │      (Zero Contention)         │              │
│ 72h Deployment Engine (Free) │                                ▼              ▼
│          Port 5100           │                 ┌─────────────────────────────┐
└──────────────────────────────┘                 │     Neon Free PostgreSQL    │
                                                 │   Pooled Connection String  │
                                                 │ (Pooler Max: 8 < 100 limit) │
                                                 └─────────────────────────────┘
```

---

## 🗄️ Step 1: Set Up Neon Free PostgreSQL

1. Sign up at [Neon.tech](https://neon.tech) (Free tier provides 0.5 GB storage, autosuspend, and 100 pooled connections).
2. Create a project: `prime-dreems-db`.
3. In the project dashboard:
   - Select **Connection Details** ➔ Choose **Pooled connection**.
   - Copy the connection string. It will look like:
     ```text
     postgresql://<username>:<password>@<ep-hostname>-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true
     ```
4. Save this as `DATABASE_URL` (and `BOT_DATABASE_URL`).

> [!NOTE]
> Neon automatically suspends after 5 minutes of inactivity to preserve compute hours.
> Both backend and bot service use `min: 0` connections and `idleTimeoutMillis: 10000` so idle clients disconnect cleanly, allowing Neon to suspend and wake up on demand.

---

## ⚡ Step 2: Set Up Upstash Redis (Optional Cache Layer)

1. Sign up at [Upstash](https://upstash.com) (Free tier includes 10,000 commands/day).
2. Click **Create Database** ➔ Choose primary region close to your Render services.
3. In database details, copy the `REDIS_URL`:
   ```text
   redis://default:<token>@<hostname>.upstash.io:6379
   ```
4. Save this as `REDIS_URL`.

> [!TIP]
> If `REDIS_URL` is omitted or left empty, Prime Dreems automatically falls back to an ultra-fast in-process `Map` cache with TTL expiration. No external Redis setup is strictly required for dev or demo!

---

## 🚀 Step 3: Deploy via Render Blueprint (1-Click Deployment)

The repository includes a production-ready `render.yaml` blueprint that deploys all 3 web services and the keep-alive cron job automatically:

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** ➔ **Blueprint**.
3. Connect your repository: `https://github.com/Qspanther/prime-dreams` (branch: `feat/scale-free-tier` or `main`).
4. Fill in the requested secret environment variables:
   - `DATABASE_URL`: Your pooled Neon connection string.
   - `BOT_DATABASE_URL`: Same pooled Neon connection string.
   - `REDIS_URL`: Upstash Redis connection string (or leave blank for in-memory cache).
5. Click **Apply**.

---

## 🛠️ Step 4: Manual Service Configuration (If Deploying Services Individually)

If you prefer to configure each service manually in the Render dashboard:

### Service 1: `prime-dreems-backend` (User API & WebSocket)
- **Type**: Web Service | **Runtime**: Node
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`
- **Environment Variables**:
  ```ini
  NODE_ENV=production
  PORT=5000
  DATABASE_URL=postgresql://<user>:<pass>@<neon-pooler-host>/neondb?sslmode=require&pgbouncer=true
  PG_POOL_MAX=5
  REDIS_URL=redis://default:<token>@<upstash-host>:6379
  MAX_WS_CONNECTIONS=500
  ENABLE_INGESTION=true
  INGESTION_POLL_INTERVAL_MS=30000
  JWT_SECRET=<your-random-32-char-secret>
  FRONTEND_URL=https://prime-dreams.onrender.com
  ```

### Service 2: `prime-dreems-bot-service` (Isolated Bot Network)
- **Type**: Web Service | **Runtime**: Node
- **Root Directory**: `backend/bot-service`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`
- **Environment Variables**:
  ```ini
  NODE_ENV=production
  PORT=5100
  BOT_DATABASE_URL=postgresql://<user>:<pass>@<neon-pooler-host>/neondb?sslmode=require&pgbouncer=true
  BOT_PG_POOL_MAX=3
  BOT_MANAGER_KEY=c11_bot_mgr_sec_9938a7fbc21d49e
  BOT_INTERVAL_MS=60000
  BOT_MAX_ACTIVE=1000
  BOT_BATCH_PER_TICK=5
  ```

### Service 3: `prime-dreems-frontend` (Next.js 15 Standalone)
- **Type**: Web Service | **Runtime**: Node
- **Root Directory**: `frontend`
- **Build Command**: `npm install --include=dev && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`
- **Environment Variables**:
  ```ini
  NODE_ENV=production
  PORT=10000
  BACKEND_URL=https://prime-dreems-backend.onrender.com
  NEXT_PUBLIC_API_URL=https://prime-dreems-backend.onrender.com
  NEXT_PUBLIC_WEBSOCKET_URL=wss://prime-dreems-backend.onrender.com/ws
  ```

### Cron Job: Keep-Alive Pinger (Prevents 15-Minute Free Spin-Down)
- **Type**: Cron Job
- **Schedule**: `*/14 * * * *` (Every 14 minutes)
- **Command**:
  ```bash
  curl -fsS https://prime-dreems-backend.onrender.com/health https://prime-dreems-bot-service.onrender.com/health || true
  ```
*(Alternatively, configure a free monitor on [cron-job.org](https://cron-job.org) or UptimeRobot to ping `/health` every 10 minutes).*

---

## 🔍 Step 5: Verification & Health Checks

Once deployed, verify that each layer is operational:

| Component | Target URL | Expected Response |
|-----------|------------|-------------------|
| **Frontend Web App** | `https://prime-dreams.onrender.com` | HTTP 200 (Home Screen) |
| **Frontend Health Route** | `https://prime-dreams.onrender.com/api/health` | `{"status":"ok","backend_status":{...}}` |
| **Backend Health** | `https://prime-dreems-backend.onrender.com/health` | `{"status":"ok","platform":"Prime Dreems"}` |
| **Bot Service Health** | `https://<bot-service>.onrender.com/health` | `{"status":"ok","service":"prime-dreems-bot-service"}` |
| **Live WebSocket** | `wss://prime-dreems-backend.onrender.com/ws` | Protocol Upgrade HTTP 101 |

---

## 🔒 Neon Connection Budget Summary

| Service | Pool Max | Minimum | Purpose |
|---------|----------|---------|---------|
| **User Backend** | `5` | `0` | Live user actions (browsing, joining contests, wallet) |
| **Bot Service** | `3` | `0` | Autonomous 72-hour bot team deployments |
| **Total Connections** | **8** | `0` | **Well within Neon Free limit of 100 connections!** |
