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

// Semester calendar derivation for the autofill feature. Returns an array
// of 6 {term, year} pairs describing each of a WBG's semesters given its
// start.
//   HS-Start (Y): sem 1=HS Y, 2=FS Y+1, 3=HS Y+1, 4=FS Y+2, 5=HS Y+2, 6=FS Y+3
//   FS-Start (Y): sem 1=FS Y, 2=HS Y,   3=FS Y+1, 4=HS Y+1, 5=FS Y+2, 6=HS Y+2
export function semesterCalendarFor(program) {
  const yearRaw = Number(program.startYear);
  const baseYear = Number.isFinite(yearRaw) && yearRaw > 1900 ? yearRaw : new Date().getFullYear();
  const startIsHS = program.startTerm === "HS";
  const out = [];
  for (let i = 0; i < 6; i++) {
    let term, year;
    if (startIsHS) {
      term = i % 2 === 0 ? "HS" : "FS";
      year = baseYear + Math.ceil(i / 2);
    } else {
      term = i % 2 === 0 ? "FS" : "HS";
      year = baseYear + Math.floor(i / 2);
    }
    out.push({ term, year: String(year) });
  }
  return out;
}

// Best-effort autofill of a WBG's matrix from courses tagged for that WBG.
// Existing modules are PRESERVED — only empty slots get filled. See the
// monolith implementation for full docs; this is the testable mirror.
export function autofillModulesForProgram(program, courseTags, questions) {
  if (!program || !courseTags) return null;
  const programId = String(program.id);
  const taggedCourses = Object.entries(courseTags)
    // eslint-disable-next-line no-unused-vars
    .filter(([_, ids]) => Array.isArray(ids) && ids.map(String).includes(programId))
    .map(([course]) => course);
  if (!taggedCourses.length) return null;

  const mostCommon = (obj) => {
    const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || "";
  };
  const courseMeta = {};
  for (const course of taggedCourses) {
    const qs = (questions || []).filter((q) => q.course === course);
    const yC = {}, lC = {};
    qs.forEach((q) => {
      if (q.year) yC[q.year] = (yC[q.year] || 0) + 1;
      if (q.lecturer) lC[q.lecturer] = (lC[q.lecturer] || 0) + 1;
    });
    courseMeta[course] = { year: mostCommon(yC), lecturer: mostCommon(lC) };
  }

  const calendar = semesterCalendarFor(program);
  const newSemesters = (program.semesters || []).map((s) => ({
    sem: s.sem,
    modules: (s.modules || []).map((m) => ({ ...m })),
  }));

  const sortedCourses = [...taggedCourses].sort((a, b) => {
    const yA = courseMeta[a].year || "9999";
    const yB = courseMeta[b].year || "9999";
    if (yA !== yB) return yA.localeCompare(yB);
    return a.localeCompare(b);
  });

  const stats = { placed: 0, alreadyPresent: 0, skipped: 0 };
  for (const course of sortedCourses) {
    const present = newSemesters.some((s) =>
      (s.modules || []).some((m) => m.course === course)
    );
    if (present) {
      stats.alreadyPresent++;
      continue;
    }
    const meta = courseMeta[course];
    let targetSemIdx = -1;
    if (meta.year) {
      for (let i = 0; i < calendar.length; i++) {
        if (calendar[i].year === meta.year) {
          const emptyIdx = newSemesters[i].modules.findIndex((m) => !m.course);
          if (emptyIdx !== -1) {
            targetSemIdx = i;
            break;
          }
        }
      }
    }
    if (targetSemIdx === -1) {
      for (let i = 0; i < newSemesters.length; i++) {
        const emptyIdx = newSemesters[i].modules.findIndex((m) => !m.course);
        if (emptyIdx !== -1) {
          targetSemIdx = i;
          break;
        }
      }
    }
    if (targetSemIdx === -1) {
      stats.skipped++;
      continue;
    }
    const emptyIdx = newSemesters[targetSemIdx].modules.findIndex((m) => !m.course);
    newSemesters[targetSemIdx].modules[emptyIdx] = {
      course,
      year: meta.year || "",
      lecturer: meta.lecturer || "",
    };
    stats.placed++;
  }
  return { semesters: newSemesters, stats };
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
