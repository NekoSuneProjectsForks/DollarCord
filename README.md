# DollarCord — Self-Host Kit

Run your own DollarCord node in one command. This branch is the **deployment kit** —
it pulls the prebuilt image from GHCR (built on the [`docker`](../../tree/docker)
branch) and runs everything on your own infrastructure.

> **Architecture (GameVox-style):** all voice / video / chat / file traffic goes
> **directly between clients and your server**. The cloud (optional, via `CLOUD_URL`)
> is used only for lightweight **auth & coordination**. Leave `CLOUD_URL` empty for a
> fully standalone node with its own accounts.

## Quick start

```bash
# 1. Get this kit
git clone -b selfhost https://github.com/NekoSuneProjectsForks/DollarCord.git dollarcord
cd dollarcord

# 2. (optional) copy and edit env defaults
cp .env.example .env

# 3. Run it
docker compose up -d
# open http://localhost:3000  — the first account becomes the admin
```

Data (SQLite + per-server uploads) persists in the `dollarcord-data` volume.

## Self-Hosted tier — unlimited

`SELF_HOSTED=true` (set in `docker-compose.yml`) unlocks the **unlimited** tier for
every community on the node: unlimited members / channels / storage, up to 4K screen
share, 384 kbps voice, unlimited custom emojis, applications, soundboard, and more.

> **Early adopter — free forever** if activated before **July 1, 2026**. After that an
> optional **$2/mo or $15/yr** subscription supports development (never required).

See [SELF_HOSTING.md](SELF_HOSTING.md) for full configuration, ports, TURN, and reverse-proxy notes.

## Updating

```bash
docker compose pull && docker compose up -d
```

## Branches

| Branch | Contents |
|---|---|
| [`main`](../../tree/main) | Overview + pointers |
| [`docker`](../../tree/docker) | Full app source + `Dockerfile` + GHCR publish workflow |
| `selfhost` (this) | One-command self-host kit (compose pulls the GHCR image) |
| [`desktop`](../../tree/desktop) | Electron desktop client |
| [`mobile`](../../tree/mobile) | Expo (iOS + Android) client |
