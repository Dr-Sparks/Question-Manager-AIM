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

// ─── v1.0.15 Excel round-trip — diff core ───────────────────────────────────
// Pure function that compares parsed Excel data against current app state
// and returns {add, update, unchanged} per category plus a conflicts list.
// Mirrors `computeExcelImportDiff` in AIMExamManager.jsx — if you change one,
// update the other so the tests stay meaningful.
//
// Contract:
//   - Never deletes anything. Rows missing in `parsed` are simply absent
//     from the diff; the app keeps its current copy.
//   - Match strategy:
//       questions  → by id (string compare)
//       programs   → by id, else by name
//       courseTags → by course name
//       savedExams → by id
//   - "unchanged" detection is field-level — if every comparable field
//     matches, the row is unchanged. Otherwise it's an update.
export function computeExcelImportDiff(parsed, current) {
  const diff = {
    questions: { add: [], update: [], unchanged: [] },
    programs: { add: [], update: [], unchanged: [] },
    courseTags: { add: [], update: [], unchanged: [] },
    savedExams: { add: [], update: [], unchanged: [] },
    conflicts: [],
  };

  const sameQuestion = (a, b) =>
    a.year === b.year &&
    a.location === b.location &&
    a.lecturer === b.lecturer &&
    a.course === b.course &&
    a.format === b.format &&
    a.question === b.question &&
    a.optA === b.optA &&
    a.optB === b.optB &&
    a.optC === b.optC &&
    a.optD === b.optD &&
    a.optE === b.optE &&
    a.answer === b.answer;

  const sameProgram = (a, b) =>
    a.name === b.name &&
    a.startYear === b.startYear &&
    a.startTerm === b.startTerm &&
    JSON.stringify(a.semesters || []) === JSON.stringify(b.semesters || []);

  // Questions
  const currentQById = new Map((current.questions || []).map((q) => [String(q.id), q]));
  (parsed.questions || []).forEach((q) => {
    if (!q.course || !q.question) {
      diff.conflicts.push({ type: "question", reason: "Pflichtfeld fehlt (Kurs oder Frage)", row: q });
      return;
    }
    if (q.id && currentQById.has(String(q.id))) {
      const existing = currentQById.get(String(q.id));
      const merged = { ...existing, ...q, id: existing.id };
      if (sameQuestion(existing, merged)) diff.questions.unchanged.push(merged);
      else diff.questions.update.push({ before: existing, after: merged });
    } else {
      diff.questions.add.push({ ...q, id: "" });
    }
  });

  // Programs
  const currentPById = new Map((current.programs || []).map((p) => [String(p.id), p]));
  const currentPByName = new Map((current.programs || []).map((p) => [p.name, p]));
  (parsed.programs || []).forEach((p) => {
    if (!p.name) {
      diff.conflicts.push({ type: "program", reason: "Name fehlt", row: p });
      return;
    }
    let existing = p.id ? currentPById.get(String(p.id)) : null;
    if (!existing) existing = currentPByName.get(p.name) || null;
    if (existing) {
      const merged = { ...existing, ...p, id: existing.id, semesters: p.semesters || existing.semesters };
      if (sameProgram(existing, merged)) diff.programs.unchanged.push(merged);
      else diff.programs.update.push({ before: existing, after: merged });
    } else {
      diff.programs.add.push({ ...p, id: "" });
    }
  });

  // Course tags
  const currentTags = current.courseTags || {};
  Object.entries(parsed.courseTags || {}).forEach(([course, ids]) => {
    const before = (currentTags[course] || []).map(String).sort();
    const after = (ids || []).map(String).sort();
    if (before.join("|") === after.join("|")) {
      diff.courseTags.unchanged.push({ course, ids: after });
    } else if (!currentTags[course]) {
      diff.courseTags.add.push({ course, ids: after });
    } else {
      diff.courseTags.update.push({ course, before, after });
    }
  });

  // Saved exams
  const currentExamById = new Map((current.savedExams || []).map((e) => [String(e.id), e]));
  (parsed.savedExams || []).forEach((exam) => {
    if (exam.id && currentExamById.has(String(exam.id))) {
      const existing = currentExamById.get(String(exam.id));
      if (
        JSON.stringify(existing.questions) === JSON.stringify(exam.questions) &&
        existing.name === exam.name
      ) {
        diff.savedExams.unchanged.push(existing);
      } else {
        diff.savedExams.update.push({
          before: existing,
          after: { ...existing, ...exam, id: existing.id },
        });
      }
    } else {
      diff.savedExams.add.push(exam);
    }
  });

  return diff;
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

// ── Word (.docx) export for Testportal import ────────────────────────────────
// MIRROR of the inline implementation in AIMExamManager.jsx. Testportal detects
// the correct answer from BOLD text. A PDF can't carry "bold" reliably (in a
// PDF, bold is only a font choice that text extraction discards), so the import
// marked no correct answer. A .docx stores bold as an explicit <w:b/> run
// property that Testportal reads directly. ONLY the correct answer line is bold
// (letter prefix included); the course title, stem and wrong answers stay normal
// so Testportal never marks a wrong answer as correct.

export function docxEsc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// One <w:p> paragraph; bold=true wraps the run in <w:b/><w:bCs/>.
export function docxParagraph(text, bold) {
  const rpr =
    `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>` +
    (bold ? "<w:b/><w:bCs/>" : "") +
    `<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>`;
  return (
    `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r>${rpr}` +
    `<w:t xml:space="preserve">${docxEsc(text)}</w:t></w:r></w:p>`
  );
}

export function buildDocxDocumentXml(questions) {
  const blocks = questions
    .map((q, i) => {
      const correct = q.answer ? q.answer.split(";") : [];
      const opts = [
        { k: "A", t: q.optA }, { k: "B", t: q.optB }, { k: "C", t: q.optC },
        { k: "D", t: q.optD }, { k: "E", t: q.optE },
      ].filter((o) => o.t);
      const head = docxParagraph(`${i + 1}. Titel des Kurses: ${q.course || ""}`, false);
      const stem = docxParagraph(q.question || "", false);
      const answers = opts
        .map((o) => docxParagraph(`${o.k.toLowerCase()}) ${o.t}`, correct.includes(o.k)))
        .join("");
      const spacer = '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
      return head + stem + answers + spacer;
    })
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    blocks +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>' +
    "</w:body></w:document>"
  );
}

