// Über die App — onboarding + reference page for non-technical users.
//
// IMPORTANT: every tour scene uses the EXACT same UI primitives, style
// tokens, and layout that the real app screens use. Btn, Badge, Field,
// inp, gridCell, gridSemesterHead, etc. are imported from the monolith
// directly so what the user sees in the tour is pixel-identical to what
// they'll see when they navigate to the actual view.
//
// The animation logic (cursor moves, char-by-char typing, toast slide-in)
// drives controlled fake-state through the real components — like puppet
// strings on the real UI.
//
// No video files, no animation library. CSS transitions + a useLoop hook.
// prefers-reduced-motion pauses everything.

import React, { useEffect, useState } from "react";

import {
  Btn,
  Badge,
  Field,
  C,
  sans,
  serif,
  inp,
  gridCell,
  gridSubHead,
  gridSemesterHead,
  gridCellMuted,
  gridStickyName,
  gridInput,
  stickyNr,
  stickyWbg,
  NR_W,
  FORMATS,
  abbreviateCourseName,
} from "../AIMExamManager.jsx";

// ── timing helper ─────────────────────────────────────────────────────────

// Returns a step counter that advances every `interval` ms and loops over
// `steps` values. Respects prefers-reduced-motion: stays at the final state.
function useLoop(steps, interval = 1500) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;
    if (reduced) {
      setStep(steps - 1);
      return undefined;
    }
    const t = setInterval(() => setStep((s) => (s + 1) % steps), interval);
    return () => clearInterval(t);
  }, [steps, interval]);
  return step;
}

// Character-by-character typing. Returns the substring at time `t` ms after
// start. Includes a brief pre-roll so the field is "empty" momentarily
// before typing begins.
function typed(value, progress) {
  if (!value) return "";
  const len = Math.max(0, Math.min(value.length, Math.floor(progress * value.length)));
  return value.slice(0, len);
}

// Animated cursor primitive (shared by every scene).
function Cursor({ x, y, clicked }) {
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
        transition:
          "left 0.55s cubic-bezier(.4,.7,.4,1), top 0.55s cubic-bezier(.4,.7,.4,1)",
        zIndex: 20,
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
            animation: "aim-tour-ring 0.5s ease-out",
          }}
        />
      )}
    </div>
  );
}

// Highlight halo we draw around a real Btn/element. Positioned absolutely;
// the parent must be `position: relative`.
function Highlight({ left, top, width, height, visible }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        boxShadow: visible ? "0 0 0 3px rgba(215,25,32,0.30)" : "none",
        borderRadius: 4,
        transition: "box-shadow 0.25s",
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}

