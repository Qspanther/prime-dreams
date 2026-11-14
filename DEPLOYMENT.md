# 🚀 PRIME DREEMS — DISTRIBUTED DEPLOYMENT GUIDE (RENDER + EXTERNAL CLOUD DATABASE)

This guide explains how to deploy Prime Dreems as a distributed 3-tier production architecture:
1. **Frontend:** Render Web Service (Next.js 15, Turbopack, React 19)
2. **Backend:** Render Web Service (Node.js, Express, WebSocket Gateway, 10,000 Bots Engine)
3. **Database:** Independent External Cloud Database (Neon.tech / Supabase / Railway / AWS RDS)

```
┌─────────────────────────────────┐        ┌─────────────────────────────────┐
│        RENDER FRONTEND          │        │         RENDER BACKEND          │
│   (Next.js 15 Web Service)      │◄──────►│    (Node.js API & WebSockets)   │
│  prime-dreems-frontend.onrender │        │  prime-dreems-backend.onrender  │
└─────────────────────────────────┘        └─────────────────────────────────┘
                                                           ▲
                                                           │ (DATABASE_URL SSL)
                                                           ▼
                                           ┌─────────────────────────────────┐
                                           │     EXTERNAL CLOUD DATABASE     │
                                           │  (Neon.tech / Supabase / RDS)   │
                                           │    PostgreSQL (100% Isolated)   │
                                           └─────────────────────────────────┘
```

---

## 🗄️ PART 1: Set Up External Cloud Database (Free & Instant)

You can choose any external database provider. **Neon.tech** or **Supabase** are recommended:

### Option A: Neon.tech (Recommended — 30 seconds setup)
1. Go to [neon.tech](https://neon.tech) and sign up (free tier has generous storage and zero maintenance).
2. Click **Create Project** ➔ Name: `prime-dreems-db`.
3. In the project dashboard, copy your **Connection String**:
   ```
   postgresql://neondb_owner:npg_xxxxxx@ep-xxxxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this string — this is your `DATABASE_URL`.

### Option B: Supabase
1. Go to [supabase.com](https://supabase.com) ➔ Create new project.
2. In Project Settings ➔ **Database** ➔ Connection Pooling ➔ Copy **URI**:
   ```
   postgresql://postgres.xxxxxx:your_password@aws-0-xxxxxx.pooler.supabase.com:6543/postgres
   ```

*(Note: If you do not provide `DATABASE_URL`, the backend automatically falls back to local SQLite `primedreems.sqlite` for local testing).*

---

## ⚙️ PART 2: Deploy Backend Web Service on Render

1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** ➔ Select **Web Service**.
3. Connect your Git repository (`Prime dreems`).
4. Configure the Backend service:
   - **Name:** `prime-dreems-backend`
   - **Region:** Any (e.g., Singapore / Oregon / Frankfurt)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (or Starter)
5. Under **Environment Variables**, add:
   | Key | Value | Notes |
   |---|---|---|
   | `NODE_VERSION` | `20.18.0` | Node.js runtime |
   | `NODE_ENV` | `production` | Production mode |
   | `PORT` | `10000` | Render port |
   | `DATABASE_URL` | `postgresql://...` | **Your External Neon / Supabase Connection String** |
   | `DB_SSL` | `true` | Required for Cloud PostgreSQL |
   | `JWT_SECRET` | *(Generate a 32+ character random string)* | Auth tokens |
   | `BOT_API_KEY` | `c11_bot_mgr_sec_9938a7fbc21d49e` | Internal Bot Key |
   | `FRONTEND_URL` | `https://prime-dreems-frontend.onrender.com` | Your Frontend URL |

6. Click **Create Web Service**.
7. Once deployed, note down your Backend URL:  
   `https://prime-dreems-backend.onrender.com`

---

## 🎨 PART 3: Deploy Frontend Web Service on Render

1. In Render Dashboard, click **New +** ➔ Select **Web Service**.
2. Connect the same Git repository (`Prime dreems`).
3. Configure the Frontend service:
   - **Name:** `prime-dreems-frontend`
   - **Root Directory:** `frontend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free (or Starter)
4. Under **Environment Variables**, add:
   | Key | Value | Notes |
   |---|---|---|
   | `NODE_VERSION` | `20.18.0` | Node.js runtime |
   | `NODE_ENV` | `production` | Production mode |
   | `PORT` | `10000` | Render port |
   | `BACKEND_URL` | `https://prime-dreems-backend.onrender.com` | Target for Next.js rewrites |
   | `NEXT_PUBLIC_API_URL` | `https://prime-dreems-backend.onrender.com` | Direct Client-side API |
   | `NEXT_PUBLIC_WEBSOCKET_URL` | `wss://prime-dreems-backend.onrender.com/ws` | Live Ball-by-Ball streaming |

5. Click **Create Web Service**.
6. Once deployed, your web application will be live at:  
   `https://prime-dreems-frontend.onrender.com`

---

## ⚡ Option 4: 1-Click Blueprint Deploy (render.yaml)

Alternatively, you can deploy both services in 1-click using Render Blueprints:
1. In Render Dashboard, click **Blueprints** ➔ **New Blueprint Instance**.
2. Connect your repository.
3. Render reads [render.yaml](file:///C:/Users/abbu/Documents/Prime%20dreems/render.yaml) and automatically creates:
   - `prime-dreems-backend`
   - `prime-dreems-frontend`
4. Enter your `DATABASE_URL` in the prompt, and click **Apply**.

---

## 🔍 Verification & Health Check

After deployment:
- **Backend Health Check:** `https://prime-dreems-backend.onrender.com/health` (should return `{ status: "ok" }`).
- **Matches Endpoint:** `https://prime-dreems-backend.onrender.com/api/matches`.
- **Bot Network Status:** `https://prime-dreems-backend.onrender.com/bot-manager/status`.
- **WebSocket Gateway:** `wss://prime-dreems-backend.onrender.com/ws`.
- **Frontend App:** Visit `https://prime-dreems-frontend.onrender.com` to explore live matches, team creation, pitch view, and contest participation.
