// Über die App — onboarding + reference page for non-technical users.
//
// Each tour scene is a mini-mockup of the real app UI animated through a
// scripted sequence of states. No video files, no heavy assets — just CSS
// keyframes + small React state machines that loop. `prefers-reduced-motion`
// pauses everything. The mockups intentionally look like the actual UI so
// users recognise the screens when they navigate to them for real.

import React, { useEffect, useState } from "react";

const sans = "'Source Sans 3',system-ui,sans-serif";
const serif = "'Libre Baskerville',Georgia,serif";

// ── shared inline styles ────────────────────────────────────────────────────

const card = {
  background: "var(--c-wh)",
  border: "1px solid var(--c-bo)",
  borderRadius: 10,
  padding: 20,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const sectionHeading = {
  fontFamily: serif,
  fontSize: 20,
  color: "var(--c-tD)",
  margin: "32px 0 12px",
  fontWeight: 700,
};

const tourCaption = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "var(--c-tx)",
  margin: 0,
};

const tourCaptionMuted = {
  fontSize: 12,
  color: "var(--c-mu)",
  margin: "6px 0 0",
  lineHeight: 1.5,
};

// ── timing helper ───────────────────────────────────────────────────────────

// Returns a "step" that advances every `interval` ms and loops over `steps`
// values. Cleaned up automatically on unmount. Respects reduced motion —
// when the user has motion turned off, step stays at the last value so the
// scene shows its "final" state.
function useLoop(steps, interval = 1500) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      setStep(steps - 1);
      return undefined;
    }
    const t = setInterval(() => setStep((s) => (s + 1) % steps), interval);
    return () => clearInterval(t);
  }, [steps, interval]);
  return step;
}

// ── tiny mock UI primitives ────────────────────────────────────────────────

function MockCursor({ x, y, clicked }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 18,
        height: 18,
        pointerEvents: "none",
        transition: "left 0.6s cubic-bezier(.4,.7,.4,1), top 0.6s cubic-bezier(.4,.7,.4,1)",
        zIndex: 10,
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path
          d="M5,3 L5,17 L9,13 L11.5,18.5 L13.5,17.5 L11,12 L17,12 Z"
          fill="#111"
          stroke="#fff"
          strokeWidth="1"
        />
      </svg>
      {clicked && (
        <span
          style={{
            position: "absolute",
            left: -10,
            top: -10,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "2px solid var(--c-t)",
            animation: "aim-ring 0.5s ease-out",
          }}
        />
      )}
    </div>
  );
}

function MockButton({ children, highlighted, primary, sm }) {
  const bg = primary ? "var(--c-t)" : "transparent";
  const color = primary ? "#fff" : "var(--c-tx)";
  const border = primary ? "none" : "1px solid var(--c-bo)";
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: sans,
        fontSize: sm ? 11 : 12,
        fontWeight: 500,
        padding: sm ? "4px 10px" : "6px 14px",
        borderRadius: 4,
        background: bg,
        color,
        border,
        transition: "box-shadow 0.2s, transform 0.2s",
        boxShadow: highlighted ? "0 0 0 3px rgba(215,25,32,0.25)" : "none",
        transform: highlighted ? "translateY(-1px)" : "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function MockInput({ value, focused, placeholder }) {
  return (
    <div
      style={{
        background: "var(--c-wh)",
        border: focused ? "1.5px solid var(--c-t)" : "1px solid var(--c-bo)",
        borderRadius: 3,
        padding: "5px 8px",
        fontSize: 12,
        color: value ? "var(--c-tx)" : "var(--c-mu)",
        fontFamily: sans,
        minHeight: 24,
        transition: "border-color 0.2s",
      }}
    >
      {value || placeholder || " "}
    </div>
  );
}

