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

import React, { useEffect, useState } from "react";

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
  const bg = color === "accent" ? C.ac : color === "green" ? C.gr : C.tD;
  const fg = color === "accent" ? "#111" : "#fff";
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top: y,
        maxWidth: 260,
        background: bg,
        color: fg,
        fontFamily: sans,
        fontSize: 12.5,
        lineHeight: 1.45,
        padding: "9px 12px",
        borderRadius: 8,
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
  return (
    <div
      style={{
        position: "relative",
        background: C.wW,
        border: `1px solid ${C.bo}`,
        borderRadius: 10,
        overflow: "hidden",
        height: naturalHeight ? naturalHeight * scale : undefined,
      }}
    >
      <div
        aria-hidden
        style={{
          width: naturalWidth,
          transform: `scale(${scale})`,
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

function TourSection({ index, title, lead, stage }) {
  return (
    <section style={{ marginBottom: 36 }}>
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
        {lead}
      </p>
      {stage}
    </section>
  );
}

// ─── per-page tour scenes (AIM Prüfungs-Manager) ───────────────────────────

// 1. Dashboard. The page itself is fairly tall — we render it at scale 0.7
//    and step the cursor across its main panels.
function StageDashboard() {
  const stops = [
    {
      x: "82%",
      y: "8%",
      tail: "top-right",
      text: "Auf „Neue Prüfung“ klicken — startet den Prüfungsbau direkt aus dem Dashboard.",
    },
    {
      x: "8%",
      y: "16%",
      tail: "top-left",
      text: "Hier siehst du die Gesamtzahl der Fragen, Kurse, Weiterbildungsgänge und gespeicherten Prüfungen auf einen Blick.",
    },
    {
      x: "60%",
      y: "32%",
      tail: "top-left",
      text: "Schnellzugriff — direkt zu „Prüfung erstellen“ oder „Fragen verwalten“ springen.",
    },
    {
      x: "10%",
      y: "62%",
      tail: "top-left",
      text: "Datensicherung: JSON-Backup für alles oder Excel für Fragen + Programme. Regelmäßig nutzen!",
    },
    {
      x: "62%",
      y: "62%",
      tail: "top-right",
      text: "„Alle Daten löschen“ wischt die App leer — vorher wird automatisch ein Snapshot gesichert.",
    },
  ];
  const step = useLoop(stops.length, 4000);
  const s = stops[step];
  return (
    <PageStage scale={0.62} naturalWidth={1500} naturalHeight={1100}
      overlay={(
        <>
          <Callout x={s.x} y={s.y} tail={s.tail}>{s.text}</Callout>
          <Cursor
            x={`calc(${s.x} + ${s.tail.includes("right") ? "180px" : "20px"})`}
            y={`calc(${s.y} + 22px)`}
            clicked
          />
        </>
      )}
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
      overlay={(
        <>
          <Callout x={s.x} y={s.y} tail={s.tail}>{s.text}</Callout>
          <Cursor
            x={`calc(${s.x} + ${s.tail.includes("right") ? "200px" : "10px"})`}
            y={`calc(${s.y} + 26px)`}
            clicked
          />
        </>
      )}
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
      overlay={(
        <>
          <Callout x={s.x} y={s.y} tail={s.tail}>{s.text}</Callout>
          <Cursor
            x={`calc(${s.x} + ${s.tail.includes("right") ? "200px" : "30px"})`}
            y={`calc(${s.y} + 22px)`}
            clicked
          />
        </>
      )}
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
      overlay={(
        <>
          <Callout x={s.x} y={s.y} tail={s.tail}>{s.text}</Callout>
          <Cursor
            x={`calc(${s.x} + ${s.tail.includes("right") ? "200px" : "30px"})`}
            y={`calc(${s.y} + 22px)`}
            clicked
          />
        </>
      )}
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
      overlay={(
        <>
          <Callout x={s.x} y={s.y} tail={s.tail}>{s.text}</Callout>
          <Cursor
            x={`calc(${s.x} + ${s.tail.includes("right") ? "200px" : "20px"})`}
            y={`calc(${s.y} + 26px)`}
            clicked
          />
        </>
      )}
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
      overlay={(
        <>
          <Callout x={s.x} y={s.y} tail={s.tail}>{s.text}</Callout>
          <Cursor x={`calc(${s.x} + 30px)`} y={`calc(${s.y} + 24px)`} clicked />
        </>
      )}
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
            JSON-Backup auf dem Dashboard nutzen.
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
          <span>{p}</span>
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
function VideoStage({ name, points = [] }) {
  const src = tpVideo(name);
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
            src={src}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden
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
function SubStep({ label, name, points }) {
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
      <VideoStage name={name} points={points} />
    </div>
  );
}

// Testportal step definitions. Texts are intentionally non-technical German.
const TP_STEPS = [
  {
    title: "Bei Testportal anmelden",
    lead:
      "Testportal läuft im Browser. Melde dich mit dem offiziellen AIM-Konto an — also demselben Konto, mit dem alle AIM-Prüfungen verwaltet werden, nicht mit einem privaten Login.",
    video: "01-login",
    points: [
      "Im Browser www.testportal.com öffnen.",
      "Oben rechts auf „Sign in“ / „Anmelden“ klicken.",
      "Mit den offiziellen AIM-Zugangsdaten anmelden.",
      "Nach der Anmeldung landest du auf der Test-Übersicht „My tests“.",
    ],
  },
  {
    title: "Die Startseite „My tests“ verstehen",
    lead:
      "Nach dem Login siehst du alle Tests des Kontos. Diese Übersicht ist der Ausgangspunkt für jede Prüfung — egal ob neu anlegen, bearbeiten oder auswerten.",
    video: "02-startseite",
    points: [
      "Jede Kachel ist ein Test mit Status: ACTIVE (läuft), ENDED (beendet) oder SETUP IN PROGRESS (in Einrichtung).",
      "Oben rechts: „New test“ legt einen neuen Test an. „Generate questions“ wird für AIM nicht benötigt.",
      "Mit „Category“ und „Status“ lässt sich die Liste filtern, wenn viele Tests vorhanden sind.",
      "Ein Klick auf eine Kachel öffnet den jeweiligen Test.",
    ],
  },
  {
    title: "Fragen aus dem AIM Prüfungs-Manager importieren",
    lead:
      "Du musst keine Fragen abtippen. Lade einfach die Datei hoch, die du im AIM Prüfungs-Manager unter „Export & Download“ erzeugt hast — Testportal baut daraus den Test.",
    video: "03-import",
    points: [
      "Auf „New test“ klicken und „Import test“ wählen.",
      "Die im AIM Prüfungs-Manager als Word-Datei (.docx) exportierte Datei hochladen.",
      "Wichtig: Testportal erkennt fett markierten Text automatisch als die richtige Antwort — genau so exportiert die AIM-App.",
      "Auf „Import“ klicken. Aus der Datei entsteht ein neuer Test mit allen Fragen.",
      "Der Test steht danach auf „Setup in progress“ und wird im nächsten Schritt eingerichtet.",
    ],
  },
  {
    title: "Den Test konfigurieren",
    lead:
      "Nach dem Import richtest du den Test ein: Punkte, Zeit, Bestehensgrenze und Zugang. Links findest du alle Einstellungs-Bereiche, oben den Fortschritt in Prozent. Erst wenn alles kontrolliert ist, wird der Test über „Activate test“ freigegeben.",
    video: "04-konfiguration",
    points: [
      "Links: die Einstellungs-Bereiche (Basic settings, Questions manager, …).",
      "Oben: der Fortschrittsbalken zeigt, wie vollständig der Test eingerichtet ist.",
      "Unten links: der grüne Knopf „Activate test“ gibt den Test frei — erst nach der Kontrolle drücken.",
      "Rechts fasst die „Configuration summary“ alle wichtigen Einstellungen für die Schlusskontrolle zusammen.",
    ],
    subSteps: [
      {
        label: "Basic settings — Name & Beschreibung",
        name: "04a-basic-settings",
        points: [
          "Einen klaren Testnamen vergeben, z. B. „AIM Prüfung – WBS 55 (2020)“.",
          "So ist der Test später bei Resultaten und Rückfragen eindeutig zuzuordnen.",
        ],
      },
      {
        label: "Questions manager — Fragen kontrollieren",
        name: "04b-questions-manager",
        points: [
          "Alle importierten Fragen durchsehen.",
          "Bei jeder Frage muss die richtige Antwort markiert sein (sonst warnt Testportal in der Zusammenfassung).",
          "Punktzahl pro Frage prüfen; Reihenfolge lässt sich hier ändern.",
        ],
      },
      {
        label: "Test sets — Varianten erzeugen",
        name: "04c-test-sets",
        points: [
          "Mehrere Sets erstellen, damit nicht alle dieselbe Reihenfolge sehen.",
          "„Select all“ aktiv lassen, damit wirklich alle Sets genutzt werden.",
        ],
      },
      {
        label: "Test access — Zugang absichern",
        name: "04d-test-access",
        points: [
          "Zugangsart festlegen (für AIM meist „Public Link“).",
          "Anzahl Zugriffe = 2, damit Lernende nach einem technischen Unterbruch erneut einsteigen können.",
          "Versuche = 1. Warnungen bei Browser-Wechsel aktiv lassen.",
        ],
      },
      {
        label: "Test start page — Begrüßungsseite",
        name: "04e-test-start-page",
        points: [
          "Die Seite, die Studierende direkt vor dem Start sehen.",
          "Kurze Begrüßung und Hinweise zum Ablauf hinterlegen.",
        ],
      },
      {
        label: "Grading & summary — Punkte & Bestehensgrenze",
        name: "04f-grading-summary",
        points: [
          "Mit Punkten und möglichst geraden Zahlen arbeiten (keine Dezimalbewertung).",
          "Bestehensgrenze (Pass mark) setzen, z. B. 50 %.",
          "Richtige Antworten während des laufenden Tests NICHT anzeigen.",
        ],
      },
      {
        label: "Time settings — Zeit & Termin",
        name: "04g-time-settings",
        points: [
          "Gesamtdauer oder Zeit pro Frage festlegen.",
          "Aktivierungszeit und Endzeit terminieren.",
          "Rücksprung-Option ausschalten, wenn kein Zurückblättern erlaubt sein soll.",
        ],
      },
    ],
    note: "Den Bereich „Certificate template“ braucht AIM nicht — er kann übersprungen werden.",
  },
  {
    title: "Den Test aktivieren und durchführen",
    lead:
      "Wenn alles kontrolliert ist, aktivierst du den Test und teilst den Link mit der Klasse. Während und nach der Prüfung verfolgst du den Ablauf und sicherst die Resultate über die Bereiche unter „Test progress & results“.",
    video: "05-durchfuehrung",
    points: [
      "Unten links auf „Activate test“ klicken — der Test wird scharf geschaltet.",
      "Den Test-Link kopieren und an die richtige Klasse senden (z. B. über Microsoft Teams).",
      "Der Link öffnet sich für Studierende erst ab der eingestellten Aktivierungszeit.",
      "Nach der Prüfung wird der Test über „End test“ beendet.",
    ],
    subSteps: [
      {
        label: "Respondent monitoring — Teilnahme live verfolgen",
        name: "05a-respondent-monitoring",
        points: [
          "Sehen, wer gerade teilnimmt und wie weit die Person ist.",
          "Warnungen (z. B. Browser-Wechsel) werden hier angezeigt.",
        ],
      },
      {
        label: "Results table — Resultate herunterladen",
        name: "05b-results-table",
        points: [
          "Tabelle aller Ergebnisse.",
          "Alle Teilnehmenden markieren und die Resultate gesammelt herunterladen.",
          "Die Spalten lassen sich auf das Nötige reduzieren.",
        ],
      },
      {
        label: "Test sheets review — einzelne Bögen ansehen",
        name: "05c-test-sheets-review",
        points: [
          "Den ausgefüllten Testbogen einzelner Studierender öffnen.",
          "Nützlich bei Rückfragen oder zur Kontrolle.",
        ],
      },
      {
        label: "Answers review — offene Antworten bewerten",
        name: "05d-answers-review",
        points: [
          "Offene (descriptive) Antworten manuell bewerten.",
          "Bei reinen Single-/Multiple-Choice-Prüfungen meist nicht nötig.",
        ],
      },
      {
        label: "Statistics — Auswertung pro Frage",
        name: "05e-statistics",
        points: [
          "Zeigt, wie viele eine Frage richtig beantwortet haben.",
          "Macht zu schwere oder missverständliche Fragen sichtbar.",
        ],
      },
      {
        label: "Unused codes — nicht genutzte Zugänge",
        name: "05f-unused-codes",
        points: [
          "Nur bei Zugang über Einzel-Codes relevant.",
          "Zeigt, welche Codes noch nicht verwendet wurden.",
        ],
      },
    ],
  },
  {
    title: "Einen beendeten Test erneut starten (mit Änderungen)",
    lead:
      "Ein bereits beendeter Test lässt sich wiederverwenden — entweder unverändert erneut aktivieren oder als Kopie, wenn du etwas ändern willst (neue Klasse, neuer Termin, andere Fragen).",
    video: "06-test-erneut-starten",
    points: [
      "Den beendeten Test (Status ENDED) in „My tests“ öffnen.",
      "Unverändert wiederholen: in „Time settings“ neue Zeiten setzen und erneut „Activate test“.",
      "Mit Änderungen: über das „…“-Menü „Copy/Duplicate“ wählen — es entsteht „… - copy“ in „Setup in progress“.",
      "In der Kopie die Anpassungen vornehmen (Fragen, Punkte, Zeit) und dann aktivieren.",
      "Tipp: Resultate des alten Tests vorher herunterladen, damit nichts verloren geht.",
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

function TestportalGuide() {
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
        Testportal ist die Online-Plattform, auf der die Prüfung tatsächlich durchgeführt wird. Die
        kurzen Videos unten laufen in Schleife und zeigen für jeden Schritt, wo du klickst.
      </div>

      {TP_STEPS.map((step, i) => (
        <TourSection
          key={step.video}
          index={i + 1}
          title={step.title}
          lead={step.lead}
          stage={
            <>
              <VideoStage name={step.video} points={step.points} />
              {step.subSteps && (
                <div style={{ marginTop: 18 }}>
                  {step.subSteps.map((sub) => (
                    <SubStep key={sub.name} label={sub.label} name={sub.name} points={sub.points} />
                  ))}
                </div>
              )}
              {step.note && <InfoNote icon="ℹ️">{step.note}</InfoNote>}
            </>
          }
        />
      ))}
    </>
  );
}

// ─── main page ───────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        appearance: "none",
        background: active ? C.tD : "transparent",
        color: active ? "#fff" : C.tx,
        border: `1px solid ${active ? C.tD : C.bo}`,
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
        </div>

        {tab === "aim" ? <AimGuide /> : <TestportalGuide />}

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
