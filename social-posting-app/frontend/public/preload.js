const { contextBridge, ipcMain } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  invoke: (channel, args) => ipcMain.invoke(channel, args),
});
