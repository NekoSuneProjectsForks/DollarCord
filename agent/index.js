#!/usr/bin/env node
"use strict";

/**
 * DollarCord desktop presence agent.
 *
 * Scans the OS process list, matches running games against games.json, and
 * pushes Discord-RPC-style Rich Presence to your DollarCord profile via the
 * /api/rpc/activity ingest endpoint. This is the "web-native" equivalent of the
 * Discord desktop client's game detection — DollarCord runs in the browser and
 * cannot see your processes, so this small local agent does it for you.
 *
 * Config (env vars, or agent/config.json with the same keys):
 *   DOLLARCORD_URL        e.g. http://localhost:3000   (default)
 *   DOLLARCORD_RPC_TOKEN  the token from Settings > Activity (required)
 *   DOLLARCORD_INTERVAL   poll seconds (default 30)
 *
 * Run:  DOLLARCORD_RPC_TOKEN=dcrpc_xxx node index.js
 */

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

function loadConfig() {
  let fileConfig = {};
  const configPath = path.join(__dirname, "config.json");
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
      console.error("[agent] failed to parse config.json:", err.message);
    }
  }
  const url = process.env.DOLLARCORD_URL || fileConfig.DOLLARCORD_URL || "http://localhost:3000";
  const token = process.env.DOLLARCORD_RPC_TOKEN || fileConfig.DOLLARCORD_RPC_TOKEN || "";
  const interval = Number(process.env.DOLLARCORD_INTERVAL || fileConfig.DOLLARCORD_INTERVAL || 30);
  return { url: url.replace(/\/$/, ""), token, interval: Math.max(10, interval) };
}

function loadGames() {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "games.json"), "utf8"));
  return (data.games || []).map((g) => ({ ...g, process: String(g.process).toLowerCase() }));
}

function listProcesses() {
  return new Promise((resolve) => {
    const platform = os.platform();
    const cmd = platform === "win32" ? "tasklist /fo csv /nh" : "ps -A -o comm";
    exec(cmd, { maxBuffer: 1024 * 1024 * 8 }, (err, stdout) => {
      if (err || !stdout) return resolve(new Set());
      const names = new Set();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.trim()) continue;
        if (platform === "win32") {
          // CSV: "image.exe","pid",...
          const match = line.match(/^"([^"]+)"/);
          if (match) names.add(match[1].toLowerCase());
        } else {
          names.add(path.basename(line.trim()).toLowerCase());
        }
      }
      resolve(names);
    });
  });
}

function detectGame(games, running) {
  for (const game of games) {
    if (running.has(game.process)) return game;
  }
  return null;
}

async function pushActivity(config, game) {
  const body = game
    ? {
        activity: {
          type: 0, // Playing
          name: game.name,
          details: game.details || null,
          state: game.state || null,
          assets: game.image ? { large_image: game.image } : undefined,
          timestamps: { start: game.__start || Date.now() },
        },
      }
    : { activity: null };

  try {
    const res = await fetch(`${config.url}/api/rpc/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[agent] push failed (${res.status}):`, (await res.text()).slice(0, 200));
    }
  } catch (err) {
    console.error("[agent] request error:", err.message);
  }
}

async function main() {
  const config = loadConfig();
  if (!config.token) {
    console.error("[agent] Missing DOLLARCORD_RPC_TOKEN. Generate one in Settings > Activity.");
    process.exit(1);
  }
  const games = loadGames();
  console.log(`[agent] DollarCord presence agent → ${config.url} (every ${config.interval}s, ${games.length} known games)`);

  let last = null;
  let startTimestamp = null;

  async function tick() {
    const running = await listProcesses();
    const game = detectGame(games, running);
    const name = game ? game.name : null;
    if (name !== last) {
      last = name;
      if (game) {
        startTimestamp = Date.now();
        console.log(`[agent] detected: ${game.name}`);
      } else {
        console.log("[agent] no game detected — clearing presence");
      }
    }
    // Re-push every tick so the server-side expiry keeps refreshing.
    if (game) {
      game.__start = startTimestamp;
      await pushActivity(config, game);
    } else {
      await pushActivity(config, null);
    }
  }

  await tick();
  const timer = setInterval(tick, config.interval * 1000);

  async function shutdown() {
    clearInterval(timer);
    await pushActivity(config, null);
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
