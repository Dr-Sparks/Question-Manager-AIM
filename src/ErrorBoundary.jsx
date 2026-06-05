import React from "react";

// React 18 still requires a class component for error boundaries (no
// hook-equivalent yet). Catches render-time / lifecycle errors anywhere
// in the tree below and replaces the white-screen-of-death with a
// recoverable UI: the user can dump their localStorage to a JSON file
// (which contains every aim_* key including questions and help content)
// BEFORE reloading the page. This makes any future React crash a
// nuisance, never a data-loss event.

const sans = "'Source Sans 3',system-ui,sans-serif";
const serif = "'Libre Baskerville',Georgia,serif";

function dumpAllAimData() {
  const out = { exportedAt: new Date().toISOString(), keys: {} };
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("aim_")) continue;
      const raw = window.localStorage.getItem(key);
      // Try to JSON.parse so the dump is structured. Fall back to raw string.
      try {
        out.keys[key] = JSON.parse(raw);
      } catch {
        out.keys[key] = raw;
      }
    }
  } catch (err) {
    out.dumpError = String(err?.message || err);
  }
  return out;
}

function downloadJson(data, filename) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: filename,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, exported: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Log to console at minimum — Electron preload can pick this up later.
    try {
      // eslint-disable-next-line no-console
      console.error("[AIM ErrorBoundary]", error, info?.componentStack);
    } catch {
      /* noop */
    }
  }

  handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const ok = downloadJson(
      dumpAllAimData(),
      `AIM_Notfall-Sicherung_${stamp}.json`
    );
    this.setState({ exported: ok });
    if (ok) {
      // Re-arm after 3s so a second click (e.g. saving to a second location)
      // gives visible feedback. setState on unmounted is a noop; the boundary
      // stays mounted until reload anyway.
      if (this._resetTimer) clearTimeout(this._resetTimer);
      this._resetTimer = setTimeout(
        () => this.setState({ exported: false }),
        3000
      );
    }
  };

  componentWillUnmount() {
    if (this._resetTimer) clearTimeout(this._resetTimer);
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      /* noop */
    }
  };

  render() {
    const { error, exported } = this.state;
    if (!error) return this.props.children;

    const message = error?.message || String(error);

    return (
      <div
        style={{
          minHeight: "100vh",
          fontFamily: sans,
          background: "#f7f7f5",
          color: "#111",
          padding: "40px 24px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 640,
            background: "#fff",
            border: "1px solid #d7d7d2",
            borderRadius: 10,
            padding: "28px 32px",
            boxShadow: "0 6px 32px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              fontFamily: serif,
              fontSize: 22,
              fontWeight: 700,
              color: "#b42318",
              marginBottom: 6,
            }}
          >
            Es ist ein Fehler aufgetreten
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, margin: "0 0 16px" }}>
            Die App ist auf einen unerwarteten Fehler gestoßen. Deine Daten
            sind weiterhin lokal gespeichert. Bitte zuerst eine
            <strong> Notfall-Sicherung</strong> herunterladen, danach die App
            neu laden. Die heruntergeladene Datei enthält alle Fragen,
            Weiterbildungsgänge und gespeicherten Prüfungen.
          </p>

          <div
            style={{
              background: "#fff5ee",
              border: "1px solid #f3dcc9",
              borderRadius: 6,
              padding: "10px 12px",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              color: "#444",
              marginBottom: 18,
              maxHeight: 120,
              overflow: "auto",
              wordBreak: "break-word",
            }}
          >
            {message}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={this.handleExport}
              style={{
                fontFamily: sans,
                fontSize: 14,
                fontWeight: 600,
                background: "#1d6b3e",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "9px 18px",
                cursor: "pointer",
              }}
            >
              {exported
                ? "✓ Sicherung heruntergeladen"
                : "💾 Notfall-Sicherung herunterladen"}
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                fontFamily: sans,
                fontSize: 14,
                fontWeight: 500,
                background: "transparent",
                color: "#111",
                border: "1px solid #d7d7d2",
                borderRadius: 4,
                padding: "9px 18px",
                cursor: "pointer",
              }}
            >
              App neu laden
            </button>
          </div>

          <p
            style={{
              fontSize: 12,
              color: "#666",
              margin: "18px 0 0",
              lineHeight: 1.5,
            }}
          >
            Sollte dieser Fehler wiederholt auftreten, melde ihn bitte mit
            der heruntergeladenen Sicherungsdatei und der Fehlermeldung oben.
          </p>
        </div>
      </div>
    );
  }
}