// Toast styled IDENTICALLY to ToastContainer in the monolith.
function ToastReal({ children, visible, type = "success" }) {
  const bg =
    type === "error" ? "var(--c-re)" : type === "warning" ? "#b45309" : "#1a7a4a";
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        background: bg,
        color: C.wh,
        fontFamily: sans,
        fontSize: 13,
        padding: "11px 14px",
        borderRadius: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 0.3s, transform 0.3s",
        pointerEvents: "none",
        zIndex: 15,
        display: "flex",
        alignItems: "center",
        gap: 10,
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

// Stage container around every scene — relative positioning so cursor +
// highlight + toast can be absolutely placed on top of the real UI.
function Stage({ children, height = 320 }) {
  return (
    <div
      style={{
        position: "relative",
        background: C.wW,
        border: `1px solid ${C.bo}`,
        borderRadius: 10,
        overflow: "hidden",
        minHeight: height,
        fontFamily: sans,
      }}
    >
      {children}
    </div>
  );
}

// ── Scene 1 — Frage hinzufügen ────────────────────────────────────────────
// Reproduces the actual form layout from QuestionDB.jsx:
//   2x2 grid: Kursname | Dozent/in | Erstellungsjahr | Standort
//   Format dropdown (full width)
//   Frage textarea (full width)
//   Save/Cancel buttons row
// Scripted state: fields fill in character by character, format changes,
// save button highlights, toast slides in.

function SceneAddQuestion() {
  const step = useLoop(9, 1600);
  // Step plan:
  // 0  empty form
  // 1  typing course
  // 2  typing lecturer
  // 3  format switch to Richtig/Falsch
  // 4  typing question
  // 5  cursor moves toward Speichern
  // 6  Speichern highlighted + clicked
  // 7  toast slides in
  // 8  pause before loop
  const courseFull = "Sucht";
  const lecturerFull = "Dr. Petry";
  const questionFull = "Ist die Toleranzsteigerung ein Kriterium für eine Alkoholnutzungs-Störung?";

  const courseVal = step >= 1 ? typed(courseFull, step >= 1 ? 1 : 0) : "";
  const lecturerVal = step >= 2 ? typed(lecturerFull, 1) : "";
  const format = step >= 3 ? "Richtig/Falsch" : "Single Choice";
  const questionVal = step >= 4 ? typed(questionFull, 1) : "";

  const focused = {
    course: step === 1,
    lecturer: step === 2,
    format: step === 3,
    question: step === 4,
  };

  const saveHighlighted = step === 5 || step === 6;
  const cursorPos =
    step <= 1
      ? { x: 60, y: 70 }
      : step === 2
      ? { x: 300, y: 70 }
      : step === 3
      ? { x: 60, y: 165 }
      : step === 4
      ? { x: 200, y: 220 }
      : step === 5
      ? { x: 470, y: 305 }
      : { x: 470, y: 305 };

  const toastVisible = step === 7 || step === 8;

  return (
    <Stage height={400}>
      {/* Toolbar — section header matching the real SectionHeader */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          padding: "18px 22px 14px",
          borderBottom: `1px solid ${C.bo}`,
          background: C.wh,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: serif,
              fontSize: 18,
              color: C.tD,
              margin: "0 0 2px",
              fontWeight: 700,
            }}
          >
            Neue Frage
          </h1>
          <p style={{ color: C.mu, fontSize: 12, margin: 0 }}>
            Alle markierten Felder sind Pflichtfelder
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn ch="Abbrechen" v="ghost" sm />
          <span
            style={{
              boxShadow: saveHighlighted ? "0 0 0 4px rgba(215,25,32,0.32)" : "none",
              borderRadius: 4,
              display: "inline-block",
              transition: "box-shadow 0.25s",
            }}
          >
            <Btn ch="Speichern" v="primary" sm />
          </span>
        </div>
      </div>

      {/* The form card — same structure as in QuestionDB form view */}
      <div
        style={{
          background: C.wh,
          margin: 14,
          border: `1px solid ${C.bo}`,
          borderRadius: 8,
          padding: 18,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Field label="Kursname *" half>
            <input
              readOnly
              style={{
                ...inp,
                borderColor: focused.course ? C.t : "var(--c-bo)",
              }}
              value={courseVal}
              placeholder="z.B. Psychoonkologie"
            />
          </Field>
          <Field label="Dozent/in" half>
            <input
              readOnly
              style={{
                ...inp,
                borderColor: focused.lecturer ? C.t : "var(--c-bo)",
              }}
              value={lecturerVal}
              placeholder="z.B. Dr. Muster"
            />
          </Field>
        </div>
        <Field label="Format *">
          <select
            readOnly
            value={format}
            style={{
              ...inp,
              width: "auto",
              borderColor: focused.format ? C.t : "var(--c-bo)",
            }}
            onChange={() => {}}
          >
            {FORMATS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label="Frage *">
          <textarea
            readOnly
            style={{
              ...inp,
              minHeight: 56,
              resize: "vertical",
              borderColor: focused.question ? C.t : "var(--c-bo)",
            }}
            value={questionVal}
            placeholder="Fragetext eingeben…"
          />
        </Field>
      </div>

      <ToastReal visible={toastVisible}>✓ Frage gespeichert</ToastReal>
      <Cursor x={cursorPos.x} y={cursorPos.y} clicked={step === 6} />
    </Stage>
  );
}

// ── Scene 2 — Weiterbildungsgang Semestermatrix ───────────────────────────
// Reproduces SemesterMatrix structure in 'manage' mode for ONE program,
// limited to semester 1 (4 module rows × 3 sub-columns + sticky name).
// Cells fill in row by row.

function SceneSemesterMatrix() {
  const step = useLoop(6, 1400);
  const modules = [
    { year: "2025", lecturer: "Dr. Jörg Petry", course: "Sucht" },
    { year: "2026", lecturer: "Jannis Behr", course: "Einführung ACT" },
    { year: "2025", lecturer: "Dr. Blickenstorfer", course: "CBASP" },
    { year: "", lecturer: "Stephan Goppel", course: "Psychopharmako-therapie" },
  ];
  const filledRows = Math.min(step, modules.length);

  // Cursor positions for the current row being filled (approximate cell
  // centres). Resets each iteration so motion is visible.
  const cursorY = 90 + filledRows * 36;

  return (
    <Stage height={290}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          background: C.wh,
          borderBottom: `1px solid ${C.bo}`,
        }}
      >
        <span
          style={{ fontFamily: serif, fontSize: 14, fontWeight: 700, color: C.tD }}
        >
          WBS 55 (2020)
        </span>
        <Badge ch="HS 2024" color="warm" sm />
        <span style={{ fontSize: 11, color: C.mu, marginLeft: "auto" }}>
          Semester 1 · 4 Module
        </span>
      </div>

      <div style={{ padding: 12, background: C.wh, overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            fontFamily: sans,
          }}
        >
          <colgroup>
            <col style={{ width: NR_W }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 130 }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...stickyNr, background: C.wh }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.tx,
                    padding: 8,
                  }}
                >
                  Nr.
                </div>
              </th>
              <th rowSpan={2}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.tx,
                    padding: 8,
                    textAlign: "left",
                  }}
                >
                  Weiterbildungsgang
                </div>
              </th>
              <th colSpan={3} style={gridSemesterHead}>
                Semester 1
              </th>
            </tr>
            <tr>
              <th
                style={{ ...gridSubHead, borderLeft: `1px solid ${C.bo}` }}
              >
                Jahr
              </th>
              <th style={gridSubHead}>Dozent/in</th>
              <th style={gridSubHead}>Kursname</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m, idx) => {
              const filled = idx < filledRows;
              return (
                <tr key={idx} style={{ background: idx % 2 === 0 ? C.wh : C.wW }}>
                  {idx === 0 && (
                    <>
                      <td
                        rowSpan={4}
                        style={{
                          ...gridCellMuted,
                          background: C.wh,
                        }}
                      >
                        1
                      </td>
                      <td
                        rowSpan={4}
                        style={{
                          ...gridStickyName,
                          background: C.wh,
                          padding: 8,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: serif,
                            fontSize: 13,
                            color: C.tD,
                            fontWeight: 600,
                            lineHeight: 1.2,
                          }}
                        >
                          WBS 55 (2020)
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Badge ch="HS 2024" color="warm" sm />
                        </div>
                      </td>
                    </>
                  )}
                  <td
                    style={{
                      ...gridCell,
                      borderLeft: `2px solid var(--c-grid-border)`,
                    }}
                  >
                    <div
                      style={{
                        ...gridInput,
                        border: `1px solid ${filled ? C.bo : "transparent"}`,
                        background: filled ? C.wh : C.st,
                        minHeight: 22,
                        transition: "background 0.4s, border-color 0.4s",
                      }}
                    >
                      {filled ? m.year || <span style={{ color: C.mu }}>–</span> : ""}
                    </div>
                  </td>
                  <td style={gridCell}>
                    <div
                      style={{
                        ...gridInput,
                        border: `1px solid ${filled ? C.bo : "transparent"}`,
                        background: filled ? C.wh : C.st,
                        minHeight: 22,
                        transition: "background 0.4s, border-color 0.4s",
                      }}
                    >
                      {filled ? m.lecturer : ""}
                    </div>
                  </td>
                  <td style={gridCell}>
                    <div
                      style={{
                        ...gridInput,
                        border: `1px solid ${filled ? C.bo : "transparent"}`,
                        background: filled ? C.wh : C.st,
                        minHeight: 22,
                        transition: "background 0.4s, border-color 0.4s",
                      }}
                    >
                      {filled ? m.course : ""}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Cursor x={460} y={cursorY} clicked={filledRows > 0 && step <= 4} />
    </Stage>
  );
}

