import React from "react";
import { useUpdater } from "./useUpdater.js";

// Visible only when an update is actionable. We never block the UI — the
// banner sits above the main app and pushes content down a few pixels.
//
// Visible states:
//   downloading -> shows percent
//   downloaded  -> "install now" CTA + dismiss for this version
//   error       -> compact error line
//
// 'available' alone is hidden because autoDownload=true (see updater.cjs) —
// users see 'downloading' immediately and then 'downloaded', which is when
// the install button is meaningful.

const sans = "'Source Sans 3',system-ui,sans-serif";

const wrap = {
  fontFamily: sans,
  fontSize: 14,
  padding: "10px 16px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderBottom: "1px solid var(--c-bo)",
};

const btn = {
  fontFamily: sans,
  fontSize: 13,
  fontWeight: 600,
  padding: "6px 12px",
  borderRadius: 4,
  border: "1px solid transparent",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const btnPrimary = {
  ...btn,
  background: "#1d6b3e",
  color: "white",
};

const btnGhost = {
  ...btn,
  background: "transparent",
  color: "var(--c-tx)",
  border: "1px solid var(--c-bo)",
};

function formatBytes(n) {
  if (!n || !Number.isFinite(n)) return "0 KB";
  const mb = n / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

export default function UpdateBanner() {
  const { status, isDismissed, installNow, dismiss } = useUpdater();
  const { state, info, progress, error } = status || {};

  if (state === "downloading") {
    const pct = progress?.percent ? Math.round(progress.percent) : 0;
    return (
      <div
        style={{ ...wrap, background: "var(--c-tP)", color: "var(--c-tx)" }}
        role="status"
        aria-live="polite"
      >
        <span style={{ fontSize: 18 }} aria-hidden>↓</span>
        <span style={{ flex: 1 }}>
          Aktualisierung wird geladen ({pct}%
          {progress?.total ? ` von ${formatBytes(progress.total)}` : ""})
        </span>
      </div>
    );
  }

  if (state === "downloaded" && info?.version && !isDismissed) {
    return (
      <div
        style={{ ...wrap, background: "var(--c-gP)", color: "var(--c-tx)" }}
        role="status"
        aria-live="polite"
      >
        <span style={{ fontSize: 18 }} aria-hidden>✓</span>
        <span style={{ flex: 1 }}>
          <strong>Version {info.version}</strong> ist bereit zur Installation.
        </span>
        <button type="button" style={btnGhost} onClick={dismiss}>
          Spaeter
        </button>
        <button type="button" style={btnPrimary} onClick={installNow}>
          Jetzt aktualisieren
        </button>
      </div>
    );
  }

  if (state === "error" && error?.message) {
    return (
      <div
        style={{
          ...wrap,
          background: "var(--c-rP)",
          color: "var(--c-tx)",
          fontSize: 12,
        }}
        role="status"
        aria-live="polite"
      >
        <span style={{ fontSize: 14 }} aria-hidden>!</span>
        <span style={{ flex: 1 }}>
          Update-Pruefung fehlgeschlagen: {error.message}
        </span>
      </div>
    );
  }

  return null;
}
