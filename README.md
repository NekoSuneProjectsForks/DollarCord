# DollarCord

A real-time, Discord-inspired community platform — servers, text & voice channels,
DMs, threads, screen share, video, rich presence, roles/permissions, and more — with
a **direct-to-server self-host model**: run your own node, your data stays yours.

This repository is split across branches. **`main` is just this overview** — the code
lives on the branches below.

## 🌿 Branches

| Branch | What's there | Path |
|---|---|---|
| **[`docker`](../../tree/docker)** | Full application source (Next.js + Socket.IO + Prisma) **+ `Dockerfile` + GHCR publish workflow**. The buildable app / cloud code. | [`/`](../../tree/docker) |
| **[`selfhost`](../../tree/selfhost)** | One-command **self-host kit** — `docker compose up -d` pulls the prebuilt image from GHCR. Compose + docs + env. | [`/`](../../tree/selfhost) · [`docker-compose.yml`](../../blob/selfhost/docker-compose.yml) · [`SELF_HOSTING.md`](../../blob/selfhost/SELF_HOSTING.md) |
| **[`desktop`](../../tree/desktop)** | **Electron desktop client** that connects to any DollarCord server (+ game presence). | [`/`](../../tree/desktop) |
| **[`mobile`](../../tree/mobile)** | **Expo (iOS + Android)** client. | [`/`](../../tree/mobile) |

## 🐳 Run your own server (self-host)

```bash
git clone -b selfhost https://github.com/NekoSuneProjectsForks/DollarCord.git dollarcord
cd dollarcord
docker compose up -d          # open http://localhost:3000
```

The published image is `ghcr.io/nekosuneprojectsforks/dollarcord:latest` (built by the
[GHCR workflow](../../blob/docker/.github/workflows/docker-publish.yml) on the `docker` branch).

## 🧭 Architecture (direct-to-server)

```
  Client ──── voice / video / chat / files (direct) ────▶  Your Server (self-host node)
     │                                                          │
     └────────── auth & coordination (lightweight) ─────────────┴───▶  Cloud (optional)
```

- **Self-host node** carries all realtime/media/file traffic. WebRTC voice/video/screen
  is **peer-to-peer (mesh)** — no media port to open; optional TURN for tricky NATs.
- **Cloud** (optional, via `CLOUD_URL`) handles only **auth federation, license &
  discovery**. With it unset, a node is fully standalone with its own accounts.
- One node hosts **unlimited communities**, each with its own per-server data directory.

## 💎 Server tiers

| | Free | Gold ($5/mo) | Self-Hosted |
|---|---|---|---|
| Members | 50 | 500 | Unlimited |
| Voice / Text channels | 3 / 8 | 18 / 32 | Unlimited |
| Storage / file | 2 GB / 500 MB | 50 GB / 2 GB | Unlimited |
| Voice | 64 kbps | 128 kbps | 384 kbps |
| Screen share | 720p | 1080p60 | up to 4K |
| Custom emojis | 0 | 300 | Unlimited |
| Applications, Video DJ, branding, API | — | partial | All |

**Self-hosting is free forever for early adopters** (activate before **July 1, 2026**);
afterwards an optional **$2/mo · $15/yr** supports development — never required to keep running.

## ✨ Features (high level)

Servers & categories · text/voice/announcement/forum channels · threads · DMs & **1:1/group
voice+video calls** · screen share · **webcam** · rich presence + Discord-RPC ingest + a
desktop game-detection agent · Twitch/Kick live detection · attachments · @mentions & role
mentions · unread/mention badges · reactions · pins · slowmode · NSFW gating · granular
**per-channel/per-role permissions** + private channels · roles · invites · bans · AutoMod ·
server discovery · native server templates · Server Supporters · account security
(rate-limiting, sessions, password reset, data export/delete).

## 📦 Tech

Next.js 14 · TypeScript · Prisma + SQLite · Socket.IO · WebRTC (P2P mesh) · Tailwind CSS.

---

> Looking for the source? Switch to the **[`docker`](../../tree/docker)** branch.
