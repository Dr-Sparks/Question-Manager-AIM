import test from "node:test";
import assert from "node:assert/strict";
import {
  COURSE_SLOT_COUNT,
  autoSelectQuestions,
  buildExportPayload,
  migrateCourseTagsFromMatrix,
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

// ── programsForQuestion (v1.0.13: now reads from courseTags map) ──────────

const programA = { id: "p1", name: "WBS A", semesters: [] };
const programB = { id: "p2", name: "WBS B", semesters: [] };
const programC = { id: "p3", name: "WBS C", semesters: [] };

test("programsForQuestion returns empty for missing/empty inputs", () => {
  const tags = { Sucht: ["p1"] };
  assert.deepEqual(programsForQuestion({ course: "Sucht" }, [], tags), []);
  assert.deepEqual(programsForQuestion({ course: "Sucht" }, [programA]), []);
  assert.deepEqual(programsForQuestion(null, [programA], tags), []);
});

test("programsForQuestion returns the WBGs whose IDs are listed in courseTags[course]", () => {
  const tags = { Sucht: ["p1", "p2"], Essstörungen: ["p3"] };
  const matched = programsForQuestion(
    { course: "Sucht" },
    [programA, programB, programC],
    tags
  );
  assert.deepEqual(matched.map((p) => p.id), ["p1", "p2"]);
});

test("programsForQuestion ignores stale tag IDs that no longer match any program", () => {
  // Tag references a program that's been deleted — should be silently filtered out.
  const tags = { Sucht: ["p1", "p999_deleted"] };
  const matched = programsForQuestion(
    { course: "Sucht" },
    [programA, programB],
    tags
  );
  assert.deepEqual(matched.map((p) => p.id), ["p1"]);
});

test("programsForQuestion returns [] when the course has no tag entry", () => {
  const tags = { Essstörungen: ["p3"] };
  assert.deepEqual(
    programsForQuestion({ course: "Sucht" }, [programA, programB, programC], tags),
    []
  );
});

test("programsForQuestion: ignores lecturer / year completely (only course tags matter now)", () => {
  // Pre-v1.0.13 this would have used lecturer/year filtering. Now: tag list is the truth.
  const tags = { Sucht: ["p1"] };
  const matched = programsForQuestion(
    { course: "Sucht", lecturer: "Anyone", year: "9999" },
    [programA, programB],
    tags
  );
  assert.deepEqual(matched.map((p) => p.id), ["p1"]);
});

test("programsForQuestion: handles numeric program IDs vs string tag IDs (coerces both)", () => {
  const numericProgram = { id: 42, name: "WBS Numeric", semesters: [] };
  // Tag stored as string "42" should still match a program with numeric id 42.
  const tags = { Sucht: ["42"] };
  const matched = programsForQuestion(
    { course: "Sucht" },
    [numericProgram],
    tags
  );
  assert.deepEqual(matched.map((p) => p.id), [42]);
});

// ── migrateCourseTagsFromMatrix ───────────────────────────────────────────

test("migrateCourseTagsFromMatrix seeds tags from existing course-in-module relationships", () => {
  const programs = [
    {
      id: "p1",
      name: "WBS A",
      semesters: [
        { sem: 1, modules: [{ course: "Sucht", lecturer: "Dr. P", year: "2025" }] },
        { sem: 2, modules: [{ course: "Essstörungen", lecturer: "Dr. M", year: "2025" }] },
      ],
    },
    {
      id: "p2",
      name: "WBS B",
      semesters: [
        { sem: 1, modules: [{ course: "Sucht", lecturer: "", year: "" }] },
      ],
    },
  ];
  const questions = [
    { id: 1, course: "Sucht" },
    { id: 2, course: "Essstörungen" },
    { id: 3, course: "Standalone — not in any program" },
  ];
  const out = migrateCourseTagsFromMatrix(questions, programs);
  assert.deepEqual(out["Sucht"], ["p1", "p2"]);
  assert.deepEqual(out["Essstörungen"], ["p1"]);
  // Course that's in no program gets an empty tag list (the user can still
  // tag it later from Kurs Übersicht).
  assert.deepEqual(out["Standalone — not in any program"], []);
});

test("migrateCourseTagsFromMatrix: returns {} for empty/missing inputs", () => {
  assert.deepEqual(migrateCourseTagsFromMatrix([], []), {});
  assert.deepEqual(migrateCourseTagsFromMatrix(null, []), {});
});

test("migrateCourseTagsFromMatrix: doesn't double-tag if a course appears in multiple modules of the same program", () => {
  const programs = [
    {
      id: "p1",
      name: "WBS A",
      semesters: [
        { sem: 1, modules: [{ course: "Sucht" }, { course: "Sucht" }] },
        { sem: 2, modules: [{ course: "Sucht" }] },
      ],
    },
  ];
  const out = migrateCourseTagsFromMatrix([{ id: 1, course: "Sucht" }], programs);
  assert.deepEqual(out["Sucht"], ["p1"]);
});