function MockBadge({ children, color = "gray" }) {
  const colors = {
    gray: { bg: "var(--c-st)", fg: "#4A4A48" },
    red: { bg: "var(--c-rP)", fg: "var(--c-re)" },
    green: { bg: "var(--c-gP)", fg: "var(--c-gr)" },
    warm: { bg: "#FEF3E2", fg: "#7A4F10" },
    teal: { bg: "var(--c-tP)", fg: "var(--c-tD)" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span
      style={{
        display: "inline-block",
        background: c.bg,
        color: c.fg,
        fontSize: 10,
        fontWeight: 500,
        padding: "2px 7px",
        borderRadius: 999,
        fontFamily: sans,
      }}
    >
      {children}
    </span>
  );
}

function MockToast({ children, visible }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        right: 12,
        background: "#1a7a4a",
        color: "#fff",
        fontSize: 12,
        fontFamily: sans,
        padding: "8px 12px",
        borderRadius: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.3s, transform 0.3s",
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}

function MockStage({ children, height = 220 }) {
  return (
    <div
      style={{
        position: "relative",
        background: "var(--c-wW)",
        border: "1px solid var(--c-bo)",
        borderRadius: 8,
        overflow: "hidden",
        height,
        minHeight: height,
        fontFamily: sans,
      }}
    >
      {children}
    </div>
  );
}

// ── scenes ─────────────────────────────────────────────────────────────────

// 1. Frage hinzufügen
//    States: 0 idle, 1 cursor moving to button, 2 button clicked,
//            3 form visible empty, 4 form being filled, 5 save click,
//            6 toast appears
function SceneAddQuestion() {
  const step = useLoop(7, 1400);
  const formVisible = step >= 3;
  const filled = step >= 4;
  const saveHighlighted = step === 5;
  const toastVisible = step === 6;

  const cursorPositions = [
    { x: 220, y: 30 },
    { x: 220, y: 30 },
    { x: 220, y: 30 },
    { x: 80, y: 110 },
    { x: 80, y: 110 },
    { x: 220, y: 175 },
    { x: 220, y: 175 },
  ];
  const cursor = cursorPositions[step] || cursorPositions[0];

  return (
    <MockStage>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          borderBottom: "1px solid var(--c-bo)",
          background: "var(--c-wh)",
        }}
      >
        <div style={{ fontFamily: serif, fontSize: 13, color: "var(--c-tD)", fontWeight: 700 }}>
          Fragen Datenbank
        </div>
        <MockButton primary highlighted={step === 1 || step === 2}>
          + Neue Frage
        </MockButton>
      </div>

      {/* Form panel */}
      {formVisible && (
        <div
          style={{
            padding: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            animation: "aim-fade-in 0.3s ease",
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "var(--c-mu)", marginBottom: 3 }}>KURS</div>
            <MockInput
              value={filled ? "Sucht" : ""}
              focused={step === 4}
              placeholder="z.B. Psychoonkologie"
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--c-mu)", marginBottom: 3 }}>DOZENT/IN</div>
            <MockInput value={filled ? "Dr. Petry" : ""} placeholder="z.B. Dr. Muster" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 10, color: "var(--c-mu)", marginBottom: 3 }}>FRAGE</div>
            <MockInput
              value={filled ? "Ist Toleranzsteigerung ein Kriterium…?" : ""}
              placeholder="Fragetext eingeben…"
            />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <MockButton sm>Abbrechen</MockButton>
            <MockButton sm primary highlighted={saveHighlighted}>
              Speichern
            </MockButton>
          </div>
        </div>
      )}

      <MockToast visible={toastVisible}>✓ Frage gespeichert</MockToast>
      <MockCursor x={cursor.x} y={cursor.y} clicked={step === 2 || step === 5} />
    </MockStage>
  );
}