// ── Scene 3 — Prüfung erstellen ───────────────────────────────────────────
// Reproduces the ExamBuilder summary card + the SemesterMatrix in 'exam'
// mode for one program with 4 modules (semester 1). Module checkboxes
// toggle on one by one; the Fragen counter rises and turns green when
// the standard 40 is hit (well, when we hit our scripted final value).

function SceneExamBuild() {
  const step = useLoop(7, 1300);
  // step 0  nothing selected
  // step 1  program tile highlighted
  // step 2  module 1 checked
  // step 3  module 2 checked
  // step 4  module 3 checked
  // step 5  module 4 checked
  // step 6  Prüfung-erstellen highlighted + cursor click
  const programSelected = step >= 1;
  const checkedCount = Math.max(0, Math.min(4, step - 1));
  const questionsPerModule = 10;
  const totalQ = checkedCount * questionsPerModule;
  const standard = 40;
  const buildHighlighted = step === 6;

  const modules = [
    { course: "Sucht", lecturer: "Dr. Petry" },
    { course: "Essstörungen", lecturer: "Dr. Mihov" },
    { course: "Schematherapie", lecturer: "M. Poppinger" },
    { course: "Sterbeprozesse", lecturer: "M. Renz" },
  ];

  return (
    <Stage height={400}>
      {/* Summary card — same structure as the real ExamBuilder */}
      <div
        style={{
          background: C.wh,
          border: `1px solid ${C.bo}`,
          borderRadius: 8,
          margin: 14,
          marginBottom: 10,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 200px" }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: C.mu,
              marginBottom: 3,
              fontWeight: 600,
            }}
          >
            Zusammenfassung
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tD }}>
            {programSelected ? "WBS 55 (2020)" : (
              <span style={{ color: C.mu, fontWeight: 400 }}>
                Noch kein Weiterbildungsgang ausgewählt
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.mu, marginBottom: 2 }}>Module</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: C.tD,
                lineHeight: 1,
              }}
            >
              {checkedCount}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.mu, marginBottom: 2 }}>Fragen</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1,
                color:
                  totalQ === standard ? C.gr : totalQ > 0 ? C.tM : C.tD,
                transition: "color 0.3s",
              }}
            >
              {totalQ}
            </div>
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span
            style={{
              boxShadow: buildHighlighted ? "0 0 0 4px rgba(215,25,32,0.32)" : "none",
              borderRadius: 4,
              display: "inline-block",
              transition: "box-shadow 0.25s",
            }}
          >
            <Btn ch="Prüfung erstellen →" v="primary" dis={checkedCount === 0} />
          </span>
        </div>
      </div>

      {/* Mini matrix with checkboxes in cells — same gridCell / gridSubHead tokens */}
      <div style={{ padding: "0 14px 14px", background: "transparent" }}>
        <div
          style={{
            background: C.wh,
            border: `1px solid ${C.bo}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
              fontFamily: sans,
            }}
          >
            <colgroup>
              <col style={{ width: 200 }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th
                  style={{
                    ...gridStickyName,
                    background: programSelected ? "var(--c-sem-sel)" : C.wh,
                    fontFamily: serif,
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.tx,
                    textAlign: "left",
                    transition: "background 0.4s",
                  }}
                >
                  WBS 55 (2020){" "}
                  {programSelected && (
                    <Badge ch="✓ Ausgewählt" color="teal" sm />
                  )}
                </th>
                <th style={gridSemesterHead}>Semester 1 — Module</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m, i) => {
                const checked = i < checkedCount;
                return (
                  <tr key={m.course} style={{ background: i % 2 === 0 ? C.wh : C.wW }}>
                    <td
                      style={{
                        ...gridCell,
                        fontSize: 11,
                        color: C.mu,
                      }}
                    >
                      {i === 0 ? "" : ""}
                    </td>
                    <td style={{ ...gridCell, padding: 8 }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          cursor: programSelected ? "pointer" : "default",
                          opacity: programSelected ? 1 : 0.55,
                        }}
                      >
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            border: `1.5px solid ${C.bo}`,
                            borderRadius: 3,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: checked ? C.t : "transparent",
                            color: "#fff",
                            fontSize: 11,
                            flexShrink: 0,
                            marginTop: 2,
                            transition: "background 0.25s",
                          }}
                        >
                          {checked ? "✓" : ""}
                        </span>
                        <span>
                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                              fontWeight: 600,
                              color: C.tx,
                              lineHeight: 1.2,
                            }}
                          >
                            {m.course}
                          </span>
                          <span
                            style={{
                              display: "block",
                              fontSize: 10,
                              color: C.mu,
                              marginTop: 2,
                            }}
                          >
                            {m.lecturer} · {questionsPerModule} Fragen
                          </span>
                        </span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Stage>
  );
}

// ── Scene 4 — Als PDF speichern ───────────────────────────────────────────
// Reproduces the ExportView SectionHeader toolbar with ALL the real buttons
// (Bearbeiten, 💾 Speichern & neu, Kopieren, ↓ TXT, ↓ Als PDF speichern,
// ✕ Prüfung löschen). Cursor moves to the PDF button, click ripple, file
// icon flies down. Below, the same 3-stat cards (Fragen / Kurse / Formate)
// that the real ExportView shows.

function ScenePdfExport() {
  const step = useLoop(5, 1500);
  const pdfHighlighted = step === 1 || step === 2;
  const fileFlying = step >= 2;
  const cursorPos =
    step === 0
      ? { x: 60, y: 50 }
      : { x: 510, y: 60 };

  return (
    <Stage height={300}>
      <div
        style={{
          padding: "18px 22px 14px",
          background: C.wh,
          borderBottom: `1px solid ${C.bo}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: serif,
                fontSize: 18,
                color: C.tD,
                margin: "0 0 2px",
                fontWeight: 700,
              }}
            >
              Export &amp; Download
            </h1>
            <p style={{ color: C.mu, fontSize: 12, margin: 0 }}>
              40 Fragen · WBS 55 (2020)
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn ch="Bearbeiten" v="ghost" sm />
            <Btn ch="💾 Speichern &amp; neu" v="primary" sm />
            <Btn ch="Kopieren" v="ghost" sm />
            <Btn ch="↓ TXT" v="secondary" sm />
            <span
              style={{
                boxShadow: pdfHighlighted ? "0 0 0 4px rgba(242,194,48,0.55)" : "none",
                borderRadius: 4,
                display: "inline-block",
                transition: "box-shadow 0.25s",
              }}
            >
              <Btn ch="↓ Als PDF speichern" v="accent" sm />
            </span>
            <Btn ch="✕ Prüfung löschen" v="ghost" sm />
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.mu }}>
          Tipp: Im Druckdialog „Als PDF sichern“ wählen.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          padding: 14,
        }}
      >
        {[
          { label: "Fragen", val: 40 },
          { label: "Kurse", val: 8 },
          { label: "Formate", val: 3 },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: C.tP,
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 10, color: C.mu, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.tD }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          right: 32,
          top: fileFlying ? 230 : 50,
          opacity: fileFlying ? 1 : 0,
          transition: "top 0.7s ease-in, opacity 0.4s",
          textAlign: "center",
          fontSize: 30,
        }}
      >
        <div>📄</div>
        <div style={{ fontSize: 9, color: C.mu, marginTop: 2 }}>
          Pruefung.pdf
        </div>
      </div>

      <Cursor x={cursorPos.x} y={cursorPos.y} clicked={step === 1} />
    </Stage>
  );
}

