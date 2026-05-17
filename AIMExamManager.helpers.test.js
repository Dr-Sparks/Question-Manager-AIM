import test from "node:test";
import assert from "node:assert/strict";
import {
  COURSE_SLOT_COUNT,
  autoSelectQuestions,
  buildExportPayload,
  normalizeSlots,
  programsForQuestion,
  shortProgramName,
  validateAssignment,
} from "./AIMExamManager.helpers.js";

// ── normalizeSlots ──────────────────────────────────────────────────────────

test("normalizeSlots always returns exactly four slots", () => {
  assert.equal(normalizeSlots(["A", "B"]).length, COURSE_SLOT_COUNT);
  assert.deepEqual(normalizeSlots(["A", "B"]), ["A", "B", "", ""]);
});

test("normalizeSlots handles empty input", () => {
  assert.deepEqual(normalizeSlots(), ["", "", "", ""]);
  assert.deepEqual(normalizeSlots([]), ["", "", "", ""]);
});

test("normalizeSlots truncates input longer than four slots", () => {
  assert.deepEqual(normalizeSlots(["A", "B", "C", "D", "E", "F"]), [
    "A",
    "B",
    "C",
    "D",
  ]);
});

test("normalizeSlots preserves all four when all provided", () => {
  assert.deepEqual(normalizeSlots(["w", "x", "y", "z"]), ["w", "x", "y", "z"]);
});

// ── validateAssignment ──────────────────────────────────────────────────────

test("validateAssignment accepts only four-slot assignments", () => {
  assert.equal(validateAssignment({ courseIds: ["A", "B", "C", "D"] }), true);
  assert.equal(validateAssignment({ courseIds: ["A", "B"] }), false);
});

test("validateAssignment rejects non-array courseIds", () => {
  assert.equal(validateAssignment({ courseIds: "ABCD" }), false);
  assert.equal(validateAssignment({ courseIds: null }), false);
  assert.equal(validateAssignment({}), false);
});

test("validateAssignment accepts four empty strings (valid placeholder)", () => {
  assert.equal(validateAssignment({ courseIds: ["", "", "", ""] }), true);
});

// ── autoSelectQuestions ─────────────────────────────────────────────────────

test("autoSelectQuestions filters and sorts by selected modules", () => {
  const selected = autoSelectQuestions(
    [
      { id: "q2", moduleId: "B", stem: "Zulu" },
      { id: "q1", moduleId: "A", stem: "Beta" },
      { id: "q3", moduleId: "A", stem: "Alpha" },
    ],
    ["A"]
  );

  assert.deepEqual(
    selected.map((question) => question.id),
    ["q3", "q1"]
  );
});

test("autoSelectQuestions returns empty array when no modules match", () => {
  const out = autoSelectQuestions(
    [{ id: "q1", moduleId: "A", stem: "x" }],
    ["nonexistent"]
  );
  assert.deepEqual(out, []);
});

test("autoSelectQuestions returns empty array on empty questions input", () => {
  assert.deepEqual(autoSelectQuestions([], ["A", "B"]), []);
});

test("autoSelectQuestions sorts questions of the same module by stem", () => {
  const out = autoSelectQuestions(
    [
      { id: "q1", moduleId: "M", stem: "Charlie" },
      { id: "q2", moduleId: "M", stem: "Alpha" },
      { id: "q3", moduleId: "M", stem: "Bravo" },
    ],
    ["M"]
  );
  assert.deepEqual(out.map((q) => q.stem), ["Alpha", "Bravo", "Charlie"]);
});

test("autoSelectQuestions handles German umlauts in stem ordering", () => {
  const out = autoSelectQuestions(
    [
      { id: "q1", moduleId: "M", stem: "Ärger" },
      { id: "q2", moduleId: "M", stem: "Abend" },
      { id: "q3", moduleId: "M", stem: "Übung" },
    ],
    ["M"]
  );
  // localeCompare with default locale puts Abend first; umlauts sort near base letter
  assert.equal(out.length, 3);
  assert.equal(out[0].stem, "Abend");
});

test("autoSelectQuestions handles many modules selected", () => {
  const questions = Array.from({ length: 200 }, (_, i) => ({
    id: `q${i}`,
    moduleId: `M${i % 10}`,
    stem: `Frage ${String(i).padStart(3, "0")}`,
  }));
  const moduleIds = Array.from({ length: 10 }, (_, i) => `M${i}`);
  const out = autoSelectQuestions(questions, moduleIds);
  assert.equal(out.length, 200);
});

