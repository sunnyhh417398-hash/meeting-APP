# Meeting SaaS (School-ready)

A full-stack meeting management system with realtime voting, designed for schools to self-host.

## Features
- JWT auth (multi-tenant by schoolId)
- Roles: viewer / member / host / admin
- Socket.IO realtime sync
- Redis snapshot cache
- Postgres persistence
- Non-repudiation audit log (hash chain)
- Motions + Named voting + Host revoke
- Export CSV / PDF
- Meeting flow (agenda steps 1-9)
- React frontend + Vanilla HTML frontend
- Docker Compose one-command deploy
- Speaking time tracker (standalone `index.html`)

## Quick Start

```bash
cp .env.example .env
# Edit .env — change JWT_SECRET at minimum
docker compose up --build
```

- React client: http://localhost:5173
- API / Socket: http://localhost:3000
- Health check: http://localhost:3000/health

## Login Demo

Use the React UI login fields:
- schoolId: `soochow`
- userId: `sunny`
- name: `Sunny`
- role: `host` (or `member` / `viewer`)

Then: **Create meeting** -> **Join** -> **Add members** -> **Open motion** -> **Vote**

## Project Structure

```
meeting-APP/
  index.html                 # Standalone speaking time tracker
  docker-compose.yml
  .env.example
  .gitignore

  server/                    # Node.js + Express + Socket.IO
    Dockerfile
    package.json
    src/
      index.js               # REST endpoints + server startup
      auth.js                # JWT sign/verify/middleware
      rbac.js                # Role-based access control
      db.js                  # Postgres pool + auto-create tables
      store.js               # Redis snapshot cache
      audit.js               # Hash-chain audit log
      export.js              # PDF + CSV export
      agenda.js              # Meeting flow (steps 1-9)
      socket.js              # Socket.IO events (realtime sync)

  client-react/              # React + Vite frontend
    Dockerfile
    package.json
    vite.config.js
    index.html
    src/
      main.jsx
      App.jsx                # Full UI: login, meetings, voting
      api.js                 # REST API helpers

  client-vanilla/            # Vanilla HTML/JS (simple demo)
    index.html

  deploy/                    # Self-hosted deployment tools
    backup.sh                # Postgres backup script
    restore.sh               # Postgres restore script
    backups/                 # Backup files (gitignored)
```

## Backup & Restore

```bash
# Backup
bash deploy/backup.sh

# Restore
bash deploy/restore.sh deploy/backups/<file.sql.gz>
```

## Self-Hosted Deployment (for schools)

### Requirements
- Docker + Docker Compose (v2+)
- 2 vCPU / 4GB RAM minimum
- 20GB disk

### Steps
1. Clone this repo
2. Copy `.env.example` to `.env` and set `JWT_SECRET`
3. Run `docker compose up -d --build`
4. Access React UI at `http://<server-ip>:5173`

### Update
```bash
git pull
docker compose up -d --build
```

## Speaking Time Tracker (Standalone)

Open `index.html` directly in a browser for a simple speaking time tracker:
1. Add participant names
2. Click **Start Meeting**
3. Click **Speak** next to whoever is talking
4. Click **End Meeting** to save the session

## Security Notes
- Postgres and Redis are not exposed externally (internal Docker network only)
- Audit log uses SHA-256 hash chain for non-repudiation
- JWT tokens expire after 12 hours
- Vote locking prevents ballot tampering (only host can revoke)
