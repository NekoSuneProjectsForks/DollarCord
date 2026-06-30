// DollarCord desktop client (Electron).
// A thin native shell that connects to any DollarCord server (cloud or self-hosted)
// and loads its web UI. The last-used server is remembered between launches.
// WebRTC voice/video/screen works natively in the embedded Chromium.

const { app, BrowserWindow, ipcMain, session, desktopCapturer } = require("electron");
const path = require("path");
const fs = require("fs");

const CONFIG = path.join(app.getPath("userData"), "dollarcord.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  } catch {
    return {};
  }
}
function writeConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
  } catch {}
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 560,
    backgroundColor: "#1e1f22",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Allow getUserMedia / getDisplayMedia (mic, camera, screen share) without prompts.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(["media", "display-capture", "notifications"].includes(permission));
  });
  // Screen-share picker → default to the first screen source.
  if (session.defaultSession.setDisplayMediaRequestHandler) {
    session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => {
      desktopCapturer.getSources({ types: ["screen", "window"] }).then((sources) => {
        cb({ video: sources[0], audio: "loopback" });
      });
    });
  }

  const cfg = readConfig();
  if (cfg.serverUrl) win.loadURL(cfg.serverUrl);
  else win.loadFile(path.join(__dirname, "renderer", "connect.html"));
}

ipcMain.handle("dc:connect", (_e, url) => {
  const clean = String(url || "").trim().replace(/\/$/, "");
  if (!/^https?:\/\//.test(clean)) return { ok: false, error: "Enter a full http(s) URL" };
  writeConfig({ serverUrl: clean });
  win.loadURL(clean);
  return { ok: true };
});

ipcMain.handle("dc:reset", () => {
  writeConfig({});
  win.loadFile(path.join(__dirname, "renderer", "connect.html"));
  return { ok: true };
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