// ── buildExportPayload ──────────────────────────────────────────────────────

const sampleProgram = {
  id: "w1",
  code: "BE-24",
  name: "Bern",
  location: "Bern",
  cohortLabel: "2024",
  status: "active",
  startSemesterId: "hs24",
};

const sampleExamMeta = {
  examTitle: "AIM Test",
  examDate: "2026-04-23",
  durationMinutes: "90",
  examCode: "A-1",
  notes: "Hinweis",
};

test("buildExportPayload preserves metadata and question ordering", () => {
  const payload = buildExportPayload({
    weiterbildungsgang: sampleProgram,
    selectedAssignments: [
      { semesterId: "hs24", courseIds: ["A", "B", "C", "D"] },
      { semesterId: "fs25", courseIds: ["E", "F", "", ""] },
    ],
    selectedModuleIds: ["A", "B"],
    questions: [
      {
        id: "q1",
        moduleId: "A",
        stem: "Frage A",
        options: ["1", "2", "3", "4"],
        correctOptionIndexes: [1],
        answerFormat: "Single Choice",
        createdYear: "2026",
        location: "Bern",
        lecturer: "Dozent A",
        difficulty: "mittel",
        tags: ["a"],
      },
    ],
    examMeta: sampleExamMeta,
  });

  assert.equal(payload.examMeta.language, "de-CH");
  assert.equal(payload.questions[0].order, 1);
  assert.equal(payload.questions[0].correctOptionLetters[0], "B");
  assert.deepEqual(payload.semesterSnapshot[1].courseIds, ["E", "F"]);
});