// 2. Weiterbildungsgang einrichten — semester matrix being filled
function SceneSemesterMatrix() {
  const step = useLoop(5, 1200);
  // 4 modules per semester. Show them filling in one by one.
  const modules = [
    { course: "Sucht", lecturer: "Dr. Petry" },
    { course: "Essstörungen", lecturer: "Dr. Mihov" },
    { course: "Schematherapie", lecturer: "M. Poppinger" },
    { course: "Sterbeprozesse", lecturer: "M. Renz" },
  ];

  return (
    <MockStage height={220}>
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--c-bo)",
          background: "var(--c-wh)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: "var(--c-tD)" }}>
          WBS 55 (2020)
        </span>
        <MockBadge color="warm">HS 2024</MockBadge>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--c-mu)" }}>
          Semester 1 · 4 Module
        </span>
      </div>
      <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {modules.map((m, idx) => {
          const filled = idx < step;
          return (
            <div
              key={idx}
              style={{
                background: filled ? "var(--c-wh)" : "var(--c-st)",
                border: "1px solid var(--c-bo)",
                borderRadius: 4,
                padding: 8,
                minHeight: 60,
                transition: "background 0.3s",
              }}
            >
              <div style={{ fontSize: 9, color: "var(--c-mu)", marginBottom: 3 }}>
                Modul {idx + 1}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: filled ? "var(--c-tD)" : "var(--c-mu)",
                  fontStyle: filled ? "normal" : "italic",
                }}
              >
                {filled ? m.course : "leer"}
              </div>
              {filled && (
                <div style={{ fontSize: 10, color: "var(--c-mu)", marginTop: 2 }}>{m.lecturer}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding: "0 14px", fontSize: 11, color: "var(--c-mu)" }}>
        6 Semester · 4 Module pro Semester
      </div>
    </MockStage>
  );
}

// 3. Prüfung erstellen — pick program, modules check on, counter rises
function SceneExamBuild() {
  const step = useLoop(6, 1300);
  const programSelected = step >= 1;
  // 4 modules. They get checked one by one starting at step 2.
  const checkedCount = Math.max(0, Math.min(4, step - 1));
  const questionCount = checkedCount * 9 + (programSelected ? 1 : 0);
  const buildHighlighted = step === 5;

  return (
    <MockStage>
      <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12 }}>
        {/* Program list */}
        <div
          style={{
            background: "var(--c-wh)",
            border: "1px solid var(--c-bo)",
            borderRadius: 6,
            padding: 8,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--c-mu)", marginBottom: 6, letterSpacing: "1px" }}>
            WEITERBILDUNGSGÄNGE
          </div>
          {["WBS 55 (2020)", "WBS Zürich", "WBS Bern"].map((p, i) => {
            const active = i === 0 && programSelected;
            return (
              <div
                key={p}
                style={{
                  padding: "6px 8px",
                  borderRadius: 4,
                  background: active ? "var(--c-tP)" : "transparent",
                  border: active ? "1px solid var(--c-tL)" : "1px solid transparent",
                  fontSize: 12,
                  color: active ? "var(--c-tD)" : "var(--c-tx)",
                  fontWeight: active ? 600 : 400,
                  marginBottom: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {active && <span style={{ color: "var(--c-gr)" }}>✓</span>}
                {p}
              </div>
            );
          })}
        </div>

        {/* Module selection + summary */}
        <div>
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              marginBottom: 8,
              padding: "6px 10px",
              background: "var(--c-wh)",
              border: "1px solid var(--c-bo)",
              borderRadius: 6,
            }}
          >
            <div>
              <div style={{ fontSize: 9, color: "var(--c-mu)" }}>MODULE</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--c-tD)", lineHeight: 1 }}>
                {checkedCount}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "var(--c-mu)" }}>FRAGEN</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: questionCount >= 36 ? "var(--c-gr)" : "var(--c-tM)",
                  lineHeight: 1,
                  transition: "color 0.3s",
                }}
              >
                {questionCount}
              </div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <MockButton primary sm highlighted={buildHighlighted}>
                Prüfung erstellen →
              </MockButton>
            </div>
          </div>
          {["Sucht", "Essstörungen", "Schematherapie", "Sterbeprozesse"].map((m, i) => {
            const checked = i < checkedCount;
            return (
              <div
                key={m}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 6px",
                  fontSize: 11,
                  color: "var(--c-tx)",
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "1.5px solid var(--c-bo)",
                    borderRadius: 3,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: checked ? "var(--c-t)" : "transparent",
                    color: "#fff",
                    fontSize: 10,
                    transition: "background 0.2s",
                  }}
                >
                  {checked ? "✓" : ""}
                </span>
                {m}
              </div>
            );
          })}
        </div>
      </div>
    </MockStage>
  );
}

