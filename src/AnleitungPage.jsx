// Anleitung — die Bedienungsanleitung der App, in zwei Bereichen:
//
//   1. AIM Prüfungs-Manager — eine geführte Tour durch die echte App.
//      Die tatsächlichen Seiten-Komponenten werden verkleinert gerendert,
//      ein animierter Cursor + Sprechblasen zeigen, wo man klickt. Kein
//      Screenshot, kein Mockup — jeder Pixel ist die echte UI.
//
//   2. Testportal — Schritt für Schritt erklärt mit kurzen, in Schleife
//      laufenden Videos (wie GIFs). Der Eigentümer legt die Videos in
//      src/anleitung-media/testportal/ ab (Dateinamen siehe README dort);
//      fehlt ein Video, erscheint automatisch ein "Video folgt"-Platzhalter.
//
// Diese Seite ersetzt die früheren Tabs "Hilfe & Anleitung" und "Über die App".

import React, { useEffect, useRef, useState } from "react";

import {
  C,
  sans,
  serif,
  // page components (für die AIM-Tour)
  Dashboard,
  QuestionDB,
  Programs,
  ExamBuilder,
  ExportView,
  SettingsPage,
  // .docx export primitives (reused to build the printable Anleitung document)
  docxEsc,
  DOCX_CONTENT_TYPES,
  DOCX_RELS,
  zipStore,
} from "../AIMExamManager.jsx";

// ─── timing + animation helpers ──────────────────────────────────────────

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return undefined;
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return reduced;
}

// Cycle through `n` steps every `interval` ms. With reduced motion we just
// stay on step 0 so users with motion sensitivity see a static state.
function useLoop(n, interval = 3500) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced || n <= 1) return undefined;
    const t = setInterval(() => setStep((s) => (s + 1) % n), interval);
    return () => clearInterval(t);
  }, [n, interval, reduced]);
  return step;
}

// ─── cursor + callout primitives ─────────────────────────────────────────

function Cursor({ x, y, clicked }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 22,
        height: 22,
        pointerEvents: "none",
        transition:
          "left 0.7s cubic-bezier(.45,.7,.4,1), top 0.7s cubic-bezier(.45,.7,.4,1)",
        zIndex: 30,
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          d="M5,3 L5,17 L9,13 L11.5,18.5 L13.5,17.5 L11,12 L17,12 Z"
          fill="#111"
          stroke="#fff"
          strokeWidth="1.2"
        />
      </svg>
      {clicked && (
        <span
          style={{
            position: "absolute",
            left: -10,
            top: -10,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "2.5px solid var(--c-t)",
            animation: "aim-tour-ring 0.55s ease-out",
          }}
        />
      )}
    </div>
  );
}

// Small floating speech bubble that points at a specific spot. `tail` says
// where the arrow comes from: "top-left", "top-right", etc.
function Callout({ x, y, tail = "top-left", children, color = "tD", visible = true }) {
  const bg = color === "accent" ? C.ac : color === "green" ? C.gr : C.inv;
  const fg = color === "accent" ? "#111" : "#fff";
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top: y,
        maxWidth: 200,
        background: bg,
        color: fg,
        fontFamily: sans,
        fontSize: 11.5,
        lineHeight: 1.4,
        padding: "7px 10px",
        borderRadius: 7,
        boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-6px)",
        transition: "opacity 0.4s, transform 0.4s",
        zIndex: 25,
      }}
    >
      {children}
      {/* tail */}
      <span
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          ...(tail === "top-left" && {
            top: -8,
            left: 16,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderBottom: `8px solid ${bg}`,
          }),
          ...(tail === "top-right" && {
            top: -8,
            right: 16,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderBottom: `8px solid ${bg}`,
          }),
          ...(tail === "bottom-left" && {
            bottom: -8,
            left: 16,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: `8px solid ${bg}`,
          }),
          ...(tail === "left" && {
            left: -8,
            top: 14,
            borderTop: "8px solid transparent",
            borderBottom: "8px solid transparent",
            borderRight: `8px solid ${bg}`,
          }),
          ...(tail === "right" && {
            right: -8,
            top: 14,
            borderTop: "8px solid transparent",
            borderBottom: "8px solid transparent",
            borderLeft: `8px solid ${bg}`,
          }),
        }}
      />
    </div>
  );
}

