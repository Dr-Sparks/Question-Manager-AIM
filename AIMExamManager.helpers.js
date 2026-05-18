// REFERENCE IMPLEMENTATIONS — not currently imported by AIMExamManager.jsx.
//
// The actual exam-building logic in the monolith uses hand-duplicated
// equivalents inline. These pure-function versions live here so the
// invariants (4-slot semesters, deterministic question ordering, export
// payload shape, etc.) are exercised by `AIMExamManager.helpers.test.js`
// in CI on every push.
//
// If you change the corresponding logic in the monolith, mirror the change
// here so the tests stay meaningful. If you ever refactor the monolith,
// wire these helpers in directly to remove the duplication.

export const COURSE_SLOT_COUNT = 4;

export function normalizeSlots(courseIds = []) {
  return Array.from({ length: COURSE_SLOT_COUNT }, (_, index) => courseIds[index] || "");
}

export function validateAssignment(assignment) {
  return Array.isArray(assignment.courseIds) && assignment.courseIds.length === COURSE_SLOT_COUNT;
}

export function autoSelectQuestions(questions, selectedModuleIds) {
  const moduleSet = new Set(selectedModuleIds);
  return questions
    .filter((question) => moduleSet.has(question.moduleId))
    .sort((left, right) => {
      if (left.moduleId !== right.moduleId) {
        return left.moduleId.localeCompare(right.moduleId);
      }
      return left.stem.localeCompare(right.stem);
    });
}

// Compact form of a Weiterbildungsgang's name for in-row display. Mirrors
// the inline helper of the same shape in AIMExamManager.jsx.
export function shortProgramName(name = "") {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\s*\([^)]*\)\s*$/, "").trim() || trimmed;
}

// Reference implementation of the "which Weiterbildungsgänge does this
// question belong to" computation.
//
// As of v1.0.13 this is a simple lookup against the EXPLICIT per-course
// `courseTags` map (format: { [courseName]: [wbgId, ...] }). The previous
// implicit rule (matching course/lecturer/year against WBG modules) is
// only used at first-launch migration to seed initial tags — see
// `migrateCourseTagsFromMatrix` below.
//
// The monolith's version of this function in AIMExamManager.jsx must stay
// in lock-step with this one — the tests in AIMExamManager.helpers.test.js
// pin the contract.
export function programsForQuestion(question, programs, courseTags) {
  if (!question || !Array.isArray(programs) || !courseTags) return [];
  const ids = courseTags[question.course];
  if (!Array.isArray(ids) || !ids.length) return [];
  const idSet = new Set(ids.map(String));
  return programs
    .filter((p) => idSet.has(String(p.id)))
    .map((p) => ({ id: p.id, name: p.name }));
}

// One-shot migration: compute initial course tags from the old implicit
// course-in-module relationship. Used once on first launch of v1.0.13 to
// seed `courseTags` for existing users; after that, tags are managed
// explicitly via Kurs Übersicht.
export function migrateCourseTagsFromMatrix(questions, programs) {
  const out = {};
  if (!Array.isArray(questions) || !Array.isArray(programs)) return out;
  const uniqueCourses = [...new Set(questions.map((q) => q.course).filter(Boolean))];
  for (const course of uniqueCourses) {
    const wbgIds = [];
    for (const p of programs) {
      let hit = false;
      for (const s of p.semesters || []) {
        for (const m of s.modules || []) {
          if (m.course === course) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) wbgIds.push(p.id);
    }
    out[course] = wbgIds;
  }
  return out;
}

export function buildExportPayload({
  weiterbildungsgang,
  selectedAssignments,
  selectedModuleIds,
  questions,
  examMeta,
}) {
  return {
    generatedAt: new Date().toISOString(),
    weiterbildungsgang: {
      id: weiterbildungsgang.id,
      code: weiterbildungsgang.code,
      name: weiterbildungsgang.name,
      location: weiterbildungsgang.location,
      cohortLabel: weiterbildungsgang.cohortLabel,
      status: weiterbildungsgang.status,
      startSemesterId: weiterbildungsgang.startSemesterId,
    },
    semesterSnapshot: selectedAssignments.map((assignment) => ({
      semesterId: assignment.semesterId,
      courseIds: normalizeSlots(assignment.courseIds).filter(Boolean),
    })),
    selectedModuleIds: [...selectedModuleIds],
    examMeta: {
      examTitle: examMeta.examTitle || "AIM Multiple-Choice Test",
      examDate: examMeta.examDate || "",
      durationMinutes: examMeta.durationMinutes || "",
      examCode: examMeta.examCode || "",
      notes: examMeta.notes || "",
      language: "de-CH",
    },
    questions: questions.map((question, index) => ({
      id: question.id,
      order: index + 1,
      moduleId: question.moduleId,
      type: "multiple-choice",
      answerFormat: question.answerFormat || "Single Choice",
      stem: question.stem,
      options: [...question.options],
      correctOptionIndexes: [...question.correctOptionIndexes],
      correctOptionLetters: [...question.correctOptionIndexes].map((optionIndex) =>
        String.fromCharCode(65 + optionIndex)
      ),
      difficulty: question.difficulty || "",
      tags: [...(question.tags || [])],
      createdYear: question.createdYear || "",
      location: question.location || "",
      lecturer: question.lecturer || "",
    })),
  };
}