// ── Scene 5 — Datensicherung ──────────────────────────────────────────────
// Reproduces the Dashboard "Datensicherung" panel exactly — header,
// description paragraph, JSON sub-section with three buttons, Excel
// sub-section with two buttons. Cursor clicks "↓ JSON exportieren",
// file icon flies down.

function SceneBackup() {
  const step = useLoop(4, 1500);
  const exportHighlighted = step === 1 || step === 2;
  const fileFlying = step >= 2;
  const cursorPos =
    step === 0 ? { x: 80, y: 50 } : { x: 330, y: 130 };

  return (
    <Stage height={290}>
      <div
        style={{
          background: C.wh,
          border: `1px solid ${C.bo}`,
          borderRadius: 8,
          padding: 16,
          margin: 14,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: C.mu,
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          Datensicherung
        </div>
        <p
          style={{
            fontSize: 12,
            color: C.tx,
            margin: "0 0 12px",
            lineHeight: 1.5,
          }}
        >
          Alle Daten werden automatisch lokal gespeichert. Für Weitergabe oder
          Neuaufsetzen einer Datenversion empfiehlt sich der Export.
        </p>
        <div style={{ marginBottom: 10 }}>
          <div
            style={{ fontSize: 10, color: C.mu, marginBottom: 5, fontWeight: 500 }}
          >
            JSON (vollständiges Backup)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn ch="💾 Jetzt sichern" v="secondary" sm />
            <Btn ch="↑ JSON laden" v="ghost" sm />
            <span
              style={{
                boxShadow: exportHighlighted ? "0 0 0 4px rgba(215,25,32,0.32)" : "none",
                borderRadius: 4,
                display: "inline-block",
                transition: "box-shadow 0.25s",
              }}
            >
              <Btn ch="↓ JSON exportieren" v="ghost" sm />
            </span>
          </div>
        </div>
        <div>
          <div
            style={{ fontSize: 10, color: C.mu, marginBottom: 5, fontWeight: 500 }}
          >
            Excel (Fragen, Weiterbildungsgänge, Semesteransicht, Gespeicherte
            Prüfungen)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn ch="↓ Excel exportieren" v="ghost" sm />
            <Btn ch="↑ Excel importieren" v="ghost" sm />
          </div>
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 320,
          top: fileFlying ? 240 : 130,
          opacity: fileFlying ? 1 : 0,
          transition: "top 0.7s ease-in, opacity 0.4s",
          fontSize: 24,
        }}
      >
        🗂️
      </div>

      <Cursor x={cursorPos.x} y={cursorPos.y} clicked={step === 1} />
    </Stage>
  );
}