const DOCX_CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const DOCX_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    let c = (crc ^ bytes[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Minimal STORE (uncompressed) zip writer — a valid .docx with no dependency.
export function zipStore(files) {
  const enc = new TextEncoder();
  const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameB = enc.encode(f.name);
    const dataB = enc.encode(f.data);
    const crc = crc32(dataB);
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(dataB.length), ...u32(dataB.length),
      ...u16(nameB.length), ...u16(0), ...nameB,
    ];
    chunks.push(Uint8Array.from(local), dataB);
    central.push([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(dataB.length), ...u32(dataB.length),
      ...u16(nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset), ...nameB,
    ]);
    offset += local.length + dataB.length;
  }
  const cdStart = offset;
  const cd = [];
  for (const c of central) { cd.push(...c); offset += c.length; }
  const eocd = [
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(offset - cdStart), ...u32(cdStart), ...u16(0),
  ];
  const out = new Uint8Array(cdStart + cd.length + eocd.length);
  let p = 0;
  for (const ch of chunks) { out.set(ch, p); p += ch.length; }
  out.set(Uint8Array.from(cd), p); p += cd.length;
  out.set(Uint8Array.from(eocd), p);
  return out;
}

// Returns the .docx file as a Uint8Array.
export function buildDocx(questions) {
  return zipStore([
    { name: "[Content_Types].xml", data: DOCX_CONTENT_TYPES },
    { name: "_rels/.rels", data: DOCX_RELS },
    { name: "word/document.xml", data: buildDocxDocumentXml(questions) },
  ]);
}

