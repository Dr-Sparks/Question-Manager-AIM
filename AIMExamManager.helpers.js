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