// PageStage hosts a real page component at a defined natural width, scales
// it down to fit, and gives us a fixed coordinate system for cursors and
// callouts. Pointer events on the inner content are disabled so the tour
// can never accidentally trigger real handlers (downloads, modals).
function PageStage({ scale = 0.7, naturalWidth = 1500, naturalHeight, children, overlay }) {
  // Scale the live page to FIT the container width, so it works in both the
  // 1-column and 2-column Anleitung layouts without overflowing. `scale` is
  // only a fallback before the first measurement.
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const fit = w ? w / naturalWidth : scale;
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        background: C.wW,
        border: `1px solid ${C.bo}`,
        borderRadius: 10,
        overflow: "hidden",
        height: naturalHeight ? naturalHeight * fit : undefined,
      }}
    >
      <div
        aria-hidden
        style={{
          width: naturalWidth,
          transform: `scale(${fit})`,
          transformOrigin: "top left",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {children}
      </div>
      {/* Overlay coordinates are in DISPLAYED pixels (already scaled). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 20,
        }}
      >
        {overlay}
      </div>
    </div>
  );
}

// ─── mock data fixtures ──────────────────────────────────────────────────
// Small, deterministic, German content that exercises every visible feature
// of each page without overwhelming the tour cards.

const mockQuestions = [
  {
    id: "tour_q1",
    year: "2025",
    location: "",
    lecturer: "Dr. Jörg Petry",
    course: "Sucht",
    format: "Richtig/Falsch",
    question: "Ist die Toleranzsteigerung ein Kriterium für eine Alkoholnutzungs-Störung?",
    optA: "Richtig",
    optB: "Falsch",
    optC: "",
    optD: "",
    optE: "",
    answer: "A",
  },
  {
    id: "tour_q2",
    year: "2025",
    location: "",
    lecturer: "Dr. Jörg Petry",
    course: "Sucht",
    format: "Richtig/Falsch",
    question: "Dienen psychotrope Substanzen dazu, Emotionen zu regulieren?",
    optA: "Richtig",
    optB: "Falsch",
    optC: "",
    optD: "",
    optE: "",
    answer: "A",
  },
  {
    id: "tour_q3",
    year: "2025",
    location: "",
    lecturer: "Dr. phil. Yoan Mihov",
    course: "Essstörungen",
    format: "Single Choice",
    question:
      "Welche Essstörung weist den frühesten typischen Beginn in der Lebensspanne auf?",
    optA: "Anorexia nervosa beginnt am frühesten",
    optB: "Bulimia nervosa beginnt am frühesten",
    optC: "Binge-Eating-Störung beginnt am frühesten",
    optD: "Alle drei beginnen im selben Alter",
    optE: "",
    answer: "A",
  },
  {
    id: "tour_q4",
    year: "2026",
    location: "",
    lecturer: "Jannis Behr",
    course: "Einführung ACT",
    format: "Richtig/Falsch",
    question:
      "Bei der ACT handelt es sich um einen transdiagnostischen Ansatz der dritten Welle der Verhaltenstherapie.",
    optA: "Richtig",
    optB: "Falsch",
    optC: "",
    optD: "",
    optE: "",
    answer: "A",
  },
  {
    id: "tour_q5",
    year: "2025",
    location: "",
    lecturer: "Marina Poppinger",
    course: "Einführung Schematherapie",
    format: "Richtig/Falsch",
    question:
      "Maladaptive Schemata entstehen in der Kindheit durch unzureichend erfüllte Grundbedürfnisse.",
    optA: "Richtig",
    optB: "Falsch",
    optC: "",
    optD: "",
    optE: "",
    answer: "A",
  },
  {
    id: "tour_q6",
    year: "2025",
    location: "",
    lecturer: "Monika Renz",
    course: "Sterbeprozesse",
    format: "Ja/Nein",
    question:
      "Kann Vergebung und Loslassen das Sterben und das Zurückbleiben der Angehörigen erleichtern?",
    optA: "Ja",
    optB: "Nein",
    optC: "",
    optD: "",
    optE: "",
    answer: "A",
  },
];

const emptyMod = { year: "", lecturer: "", course: "" };
const fillSem = (n, mods) => ({
  sem: n,
  modules: [0, 1, 2, 3].map((i) => mods[i] || { ...emptyMod }),
});

const mockPrograms = [
  {
    id: "tour_p1",
    name: "WBS 55 (2020)",
    startYear: "2024",
    startTerm: "HS",
    semesters: [
      fillSem(1, [
        { year: "2025", lecturer: "Dr. Jörg Petry", course: "Sucht" },
        { year: "2026", lecturer: "Jannis Behr", course: "Einführung ACT" },
        { year: "2025", lecturer: "Marina Poppinger", course: "Einführung Schematherapie" },
        { year: "2025", lecturer: "Monika Renz", course: "Sterbeprozesse" },
      ]),
      fillSem(2, [
        { year: "2025", lecturer: "Dr. phil. Yoan Mihov", course: "Essstörungen" },
        { year: "2025", lecturer: "Dr. phil. Dominique Holstein", course: "Emotionsfokussierte Therapie" },
      ]),
      fillSem(3, []),
      fillSem(4, []),
      fillSem(5, []),
      fillSem(6, []),
    ],
  },
  {
    id: "tour_p2",
    name: "WBS Zürich (Gruppe 2)",
    startYear: "2025",
    startTerm: "FS",
    semesters: [
      fillSem(1, [
        { year: "2025", lecturer: "Dr. Jörg Petry", course: "Sucht" },
        { year: "2025", lecturer: "Dr. phil. Dominique Holstein", course: "Emotionsfokussierte Therapie" },
      ]),
      fillSem(2, []),
      fillSem(3, []),
      fillSem(4, []),
      fillSem(5, []),
      fillSem(6, []),
    ],
  },
];

const mockExam = mockQuestions.slice(0, 4);
const mockSavedExams = [
  {
    id: "tour_se1",
    name: "WBS 55 — Semester 1 Probe",
    programName: "WBS 55 (2020)",
    createdAt: "2026-04-12T09:30:00Z",
    questions: mockQuestions.slice(0, 4),
  },
];

const mockSettings = { lockedByDefault: true, defaultScale: 55 };

const noop = () => {};

// ─── single tour section helper ──────────────────────────────────────────

function TourSection({ index, title, lead, stage, wide }) {
  return (
    <section style={{ marginBottom: 28, ...(wide ? { gridColumn: "1 / -1" } : null) }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <div
          style={{
            fontFamily: sans,
            fontSize: 11,
            color: C.mu,
            letterSpacing: "2px",
            textTransform: "uppercase",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          Schritt {index}
        </div>
        <h3
          style={{
            fontFamily: serif,
            fontSize: 19,
            color: C.tD,
            margin: 0,
            fontWeight: 700,
          }}
        >
          {title}
        </h3>
      </div>
      <p
        style={{
          fontSize: 14,
          color: C.tx,
          margin: "0 0 14px",
          lineHeight: 1.55,
          maxWidth: 820,
        }}
      >
        {renderRich(lead)}
      </p>
      {stage}
    </section>
  );
}

// Renders a step's speech bubble + the cursor pointing at the tail target.
// The cursor sits just ABOVE the callout (at the control the top tail points
// to) — that's where the described element actually is.
function StageOverlay({ s }) {
  const right = s.tail.includes("right");
  const top = s.tail.includes("top");
  return (
    <>
      <Callout x={s.x} y={s.y} tail={s.tail}>{s.text}</Callout>
      <Cursor
        x={`calc(${s.x} + ${right ? "166px" : "12px"})`}
        y={top ? `calc(${s.y} - 16px)` : `calc(${s.y} + 16px)`}
        clicked
      />
    </>
  );
}

// ─── per-page tour scenes (AIM Prüfungs-Manager) ───────────────────────────

// 1. Dashboard. The page itself is fairly tall — we render it at scale 0.7
//    and step the cursor across its main panels.
function StageDashboard() {
  const stops = [
    { x: "61%", y: "9%", tail: "top-right", text: "Auf „Neue Prüfung“ klicken — startet den Prüfungsbau direkt aus dem Dashboard." },
    { x: "12%", y: "17%", tail: "top-left", text: "Hier siehst du die Gesamtzahl der Fragen, Kurse, Weiterbildungsgänge und gespeicherten Prüfungen auf einen Blick." },
    { x: "44%", y: "25%", tail: "top-right", text: "Schnellzugriff — direkt zu „Prüfung erstellen“ oder „Fragen verwalten“ springen." },
    { x: "24%", y: "46%", tail: "top-left", text: "Datensicherung: alle Daten als Excel-Datei sichern oder wieder zurückladen. Regelmäßig nutzen!" },
    { x: "48%", y: "54%", tail: "top-left", text: "„Alle Daten löschen“ wischt die App leer — vorher wird automatisch ein Snapshot gesichert." },
  ];
  const step = useLoop(stops.length, 4000);
  const s = stops[step];
  return (
    <PageStage scale={0.62} naturalWidth={1500} naturalHeight={1100}
      overlay={<StageOverlay s={s} />}
    >
      <div style={{ display: "flex", minHeight: 1100 }}>
        <Dashboard
          questions={mockQuestions}
          programs={mockPrograms}
          exam={null}
          examName=""
          savedExams={mockSavedExams}
          setView={noop}
          setQuestions={noop}
          setPrograms={noop}
          setSavedExams={noop}
          setExam={noop}
          setExamName={noop}
          showToast={noop}
          showConfirm={noop}
          onClearAllData={noop}
          saveLastBackup={noop}
        />
      </div>
    </PageStage>
  );
}

// 2. Fragen Datenbank.
function StageQuestionDB() {
  const stops = [
    {
      x: "55%",
      y: "6%",
      tail: "top-left",
      text: "„✏️ Bearbeiten“ entsperrt die Tabelle. Erst dann erscheinen die Lösch-Buttons und der Knopf „+ Neue Frage“.",
    },
    {
      x: "8%",
      y: "14%",
      tail: "top-left",
      text: "Über die Suchleiste findest du Fragen nach Stichwort. Filter dahinter grenzen auf Kurs, Dozent/in, Weiterbildungsgang oder Format ein.",
    },
    {
      x: "40%",
      y: "14%",
      tail: "top-left",
      text: "Neuer „Weiterbildungsgang“-Filter: Zeigt nur Fragen, die im ausgewählten Programm vorkommen.",
    },
    {
      x: "40%",
      y: "32%",
      tail: "top-left",
      text: "In dieser Spalte siehst du als kleine Plaketten, zu welchen Weiterbildungsgängen jede Frage passt. Wird live berechnet.",
    },
    {
      x: "8%",
      y: "32%",
      tail: "top-left",
      text: "Eine Zeile pro Frage. Kurs, Jahr, Dozent/in, Format und die korrekte Antwort sind auf einen Blick sichtbar.",
    },
  ];
  const step = useLoop(stops.length, 4000);
  const s = stops[step];
  return (
    <PageStage scale={0.6} naturalWidth={1500} naturalHeight={1050}
      overlay={<StageOverlay s={s} />}
    >
      <div style={{ display: "flex", minHeight: 1050 }}>
        <QuestionDB
          questions={mockQuestions}
          setQuestions={noop}
          programs={mockPrograms}
          showToast={noop}
          showConfirm={noop}
        />
      </div>
    </PageStage>
  );
}

// 3. Weiterbildungsgänge. Render with settings that default to scale 55 +
//    locked so it fits and shows the lock state.
function StageProgramsView() {
  const stops = [
    {
      x: "32%",
      y: "5%",
      tail: "top-left",
      text: "Zwischen Standard- und Kompaktansicht wechseln. Kompakt kürzt lange Kursnamen automatisch.",
    },
    {
      x: "50%",
      y: "5%",
      tail: "top-left",
      text: "Zoomstufen 100/85/70/55 % — bequem den ganzen Plan auf einen Blick.",
    },
    {
      x: "68%",
      y: "5%",
      tail: "top-right",
      text: "🔓 Bearbeiten/Sperren — entsperrt die Felder zum Tippen. Beim Sperren bleibt die Übersicht aufgeräumt.",
    },
    {
      x: "10%",
      y: "26%",
      tail: "top-left",
      text: "Pro Zeile ein Weiterbildungsgang mit Startsemester (z.B. HS 2024). 6 Semester × 4 Module je Programm.",
    },
    {
      x: "60%",
      y: "32%",
      tail: "top-left",
      text: "Pro Semester drei Spalten: Jahr · Dozent/in · Kursname. Doppelt-Klicken oder Tippen bearbeitet eine Zelle (im Bearbeiten-Modus).",
    },
  ];
  const step = useLoop(stops.length, 4000);
  const s = stops[step];
  return (
    <PageStage scale={0.6} naturalWidth={1500} naturalHeight={900}
      overlay={<StageOverlay s={s} />}
    >
      <div style={{ display: "flex", minHeight: 900 }}>
        <Programs
          programs={mockPrograms}
          setPrograms={noop}
          questions={mockQuestions}
          showToast={noop}
          showConfirm={noop}
          settings={mockSettings}
        />
      </div>
    </PageStage>
  );
}

// 4. Prüfung erstellen — ExamBuilder.
function StageExamBuilder() {
  const stops = [
    {
      x: "10%",
      y: "18%",
      tail: "top-left",
      text: "Die Zusammenfassung zeigt den aktuell gewählten Weiterbildungsgang.",
    },
    {
      x: "42%",
      y: "18%",
      tail: "top-left",
      text: "Anzahl Module und Fragen — die Zahl wird grün, sobald die Standard-Größe von 40 Fragen erreicht ist.",
    },
    {
      x: "72%",
      y: "18%",
      tail: "top-right",
      text: "„Prüfung erstellen“ baut die Prüfung aus den ausgewählten Modulen und springt direkt zum Export.",
    },
    {
      x: "10%",
      y: "44%",
      tail: "top-left",
      text: "Auf einen Weiterbildungsgang in der Matrix klicken — alle seine Module werden vorausgewählt.",
    },
    {
      x: "55%",
      y: "44%",
      tail: "top-left",
      text: "Pro Modul ein Häkchen. Abhaken entfernt es aus der Prüfung. Die Fragen-Zahl rechnet sich live mit.",
    },
  ];
  const step = useLoop(stops.length, 4000);
  const s = stops[step];
  return (
    <PageStage scale={0.6} naturalWidth={1500} naturalHeight={900}
      overlay={<StageOverlay s={s} />}
    >
      <div style={{ display: "flex", minHeight: 900 }}>
        <ExamBuilder
          programs={mockPrograms}
          questions={mockQuestions}
          onBuild={noop}
          setView={noop}
        />
      </div>
    </PageStage>
  );
}

// 5. Export & Download — ExportView.
function StageExportView() {
  const stops = [
    {
      x: "12%",
      y: "12%",
      tail: "top-left",
      text: "Bearbeiten-Modus: Reihenfolge der Fragen ändern oder einzelne entfernen.",
    },
    {
      x: "26%",
      y: "12%",
      tail: "top-left",
      text: "💾 Speichern & neu — speichert die Prüfung dauerhaft und startet sofort eine neue.",
    },
    {
      x: "55%",
      y: "12%",
      tail: "top-left",
      text: "↓ TXT — Plain-Text-Export der Prüfung.",
    },
    {
      x: "66%",
      y: "12%",
      tail: "top-left",
      text: "↓ Word (.docx) — exportiert die Prüfung als Word-Datei für den Testportal-Import. Korrekte Antworten sind fett markiert.",
    },
    {
      x: "10%",
      y: "55%",
      tail: "top-left",
      text: "Live-Vorschau im Testportal-Format. Korrekte Antworten sind grün hervorgehoben.",
    },
  ];
  const step = useLoop(stops.length, 4000);
  const s = stops[step];
  return (
    <PageStage scale={0.6} naturalWidth={1500} naturalHeight={900}
      overlay={<StageOverlay s={s} />}
    >
      <div style={{ display: "flex", minHeight: 900 }}>
        <ExportView
          exam={mockExam}
          programName="WBS 55 (2020)"
          setView={noop}
          showToast={noop}
          showConfirm={noop}
          onSaveAndNew={noop}
          onUpdateExam={noop}
          onClear={noop}
        />
      </div>
    </PageStage>
  );
}

// 6. Einstellungen — SettingsPage.
function StageSettings() {
  const stops = [
    {
      x: "10%",
      y: "22%",
      tail: "top-left",
      text: "Sperre standardmäßig aktiv — schützt die Weiterbildungsgang-Übersicht vor versehentlichen Änderungen.",
    },
    {
      x: "10%",
      y: "46%",
      tail: "top-left",
      text: "Standard-Zoomstufe für die Semester-Matrix. Hilfreich auf kleinen Bildschirmen.",
    },
    {
      x: "10%",
      y: "70%",
      tail: "top-left",
      text: "Dunkelmodus auch über das Sonne/Mond-Icon links unten umschaltbar.",
    },
  ];
  const step = useLoop(stops.length, 4000);
  const s = stops[step];
  return (
    <PageStage scale={0.7} naturalWidth={900} naturalHeight={600}
      overlay={<StageOverlay s={s} />}
    >
      <div style={{ display: "flex", minHeight: 600 }}>
        <SettingsPage
          settings={mockSettings}
          setSettings={noop}
          darkMode={false}
          onToggleDark={noop}
        />
      </div>
    </PageStage>
  );
}

// ─── quick-start checklist (with localStorage persistence) ───────────────

const CHECKLIST_KEY = "aim_about_checklist_v1";
const CHECKLIST_ITEMS = [
  { k: "explore", label: "Beispieldaten ansehen — auf Dashboard alle Werte prüfen" },
  { k: "program", label: "Eigenen Weiterbildungsgang anlegen" },
  { k: "question", label: "Erste eigene Frage hinzufügen" },
  { k: "exam", label: "Erste eigene Prüfung erstellen und als Word-Datei speichern" },
  { k: "backup", label: "Excel-Backup exportieren und an einem sicheren Ort speichern" },
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
      /* non-essential */
    }
  }, [checked]);
  const toggle = (k) => setChecked((prev) => ({ ...prev, [k]: !prev[k] }));
  const done = CHECKLIST_ITEMS.filter((it) => checked[it.k]).length;

  return (
    <div
      style={{
        background: C.wh,
        border: `1px solid ${C.bo}`,
        borderRadius: 10,
        padding: 18,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, color: C.tD }}>
          Erste Schritte
        </div>
        <div style={{ fontSize: 12, color: C.mu }}>
          {done} / {CHECKLIST_ITEMS.length} erledigt
        </div>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {CHECKLIST_ITEMS.map((it) => (
          <li
            key={it.k}
            style={{ display: "flex", gap: 10, padding: "6px 0", alignItems: "center" }}
          >
            <button
              type="button"
              onClick={() => toggle(it.k)}
              aria-pressed={!!checked[it.k]}
              style={{
                width: 20,
                height: 20,
                border: `1.5px solid ${C.bo}`,
                borderRadius: 4,
                background: checked[it.k] ? C.gr : "transparent",
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
                color: checked[it.k] ? C.mu : C.tx,
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

// ─── about info ──────────────────────────────────────────────────────────

function AboutInfo({ version }) {
  return (
    <div
      style={{
        background: C.wW,
        border: `1px solid ${C.bo}`,
        borderRadius: 10,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 20,
          alignItems: "center",
        }}
      >
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
          <div
            style={{
              fontFamily: serif,
              fontSize: 18,
              fontWeight: 700,
              color: C.tD,
            }}
          >
            AIM Prüfungs-Manager
          </div>
          <div style={{ fontSize: 12, color: C.mu, marginTop: 2 }}>
            Version {version || "—"} · Lokale Desktop-App · Offline-fähig
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: C.mu,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Wo sind meine Daten?
          </div>
          <div style={{ fontSize: 12, color: C.tx, lineHeight: 1.55 }}>
            Alle Daten werden lokal auf diesem Computer gespeichert. Nichts wird
            ins Internet geschickt. Für Sicherheit und Übertragung das
            Excel-Backup auf dem Dashboard nutzen.
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              color: C.mu,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Updates
          </div>
          <div style={{ fontSize: 12, color: C.tx, lineHeight: 1.55 }}>
            Die App prüft beim Start automatisch auf neue Versionen. Bei einer
            neuen Version erscheint oben ein grüner Banner. Daten bleiben bei
            Updates erhalten.
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, fontSize: 11, color: C.mu }}>
        © AIM · Basel · Bern · Zürich
      </div>
    </div>
  );
}

// ─── Testportal: Loop-Videos + Szenen ──────────────────────────────────────

// Alle MP4/WebM-Dateien aus dem Drop-in-Ordner einsammeln. Vite bündelt sie
// beim Build und liefert relative URLs (base "./"), die unter file:// in der
// Electron-App funktionieren. Fehlt eine Datei, bleibt der Name unbelegt und
// VideoStage zeigt den "Video folgt"-Platzhalter.
const TP_MEDIA = import.meta.glob(
  "./anleitung-media/testportal/*.{mp4,webm}",
  { eager: true, query: "?url", import: "default" }
);
const TP_VIDEOS = {};
for (const [path, url] of Object.entries(TP_MEDIA)) {
  const name = path.split("/").pop().replace(/\.(mp4|webm)$/i, "");
  TP_VIDEOS[name] = url;
}
const tpVideo = (name) => TP_VIDEOS[name];

// Render plain text with **bold** segments as <strong>. Used for all step
// text so key terms/buttons stand out on screen — and so the same source
// strings map cleanly to bold in a future paper/PDF printout.
function renderRich(text) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      /^\*\*[^*]+\*\*$/.test(part) ? (
        <strong key={i} style={{ fontWeight: 700, color: C.tD }}>
          {part.slice(2, -2)}
        </strong>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );
}

// Bullet list under a video: the spoken/written explanation of each click.
function PointList({ points }) {
  return (
    <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "grid", gap: 9 }}>
      {points.map((p, i) => (
        <li key={i} style={{ display: "flex", gap: 11, fontSize: 13.5, color: C.tx, lineHeight: 1.55 }}>
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.t,
              marginTop: 7,
            }}
          />
          <span>{renderRich(p)}</span>
        </li>
      ))}
    </ul>
  );
}

