# Self-Hosting DollarCord

Run your own DollarCord node — one container, your data, the **unlimited Self-Hosted
tier** for every community on it. No external database or services required.

## What the Self-Hosted tier gets you

| | Self-Hosted |
|---|---|
| Members | Unlimited |
| Text channels | Unlimited |
| Voice channels | Unlimited |
| Storage | Unlimited |
| Upload limit | Unlimited* |
| Screen share | up to 2160p / 4K |
| Voice bitrate | 384 kbps |
| Custom emojis | Unlimited |
| Server applications | Enabled |
| Soundboard | 64 slots |
| Spatial audio, AI voice isolation, Video DJ, Custom branding, API access | Enabled |

\* The upload route buffers files in memory, so there's a practical 100 MB ceiling
per file until streaming/object-storage lands. Everything else is uncapped.

> **Early adopter — free forever.** If you activate before **July 1, 2026**, your
> self-hosted node is free for life. After that an optional **$2/mo or $15/yr**
> subscription supports development (never required to keep running).

## Quick start (Docker)

```bash
git clone <your-fork> dollarcord && cd dollarcord
docker compose up -d
# open http://localhost:3000  (the first account becomes the platform admin)
```

That's it. Data (SQLite DB + per-server uploads) persists in the `dollarcord-data`
volume. To stop: `docker compose down` (add `-v` to also wipe data).

## How it runs

- **One port (3000):** HTTP + WebSocket (Socket.IO signaling/presence/typing).
- **WebRTC media is peer-to-peer (mesh):** voice/video/screen flows directly between
  members, so there's **no media port to open** on the server. For users behind
  symmetric NAT, point `NEXT_PUBLIC_TURN_*` at a TURN server.
- **Per-server data paths:** uploads are namespaced `UPLOAD_ROOT/<serverId>/...`, so a
  single node hosting many communities keeps each server's files separate. Point
  `UPLOAD_ROOT` at any data volume.
- **Many servers, one node:** a node hosts unlimited communities (guilds) out of the
  box — no need to run multiple nodes.

## Configuration (env)

| Var | Default | Notes |
|---|---|---|
| `SELF_HOSTED` | `true` (image) | Unlocks the unlimited tier for all servers |
| `SELF_HOST_ACTIVATED_AT` | install date | Used for the free-forever early-adopter check |
| `PORT` | `3000` | HTTP/WS port |
| `DATABASE_URL` | `file:/data/db/dollarcord.db` | SQLite on the data volume |
| `UPLOAD_ROOT` | `/data/uploads` | Per-server file storage root |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public URL (CORS) |
| `NEXT_PUBLIC_TURN_URL` / `_USERNAME` / `_CREDENTIAL` | — | Optional TURN |
| `TWITCH_CLIENT_ID` / `_SECRET` | — | Optional live detection |

## Requirements

- Docker (or Node 20+ to run without Docker: `npm ci && npm run build && npm run start`).
- ~512 MB RAM; a modern x86-64 or ARM64 host.
- A reverse proxy (Caddy/Nginx/Traefik) in front for TLS in production, pointing at
  port 3000. WebSockets must be allowed to upgrade.

## Cloud tiers (non-self-host)

A hosted deployment offers **Free** and **Gold ($5/mo)** tiers with member/channel/
storage limits enforced per server. Self-hosting bypasses all of that — you own it.
