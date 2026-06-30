const { contextBridge, ipcRenderer } = require("electron");

// Minimal, safe bridge: the connect screen can set the server URL; loaded server
// pages can reset back to the picker.
contextBridge.exposeInMainWorld("dollarcord", {
  connect: (url) => ipcRenderer.invoke("dc:connect", url),
  reset: () => ipcRenderer.invoke("dc:reset"),
});