// 4. Als PDF speichern — toolbar button click, then download icon
function ScenePdfExport() {
  const step = useLoop(4, 1500);
  const cursorPos = step === 0
    ? { x: 30, y: 30 }
    : step === 1
    ? { x: 280, y: 36 }
    : { x: 280, y: 36 };

  return (
    <MockStage>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--c-bo)",
          background: "var(--c-wh)",
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span style={{ fontFamily: serif, fontSize: 13, color: "var(--c-tD)", fontWeight: 700, flex: 1 }}>
          Export &amp; Download
        </span>
        <MockButton sm>↓ TXT</MockButton>
        <span style={{ position: "relative" }}>
          <MockButton sm primary highlighted={step === 1 || step === 2}>
            ↓ Als PDF speichern
          </MockButton>
        </span>
      </div>
      <div style={{ padding: 16, fontSize: 12, color: "var(--c-mu)" }}>
        Klicke <strong style={{ color: "var(--c-tD)" }}>↓ Als PDF speichern</strong> → wähle im
        Druckdialog <strong style={{ color: "var(--c-tD)" }}>„Als PDF sichern“</strong>.
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: 36,
          top: step >= 2 ? 160 : 50,
          width: 36,
          opacity: step >= 2 ? 1 : 0,
          transition: "top 0.7s ease-in, opacity 0.4s",
          textAlign: "center",
          color: "var(--c-re)",
        }}
      >
        <div style={{ fontSize: 28 }}>📄</div>
        <div style={{ fontSize: 9, color: "var(--c-mu)", marginTop: 2 }}>Pruefung.pdf</div>
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: 32,
          bottom: 10,
          fontSize: 22,
          color: "var(--c-mu)",
        }}
      >
        📁
      </div>
      <MockCursor x={cursorPos.x} y={cursorPos.y} clicked={step === 1} />
    </MockStage>
  );
}

// 5. Datensicherung — backup panel + click + file flies
function SceneBackup() {
  const step = useLoop(4, 1500);
  const cursorPos = step === 1 || step === 2 ? { x: 175, y: 100 } : { x: 30, y: 30 };

  return (
    <MockStage>
      <div
        style={{
          padding: 18,
          background: "var(--c-wh)",
          margin: 14,
          border: "1px solid var(--c-bo)",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--c-mu)",
            fontWeight: 500,
            marginBottom: 6,
          }}
        >
          Datensicherung
        </div>
        <div style={{ fontSize: 12, color: "var(--c-tx)", marginBottom: 12, lineHeight: 1.5 }}>
          Alle Daten werden automatisch lokal gespeichert. Für Übertragung oder Sicherheit:
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <MockButton sm>💾 Jetzt sichern</MockButton>
          <MockButton sm>↑ JSON laden</MockButton>
          <MockButton sm primary highlighted={step === 1 || step === 2}>
            ↓ JSON exportieren
          </MockButton>
        </div>
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 140,
          top: step >= 2 ? 180 : 90,
          opacity: step >= 2 ? 1 : 0,
          transition: "top 0.7s ease-in, opacity 0.3s",
          fontSize: 22,
        }}
      >
        🗂️
      </div>
      <MockCursor x={cursorPos.x} y={cursorPos.y} clicked={step === 1} />
    </MockStage>
  );
}

// ── checklist (with localStorage) ──────────────────────────────────────────

const CHECKLIST_KEY = "aim_about_checklist_v1";
const CHECKLIST_ITEMS = [
  { k: "explore", label: "Beispieldaten ansehen — auf Dashboard alle Werte prüfen" },
  { k: "program", label: "Eigenen Weiterbildungsgang anlegen" },
  { k: "question", label: "Erste eigene Frage hinzufügen" },
  { k: "exam", label: "Erste eigene Prüfung erstellen und als PDF speichern" },
  { k: "backup", label: "JSON-Backup exportieren und an einem sicheren Ort speichern" },
];

