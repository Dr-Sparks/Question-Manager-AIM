const path = require("path");
const { app, BrowserWindow, shell, session } = require("electron");
const { buildMenu } = require("./menu.cjs");
const { initUpdater, checkForUpdates } = require("./updater.cjs");
const windowState = require("./window-state.cjs");

const PRODUCT_NAME = "AIM Pruefungs-Manager";
app.setName(PRODUCT_NAME);
app.setAppUserModelId("ch.aim.pruefungsmanager"); // Windows: groups taskbar + notifications correctly

// Single-instance lock: focus the existing window instead of opening a new one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;

function applyCsp() {
  // Strict CSP. Everything ships bundled, so no remote loads of any kind.
  // 'unsafe-inline' on style-src is required by the inline-styled React app
  // (the monolith uses style objects + an injected <style> for the theme).
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join("; ");

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });
}

function createWindow() {
  // Restore saved window geometry (or use defaults on first launch).
  const ws = windowState.load();
  mainWindow = new BrowserWindow({
    x: ws.state.x,
    y: ws.state.y,
    width: ws.state.width,
    height: ws.state.height,
    minWidth: 1200,
    minHeight: 760,
    title: PRODUCT_NAME,
    backgroundColor: "#f7f7f5",
    show: false, // wait until ready-to-show so we never flash a white window
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  ws.manage(mainWindow);

  // External links always open in the system browser, never inside the app.
  // BUT we MUST allow `window.open('', '_blank')` for the print-window flow
  // — `printAsPdf` and `printHelpManualPdf` open a blank window, write the
  // print HTML into it via document.write(), and call w.print(). If we deny
  // blank/about:blank, those functions silently no-op and clicking "PDF
  // drucken" appears to do nothing.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    if (!url || url === "about:blank") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          backgroundColor: "#ffffff",
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }
    return { action: "deny" };
  });

  // Block in-app navigation entirely. The React app is a SPA and never
  // navigates the top-level frame.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(() => {
  applyCsp();
  initUpdater();
  buildMenu({
    onCheckForUpdates: () => checkForUpdates({ silentIfNone: false }),
  });
  createWindow();

  // Kick off a silent check ~3s after launch so it never blocks the UI thread.
  setTimeout(() => {
    checkForUpdates({ silentIfNone: true });
  }, 3000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Defense-in-depth: refuse to create any new webContents the renderer requests.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
});