test("buildExportPayload generates ISO timestamp", () => {
  const payload = buildExportPayload({
    weiterbildungsgang: sampleProgram,
    selectedAssignments: [],
    selectedModuleIds: [],
    questions: [],
    examMeta: {},
  });
  assert.match(payload.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test("buildExportPayload defaults missing examMeta fields", () => {
  const payload = buildExportPayload({
    weiterbildungsgang: sampleProgram,
    selectedAssignments: [],
    selectedModuleIds: [],
    questions: [],
    examMeta: {},
  });
  assert.equal(payload.examMeta.examTitle, "AIM Multiple-Choice Test");
  assert.equal(payload.examMeta.examDate, "");
  assert.equal(payload.examMeta.language, "de-CH");
});

test("buildExportPayload maps multiple correct option letters", () => {
  const payload = buildExportPayload({
    weiterbildungsgang: sampleProgram,
    selectedAssignments: [],
    selectedModuleIds: [],
    questions: [
      {
        id: "q1",
        moduleId: "A",
        stem: "Multi",
        options: ["1", "2", "3", "4"],
        correctOptionIndexes: [0, 2, 3],
        answerFormat: "Multiple Choice",
      },
    ],
    examMeta: sampleExamMeta,
  });
  assert.deepEqual(payload.questions[0].correctOptionLetters, ["A", "C", "D"]);
});

test("buildExportPayload assigns sequential order to questions", () => {
  const payload = buildExportPayload({
    weiterbildungsgang: sampleProgram,
    selectedAssignments: [],
    selectedModuleIds: [],
    questions: [
      { id: "q1", moduleId: "A", stem: "First", options: ["x"], correctOptionIndexes: [0] },
      { id: "q2", moduleId: "A", stem: "Second", options: ["x"], correctOptionIndexes: [0] },
      { id: "q3", moduleId: "A", stem: "Third", options: ["x"], correctOptionIndexes: [0] },
    ],
    examMeta: sampleExamMeta,
  });
  assert.deepEqual(payload.questions.map((q) => q.order), [1, 2, 3]);
});

test("buildExportPayload preserves question lecturer and createdYear", () => {
  const payload = buildExportPayload({
    weiterbildungsgang: sampleProgram,
    selectedAssignments: [],
    selectedModuleIds: [],
    questions: [
      {
        id: "q1",
        moduleId: "A",
        stem: "x",
        options: ["a", "b"],
        correctOptionIndexes: [0],
        lecturer: "Dr. Müller",
        createdYear: "2025",
        location: "Zürich",
      },
    ],
    examMeta: sampleExamMeta,
  });
  assert.equal(payload.questions[0].lecturer, "Dr. Müller");
  assert.equal(payload.questions[0].createdYear, "2025");
  assert.equal(payload.questions[0].location, "Zürich");
});

test("buildExportPayload handles questions with empty tags", () => {
  const payload = buildExportPayload({
    weiterbildungsgang: sampleProgram,
    selectedAssignments: [],
    selectedModuleIds: [],
    questions: [
      {
        id: "q1",
        moduleId: "A",
        stem: "x",
        options: ["a"],
        correctOptionIndexes: [0],
      },
    ],
    examMeta: sampleExamMeta,
  });
  assert.deepEqual(payload.questions[0].tags, []);
});

// ── shortProgramName ───────────────────────────────────────────────────────

test("shortProgramName strips trailing parentheticals", () => {
  assert.equal(shortProgramName("WBS 55 (2020)"), "WBS 55");
  assert.equal(shortProgramName("WBS Zürich (Gruppe 2)"), "WBS Zürich");
});

test("shortProgramName leaves clean names untouched", () => {
  assert.equal(shortProgramName("WBS 55"), "WBS 55");
});

test("shortProgramName handles empty/missing input", () => {
  assert.equal(shortProgramName(""), "");
  assert.equal(shortProgramName(), "");
});

test("shortProgramName preserves internal parentheticals", () => {
  // Only the TRAILING parenthetical is stripped — not a paren in the middle.
  assert.equal(shortProgramName("WBS (Pilot) Bern"), "WBS (Pilot) Bern");
});

// ── programsForQuestion ────────────────────────────────────────────────────

const programA = {
  id: "p1",
  name: "WBS A",
  semesters: [
    { sem: 1, modules: [{ course: "Sucht", lecturer: "Dr. Petry", year: "2025" }] },
  ],
};
const programB = {
  id: "p2",
  name: "WBS B",
  semesters: [
    { sem: 1, modules: [{ course: "Sucht", lecturer: "", year: "" }] },
  ],
};
const programC = {
  id: "p3",
  name: "WBS C",
  semesters: [
    { sem: 1, modules: [{ course: "Essstörungen", lecturer: "Dr. Mihov", year: "2025" }] },
  ],
};

test("programsForQuestion returns empty array when programs is empty/missing", () => {
  assert.deepEqual(programsForQuestion({ course: "Sucht" }, []), []);
  assert.deepEqual(programsForQuestion({ course: "Sucht" }), []);
  assert.deepEqual(programsForQuestion(null, [programA]), []);
});

test("programsForQuestion exact course+lecturer+year match", () => {
  const matched = programsForQuestion(
    { course: "Sucht", lecturer: "Dr. Petry", year: "2025" },
    [programA, programB, programC]
  );
  assert.deepEqual(
    matched.map((p) => p.id),
    ["p1", "p2"]
  );
});

test("programsForQuestion: blank lecturer on question matches all programs with the course", () => {
  const matched = programsForQuestion({ course: "Sucht", lecturer: "", year: "" }, [
    programA,
    programB,
    programC,
  ]);
  assert.deepEqual(
    matched.map((p) => p.id),
    ["p1", "p2"]
  );
});

test("programsForQuestion: lecturer mismatch excludes program", () => {
  const matched = programsForQuestion(
    { course: "Sucht", lecturer: "Dr. Other", year: "2025" },
    [programA, programB, programC]
  );
  // p1 has lecturer "Dr. Petry" — mismatch → excluded
  // p2 has blank lecturer → still matches
  assert.deepEqual(
    matched.map((p) => p.id),
    ["p2"]
  );
});

test("programsForQuestion: course mismatch excludes all", () => {
  const matched = programsForQuestion(
    { course: "Nonexistent" },
    [programA, programB, programC]
  );
  assert.deepEqual(matched, []);
});

test("programsForQuestion: doesn't double-count when module appears in multiple semesters", () => {
  const dupProgram = {
    id: "pdup",
    name: "WBS Dup",
    semesters: [
      { sem: 1, modules: [{ course: "Sucht", lecturer: "", year: "" }] },
      { sem: 2, modules: [{ course: "Sucht", lecturer: "", year: "" }] },
    ],
  };
  const matched = programsForQuestion({ course: "Sucht" }, [dupProgram]);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, "pdup");
});

test("programsForQuestion: ignores empty/blank modules", () => {
  const sparseProgram = {
    id: "psparse",
    name: "WBS Sparse",
    semesters: [
      { sem: 1, modules: [{ course: "", lecturer: "", year: "" }, { course: "Sucht", lecturer: "", year: "" }] },
    ],
  };
  const matched = programsForQuestion({ course: "Sucht" }, [sparseProgram]);
  assert.deepEqual(
    matched.map((p) => p.id),
    ["psparse"]
  );
});