// ─── Word-Vorlage Generator ───────────────────────────────────────────────────
// Mirror of the template builder in AIMExamManager.jsx. Kept here so the full
// round-trip (build template → JSZip → parse) is testable in node.
export const VORLAGE_COLS = ["Format", "Kurs", "Dozent/in", "Jahr", "Standort", "Frage", "Antwort A", "Antwort B", "Antwort C", "Antwort D", "Antwort E", "Richtige Antwort(en)", "Weiterbildungsgänge"];
const VORLAGE_W = [1300, 1500, 1300, 600, 800, 2000, 1100, 1100, 1100, 1100, 1100, 1100, 1500];

function dxCell(text, { bold = false, w = 1500, shade } = {}) {
  const rpr = `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${bold ? "<w:b/><w:bCs/>" : ""}<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>`;
  const tcPr = `<w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>`;
  return `<w:tc>${tcPr}<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r>${rpr}<w:t xml:space="preserve">${docxEsc(text)}</w:t></w:r></w:p></w:tc>`;
}
const dxRow = (cells) => `<w:tr>${cells.join("")}</w:tr>`;

export function buildVorlageDocumentXml() {
  const intro = [
    docxParagraph("AIM Prüfungs-Manager — Fragen-Vorlage", true),
    docxParagraph("Bitte tragen Sie Ihre Prüfungsfragen direkt in die Tabelle unten ein — eine Zeile pro Frage.", false),
  ].join("");
  const grid = VORLAGE_W.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const header = dxRow(VORLAGE_COLS.map((c, i) => dxCell(c, { bold: true, w: VORLAGE_W[i], shade: "E7E6E6" })));
  const rows = [];
  for (let r = 0; r < 18; r++) rows.push(dxRow(VORLAGE_W.map((w) => dxCell("", { w }))));
  const bd = (c) => `<w:${c} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`;
  const borders = `<w:tblBorders>${bd("top")}${bd("left")}${bd("bottom")}${bd("right")}${bd("insideH")}${bd("insideV")}</w:tblBorders>`;
  const tbl = `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/>${borders}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${header}${rows.join("")}</w:tbl>`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    intro + tbl +
    '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="567" w:bottom="720" w:left="567" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>' +
    "</w:body></w:document>"
  );
}

export function buildVorlageDocx() {
  return zipStore([
    { name: "[Content_Types].xml", data: DOCX_CONTENT_TYPES },
    { name: "_rels/.rels", data: DOCX_RELS },
    { name: "word/document.xml", data: buildVorlageDocumentXml() },
  ]);
}

// ─── Word-Vorlage Import (Parser) ─────────────────────────────────────────────
// Mirror of the pure logic in AIMExamManager.jsx (parseDocxTableQuestions etc.).
// Kept here so the docx-table → questions extraction is testable in node.

// A "Richtige Antwort"-Zelle ("A", "A;C", "Richtig", "Ja" …) → internes Format.
export function normalizeImportAnswer(raw, format) {
  const s = String(raw == null ? "" : raw).trim();
  if (format === "Richtig/Falsch") {
    if (/^(a|richtig|wahr|true|r|w)$/i.test(s)) return "A";
    if (/^(b|falsch|false|f)$/i.test(s)) return "B";
  }
  if (format === "Ja/Nein") {
    if (/^(a|ja|yes|j|y)$/i.test(s)) return "A";
    if (/^(b|nein|no|n)$/i.test(s)) return "B";
  }
  const letters = [...new Set((s.toUpperCase().match(/[A-E]/g) || []))];
  return letters.join(";");
}

