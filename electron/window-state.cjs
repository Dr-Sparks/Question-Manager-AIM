// Window position + size persistence between launches. No new dependency —
// stored as a tiny JSON file in userData/window-state.json. Defensively
// validates the loaded state against current display geometry so we never
// open the window off-screen (e.g. when an external monitor was unplugged).

const fs = require("fs");
const path = require("path");
const { app, screen } = require("electron");

const DEFAULTS = { width: 1600, height: 980 };
const MIN = { width: 1200, height: 760 };

function fileFor() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function readSaved() {
  try {
    const raw = fs.readFileSync(fileFor(), "utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.width === "number" &&
      typeof parsed.height === "number"
    ) {
      return parsed;
    }
  } catch {
    /* first run / corrupt file */
  }
  return null;
}

// Clamp the saved geometry into the bounds of an available display so we
// never open the window in a region that no longer exists.
function clampToDisplay(state) {
  const bounds = screen.getDisplayMatching({
    x: state.x ?? 0,
    y: state.y ?? 0,
    width: state.width,
    height: state.height,
  }).workArea;
  const width = Math.max(MIN.width, Math.min(state.width, bounds.width));
  const height = Math.max(MIN.height, Math.min(state.height, bounds.height));
  let x = state.x ?? Math.round(bounds.x + (bounds.width - width) / 2);
  let y = state.y ?? Math.round(bounds.y + (bounds.height - height) / 2);
  if (x < bounds.x || x + width > bounds.x + bounds.width) {
    x = Math.round(bounds.x + (bounds.width - width) / 2);
  }
  if (y < bounds.y || y + height > bounds.y + bounds.height) {
    y = Math.round(bounds.y + (bounds.height - height) / 2);
  }
  return {
    x,
    y,
    width,
    height,
    isMaximized: !!state.isMaximized,
    isFullScreen: !!state.isFullScreen,
  };
}

// Returns initial BrowserWindow options + a `manage(win)` function to wire
// up the listeners that persist future changes.
function load() {
  const saved = readSaved();
  const state = saved
    ? clampToDisplay(saved)
    : { ...DEFAULTS, x: undefined, y: undefined, isMaximized: false, isFullScreen: false };

  let saveTimer = null;
  const write = (data) => {
    if (saveTimer) clearTimeout(saveTimer);
    // Debounce — resize fires fast.
    saveTimer = setTimeout(() => {
      try {
        fs.writeFileSync(fileFor(), JSON.stringify(data, null, 2));
      } catch {
        /* not fatal — next launch just uses defaults */
      }
    }, 400);
  };

  function manage(win) {
    const capture = () => {
      // Don't capture during maximize/fullscreen — we want the underlying
      // normal-mode size so we can restore it next launch.
      if (win.isDestroyed()) return;
      if (win.isMaximized() || win.isFullScreen()) {
        write({
          ...state,
          isMaximized: win.isMaximized(),
          isFullScreen: win.isFullScreen(),
        });
        return;
      }
      const b = win.getBounds();
      Object.assign(state, b, {
        isMaximized: false,
        isFullScreen: false,
      });
      write(state);
    };
    win.on("resize", capture);
    win.on("move", capture);
    win.on("maximize", capture);
    win.on("unmaximize", capture);
    win.on("enter-full-screen", capture);
    win.on("leave-full-screen", capture);
    win.on("close", capture);

    if (state.isMaximized) win.maximize();
    if (state.isFullScreen) win.setFullScreen(true);
  }

  return { state, manage };
}

module.exports = { load };
