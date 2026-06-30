# DollarCord — Desktop Client

An Electron desktop client for DollarCord. It's a thin native shell that connects to
**any DollarCord server** (cloud or self-hosted) and runs its web UI, with native
permissions for mic/camera and a built-in **screen-share picker** so voice/video/
screen calls work out of the box.

## Run (dev)

```bash
npm install
npm start
```

On first launch you'll get a **Connect** screen — enter your server URL
(e.g. `http://localhost:3000` or your self-hosted domain). It's remembered next time.

## Build installers

```bash
npm run dist   # electron-builder → dmg (mac) / nsis (win) / AppImage (linux)
```

## Files

| File | Purpose |
|---|---|
| `main.js` | Electron main process: window, media/screen-capture permissions, server URL persistence |
| `preload.js` | Safe `window.dollarcord` bridge (`connect`, `reset`) |
| `renderer/connect.html` | First-run server picker |

## Notes

- WebRTC voice/video/screen runs natively in the embedded Chromium — no extra setup.
- Pair with the game-presence agent (on the `docker` branch under `agent/`) for
  automatic "Playing …" Rich Presence.
- Other branches: [`docker`](../../tree/docker) (app + image), [`selfhost`](../../tree/selfhost)
  (run your own), [`mobile`](../../tree/mobile) (iOS/Android).
