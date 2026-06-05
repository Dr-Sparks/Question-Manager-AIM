import test from "node:test";
import assert from "node:assert/strict";
import {
  COURSE_SLOT_COUNT,
  autoSelectQuestions,
  autofillModulesForProgram,
  buildDocx,
  buildDocxDocumentXml,
  buildExportPayload,
  computeExcelImportDiff,
  docxEsc,
  migrateCourseTagsFromMatrix,
  normalizeSlots,
  programsForQuestion,
  semesterCalendarFor,
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

// ── semesterCalendarFor ──────────────────────────────────────────────────

test("semesterCalendarFor HS-start: 6 semesters span 3 calendar years", () => {
  const cal = semesterCalendarFor({ startYear: "2024", startTerm: "HS" });
  assert.deepEqual(cal, [
    { term: "HS", year: "2024" },
    { term: "FS", year: "2025" },
    { term: "HS", year: "2025" },
    { term: "FS", year: "2026" },
    { term: "HS", year: "2026" },
    { term: "FS", year: "2027" },
  ]);
});

test("semesterCalendarFor FS-start: FS comes first within each calendar year", () => {
  const cal = semesterCalendarFor({ startYear: "2025", startTerm: "FS" });
  assert.deepEqual(cal, [
    { term: "FS", year: "2025" },
    { term: "HS", year: "2025" },
    { term: "FS", year: "2026" },
    { term: "HS", year: "2026" },
    { term: "FS", year: "2027" },
    { term: "HS", year: "2027" },
  ]);
});

test("semesterCalendarFor falls back to current year when startYear is invalid", () => {
  const cal = semesterCalendarFor({ startYear: "", startTerm: "HS" });
  assert.equal(cal.length, 6);
  const currentYear = new Date().getFullYear();
  assert.equal(cal[0].year, String(currentYear));
});

// ── autofillModulesForProgram ────────────────────────────────────────────

const programForAutofill = {
  id: "p1",
  name: "WBS Test",
  startYear: "2024",
  startTerm: "HS",
  semesters: [
    { sem: 1, modules: [{}, {}, {}, {}] },
    { sem: 2, modules: [{}, {}, {}, {}] },
    { sem: 3, modules: [{}, {}, {}, {}] },
    { sem: 4, modules: [{}, {}, {}, {}] },
    { sem: 5, modules: [{}, {}, {}, {}] },
    { sem: 6, modules: [{}, {}, {}, {}] },
  ],
};

test("autofillModulesForProgram returns null when no courses are tagged", () => {
  assert.equal(autofillModulesForProgram(programForAutofill, {}, []), null);
});

test("autofillModulesForProgram fills empty modules with tagged courses", () => {
  const courseTags = { Sucht: ["p1"], ACT: ["p1"] };
  const questions = [
    { course: "Sucht", year: "2024", lecturer: "Dr. Petry" },
    { course: "ACT", year: "2025", lecturer: "J. Behr" },
  ];
  const result = autofillModulesForProgram(programForAutofill, courseTags, questions);
  assert.equal(result.stats.placed, 2);
  // Sucht (year 2024) → semester 1 (HS 2024)
  const placedCourses = result.semesters.flatMap((s) =>
    s.modules.filter((m) => m.course).map((m) => m.course)
  );
  assert.ok(placedCourses.includes("Sucht"));
  assert.ok(placedCourses.includes("ACT"));
});

test("autofillModulesForProgram preserves existing modules — never overwrites", () => {
  const programWithExisting = {
    ...programForAutofill,
    semesters: [
      { sem: 1, modules: [{ course: "Existing", year: "2024", lecturer: "Existing-L" }, {}, {}, {}] },
      { sem: 2, modules: [{}, {}, {}, {}] },
      { sem: 3, modules: [{}, {}, {}, {}] },
      { sem: 4, modules: [{}, {}, {}, {}] },
      { sem: 5, modules: [{}, {}, {}, {}] },
      { sem: 6, modules: [{}, {}, {}, {}] },
    ],
  };
  const courseTags = { Sucht: ["p1"] };
  const questions = [{ course: "Sucht", year: "2024", lecturer: "Dr. Petry" }];
  const result = autofillModulesForProgram(programWithExisting, courseTags, questions);
  // "Existing" remains untouched
  assert.equal(result.semesters[0].modules[0].course, "Existing");
  // "Sucht" lands in one of the empty slots (year 2024 → semester 1)
  assert.equal(result.semesters[0].modules[1].course, "Sucht");
});

test("autofillModulesForProgram skips courses that are already present in the matrix", () => {
  const programAlreadyHasSucht = {
    ...programForAutofill,
    semesters: [
      { sem: 1, modules: [{ course: "Sucht", year: "2024", lecturer: "Dr. Petry" }, {}, {}, {}] },
      { sem: 2, modules: [{}, {}, {}, {}] },
      { sem: 3, modules: [{}, {}, {}, {}] },
      { sem: 4, modules: [{}, {}, {}, {}] },
      { sem: 5, modules: [{}, {}, {}, {}] },
      { sem: 6, modules: [{}, {}, {}, {}] },
    ],
  };
  const courseTags = { Sucht: ["p1"] };
  const result = autofillModulesForProgram(programAlreadyHasSucht, courseTags, []);
  assert.equal(result.stats.placed, 0);
  assert.equal(result.stats.alreadyPresent, 1);
});

test("autofillModulesForProgram: course preferred year unmatched → fallback to first empty slot", () => {
  // Course whose year is "1990" doesn't match any of the 2024-2027 semesters.
  const courseTags = { OldCourse: ["p1"] };
  const questions = [{ course: "OldCourse", year: "1990", lecturer: "Prof. X" }];
  const result = autofillModulesForProgram(programForAutofill, courseTags, questions);
  assert.equal(result.stats.placed, 1);
  // Falls back to the very first slot
  assert.equal(result.semesters[0].modules[0].course, "OldCourse");
});

test("autofillModulesForProgram: more courses than slots → marks the rest as skipped", () => {
  // 30 courses but only 24 slots
  const courseTags = {};
  for (let i = 0; i < 30; i++) courseTags["Course_" + i] = ["p1"];
  const result = autofillModulesForProgram(programForAutofill, courseTags, []);
  assert.equal(result.stats.placed, 24);
  assert.equal(result.stats.skipped, 6);
});

test("autofillModulesForProgram: picks most-common year + lecturer from a course's questions", () => {
  const courseTags = { Sucht: ["p1"] };
  const questions = [
    { course: "Sucht", year: "2025", lecturer: "Dr. A" },
    { course: "Sucht", year: "2025", lecturer: "Dr. A" },
    { course: "Sucht", year: "2024", lecturer: "Dr. B" },
  ];
  const result = autofillModulesForProgram(programForAutofill, courseTags, questions);
  const placed = result.semesters.flatMap((s) => s.modules).find((m) => m.course === "Sucht");
  assert.equal(placed.year, "2025"); // 2× wins over 1×
  assert.equal(placed.lecturer, "Dr. A");
});

// ── computeExcelImportDiff (v1.0.15) ────────────────────────────────────────
// The diff function is the safety surface for Excel round-trip. Each test
// pins one promise we make to the user: no surprise deletions, ID is the
// join key, missing-required-field becomes a conflict not a crash.

const makeQ = (overrides = {}) => ({
  id: "q1",
  year: "2024",
  location: "Zurich",
  lecturer: "Dr. A",
  course: "Math",
  format: "Single Choice",
  question: "What is 2+2?",
  optA: "3",
  optB: "4",
  optC: "5",
  optD: "",
  optE: "",
  answer: "B",
  ...overrides,
});

test("computeExcelImportDiff: identical question → unchanged", () => {
  const q = makeQ();
  const diff = computeExcelImportDiff({ questions: [q] }, { questions: [q] });
  assert.equal(diff.questions.unchanged.length, 1);
  assert.equal(diff.questions.add.length, 0);
  assert.equal(diff.questions.update.length, 0);
});

test("computeExcelImportDiff: edited question → update with before+after", () => {
  const before = makeQ({ question: "Old text" });
  const after = makeQ({ question: "New text" });
  const diff = computeExcelImportDiff({ questions: [after] }, { questions: [before] });
  assert.equal(diff.questions.update.length, 1);
  assert.equal(diff.questions.update[0].before.question, "Old text");
  assert.equal(diff.questions.update[0].after.question, "New text");
});

test("computeExcelImportDiff: question with empty ID is treated as new", () => {
  const fresh = makeQ({ id: "" });
  const diff = computeExcelImportDiff({ questions: [fresh] }, { questions: [] });
  assert.equal(diff.questions.add.length, 1);
  assert.equal(diff.questions.add[0].id, "");
});

test("computeExcelImportDiff: question missing required fields → conflict (not crash)", () => {
  const bad = makeQ({ course: "", id: "" });
  const diff = computeExcelImportDiff({ questions: [bad] }, { questions: [] });
  assert.equal(diff.conflicts.length, 1);
  assert.equal(diff.conflicts[0].type, "question");
  assert.equal(diff.questions.add.length, 0);
});

test("computeExcelImportDiff: parsed missing rows are NEVER deleted (the core contract)", () => {
  // Current has 3 questions, parsed has 0 → diff should show nothing,
  // because never-delete means rows simply don't appear in the diff.
  const a = makeQ({ id: "q1" });
  const b = makeQ({ id: "q2", question: "Q2" });
  const c = makeQ({ id: "q3", question: "Q3" });
  const diff = computeExcelImportDiff({ questions: [] }, { questions: [a, b, c] });
  assert.equal(diff.questions.add.length, 0);
  assert.equal(diff.questions.update.length, 0);
  assert.equal(diff.questions.unchanged.length, 0);
});

test("computeExcelImportDiff: program matched by name when ID missing", () => {
  const current = {
    programs: [
      {
        id: "p1",
        name: "WBG-A",
        startYear: "2024",
        startTerm: "HS",
        semesters: [],
      },
    ],
  };
  const parsed = {
    programs: [
      {
        id: null,
        name: "WBG-A",
        startYear: "2024",
        startTerm: "HS",
        semesters: [],
      },
    ],
  };
  const diff = computeExcelImportDiff(parsed, current);
  assert.equal(diff.programs.unchanged.length, 1);
  assert.equal(diff.programs.add.length, 0);
});

test("computeExcelImportDiff: course tag change → update, new course → add", () => {
  const current = { courseTags: { Math: ["p1"] } };
  const parsed = { courseTags: { Math: ["p1", "p2"], Physics: ["p1"] } };
  const diff = computeExcelImportDiff(parsed, current);
  assert.equal(diff.courseTags.update.length, 1);
  assert.equal(diff.courseTags.update[0].course, "Math");
  assert.deepEqual(diff.courseTags.update[0].after, ["p1", "p2"]);
  assert.equal(diff.courseTags.add.length, 1);
  assert.equal(diff.courseTags.add[0].course, "Physics");
});

test("computeExcelImportDiff: course tag list with same IDs in different order → unchanged", () => {
  const current = { courseTags: { Math: ["p2", "p1"] } };
  const parsed = { courseTags: { Math: ["p1", "p2"] } };
  const diff = computeExcelImportDiff(parsed, current);
  assert.equal(diff.courseTags.unchanged.length, 1);
});

test("computeExcelImportDiff: empty parsed → empty diff sections (no crashes)", () => {
  const diff = computeExcelImportDiff({}, {});
  assert.equal(diff.questions.add.length, 0);
  assert.equal(diff.programs.add.length, 0);
  assert.equal(diff.courseTags.add.length, 0);
  assert.equal(diff.savedExams.add.length, 0);
  assert.equal(diff.conflicts.length, 0);
});

test("computeExcelImportDiff: saved exam matched by ID gets updated, otherwise added", () => {
  const existing = {
    id: "ex1",
    name: "Exam 1",
    programName: "WBG-A",
    questions: [makeQ()],
  };
  const updated = { ...existing, name: "Exam 1 (revised)" };
  const novel = {
    id: "ex2",
    name: "Exam 2",
    programName: "WBG-B",
    questions: [makeQ({ id: "q-novel" })],
  };
  const diff = computeExcelImportDiff(
    { savedExams: [updated, novel] },
    { savedExams: [existing] }
  );
  assert.equal(diff.savedExams.update.length, 1);
  assert.equal(diff.savedExams.update[0].after.name, "Exam 1 (revised)");
  assert.equal(diff.savedExams.add.length, 1);
  assert.equal(diff.savedExams.add[0].id, "ex2");
});

// ── Word (.docx) export for Testportal import ────────────────────────────────
// The whole point of the .docx export is that Testportal detects the correct
// answer from the BOLD run. These tests lock in: ONLY correct-answer lines are
// bold, nothing else is, escaping/umlauts survive, and the bytes are a real zip.

const docxQ = (over = {}) => ({
  course: "Psychoonkologie",
  question: "Welche Intervention ist angezeigt?",
  optA: "Antwort A",
  optB: "Antwort B",
  optC: "Antwort C",
  optD: "Antwort D",
  answer: "A",
  ...over,
});

// Extract { text, bold } for each real <w:p> paragraph (skips <w:pPr>/<w:bCs/>).
function docxParagraphs(xml) {
  const ps = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  return ps
    .map((p) => ({
      text: [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(""),
      bold: /<w:b\/>/.test(p),
    }))
    .filter((x) => x.text.trim() !== "");
}

test("buildDocxDocumentXml: single-choice bolds ONLY the correct answer line", () => {
  const ps = docxParagraphs(buildDocxDocumentXml([docxQ({ answer: "A" })]));
  const find = (pre) => ps.find((p) => p.text.startsWith(pre));
  assert.equal(find("a)").bold, true);
  assert.equal(find("b)").bold, false);
  assert.equal(find("c)").bold, false);
  assert.equal(find("d)").bold, false);
  assert.equal(ps.find((p) => p.text.includes("Titel des Kurses")).bold, false);
  assert.equal(ps.find((p) => p.text.includes("Welche Intervention")).bold, false);
  assert.equal(ps.filter((p) => p.bold).length, 1, "exactly one bold paragraph");
});

test("buildDocxDocumentXml: bold includes the letter prefix (matches import template)", () => {
  const xml = buildDocxDocumentXml([docxQ({ answer: "A" })]);
  // The "a) " prefix sits inside the same <w:t> as the bold run, so the whole
  // option line — letter included — is bold, exactly like the working file.
  assert.match(xml, /<w:b\/><w:bCs\/>[\s\S]*?<w:t[^>]*>a\) Antwort A<\/w:t>/);
});

test("buildDocxDocumentXml: multiple-choice bolds every marked answer (A;B;D)", () => {
  const ps = docxParagraphs(buildDocxDocumentXml([docxQ({ answer: "A;B;D" })]));
  const bold = ps.filter((p) => p.bold).map((p) => p.text.slice(0, 2)).sort();
  assert.deepEqual(bold, ["a)", "b)", "d)"]);
});

test("buildDocxDocumentXml: a question with no marked answer has zero bold runs", () => {
  // No bold => Testportal imports it without a (wrong) correct answer.
  const ps = docxParagraphs(buildDocxDocumentXml([docxQ({ answer: "" })]));
  assert.equal(ps.filter((p) => p.bold).length, 0);
});

test("buildDocxDocumentXml: only options with text become answer lines", () => {
  const ps = docxParagraphs(
    buildDocxDocumentXml([docxQ({ optC: "", optD: "", optE: "", answer: "A" })])
  );
  assert.ok(ps.some((p) => p.text.startsWith("a)")));
  assert.ok(ps.some((p) => p.text.startsWith("b)")));
  assert.ok(!ps.some((p) => p.text.startsWith("c)")));
});

test("docxEsc escapes XML metacharacters and tolerates null/undefined", () => {
  assert.equal(docxEsc('a & b < c > d " e'), "a &amp; b &lt; c &gt; d &quot; e");
  assert.equal(docxEsc(null), "");
  assert.equal(docxEsc(undefined), "");
});

test("buildDocxDocumentXml: ampersand in answer text is escaped and stays bold", () => {
  const xml = buildDocxDocumentXml([docxQ({ optA: "Körper & Psyche", answer: "A" })]);
  assert.match(xml, /Körper &amp; Psyche/);
  const a = docxParagraphs(xml).find((p) => p.text.startsWith("a)"));
  assert.equal(a.bold, true);
});

test("buildDocx returns a Uint8Array zip containing the three OOXML parts", () => {
  const bytes = buildDocx([docxQ()]);
  assert.ok(bytes instanceof Uint8Array);
  // ZIP local file header magic 'PK\x03\x04' and end-of-central-dir 'PK\x05\x06'.
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const raw = new TextDecoder("latin1").decode(bytes);
  assert.ok(raw.includes("[Content_Types].xml"));
  assert.ok(raw.includes("_rels/.rels"));
  assert.ok(raw.includes("word/document.xml"));
  assert.ok(raw.includes("PK\x05\x06"), "end-of-central-directory record present");
});

test("buildDocx encodes umlauts/ß as UTF-8 bytes", () => {
  const bytes = buildDocx([docxQ({ question: "Übung über Maßnahmen", answer: "A" })]);
  // 'Ü' = U+00DC -> 0xC3 0x9C ; 'ß' = U+00DF -> 0xC3 0x9F
  const hasSeq = (a, b) => bytes.some((v, i) => v === a && bytes[i + 1] === b);
  assert.ok(hasSeq(0xc3, 0x9c), "UTF-8 bytes for Ü");
  assert.ok(hasSeq(0xc3, 0x9f), "UTF-8 bytes for ß");
});