function InfoNote({ children, icon = "💡" }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        background: C.tP,
        border: `1px solid ${C.tL}`,
        borderRadius: 8,
        padding: "12px 14px",
        marginTop: 16,
      }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1.4 }}>{icon}</span>
      <div style={{ fontSize: 13, color: C.tD, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

// A looping, muted, autoplaying clip (behaves like a GIF) framed like a
// PageStage. Falls back to a clean placeholder when the file isn't present.
function VideoStage({ name, points = [], speed = 2 }) {
  const src = tpVideo(name);
  const vref = useRef(null);
  // Apply the chosen playback speed. playbackRate is a property (not an
  // attribute) and can reset when a source loads, so we set it in an effect
  // AND on loadeddata. Looping does not reset it.
  useEffect(() => {
    if (vref.current) vref.current.playbackRate = speed;
  }, [speed, src]);
  // Defined inside the component: reading C at module-eval time would crash
  // because of the circular import with AIMExamManager (C isn't exported yet).
  const tpFrame = {
    position: "relative",
    background: C.wW,
    border: `1px solid ${C.bo}`,
    borderRadius: 10,
    overflow: "hidden",
  };
  return (
    <div>
      {src ? (
        <div style={tpFrame}>
          <video
            ref={vref}
            src={src}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden
            onLoadedData={(e) => {
              e.currentTarget.playbackRate = speed;
            }}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
      ) : (
        <div
          style={{
            ...tpFrame,
            aspectRatio: "16 / 9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div aria-hidden style={{ fontSize: 30, marginBottom: 8 }}>🎬</div>
            <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.tD }}>
              Video folgt
            </div>
            <div
              style={{
                fontSize: 11,
                color: C.mu,
                marginTop: 6,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              {name}.mp4
            </div>
          </div>
        </div>
      )}
      {points.length > 0 && <PointList points={points} />}
    </div>
  );
}

// A sub-section card inside a step (used for Schritt 4 & 5 sub-areas).
function SubStep({ label, name, points, speed }) {
  return (
    <div
      style={{
        background: C.wh,
        border: `1px solid ${C.bo}`,
        borderRadius: 10,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.tD, marginBottom: 12 }}>
        {label}
      </div>
      <VideoStage name={name} points={points} speed={speed} />
    </div>
  );
}

// Testportal step definitions. Texts are intentionally non-technical German.
const TP_STEPS = [
  {
    title: "Bei Testportal anmelden",
    lead:
      "Testportal läuft im Browser und wird mit dem offiziellen **AIM-Konto** bedient — demselben Konto, mit dem alle AIM-Prüfungen verwaltet werden, nicht mit einem privaten Login.",
    video: "01-login",
    points: [
      "Im Browser **www.testportal.com** öffnen.",
      "Oben rechts auf **Login** klicken.",
      "Auf der Anmeldeseite **E-Mail** und **Passwort** des AIM-Kontos eingeben und auf **Sign in** klicken. Alternativ **Continue with Microsoft**, falls das AIM-Konto darüber läuft.",
      "Nach der Anmeldung erscheint die Test-Übersicht **My tests** — der Ausgangspunkt für alles Weitere.",
    ],
  },
  {
    title: "Die Startseite „My tests“ verstehen",
    lead:
      "Nach dem Login zeigt **My tests** alle Tests des Kontos als Kacheln. Von hier legst du neue Tests an, öffnest bestehende zur Bearbeitung oder rufst Resultate ab.",
    video: "02-startseite",
    points: [
      "Jede **Kachel** ist ein Test. Das farbige Etikett zeigt den Status: **ACTIVE** (läuft gerade), **ENDED** (beendet) oder **SETUP IN PROGRESS** (noch in Einrichtung).",
      "Oben rechts: **New test** legt einen neuen Test an. **Generate questions** (KI-Fragen) wird für AIM **nicht** benötigt.",
      "Auf jeder Kachel: das **„…“-Menü** (umbenennen, duplizieren, löschen), der Durchschnitt **avg. score** und die Zahl der **Results**.",
      "Links die Seitenleiste (**My tests**, **Respondents**, **Results database**), oben **Category** und **Status** zum Filtern, falls viele Tests vorhanden sind.",
      "Ein Klick auf eine Kachel öffnet den jeweiligen Test.",
    ],
  },
  {
    title: "Fragen aus dem AIM Prüfungs-Manager importieren",
    lead:
      "Fragen werden nicht abgetippt, sondern als Datei hochgeladen — am besten die **Word-Datei (.docx)**, die der AIM Prüfungs-Manager unter **Export & Download** erzeugt. In dieser .docx ist die **richtige Antwort fett** gespeichert, sodass Testportal sie beim Import automatisch als korrekt erkennt.",
    video: "03-import",
    points: [
      "Oben rechts auf **New test** klicken und **Import from file** wählen.",
      "Im Fenster **Import test** die aus dem AIM-Manager exportierte Datei hochladen — per Klick auf das Feld oder per **Drag & Drop**. Unterstützt werden **PDF, Word (.docx) und Textdateien**; für AIM die **.docx** verwenden.",
      "Auf **Import** klicken. Testportal liest alle Fragen ein und meldet **„Your questions are ready!“**.",
      "Mit **Review questions** geht es weiter — der Test steht jetzt auf **SETUP IN PROGRESS** und wird als Nächstes eingerichtet.",
    ],
  },
  {
    title: "Den Test konfigurieren — Überblick",
    lead:
      "Nach dem Import richtest du den Test ein. Links unter **Test configuration** liegen alle Einstellungs-Bereiche, oben zeigt ein Balken den Fortschritt in Prozent. Erst wenn alles geprüft ist, wird der Test unten über den grünen Knopf **Activate test** freigegeben.",
    video: "04-konfiguration",
    points: [
      "Linkes Menü **Test configuration**: Basic settings, Questions manager, Test sets, Test access, Test start page, Grading & summary, Time settings, Certificate template.",
      "Oben rechts öffnet **Test info** die **Configuration summary** — eine Zusammenfassung aller wichtigen Einstellungen (Fragenzahl, Pass mark, Zugangsart, Zeit) für die Schlusskontrolle.",
      "Die einzelnen Bereiche werden in den folgenden Abschnitten einzeln erklärt.",
      "Wichtig: Nach jeder Änderung in einem Bereich unten auf **Save** klicken.",
    ],
    subSteps: [
      {
        label: "Basic settings — Name & Grunddaten",
        name: "04a-basic-settings",
        points: [
          "**Test name**: einen klaren, eindeutigen Namen vergeben, z. B. „AIM Prüfung – WBS 55 (2020)“. So ist der Test später bei Resultaten sofort zuzuordnen.",
          "**Category** und **Description** sind optional und nur intern sichtbar.",
          "**Test language** auf die gewünschte Sprache stellen.",
          "Beim **Logo** kann das AIM-Logo hinterlegt oder das Standard-Logo genutzt werden.",
        ],
      },
      {
        label: "Questions manager — Fragen prüfen & Kategorien setzen",
        name: "04b-questions-manager",
        points: [
          "Hier stehen **alle importierten Fragen** untereinander. Bei jeder Frage ist die **richtige Antwort grün hinterlegt**, rechts steht die **Punktzahl (Points)**.",
          "**Wichtigste Kontrolle:** Bei jeder Frage muss eine richtige Antwort markiert sein (bei Multiple Choice mehrere). Fehlt das, weist Testportal in der Zusammenfassung darauf hin.",
          "Eine Frage anklicken öffnet den **Editor**: Fragetext, **Answer type** (z. B. Single choice) und die Antworten — die korrekte Antwort wird über den **grünen Punkt** links markiert.",
          "**Kategorien zuordnen (wichtig!):** Nach dem Import haben alle Fragen die Standard-Kategorie **„Generic“**. Die richtigen Kategorien werden **nicht** mitimportiert und müssen pro Frage von Hand gesetzt werden.",
          "**So geht es am schnellsten:** Die **erste Zeile jeder Frage** ist der Kursname („Titel des Kurses: …“). Diesen Kursnamen **markieren und kopieren**, dann in der Frage unter **Category** auf **Add new category** klicken und den Namen **einfügen** — so bekommt jede Frage die Kategorie ihres Kurses.",
          "Alle angelegten Kategorien lassen sich danach über **Manage categories** ansehen und verwalten (umbenennen, löschen).",
          "Über **Add question** lassen sich Fragen ergänzen, über **Change questions order** umsortieren.",
        ],
      },
      {
        label: "Test sets — Reihenfolge / Varianten",
        name: "04c-test-sets",
        points: [
          "Unter **Questions order** zwei Optionen: **Fixed** (feste Reihenfolge wie im Questions manager) oder **Random questions and answers order**.",
          "Empfehlung für Prüfungen: **Random** wählen, damit nicht alle Studierenden Fragen und Antworten in derselben Reihenfolge sehen.",
          "Über **Configure manually** lassen sich bei Bedarf eigene Sets bauen, die Reihenfolge mischen (**Randomise questions order**) und Antworten mischen (**Mix answers**).",
          "**Hier zahlen sich die Kategorien aus:** Wenn die Fragen im Questions manager sauber kategorisiert sind, siehst du beim manuellen Zusammenstellen alle **Kategorien** übersichtlich und kannst gezielt Sets pro Kurs/Thema bauen.",
          "Mit **Save** speichern.",
        ],
      },
      {
        label: "Test access — Zugang & Anti-Cheat",
        name: "04d-test-access",
        points: [
          "**Channel**: in der Regel **Web browser** (alternativ **Microsoft Teams**).",
          "**Access type**: für AIM am einfachsten **Public Link** — Testportal erzeugt einen Link, den du mit **Copy link** kopierst und an die Klasse schickst.",
          "**Attempts per respondent** auf **1** stellen (jede Person nimmt einmal teil).",
          "**Honest Respondent Technology** ist der Anti-Cheat-Schutz: **Disable**, **Enable warnings only** oder **Enable warnings and test block** (warnt bzw. sperrt bei Tab-Wechsel). Für Prüfungen mindestens Warnungen aktivieren.",
          "Hinweis: Wie viele Personen gleichzeitig teilnehmen dürfen, hängt vom **Konto-Tarif** ab. Zum Schluss **Save**.",
        ],
      },
      {
        label: "Test start page — Startseite & Namensabfrage",
        name: "04e-test-start-page",
        points: [
          "Unter **Instructions for respondents** eine kurze Begrüßung / Hinweise zum Ablauf hinterlegen (z. B. „Willkommen …“).",
          "Im **Test start form** festlegen, welche Daten die Studierenden vor dem Start eingeben. **First name**, **Last name** und **E-mail address** als **Pflichtfeld (mandatory)** aktivieren — nur so sind die Resultate später eindeutig einer Person zuzuordnen.",
          "Optional unter **Consent** einen Hinweis oder eine Einverständniserklärung hinterlegen.",
          "Über **Test start page preview** lässt sich die Seite vorab ansehen. Mit **Save** speichern.",
        ],
      },
      {
        label: "Grading & summary — Punkte & Bestehensgrenze",
        name: "04f-grading-summary",
        points: [
          "**Maximum possible score** zeigt die erreichbare Gesamtpunktzahl (entspricht 100 %).",
          "**Pass mark** aktivieren und die Bestehensgrenze setzen, z. B. **Value 50–60**, **Unit %**.",
          "Unter **Information for respondents** wählen, was die Studierenden **am Ende** sehen: **Percentage score**, **Points score**, **Pass or fail message** usw.",
          "**Empfehlung:** **Correct answers to questions NICHT** anhaken — sonst wird der Lösungsschlüssel preisgegeben.",
          "Optional **Inform respondent about result via email**. Mit **Save** speichern.",
        ],
      },
      {
        label: "Time settings — Dauer & Aktivierung",
        name: "04g-time-settings",
        points: [
          "**Test duration**: entweder **Time to complete the test** (Gesamtzeit für die ganze Prüfung, z. B. **01:00** Stunde) oder **Time limit for each test question** (Zeit pro Frage).",
          "**Test activation**: bei **Manual test activation** startest du die Prüfung später selbst über **Activate test**; unter **Test will remain active for** legst du fest, wie lange sie offen bleibt (z. B. **1 Tag**). Alternativ **Activation in a set time period** für ein festes Zeitfenster.",
          "Hinweis: Wer zu spät kommt, kann nach Ablauf des Fensters nicht mehr starten.",
          "**Allow answering questions in any order / moving back / skipping**: an = freies Navigieren, aus = kein Zurückblättern. Mit **Save** speichern.",
        ],
      },
    ],
    note: "Den Bereich „Certificate template“ braucht AIM nicht — er kann übersprungen werden.",
  },
  {
    title: "Den Test aktivieren und durchführen",
    lead:
      "Wenn alle Einstellungen geprüft sind, wird der Test scharf geschaltet und der Link an die Klasse verteilt. Während und nach der Prüfung verfolgst du alles unter **Test progress & results**.",
    video: "05-durchfuehrung",
    points: [
      "Unten links auf **Activate test** klicken — der Status wechselt auf **ACTIVE** und Testportal meldet, dass der Test aktiviert wurde.",
      "Unter **Test info** den **Test link** mit **Copy link** kopieren und an die richtige Klasse senden (z. B. über Microsoft Teams).",
      "Der Link funktioniert nur im eingestellten Zeitfenster (siehe **Time settings**).",
      "Links erscheinen jetzt die Auswertungs-Bereiche unter **Test progress & results**. Nach der Prüfung beendet **End test** den Test.",
    ],
    subSteps: [
      {
        label: "Respondent monitoring — Live-Überblick",
        name: "05a-respondent-monitoring",
        points: [
          "Zeigt in **Echtzeit**, wer gerade teilnimmt: **Name**, **aktuelle Frage**, **aktueller Punktestand** und **Versuch**.",
          "Über **Presentation mode** lässt sich die Ansicht z. B. für die Aufsicht groß darstellen.",
        ],
      },
      {
        label: "Results table — Resultate & Export",
        name: "05b-results-table",
        points: [
          "Tabelle aller abgeschlossenen Resultate mit **Last name**, **First name**, **Score**, **End date** und **Time**.",
          "Mit **Export results** lädst du alle Ergebnisse herunter; über **Table content** wählst du die angezeigten Spalten.",
          "Bei Bedarf **Send certificates** / **Download certificates** für Zertifikate.",
        ],
      },
      {
        label: "Test sheets review — einzelne Bögen",
        name: "05c-test-sheets-review",
        points: [
          "Zeigt den **vollständig ausgefüllten Testbogen** einzelner Studierender — jede Frage mit der gegebenen Antwort.",
          "Nützlich bei Rückfragen oder zur Kontrolle. Solange niemand fertig ist, erscheint der Hinweis **„None of the respondents has completed the test yet“**.",
        ],
      },
      {
        label: "Answers review — Antworten pro Frage",
        name: "05d-answers-review",
        points: [
          "Hier oben eine **einzelne Frage** auswählen und sehen, **wie alle Teilnehmenden** sie beantwortet haben.",
          "Hilfreich, um offene Antworten zu bewerten oder einzelne Fragen genauer zu prüfen.",
        ],
      },
      {
        label: "Statistics — Auswertung pro Frage",
        name: "05e-statistics",
        points: [
          "Zeigt pro Frage den **Prozentsatz**, der die jeweilige Antwort gewählt hat.",
          "So erkennst du auf einen Blick **zu schwere oder missverständliche Fragen**. Über **Review all** lassen sich alle Fragen durchgehen.",
        ],
      },
      {
        label: "Unused codes — nicht genutzte Zugänge",
        name: "05f-unused-codes",
        points: [
          "Nur relevant, wenn der Zugang über **einzelne Zugangscodes** läuft (nicht beim **Public Link**).",
          "Zeigt, welche Codes **noch nicht verwendet** wurden.",
        ],
      },
    ],
  },
  {
    title: "Einen beendeten Test erneut starten",
    lead:
      "Ein Test lässt sich **mehrfach durchführen** — etwa für eine neue Klasse oder einen Nachholtermin. Jede Aktivierung wird als eigener **Durchlauf** gespeichert, sodass keine Resultate verloren gehen.",
    video: "06-test-erneut-starten",
    points: [
      "Den Test in **My tests** öffnen. Über die Konfiguration lässt er sich wieder in den Bearbeitungs-Status **SETUP IN PROGRESS** versetzen.",
      "Bei Bedarf Anpassungen vornehmen (z. B. neues Zeitfenster unter **Time settings**, geänderte Fragen oder Punkte).",
      "Erneut auf **Activate test** klicken — der Test ist wieder **ACTIVE** und es entsteht ein neuer Durchlauf.",
      "Unter **Test info → Previous test dates** sind alle früheren Durchläufe einzeln aufgelistet, jeweils mit **Results** (Resultate ansehen) und **Remove** (entfernen).",
      "Tipp: Resultate eines Durchlaufs über **Results table** herunterladen, bevor aufgeräumt wird.",
    ],
  },
];

// ─── guide bodies ──────────────────────────────────────────────────────────

function AimGuide() {
  return (
    <>
      <div
        style={{
          fontSize: 13,
          color: C.mu,
          background: C.wW,
          border: `1px solid ${C.bo}`,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 24,
          lineHeight: 1.55,
        }}
      >
        Die Bildschirme unten sind die <strong>echte App</strong>. Ein Cursor zeigt nacheinander jedes
        wichtige Bedienelement. Klicks hier sind nur zur Ansicht — du kannst nichts kaputt machen.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 28, alignItems: "start" }}>
      <TourSection
        index={1}
        title="Dashboard — die Startseite"
        lead="Beim Öffnen der App landest du hier. Du siehst sofort, wie viele Fragen, Kurse und Weiterbildungsgänge in der App sind, hast Schnellzugriff auf die wichtigsten Aktionen und findest hier auch die Datensicherung."
        stage={<StageDashboard />}
      />

      <TourSection
        index={2}
        title="Fragen Datenbank — alle Fragen verwalten"
        lead="Hier verwaltest du alle Fragen. Eine Frage gehört zu einem Kurs und erscheint automatisch in allen Weiterbildungsgängen, die diesen Kurs unterrichten. Im Bearbeiten-Modus kannst du Fragen hinzufügen, bearbeiten oder löschen — sonst ist die Tabelle gesperrt, um versehentliche Änderungen zu verhindern."
        stage={<StageQuestionDB />}
      />

      <TourSection
        index={3}
        title="Weiterbildungsgänge — Semester und Module pflegen"
        lead="Pro Weiterbildungsgang erfasst du sechs Semester mit je vier Modulen. Jedes Modul ist ein Kurs mit Jahr und Dozent/in. Mit der Sperre verhinderst du Tippfehler im Alltag; im Bearbeiten-Modus kannst du jede Zelle ändern."
        stage={<StageProgramsView />}
      />

      <TourSection
        index={4}
        title="Prüfung erstellen — Module auswählen, Prüfung bauen"
        lead="Wähle einen Weiterbildungsgang und aktiviere die Module, aus denen die Prüfung zusammengestellt werden soll. Die App sammelt automatisch alle Fragen, die zu den gewählten Modulen passen. Der Standard sind 40 Fragen — die Zahl wird grün, wenn dieser Wert erreicht ist."
        stage={<StageExamBuilder />}
      />

      <TourSection
        index={5}
        title="Export & Download — als Word-Datei speichern"
        lead='Hier wird die Prüfung exportiert. Klick auf "↓ Word (.docx)" — die Word-Datei wird sofort heruntergeladen und lässt sich direkt im Testportal hochladen. Die korrekten Antworten sind fett markiert, damit Testportal sie automatisch erkennt.'
        stage={<StageExportView />}
      />

      <TourSection
        index={6}
        title="Einstellungen — Standardverhalten anpassen"
        lead="Hier legst du fest, wie sich die App standardmäßig verhält: ob die Weiterbildungsgang-Übersicht beim Start gesperrt ist, welche Zoomstufe voreingestellt ist und ob Hellmodus oder Dunkelmodus aktiv sein soll."
        stage={<StageSettings />}
      />
      </div>

      <h2
        style={{
          fontFamily: serif,
          fontSize: 20,
          color: C.tD,
          margin: "32px 0 12px",
          fontWeight: 700,
        }}
      >
        Probier es aus
      </h2>
      <Checklist />
    </>
  );
}

// Sticky control to set the playback speed of all Testportal clips at once.
function SpeedControl({ speed, onSelect }) {
  const opts = [1, 1.5, 2];
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0 12px",
        marginBottom: 14,
        background: C.wW,
        borderBottom: `1px solid ${C.bo}`,
      }}
    >
      <span style={{ fontSize: 12.5, color: C.mu, fontWeight: 600 }}>Video-Geschwindigkeit</span>
      <div
        style={{
          display: "inline-flex",
          border: `1px solid ${C.bo}`,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        {opts.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onSelect(o)}
            aria-pressed={speed === o}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              padding: "5px 15px",
              fontFamily: sans,
              fontSize: 13,
              fontWeight: speed === o ? 700 : 500,
              background: speed === o ? C.inv : "transparent",
              color: speed === o ? "#fff" : C.tx,
            }}
          >
            {o}×
          </button>
        ))}
      </div>
    </div>
  );
}