// ── checklist (with localStorage) ─────────────────────────────────────────

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
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontFamily: serif,
            fontSize: 16,
            fontWeight: 700,
            color: C.tD,
          }}
        >
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
            style={{
              display: "flex",
              gap: 10,
              padding: "6px 0",
              alignItems: "center",
            }}
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

// ── tour layout ───────────────────────────────────────────────────────────

function TourCard({ index, title, caption, hint, children }) {
  return (
    <div
      style={{
        background: C.wh,
        border: `1px solid ${C.bo}`,
        borderRadius: 10,
        padding: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        marginBottom: 16,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
        gap: 24,
        alignItems: "center",
      }}
    >
      <div>{children}</div>
      <div>
        <div
          style={{
            fontSize: 10,
            color: C.mu,
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
            color: C.tD,
            fontWeight: 700,
            margin: "0 0 8px",
          }}
        >
          {title}
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: C.tx, margin: 0 }}>
          {caption}
        </p>
        {hint && (
          <p
            style={{
              fontSize: 12,
              color: C.mu,
              margin: "8px 0 0",
              lineHeight: 1.5,
            }}
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

// ── about info ────────────────────────────────────────────────────────────

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

// ── main page ─────────────────────────────────────────────────────────────

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
      <style id="aim-about-styles">{`
        @keyframes aim-tour-ring { from { transform: scale(0.6); opacity: 1; } to { transform: scale(1.8); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .aim-about * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div className="aim-about">
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
            Willkommen
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
            So funktioniert der AIM Prüfungs-Manager
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: C.tx,
              margin: 0,
              maxWidth: 720,
            }}
          >
            Diese App hilft dir, Prüfungsfragen zu sammeln, Weiterbildungsgänge
            zu pflegen und daraus Prüfungen für das Testportal zu erstellen —
            alles lokal, ohne Internetverbindung. Die folgenden fünf Szenen
            zeigen die echten Bildschirme der App in Bewegung. Sie wiederholen
            sich automatisch, du kannst also so lange schauen wie du möchtest.
          </p>
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
          Die Anleitung in 5 Schritten
        </h2>

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

        <h2
          style={{
            fontFamily: serif,
            fontSize: 20,
            color: C.tD,
            margin: "32px 0 12px",
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
