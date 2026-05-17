// Preload runs in an isolated context. It is the ONLY bridge between the
// sandboxed renderer (React) and the privileged main process.
//
// Contract exposed on window.aim:
//   platform                         'darwin' | 'win32' | 'linux' | ...
//   getAppVersion()                  -> Promise<string>
//   onUpdateStatus(cb)               -> unsubscribe()    receives {state, info?, error?, progress?}
//   checkForUpdates()                -> Promise<void>    force a manual check
//   quitAndInstall()                 -> Promise<void>    apply downloaded update + restart (Windows in-place flow)
//   openDownloadUrl()                -> Promise<boolean> open DMG/EXE URL in system browser (Mac fallback flow)
//
// Update state values: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

const { contextBridge, ipcRenderer } = require("electron");

const UPDATE_CHANNEL = "aim:update-status";

contextBridge.exposeInMainWorld("aim", {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke("aim:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("aim:check-for-updates"),
  quitAndInstall: () => ipcRenderer.invoke("aim:quit-and-install"),
  openDownloadUrl: () => ipcRenderer.invoke("aim:open-download-url"),
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // Never let a renderer-side bug propagate into the preload.
      }
    };
    ipcRenderer.on(UPDATE_CHANNEL, handler);
    return () => ipcRenderer.removeListener(UPDATE_CHANNEL, handler);
  },
});