function TestportalGuide() {
  const [speed, setSpeed] = useState(() => {
    try {
      const v = parseFloat(window.localStorage.getItem("aim_anleitung_speed"));
      return [1, 1.5, 2].includes(v) ? v : 2;
    } catch {
      return 2;
    }
  });
  const selectSpeed = (v) => {
    setSpeed(v);
    try {
      window.localStorage.setItem("aim_anleitung_speed", String(v));
    } catch {
      /* non-essential */
    }
  };
  return (
    <>
      <div
        style={{
          fontSize: 13,
          color: C.mu,
          background: C.wW,
          border: `1px solid ${C.bo}`,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 18,
          lineHeight: 1.55,
        }}
      >
        Testportal ist die Online-Plattform, auf der die Prüfung tatsächlich durchgeführt wird. Die
        kurzen Videos unten laufen in Schleife und zeigen für jeden Schritt, wo du klickst. Mit der
        Geschwindigkeit oben kannst du alle Videos langsamer oder schneller abspielen.
      </div>

      <SpeedControl speed={speed} onSelect={selectSpeed} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 28, alignItems: "start" }}>
      {TP_STEPS.map((step, i) => (
        <TourSection
          key={step.video}
          index={i + 1}
          wide={!!step.subSteps}
          title={step.title}
          lead={step.lead}
          stage={
            <>
              <VideoStage name={step.video} points={step.points} speed={speed} />
              {step.subSteps && (
                <div style={{ marginTop: 18 }}>
                  {step.subSteps.map((sub) => (
                    <SubStep key={sub.name} label={sub.label} name={sub.name} points={sub.points} speed={speed} />
                  ))}
                </div>
              )}
              {step.note && <InfoNote icon="ℹ️">{renderRich(step.note)}</InfoNote>}
            </>
          }
        />
      ))}
      </div>
    </>
  );
}

