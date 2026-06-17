# DollarCord Presence Agent

A tiny local agent that detects the games you're running and shows them as Rich
Presence on your DollarCord profile — the web-native equivalent of Discord's
desktop game detection.

> **Why a separate app?** DollarCord runs in your browser, which is sandboxed and
> cannot see your running programs. This small Node script runs on your machine,
> scans your process list, and pushes what it finds to DollarCord's
> `/api/rpc/activity` endpoint using a personal token. Nothing else is sent.

## Setup

1. In DollarCord, open **Settings → Activity** and **Generate** an RPC token.
2. Make sure you have **Node.js 18+** installed.
3. Run the agent with your token:

   ```bash
   # macOS / Linux
   DOLLARCORD_RPC_TOKEN=dcrpc_xxx DOLLARCORD_URL=http://localhost:3000 node index.js

   # Windows (PowerShell)
   $env:DOLLARCORD_RPC_TOKEN="dcrpc_xxx"; $env:DOLLARCORD_URL="http://localhost:3000"; node index.js
   ```

   Or copy `config.example.json` to `config.json` and fill it in, then `node index.js`.

The agent polls every 30 seconds (configurable via `DOLLARCORD_INTERVAL`). When it
detects a known game it sets your presence to "Playing <game>"; when none are
running it clears it. It also clears your presence on exit (Ctrl+C).

## Adding games

Edit [`games.json`](games.json). Each entry maps an executable name (as it appears
in your OS process list, lowercase) to a display name and optional image URL:

```json
{ "process": "mygame.exe", "name": "My Game", "image": "https://.../icon.png" }
```

- **Windows** process names look like `game.exe` (see `tasklist`).
- **macOS / Linux** use the command name (see `ps -A -o comm`).

## How it maps to Discord RPC

The payload is Discord `SetActivity`-shaped, so the same endpoint accepts pushes
from real Discord game SDKs or any other tool:

```json
{ "activity": { "type": 0, "name": "My Game", "timestamps": { "start": 1700000000000 } } }
```

Sending `{ "activity": null }` clears presence (Discord's `ClearActivity`).