function Checklist() {
  const [checked, setChecked] = useState(() => {
    try {
      const raw = window.localStorage.getItem(CHECKLIST_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checked));
    } catch {
      /* quota — non-essential, ignore */
    }
  }, [checked]);
  const toggle = (k) =>
    setChecked((prev) => ({ ...prev, [k]: !prev[k] }));
  const done = CHECKLIST_ITEMS.filter((it) => checked[it.k]).length;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, color: "var(--c-tD)" }}>
          Erste Schritte
        </div>
        <div style={{ fontSize: 12, color: "var(--c-mu)" }}>
          {done} / {CHECKLIST_ITEMS.length} erledigt
        </div>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {CHECKLIST_ITEMS.map((it) => (
          <li key={it.k} style={{ display: "flex", gap: 10, padding: "6px 0", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => toggle(it.k)}
              aria-pressed={!!checked[it.k]}
              style={{
                width: 20,
                height: 20,
                border: "1.5px solid var(--c-bo)",
                borderRadius: 4,
                background: checked[it.k] ? "var(--c-gr)" : "transparent",
                color: "#fff",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {checked[it.k] ? "✓" : ""}
            </button>
            <span
              style={{
                fontSize: 13,
                color: checked[it.k] ? "var(--c-mu)" : "var(--c-tx)",
                textDecoration: checked[it.k] ? "line-through" : "none",
              }}
            >
              {it.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── tour layout ────────────────────────────────────────────────────────────

function TourCard({ index, title, caption, hint, children }) {
  return (
    <div
      style={{
        ...card,
        marginBottom: 16,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
        gap: 24,
        alignItems: "center",
      }}
    >
      <div>{children}</div>
      <div>
        <div
          style={{
            fontSize: 10,
            color: "var(--c-mu)",
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Schritt {index}
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: 17,
            color: "var(--c-tD)",
            fontWeight: 700,
            margin: "0 0 8px",
          }}
        >
          {title}
        </div>
        <p style={tourCaption}>{caption}</p>
        {hint && <p style={tourCaptionMuted}>{hint}</p>}
      </div>
    </div>
  );
}

// ── about info ─────────────────────────────────────────────────────────────

function AboutInfo({ version }) {
  return (
    <div style={{ ...card, background: "var(--c-wW)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "center" }}>
        <div
          aria-hidden
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            background: "linear-gradient(180deg, #e63946 0%, #b81620 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: sans,
            fontSize: 22,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-1px",
            boxShadow: "0 2px 8px rgba(180,35,24,0.3)",
          }}
        >
          AIM
        </div>
        <div>
          <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: "var(--c-tD)" }}>
            AIM Prüfungs-Manager
          </div>
          <div style={{ fontSize: 12, color: "var(--c-mu)", marginTop: 2 }}>
            Version {version || "—"} · Lokale Desktop-App · Offline-fähig
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--c-mu)",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Wo sind meine Daten?
          </div>
          <div style={{ fontSize: 12, color: "var(--c-tx)", lineHeight: 1.55 }}>
            Alle Daten werden lokal auf diesem Computer gespeichert. Nichts wird ins Internet
            geschickt. Für Sicherheit und Übertragung das JSON-Backup auf dem Dashboard nutzen.
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              color: "var(--c-mu)",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Updates
          </div>
          <div style={{ fontSize: 12, color: "var(--c-tx)", lineHeight: 1.55 }}>
            Die App prüft beim Start automatisch auf neue Versionen. Bei einer neuen Version
            erscheint oben ein grüner Banner. Daten bleiben bei Updates erhalten.
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, fontSize: 11, color: "var(--c-mu)" }}>
        © AIM · Basel · Bern · Zürich
      </div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────

export default function AboutPage() {
  const [version, setVersion] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined" && window.aim?.getAppVersion) {
      window.aim
        .getAppVersion()
        .then(setVersion)
        .catch(() => setVersion(""));
    }
  }, []);

  return (
    <div style={{ padding: 28, maxWidth: 1080, fontFamily: sans }}>
      {/* Animation keyframes — scoped via id so they only inject once */}
      <style id="aim-about-styles">{`
        @keyframes aim-ring { from { transform: scale(0.6); opacity: 1; } to { transform: scale(1.8); opacity: 0; } }
        @keyframes aim-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .aim-about * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div className="aim-about">
        {/* Hero */}
        <div
          style={{
            background: "linear-gradient(180deg, var(--c-tP) 0%, var(--c-wh) 100%)",
            border: "1px solid var(--c-tL)",
            borderRadius: 12,
            padding: "28px 32px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--c-mu)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Willkommen
          </div>
          <h1
            style={{
              fontFamily: serif,
              fontSize: 28,
              color: "var(--c-tD)",
              margin: "0 0 8px",
              fontWeight: 700,
            }}
          >
            So funktioniert der AIM Prüfungs-Manager
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--c-tx)", margin: 0, maxWidth: 720 }}>
            Diese App hilft dir, Prüfungsfragen zu sammeln, Weiterbildungsgänge zu pflegen und daraus
            Prüfungen für das Testportal zu erstellen — alles lokal, ohne Internetverbindung. Die
            folgende Anleitung zeigt in fünf Schritten, wie das geht. Die Animationen wiederholen
            sich, du kannst also so lange schauen wie du möchtest.
          </p>
        </div>

        {/* Tour scenes */}
        <h2 style={sectionHeading}>Die Anleitung in 5 Schritten</h2>

        <TourCard
          index={1}
          title="Fragen verwalten"
          caption="In der Fragen Datenbank legst du Fragen einzeln an oder importierst sie aus Excel. Jede Frage gehört zu einem Kurs."
          hint="Tipp: Eine Frage erscheint automatisch in jedem Weiterbildungsgang, der diesen Kurs unterrichtet."
        >
          <SceneAddQuestion />
        </TourCard>

        <TourCard
          index={2}
          title="Weiterbildungsgang einrichten"
          caption="Pro Weiterbildungsgang erfasst du 6 Semester mit je 4 Modulen. Jedes Modul ist ein Kurs mit Jahr und Dozent/in."
          hint="Tipp: Module aus mehreren Weiterbildungsgängen können denselben Kursnamen haben — die Fragen werden trotzdem korrekt zugeordnet."
        >
          <SceneSemesterMatrix />
        </TourCard>

        <TourCard
          index={3}
          title="Prüfung erstellen"
          caption="Wähle einen Weiterbildungsgang. Aktiviere die Module, aus denen die Prüfung gebaut werden soll. Die App sammelt automatisch alle passenden Fragen."
          hint="Standard sind 40 Fragen pro Prüfung — die Zahl wird grün, wenn dieser Wert erreicht ist."
        >
          <SceneExamBuild />
        </TourCard>

        <TourCard
          index={4}
          title="Als PDF speichern"
          caption="Im Bereich „Export & Download“ klickst du auf ↓ Als PDF speichern. Im Druckdialog wählst du dann „Als PDF sichern“ — die PDF kann direkt im Testportal hochgeladen werden."
          hint="Korrekte Antworten sind in der PDF fett markiert."
        >
          <ScenePdfExport />
        </TourCard>

        <TourCard
          index={5}
          title="Regelmäßig Backup machen"
          caption="Im Dashboard im Bereich „Datensicherung“ exportierst du alle Daten als JSON. So ist alles sicher und kann auf einen anderen Computer übertragen werden."
          hint="Wichtig: Vor jedem Importieren wird automatisch der aktuelle Stand gesichert (↺ Letzten Stand wiederherstellen auf dem Dashboard)."
        >
          <SceneBackup />
        </TourCard>

        {/* Quick-start checklist */}
        <h2 style={sectionHeading}>Probier es aus</h2>
        <Checklist />

        {/* About info */}
        <h2 style={sectionHeading}>Über die App</h2>
        <AboutInfo version={version} />
      </div>
    </div>
  );
}