// ─── main page ───────────────────────────────────────────────────────────

// ─── printable Anleitung document (.docx) + on-screen reader ───────────────

// Steps for the AIM Prüfungs-Manager guide, in the same shape as TP_STEPS.
// Drives both the printable .docx and the on-screen „Dokument“ tab. The
// interactive cursor tour above stays unchanged.
const AIM_STEPS = [
  {
    title: "Dashboard — die Startseite",
    lead:
      "Beim Öffnen der App landest du auf dem **Dashboard**. Es zeigt auf einen Blick, wie viele Fragen, Kurse und Weiterbildungsgänge vorhanden sind, bietet Schnellzugriff auf die wichtigsten Aktionen und enthält die Datensicherung.",
    points: [
      "Oben die **Statistik-Karten**: Gesamtzahl der **Fragen**, **Kurse**, **Weiterbildungsgänge** und gespeicherten Prüfungen.",
      "Über **Neue Prüfung** startet der Prüfungsbau direkt aus dem Dashboard.",
      "Der **Schnellzugriff** führt direkt zu „Prüfung erstellen“ oder „Fragen verwalten“.",
      "**Datensicherung**: alle Daten als **Excel-Datei** sichern und bei Bedarf wieder importieren. Regelmäßig nutzen!",
      "**Alle Daten löschen** leert die App — vorher wird automatisch ein Sicherungs-Snapshot erstellt, der über **Letzten Stand wiederherstellen** zurückgeholt werden kann.",
    ],
  },
  {
    title: "Fragen Datenbank — alle Fragen verwalten",
    lead:
      "Hier verwaltest du **alle Prüfungsfragen**. Jede Frage gehört zu einem Kurs und erscheint automatisch in allen Weiterbildungsgängen, die diesen Kurs unterrichten. Standardmäßig ist die Tabelle gesperrt, damit nichts versehentlich geändert wird.",
    points: [
      "Mit **✏️ Bearbeiten** die Tabelle entsperren — erst dann erscheinen **+ Neue Frage** und die Lösch-Knöpfe.",
      "Über die **Suchleiste** nach Stichwort suchen; die **Filter** grenzen auf Kurs, Dozent/in, Weiterbildungsgang oder Format ein.",
      "Die Spalte **Weiterbildungsgänge** zeigt als kleine Plaketten, zu welchen Gängen jede Frage passt.",
      "Eine **Zeile pro Frage** mit Kurs, Jahr, Dozent/in, Format und der korrekten Antwort.",
      "Neue Fragen fügst du im Bearbeiten-Modus über **+ Neue Frage** hinzu.",
    ],
  },
  {
    title: "Weiterbildungsgänge — Semester und Module pflegen",
    lead:
      "Ein **Weiterbildungsgang** ist eine Kohorte mit **6 Semestern** und je **4 Modulen**. Jedes Modul verknüpft einen Kurs mit Jahr und Dozent/in — so weiß die App, welche Fragen zu welcher Kohorte gehören.",
    points: [
      "Mit **🔓 Bearbeiten** die Matrix entsperren, mit **🔒 Sperren** wieder schützen.",
      "Pro **Zeile** ein Weiterbildungsgang mit Startsemester (z. B. **HS 2024**).",
      "Pro Semester drei Spalten: **Jahr · Dozent/in · Kursname**.",
      "Zwischen **Standard-** und **Kompaktansicht** wechseln und die **Zoomstufe** (100–55 %) anpassen, um den ganzen Plan zu sehen.",
      "**Auto-Füllen** verteilt die getaggten Kurse automatisch auf die Module — bereits gefüllte Module werden nie überschrieben.",
    ],
  },
  {
    title: "Prüfung erstellen — Module auswählen",
    lead:
      "Hier stellst du den **Fragenpool** für eine Kohorte zusammen: Weiterbildungsgang wählen, Module aktivieren — die App sammelt automatisch alle passenden Fragen.",
    points: [
      "In der Matrix auf einen **Weiterbildungsgang** klicken — alle seine Module werden vorausgewählt.",
      "Die **Zusammenfassung** oben zeigt die Anzahl gewählter Module und Fragen; die Zahl wird **grün**, sobald die Standardgröße von **40 Fragen** erreicht ist.",
      "Einzelne Module per **Häkchen** an- oder abwählen — die Fragenzahl rechnet sich live mit.",
      "**Prüfung erstellen** baut die Prüfung und wechselt direkt zum Export.",
    ],
  },
  {
    title: "Export & Download — als Word (.docx) speichern",
    lead:
      "Die fertige Prüfung wird hier exportiert — im Format, das **Testportal** beim Import versteht. In der **Word-Datei (.docx)** ist die richtige Antwort **fett** gespeichert, sodass Testportal sie zuverlässig als korrekt erkennt.",
    points: [
      "Die **Vorschau** zeigt die Prüfung im Testportal-Format; korrekte Antworten sind grün markiert.",
      "**↓ Word (.docx)** lädt die Prüfung als Word-Datei herunter — genau diese Datei wird in Testportal importiert.",
      "**↓ TXT** und **Kopieren** stehen als Alternativen bereit.",
      "Mit **💾 Speichern & neu** wird die Prüfung dauerhaft gesichert und sofort eine neue gestartet.",
    ],
  },
  {
    title: "Einstellungen — Standardverhalten anpassen",
    lead: "Hier legst du fest, wie sich die App standardmäßig verhält.",
    points: [
      "**Weiterbildungsgänge beim Start gesperrt** — schützt die Matrix vor versehentlichen Änderungen.",
      "**Standard-Zoomstufe** der Semester-Matrix (hilfreich auf kleinen Bildschirmen).",
      "**Dunkelmodus** ein- und ausschalten (auch über das Sonne/Mond-Symbol in der Seitenleiste).",
    ],
  },
];

