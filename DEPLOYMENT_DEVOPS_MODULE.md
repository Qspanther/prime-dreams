# Module 8: Deployment & DevOps Infrastructure

## Overview
Automated deployment blueprints, multi-service topologies, environment isolation, database connection pooling guards, and infrastructure health monitoring for Render and Neon PostgreSQL.

## Owned Files & Directories
- `render.yaml` (Infrastructure-as-code multi-service blueprint)
- `DEPLOYMENT.md` (End-to-end production deployment guide)
- `MIGRATION.md` (Neon PostgreSQL migration and SQLite fallback runbook)
- `.node-version` & `.nvmrc` (Pinned to Node 20 LTS `20.18.0`)
- `scripts/` (Load test harness and database verification scripts)

## Managed Sub-Parts
1. **Frontend Deployment**: Next.js 15 standalone build deployed on Render/Vercel with Turbopack optimization.
2. **Backend Deployment**: Express REST API and WebSocket gateway on Render (`prime-dreems-backend`).
3. **Bot Service**: Dedicated, isolated worker process (`prime-dreems-bot-service`) running on port 5100 with dedicated connection pool (max 3 connections).
4. **Neon PostgreSQL**: Cloud serverless Postgres (`DATABASE_URL`, SSL mode `require`, `PG_POOL_MAX=5` for free autosuspend compliance).
5. **Environment Variables**: Documented in `.env.example`, secured on Render dashboard.
6. **render.yaml Blueprint**: Multi-service declarations with automatic health check paths.
7. **DEPLOYMENT.md Guide**: Step-by-step setup for web services, cron pingers, and custom domains.
8. **MIGRATION.md**: Safe database schema sync and fallback documentation.
9. **Load Test Harness**: Automated load testing scripts to simulate concurrent traffic.
10. **Node Version Pinning**: Strict pinning across environments using Node 20 LTS.
11. **Health Checks**:
    - Backend: `GET /health` (status, DB connection, latency)
    - Frontend: `GET /api/health`
    - Bot Service: `GET /health` (scheduler status, active bots, Neon connections)
12. **SQLite Fallback**: Zero-dependency local development and fallback capability using SQLite WAL mode.
13. **Security Hardening**: Strict `.gitignore`, timing-safe secret comparisons, sanitized inputs, and admin middleware.
14. **Brand Isolation**: Strict Prime Dreems branding with zero external brand leakage.

## Isolation & Boundary Rules
- **DO NOT TOUCH**:
  - `frontend/app/` (Application pages)
  - `backend/services/` (Core fantasy and scoring algorithms)