export const FMT_IMPORT_MAP = {
  "single choice": "Single Choice", single: "Single Choice", sc: "Single Choice", einfachauswahl: "Single Choice",
  "multiple choice": "Multiple Choice", multiple: "Multiple Choice", mc: "Multiple Choice", mehrfachauswahl: "Multiple Choice",
  "richtig/falsch": "Richtig/Falsch", "richtig falsch": "Richtig/Falsch", "wahr/falsch": "Richtig/Falsch", "true/false": "Richtig/Falsch", "r/f": "Richtig/Falsch",
  "ja/nein": "Ja/Nein", "yes/no": "Ja/Nein", "j/n": "Ja/Nein",
};

// Pure: first <w:tbl> of a Word document.xml → {questions:[{id:'',...}], courseTags}.
export function parseDocxTableQuestions(xml, programs = []) {
  const tblMatch = xml.match(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/);
  if (!tblMatch) throw new Error("In der Datei wurde keine Tabelle gefunden. Bitte die mitgelieferte Vorlage verwenden.");
  const tbl = tblMatch[0];
  const trList = tbl.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || [];
  const cellText = (tc) => {
    const parts = tc.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g) || [];
    const raw = parts.map((p) => p.replace(/^<w:t(?:\s[^>]*)?>/, "").replace(/<\/w:t>$/, "")).join("");
    return raw.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
  };
  const rowCells = (tr) => (tr.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || []).map(cellText);
  if (!trList.length) return { questions: [], courseTags: {} };
  const header = rowCells(trList[0]).map((h) => h.toLowerCase());
  const find = (name) => header.findIndex((h) => h.includes(name));
  const col = { format: find("format"), course: find("kurs"), lecturer: find("dozent"), year: find("jahr"), location: find("standort"), question: find("frage"), a: find("antwort a"), b: find("antwort b"), c: find("antwort c"), d: find("antwort d"), e: find("antwort e"), answer: find("richtige"), wbg: find("weiterbildung") };
  if (col.course < 0 && col.question < 0 && col.format < 0) throw new Error("Die Tabelle hat keine erkennbare Kopfzeile. Bitte die mitgelieferte Vorlage verwenden.");
  const progByName = new Map((programs || []).map((p) => [String(p.name || "").trim().toLowerCase(), String(p.id)]));
  const questions = [];
  const courseTags = {};
  for (let r = 1; r < trList.length; r++) {
    const c = rowCells(trList[r]);
    const get = (k) => (col[k] >= 0 ? String(c[col[k]] || "").trim() : "");
    const question = get("question"), course = get("course");
    const cleanseExample = (v) => (/^\(leer\)$/i.test(v) ? "" : v);
    if (!question && !course && !get("a") && !get("answer")) continue; // leere Zeile
    const format = FMT_IMPORT_MAP[get("format").toLowerCase()] || "Single Choice";
    let optA = cleanseExample(get("a")), optB = cleanseExample(get("b")), optC = cleanseExample(get("c")), optD = cleanseExample(get("d")), optE = cleanseExample(get("e"));
    if (format === "Richtig/Falsch") { optA = optA || "Richtig"; optB = optB || "Falsch"; optC = optD = optE = ""; }
    if (format === "Ja/Nein") { optA = optA || "Ja"; optB = optB || "Nein"; optC = optD = optE = ""; }
    const answer = normalizeImportAnswer(get("answer"), format);
    questions.push({ id: "", year: get("year"), location: get("location"), lecturer: get("lecturer"), course, format, question, optA, optB, optC, optD, optE, answer });
    const wbgCell = get("wbg");
    if (course && wbgCell) {
      const ids = wbgCell.split(/[,;]/).map((s) => s.trim()).filter(Boolean).map((n) => progByName.get(n.toLowerCase())).filter(Boolean);
      if (ids.length) courseTags[course] = [...new Set([...(courseTags[course] || []), ...ids])];
    }
  }
  return { questions, courseTags };
}