// Split „text with **bold**“ into runs [{ text, bold }] for both the .docx
// (bold run property) and the on-screen renderer.
function splitBoldRuns(text) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((p) => p !== "")
    .map((p) =>
      /^\*\*[^*]+\*\*$/.test(p) ? { text: p.slice(2, -2), bold: true } : { text: p, bold: false }
    );
}

// ── OOXML helpers, built on the exported docxEsc / zipStore primitives ──
const DX_FONT = 'w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"';
function dxRun(text, opts = {}) {
  const { bold = false, italic = false, sz = 22, color = "000000" } = opts;
  const rpr =
    "<w:rPr>" +
    `<w:rFonts ${DX_FONT}/>` +
    (bold ? "<w:b/><w:bCs/>" : "") +
    (italic ? "<w:i/><w:iCs/>" : "") +
    `<w:color w:val="${color}"/>` +
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` +
    "</w:rPr>";
  return `<w:r>${rpr}<w:t xml:space="preserve">${docxEsc(text)}</w:t></w:r>`;
}
function dxPara(runs, opts = {}) {
  const { sz = 22, before = 0, after = 120, ind = 0, hanging = 0, align } = opts;
  const list = Array.isArray(runs) ? runs : [{ text: runs }];
  const body = list
    .map((r) => dxRun(r.text, { bold: r.bold, italic: r.italic, sz: r.sz || sz, color: r.color }))
    .join("");
  const indXml = ind || hanging ? `<w:ind w:left="${ind}"${hanging ? ` w:hanging="${hanging}"` : ""}/>` : "";
  const alignXml = align ? `<w:jc w:val="${align}"/>` : "";
  return `<w:p><w:pPr><w:spacing w:before="${before}" w:after="${after}"/>${indXml}${alignXml}</w:pPr>${body}</w:p>`;
}
function dxHeading(text, opts = {}) {
  const { sz = 30, color = "111111", before = 240, after = 100, align } = opts;
  return dxPara([{ text, bold: true, sz, color }], { sz, before, after, align });
}
function dxBullet(text) {
  return dxPara([{ text: "•   " }, ...splitBoldRuns(text)], { after: 80, ind: 360, hanging: 360 });
}
const DX_PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

function buildAnleitungDocumentXml(dateStr) {
  const p = [];
  // Title page
  p.push(dxPara([], { after: 2600 }));
  p.push(dxHeading("AIM Prüfungs-Manager", { sz: 52, align: "center", after: 120 }));
  p.push(dxHeading("& Testportal", { sz: 40, color: "b81620", align: "center", after: 360 }));
  p.push(dxPara([{ text: "Anleitung — Schritt für Schritt", sz: 28, color: "555555" }], { align: "center", after: 140 }));
  p.push(
    dxPara(
      [{ text: "So bereitest du eine Prüfung im AIM Prüfungs-Manager vor und führst sie im Testportal durch.", sz: 22, color: "555555" }],
      { align: "center", after: 140 }
    )
  );
  if (dateStr) p.push(dxPara([{ text: "Stand: " + dateStr, sz: 20, color: "888888" }], { align: "center" }));
  p.push(DX_PAGE_BREAK);
  // Inhaltsverzeichnis
  p.push(dxHeading("Inhaltsverzeichnis", { sz: 34, after: 200 }));
  p.push(dxPara([{ text: "Teil 1 — AIM Prüfungs-Manager", bold: true, sz: 24 }], { after: 60 }));
  AIM_STEPS.forEach((s, i) => p.push(dxPara([{ text: `${i + 1}.  ${s.title}` }], { ind: 360, after: 40 })));
  p.push(dxPara([{ text: "Teil 2 — Testportal", bold: true, sz: 24 }], { before: 180, after: 60 }));
  TP_STEPS.forEach((s, i) => p.push(dxPara([{ text: `${i + 1}.  ${s.title}` }], { ind: 360, after: 40 })));
  p.push(DX_PAGE_BREAK);
  // Teil 1 — AIM
  p.push(dxHeading("Teil 1 — AIM Prüfungs-Manager", { sz: 36, color: "b81620", after: 200 }));
  AIM_STEPS.forEach((s, i) => {
    p.push(dxHeading(`Schritt ${i + 1}: ${s.title}`, { sz: 27, before: 260 }));
    p.push(dxPara(splitBoldRuns(s.lead), { after: 100 }));
    s.points.forEach((pt) => p.push(dxBullet(pt)));
  });
  p.push(DX_PAGE_BREAK);
  // Teil 2 — Testportal
  p.push(dxHeading("Teil 2 — Testportal", { sz: 36, color: "b81620", after: 200 }));
  TP_STEPS.forEach((s, i) => {
    p.push(dxHeading(`Schritt ${i + 1}: ${s.title}`, { sz: 27, before: 260 }));
    p.push(dxPara(splitBoldRuns(s.lead), { after: 100 }));
    s.points.forEach((pt) => p.push(dxBullet(pt)));
    (s.subSteps || []).forEach((sub) => {
      p.push(dxHeading(sub.label, { sz: 23, color: "333333", before: 180, after: 60 }));
      sub.points.forEach((pt) => p.push(dxBullet(pt)));
    });
    if (s.note) p.push(dxPara([{ text: "Hinweis: ", bold: true }, ...splitBoldRuns(s.note)], { before: 120, after: 140 }));
  });
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    p.join("") +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>' +
    "</w:body></w:document>"
  );
}

function buildAnleitungDocx(dateStr) {
  return zipStore([
    { name: "[Content_Types].xml", data: DOCX_CONTENT_TYPES },
    { name: "_rels/.rels", data: DOCX_RELS },
    { name: "word/document.xml", data: buildAnleitungDocumentXml(dateStr) },
  ]);
}

function downloadBytes(bytes, filename, mime) {
  try {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {
    /* download not available */
  }
}

// ── on-screen renderers (read the same AIM_STEPS / TP_STEPS) ──
function DocList({ points }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
      {points.map((pt, i) => (
        <li key={i} style={{ display: "flex", gap: 9, fontSize: 13.5, color: C.tx, lineHeight: 1.55 }}>
          <span aria-hidden style={{ flexShrink: 0, width: 5, height: 5, borderRadius: "50%", background: C.t, marginTop: 7 }} />
          <span>{renderRich(pt)}</span>
        </li>
      ))}
    </ul>
  );
}
function DocStepBlock({ index, step, idPrefix }) {
  return (
    <section id={`${idPrefix}-${index}`} style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: serif, fontSize: 16.5, color: C.tD, margin: "0 0 6px", fontWeight: 700 }}>
        Schritt {index}: {step.title}
      </h3>
      <p style={{ fontSize: 13.5, color: C.tx, lineHeight: 1.6, margin: "0 0 8px" }}>{renderRich(step.lead)}</p>
      <DocList points={step.points} />
      {(step.subSteps || []).map((sub) => (
        <div key={sub.name} style={{ marginTop: 12, paddingLeft: 14, borderLeft: `2px solid ${C.tL}` }}>
          <div style={{ fontFamily: serif, fontSize: 14, fontWeight: 700, color: C.tD, margin: "0 0 5px" }}>{sub.label}</div>
          <DocList points={sub.points} />
        </div>
      ))}
      {step.note && (
        <p
          style={{
            fontSize: 13,
            color: C.tD,
            lineHeight: 1.55,
            margin: "10px 0 0",
            background: C.tP,
            border: `1px solid ${C.tL}`,
            borderRadius: 6,
            padding: "8px 12px",
          }}
        >
          <strong>Hinweis: </strong>
          {renderRich(step.note)}
        </p>
      )}
    </section>
  );
}

function DocumentView() {
  const download = () => {
    let dateStr = "";
    try {
      dateStr = new Date().toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
    } catch {
      /* keep empty */
    }
    downloadBytes(
      buildAnleitungDocx(dateStr),
      "AIM_Anleitung.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  };
  const jump = (id) => {
    try {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      /* ignore */
    }
  };
  const TocLink = ({ label, id }) => (
    <button
      type="button"
      onClick={() => jump(id)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        appearance: "none",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "3px 0",
        fontFamily: sans,
        fontSize: 13.5,
        color: C.t,
      }}
    >
      {label}
    </button>
  );
  const tocHead = {
    fontSize: 11,
    fontWeight: 700,
    color: C.mu,
    textTransform: "uppercase",
    letterSpacing: "1px",
    margin: "10px 0 2px",
  };
  const partHead = { fontFamily: serif, fontSize: 19, color: C.t, fontWeight: 700 };
  return (
    <>
      {/* toolbar with the download button */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 0 12px",
          marginBottom: 16,
          background: C.wW,
          borderBottom: `1px solid ${C.bo}`,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, color: C.mu, lineHeight: 1.5 }}>
          Die komplette Anleitung als sauberes Dokument — auch ohne Videos verständlich.
        </span>
        <button
          type="button"
          onClick={download}
          style={{
            appearance: "none",
            border: "none",
            cursor: "pointer",
            background: C.inv,
            color: "#fff",
            borderRadius: 8,
            padding: "9px 16px",
            fontFamily: sans,
            fontSize: 13.5,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          ↓ Als Word (.docx) herunterladen
        </button>
      </div>

      {/* the document, laid out like clean printable paper */}
      <div style={{ background: C.wh, border: `1px solid ${C.bo}`, borderRadius: 10, padding: "28px 30px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h1 style={{ fontFamily: serif, fontSize: 24, color: C.tD, margin: "0 0 4px", fontWeight: 700 }}>
          AIM Prüfungs-Manager &amp; Testportal
        </h1>
        <div style={{ fontSize: 13, color: C.mu, marginBottom: 22 }}>Anleitung — Schritt für Schritt</div>

        {/* Inhaltsverzeichnis */}
        <div style={{ background: C.wW, border: `1px solid ${C.bo}`, borderRadius: 8, padding: "14px 16px", marginBottom: 28 }}>
          <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.tD, marginBottom: 6 }}>Inhaltsverzeichnis</div>
          <div style={tocHead}>Teil 1 — AIM Prüfungs-Manager</div>
          {AIM_STEPS.map((s, i) => (
            <TocLink key={i} label={`${i + 1}.  ${s.title}`} id={`aim-${i + 1}`} />
          ))}
          <div style={tocHead}>Teil 2 — Testportal</div>
          {TP_STEPS.map((s, i) => (
            <TocLink key={i} label={`${i + 1}.  ${s.title}`} id={`tp-${i + 1}`} />
          ))}
        </div>

        <h2 style={{ ...partHead, margin: "0 0 14px" }}>Teil 1 — AIM Prüfungs-Manager</h2>
        {AIM_STEPS.map((s, i) => (
          <DocStepBlock key={i} index={i + 1} step={s} idPrefix="aim" />
        ))}

        <h2 style={{ ...partHead, margin: "28px 0 14px" }}>Teil 2 — Testportal</h2>
        {TP_STEPS.map((s, i) => (
          <DocStepBlock key={i} index={i + 1} step={s} idPrefix="tp" />
        ))}
      </div>
    </>
  );
}


function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        appearance: "none",
        background: active ? C.inv : "transparent",
        color: active ? "#fff" : C.tx,
        border: `1px solid ${active ? C.inv : C.bo}`,
        borderRadius: 999,
        padding: "8px 18px",
        fontFamily: sans,
        fontSize: 13.5,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s, border-color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

export default function AnleitungPage() {
  const [version, setVersion] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined" && window.aim?.getAppVersion) {
      window.aim
        .getAppVersion()
        .then(setVersion)
        .catch(() => setVersion(""));
    }
  }, []);

  const [tab, setTab] = useState(() => {
    try {
      return window.localStorage.getItem("aim_anleitung_tab") || "aim";
    } catch {
      return "aim";
    }
  });
  const selectTab = (t) => {
    setTab(t);
    try {
      window.localStorage.setItem("aim_anleitung_tab", t);
    } catch {
      /* non-essential */
    }
  };

  return (
    <div style={{ padding: 28, fontFamily: sans, maxWidth: 1200 }}>
      <style id="aim-anleitung-styles">{`
        @keyframes aim-tour-ring { from { transform: scale(0.6); opacity: 1; } to { transform: scale(1.8); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .aim-anleitung * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div className="aim-anleitung">
        {/* Hero */}
        <div
          style={{
            background:
              "linear-gradient(180deg, var(--c-tP) 0%, var(--c-wh) 100%)",
            border: `1px solid ${C.tL}`,
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
              color: C.mu,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Anleitung
          </div>
          <h1
            style={{
              fontFamily: serif,
              fontSize: 28,
              color: C.tD,
              margin: "0 0 8px",
              fontWeight: 700,
            }}
          >
            AIM Prüfungs-Manager & Testportal
          </h1>
          <p
            style={{
              fontSize: 14.5,
              lineHeight: 1.6,
              color: C.tx,
              margin: 0,
              maxWidth: 820,
            }}
          >
            Diese Anleitung zeigt den kompletten Weg: zuerst, wie du im AIM Prüfungs-Manager
            Fragen verwaltest und daraus eine Prüfung baust — und danach, wie du diese Prüfung ins
            Testportal lädst, dort einrichtest (Punkte, Zeit, Bestehensgrenze) und live mit
            Studierenden durchführst. Wähle unten den passenden Bereich. Alles ist auf Deutsch und
            Schritt für Schritt erklärt.
          </p>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 26,
            paddingBottom: 18,
            borderBottom: `1px solid ${C.bo}`,
            flexWrap: "wrap",
          }}
        >
          <TabButton active={tab === "aim"} onClick={() => selectTab("aim")}>
            AIM Prüfungs-Manager
          </TabButton>
          <TabButton active={tab === "testportal"} onClick={() => selectTab("testportal")}>
            Testportal
          </TabButton>
          <TabButton active={tab === "dokument"} onClick={() => selectTab("dokument")}>
            Dokument
          </TabButton>
        </div>

        {tab === "aim" && <AimGuide />}
        {tab === "testportal" && <TestportalGuide />}
        {tab === "dokument" && <DocumentView />}

        {/* Footer: Über die App */}
        <h2
          style={{
            fontFamily: serif,
            fontSize: 20,
            color: C.tD,
            margin: "36px 0 12px",
            fontWeight: 700,
          }}
        >
          Über die App
        </h2>
        <AboutInfo version={version} />
      </div>
    </div>
  );
}
