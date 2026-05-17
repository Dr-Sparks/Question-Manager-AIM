// Auto-update orchestrator. Wraps electron-updater so main.cjs stays focused
// on window lifecycle. All renderer-facing state is normalised to a single
// object: { state, info?, error?, progress? } sent on channel "aim:update-status".

const path = require("path");
const { app, dialog, ipcMain, BrowserWindow } = require("electron");

const CHANNEL = "aim:update-status";

let bound = false;
let updater = null;

function getUpdater() {
  if (updater) return updater;
  // Require lazily — electron-updater is large and not needed until ready.
  const { autoUpdater } = require("electron-updater");
  const log = require("electron-log");
  log.transports.file.level = "info";
  log.transports.file.resolvePathFn = () =>
    path.join(app.getPath("userData"), "logs", "main.log");
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true; // start download as soon as available
  autoUpdater.autoInstallOnAppQuit = false; // we ask the user first
  // In dev, electron-updater needs a feed file to test against. The file is
  // gitignored. Without it, dev sessions just skip the check silently.
  if (!app.isPackaged) {
    const devFeed = path.join(__dirname, "..", "dev-app-update.yml");
    try {
      autoUpdater.updateConfigPath = devFeed;
    } catch {
      // not fatal — checks will just no-op in dev
    }
  }
  updater = autoUpdater;
  return updater;
}

function broadcast(payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(CHANNEL, payload);
    }
  }
}

// Errors that mean "there's no release to update to yet" — benign on fresh
// installs and before the first release is published. We swallow these so a
// user opening a brand-new install isn't greeted by a scary red banner.
const BENIGN_ERROR_PATTERNS = [
  /no published versions/i,
  /Cannot find latest\.yml/i,
  /HttpError: 404/i,
  /ENOTFOUND/i,           // offline
  /getaddrinfo ENOTFOUND/i,
  /net::ERR_INTERNET_DISCONNECTED/i,
];

function isBenignError(err) {
  const message = err?.message || String(err || "");
  return BENIGN_ERROR_PATTERNS.some((rx) => rx.test(message));
}

function bindUpdaterEvents() {
  if (bound) return;
  bound = true;
  const au = getUpdater();
  au.on("checking-for-update", () => broadcast({ state: "checking" }));
  au.on("update-available", (info) => broadcast({ state: "available", info }));
  au.on("update-not-available", (info) =>
    broadcast({ state: "not-available", info })
  );
  au.on("download-progress", (progress) =>
    broadcast({ state: "downloading", progress })
  );
  au.on("update-downloaded", (info) =>
    broadcast({ state: "downloaded", info })
  );
  au.on("error", (err) => {
    if (isBenignError(err)) {
      // Still log it via electron-log but don't bother the user.
      return;
    }
    broadcast({
      state: "error",
      error: { message: err?.message || String(err) },
    });
  });
}

function bindIpc() {
  ipcMain.handle("aim:get-version", () => app.getVersion());

  ipcMain.handle("aim:check-for-updates", async () => {
    try {
      bindUpdaterEvents();
      await getUpdater().checkForUpdates();
    } catch (err) {
      broadcast({
        state: "error",
        error: { message: err?.message || String(err) },
      });
    }
  });

  ipcMain.handle("aim:quit-and-install", async () => {
    try {
      getUpdater().quitAndInstall(false, true);
    } catch (err) {
      broadcast({
        state: "error",
        error: { message: err?.message || String(err) },
      });
    }
  });
}

// Public: start a check (used on launch and from the native menu)
async function checkForUpdates({ silentIfNone = true } = {}) {
  try {
    bindUpdaterEvents();
    const result = await getUpdater().checkForUpdates();
    if (!silentIfNone && (!result || !result.updateInfo || result.updateInfo.version === app.getVersion())) {
      dialog.showMessageBox({
        type: "info",
        title: "Keine Aktualisierung",
        message: "Du verwendest bereits die neueste Version.",
        detail: `Version ${app.getVersion()}`,
        buttons: ["OK"],
      });
    }
  } catch (err) {
    if (!silentIfNone) {
      dialog.showMessageBox({
        type: "error",
        title: "Update-Pruefung fehlgeschlagen",
        message: "Pruefung auf Updates ist fehlgeschlagen.",
        detail: err?.message || String(err),
        buttons: ["OK"],
      });
    }
  }
}

function initUpdater() {
  bindIpc();
  bindUpdaterEvents();
}

module.exports = { initUpdater, checkForUpdates };
