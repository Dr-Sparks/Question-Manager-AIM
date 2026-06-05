import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import AnleitungPage from "./src/AnleitungPage.jsx";

// Color tokens — values come from CSS custom properties so dark/light mode works
// Exported for re-use by src/AnleitungPage.jsx (tour scenes need pixel-identical
// styling and primitives). The circular import (this file imports AnleitungPage,
// AnleitungPage imports back from here) is safe because AnleitungPage only uses
// these inside function bodies, not at module evaluation time.
// `inv` = inverted/dark surface (dark in BOTH themes, light text) — for the
// sidebar, dark table headers, dark buttons, callouts and active tabs. Using
// tD for those was the dark-mode bug: tD is the text color and inverts to near
// white in dark mode. `wmP`/`wm` = warm chip (cream/brown) that adapts to dark.
export const C={tD:'var(--c-tD)',t:'var(--c-t)',tM:'var(--c-tM)',tL:'var(--c-tL)',tP:'var(--c-tP)',wW:'var(--c-wW)',st:'var(--c-st)',tx:'var(--c-tx)',mu:'var(--c-mu)',bo:'var(--c-bo)',ac:'var(--c-ac)',wh:'var(--c-wh)',re:'var(--c-re)',rP:'var(--c-rP)',gr:'var(--c-gr)',gP:'var(--c-gP)',inv:'var(--c-inv)',invTx:'var(--c-invTx)',wmP:'var(--c-wmP)',wm:'var(--c-wm)'};
const THEMES={
  light:`
    --c-tD:#111111;--c-t:#d71920;--c-tM:#f08a00;--c-tL:#f3dcc9;--c-tP:#fff5ee;
    --c-wW:#f7f7f5;--c-st:#efefec;--c-tx:#111111;--c-mu:#666666;--c-bo:#d7d7d2;
    --c-ac:#f2c230;--c-wh:#ffffff;--c-re:#b42318;--c-rP:#fff1f0;--c-gr:#1d6b3e;--c-gP:#edf7ef;
    --c-sem-sel-cur:#fff0dc;--c-sem-sel-comp:#f3ede7;--c-sem-sel:#fff6f0;
    --c-sem-cur:#fff7e7;--c-sem-comp:#f5f5f2;--c-row-alt:#fcfcfb;
    --c-grid-sub:#f2f2f0;--c-grid-border:#1f1f1f;--c-sidebar:#111111;
    --c-inv:#111111;--c-invTx:#f3dcc9;--c-wmP:#FEF3E2;--c-wm:#7A4F10;`,
  dark:`
    --c-tD:#f0f0ee;--c-t:#e86068;--c-tM:#f0a030;--c-tL:#4a3028;--c-tP:#2a1a14;
    --c-wW:#18181a;--c-st:#252528;--c-tx:#e0e0de;--c-mu:#909090;--c-bo:#38383c;
    --c-ac:#f2c230;--c-wh:#222228;--c-re:#e06060;--c-rP:#2a1414;--c-gr:#5dbf7a;--c-gP:#1a2d1e;
    --c-sem-sel-cur:#2a1e0c;--c-sem-sel-comp:#201a16;--c-sem-sel:#1e1714;
    --c-sem-cur:#1e1c10;--c-sem-comp:#1e1e24;--c-row-alt:#1c1c1e;
    --c-grid-sub:#1c1c20;--c-grid-border:#444448;--c-sidebar:#0d0d10;
    --c-inv:#26262b;--c-invTx:#f3dcc9;--c-wmP:#3a2c18;--c-wm:#e6b878;`
};
export const sans="'Source Sans 3',system-ui,sans-serif";
export const serif="'Libre Baskerville',Georgia,serif";
export const FORMATS=['Single Choice','Multiple Choice','Richtig/Falsch','Ja/Nein'];
const KEYS=['A','B','C','D','E'];
const TERM_OPTIONS=['FS','HS'];
export const SEMESTER_COUNT=6;
export const MODULES_PER_SEMESTER=4;

// Unified ID generator. Replaces a previously-mixed scheme of Date.now(),
// Date.now()+Math.random() (which produced floats that lose precision in
// Map keys), and ad-hoc string IDs. Prefers crypto.randomUUID (Electron has
// it) and falls back to a timestamp+random combo for older runtimes.
function newId(prefix='id'){
  try{
    if(typeof crypto!=='undefined' && typeof crypto.randomUUID==='function'){
      return `${prefix}_${crypto.randomUUID()}`;
    }
  }catch{}
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
}

const q=(id,yr,lo,le,co,fm,qu,a,b,c,d,e,an)=>({id,year:yr,location:lo,lecturer:le,course:co,format:fm,question:qu,optA:a,optB:b||'',optC:c||'',optD:d||'',optE:e||'',answer:an});

const INIT_Q=[
q(1,'2025','','Judith Alder','Psychoonkologie','Single Choice','Ein 35-jähriger Patient mit Hodenkrebs ist nach Chemotherapie krebsfrei, hat jedoch große Angst vor einem Rückfall und vermeidet Nachsorgetermine. Welche Intervention ist am ehesten angezeigt?','Psychoedukation über Rückfallwahrscheinlichkeiten, kombiniert mit angstbewältigenden Techniken','Empfehlung zur Reduktion der Nachsorgeuntersuchungen mit Kosten-Nutzen-Abwägung','Konfrontation mit allen möglichen Spätfolgen des Unterlassens von Nachsorgeterminen','Ignorieren der Angst, da keine akute Lebensgefahr besteht','','A'),
q(2,'2025','','Judith Alder','Psychoonkologie','Single Choice','Eine 48-jährige Patientin ist überzeugt, ihre Krebserkrankung wurde durch jahrelange Überlastung verursacht. Wie sollte der/die Therapeut:in mit diesem subjektiven Krankheitsmodell umgehen?','Die Patientin aufklären, dass Stress wissenschaftlich bisher nicht als Ursache gilt.','Mit dem Arbeitgeber Kontakt aufnehmen und Veränderung der Arbeitssituation bitten.','Gemeinsam mögliche Auswirkungen dieser Überzeugung verstehen und Standortbestimmung anbieten.','Das Thema vermeiden, um keine weiteren Ängste zu triggern.','','C'),
q(3,'2025','','Judith Alder','Psychoonkologie','Single Choice','Ein Patient hat große Angst, dass seine Erkrankung fortschreitet oder zurückkehrt. Wie sollte ein:e Therapeut:in in der psychoonkologischen Behandlung damit umgehen?','Gefühle der Angst validieren und Techniken zum Umgang mit Angst vermitteln.','Den Patienten ermutigen, regelmässiger medizinische Kontrolltermine wahrzunehmen.','Den Patienten über Anzeichen eines Rezidivs aufklären und ein Symptomtagebuch einführen.','Den Fokus auf positive Gedanken lenken.','','A'),
q(4,'2025','','Judith Alder','Psychoonkologie','Single Choice','Welche Aspekte sollten in der psychoonkologischen Begleitung in der palliativen Phase besonders berücksichtigt werden?','Themen wie Tod und Sterben vermeiden, um Patient:innen nicht aufzuwühlen.','Auf medizinische Aspekte konzentrieren, psychische Themen erst nach Abschluss ansprechen.','Checkliste für zu klärende Angelegenheiten abgeben.','Förderung der Autonomie und Sinn- und Werteklärung anbieten.','','D'),
q(5,'2026','','Jannis Behr','Einführung in die Akzeptanz- und Commitmenttherapie','Richtig/Falsch','Bei der ACT handelt es sich um einen transdiagnostischen Ansatz der dritten Welle der Verhaltenstherapie.','Richtig','Falsch','','','','A'),
q(6,'2026','','Jannis Behr','Einführung in die Akzeptanz- und Commitmenttherapie','Richtig/Falsch','Die ACT hat zum Ziel, die Lebensqualität der Patient*innen zu verbessern.','Richtig','Falsch','','','','A'),
q(7,'2026','','Jannis Behr','Einführung in die Akzeptanz- und Commitmenttherapie','Richtig/Falsch','Die ACT orientiert sich an 6 Kernprozessen, die im Therapieprozess strikt nacheinander durchgearbeitet werden.','Richtig','Falsch','','','','B'),
q(8,'2026','','Jannis Behr','Einführung in die Akzeptanz- und Commitmenttherapie','Richtig/Falsch','Eine der einzigen Interventionen, die sich nicht gut mit ACT vereinbaren lässt, ist die Exposition.','Richtig','Falsch','','','','B'),
q(9,'2025','','Dr. phil. Armin Blickenstorfer','CBASP als Weg aus dem Dauertief','Richtig/Falsch','In der Situationsanalyse im CBASP wird bei der Revision der Interpretationen analog zur kognitiven Umstrukturierung vorgegangen.','Richtig','Falsch','','','','B'),
q(10,'2025','','Dr. phil. Armin Blickenstorfer','CBASP als Weg aus dem Dauertief','Richtig/Falsch','In der Situationsanalyse im CBASP wird bewusst auf die Erhebung der Emotionen verzichtet.','Richtig','Falsch','','','','A'),
q(11,'2025','','Dr. phil. Armin Blickenstorfer','CBASP als Weg aus dem Dauertief','Richtig/Falsch','Mit der kontingenten persönlichen Reaktion (KPR) wird im CBASP geprüft, ob die Reaktion des Patienten auf eine Situation adäquat ist.','Richtig','Falsch','','','','B'),
q(12,'2025','','Dr. phil. Armin Blickenstorfer','CBASP als Weg aus dem Dauertief','Richtig/Falsch','CBASP wurde spezifisch zur Behandlung von chronischen Depressionen entwickelt.','Richtig','Falsch','','','','A'),
q(13,'','','Stephan Goppel','Psychopharmakotherapie für Psychotherapeutinnen und Psychotherapeuten','Single Choice','Eine Patientin mit schwerer depressiver Episode wird mit SSRI behandelt. Was ist ein häufiger Grund für eine Dosisanpassung?','Unzureichende Wirkung nach zwei bis drei Wochen','Auftreten gastrointestinaler Nebenwirkungen wie Übelkeit, die nach einer Woche noch vorliegen','Entwicklung einer Abhängigkeit vom SSRI','Gleichzeitige Einnahme von Medikamenten gegen somatische Beschwerden','Gastrointestinale Nebenwirkungen allgemein','B'),
q(14,'','','Stephan Goppel','Psychopharmakotherapie für Psychotherapeutinnen und Psychotherapeuten','Single Choice','Ein Patient mit Angststörung wird mit Benzodiazepin behandelt. Was ist der wichtigste Aspekt für eine Psychotherapeutin?','Die Gefahr einer Abhängigkeitsentwicklung und die Notwendigkeit, die Behandlungsdauer zu begrenzen','Die Möglichkeit, die Dosis ohne ärztliche Rücksprache anzupassen.','Die gleichzeitige Verordnung anderer sedierender Medikamente zur Wirkungsverstärkung','Sofortige Beendigung der Behandlung bei Nebenwirkungen.','','A'),
q(15,'','','Stephan Goppel','Psychopharmakotherapie für Psychotherapeutinnen und Psychotherapeuten','Single Choice','Eine Patientin kommt mit Kopfschmerzen, Müdigkeit und Schwindel nach neuem Medikament und Stress. Wie sollten Sie vorgehen?','Sofort an einen Arzt überweisen, da Symptome möglicherweise körperlich bedingt sind.','Patientin beruhigen und Stressbewältigungsstrategien verbessern, ohne Arzt.','Patientin genau befragen und prüfen, ob Anzeichen für Nebenwirkungen vorliegen, bevor Arzt entscheidet.','Patientin auffordern, das neue Medikament sofort abzusetzen.','','C'),
q(16,'','','Stephan Goppel','Psychopharmakotherapie für Psychotherapeutinnen und Psychotherapeuten','Single Choice','Welche Grundregeln gelten gemäss Leitlinien zur Indikationsstellung für eine Behandlung depressiver Episoden?','Leichte Episoden: niedrigintensive Verfahren und/oder Psychotherapie.','Mittelgradige Episoden: Psychotherapie und/oder Psychopharmaka.','Schwere Episoden: Psychotherapie und Psychopharmaka.','Die Aussagen A, B und C sind alle korrekt.','','D'),
q(17,'2025','','Dr. phil. Dominique Holstein','Emotionsfokussierte Therapie','Single Choice','Welche Aussage zur Emotionsfokussierten Therapie ist richtig?','In der EFT gilt es über sekundäre Emotionen hin zu primär maladaptiven Emotionen zu vertiefen.','In der EFT gilt es über primär maladaptive Gefühle hin zu sekundären Emotionen zu vertiefen.','','','','A'),
q(18,'2025','','Dr. phil. Dominique Holstein','Emotionsfokussierte Therapie','Single Choice','Welche Aussage zur EFT-Theorie ist richtig?','Gemäss der EFT kann jede Emotion jedem Emotionstyp entsprechen.','Gemäss der EFT kann nicht jede Emotion jedem Emotionstyp entsprechen.','','','','A'),
q(19,'2025','','Dr. phil. Dominique Holstein','Emotionsfokussierte Therapie','Single Choice','Welche Aussage zum Transformationsprozess in der EFT ist richtig?','Im Transformationsprozess gilt: aus Altem durch Aktivierung primär adaptiver Emotionen Neues schaffen.','Der Transformationsprozess in der EFT entspricht einem Habituationsprozess.','','','','A'),
q(20,'2025','','Dr. phil. Dominique Holstein','Emotionsfokussierte Therapie','Single Choice','Was ist ein Marker in der Emotionsfokussierten Therapie?','Ein Marker ist Indikator für ein emotionales Verarbeitungsproblem und dafür, dass Klient:in gewillt ist, daran zu arbeiten.','Ein Marker ist Indikator für ein Problem und dafür, dass Klient:in nicht gewillt ist, daran zu arbeiten.','','','','A'),
q(21,'2025','','lic.phil. Florian Hug','Plananalyse und motivorientierte Beziehungsgestaltung','Richtig/Falsch','Eine Planstruktur besteht immer aus einer horizontalen Verhaltensanalyse, da das Mikroverhalten untersucht wird.','Richtig','Falsch','','','','B'),
q(22,'2025','','lic.phil. Florian Hug','Plananalyse und motivorientierte Beziehungsgestaltung','Richtig/Falsch','Die 4 Erschliessungskanäle zur Erstellung einer Plananalyse sind: Introspektive Aussagen, Interpretation des verbalen Berichtes, Erschliessen von der Emotion des Therapeuten, Interpretation des nonverbalen Verhaltens.','Richtig','Falsch','','','','A'),
q(23,'2025','','lic.phil. Florian Hug','Plananalyse und motivorientierte Beziehungsgestaltung','Richtig/Falsch','Anhand von Fragen nach verletzenden/erfreuenden Äusserungen stellen wir Planhypothesen auf und nutzen diese für die komplementäre Beziehungsgestaltung.','Richtig','Falsch','','','','A'),
q(24,'2025','','lic.phil. Florian Hug','Plananalyse und motivorientierte Beziehungsgestaltung','Richtig/Falsch','Motive: Narzisstische PS: Aufmerksamkeit; Histrionische PS: Bestätigung; Dependente PS: Sicherheit; Borderline PS: Nähe/Distanz und emotionale Validierung.','Richtig','Falsch','','','','B'),
q(25,'','Bern','Dr. phil. Simon Itten','Plananalyse und motivorientierte Beziehungsgestaltung','Richtig/Falsch','In Plananalysen werden Grundbedürfnisse, Pläne zu deren Umsetzung, instrumentelle Bezüge und manchmal Konflikte sowie Kognitionen dargestellt.','Richtig','Falsch','','','','B'),
q(26,'','Bern','Dr. phil. Simon Itten','Plananalyse und motivorientierte Beziehungsgestaltung','Richtig/Falsch','Bei der motivorientierten Beziehungsgestaltung richtet man sich primär auf verhaltensnahe Unterpläne aus, wodurch problematisches Verhalten abnimmt.','Richtig','Falsch','','','','B'),
q(27,'','Bern','Dr. phil. Simon Itten','Plananalyse und motivorientierte Beziehungsgestaltung','Richtig/Falsch','In Planstrukturen lassen sich Veränderungen über die Zeit nicht abbilden. Planstrukturen sind immer Momentaufnahmen.','Richtig','Falsch','','','','A'),
q(28,'','Bern','Dr. phil. Simon Itten','Plananalyse und motivorientierte Beziehungsgestaltung','Richtig/Falsch','Beim Erschliessen von Planstrukturen ist primär auf den verbal kommunizierten Inhalt zu achten, weniger auf nonverbale Verhaltensaspekte.','Richtig','Falsch','','','','B'),
q(29,'2025','','Verena Jaggi','Autismus-Spektrum-Störungen im Erwachsenenalter','Richtig/Falsch','Es gibt aktuell keine obligatorischen Tests für die Diagnosestellung einer ASS im Erwachsenenalter.','Richtig','Falsch','','','','A'),
q(30,'2025','','Verena Jaggi','Autismus-Spektrum-Störungen im Erwachsenenalter','Richtig/Falsch','Imaginationsverfahren eignen sich gut in der Therapie mit Menschen auf dem Autismus-Spektrum.','Richtig','Falsch','','','','B'),
q(31,'2025','','Verena Jaggi','Autismus-Spektrum-Störungen im Erwachsenenalter','Richtig/Falsch','Autismusspezifische Gruppentherapie zum Training sozialer Kompetenz reduziert nachweislich die autistische Symptomatik.','Richtig','Falsch','','','','A'),
q(32,'2025','','Verena Jaggi','Autismus-Spektrum-Störungen im Erwachsenenalter','Richtig/Falsch','Autistische Kernsymptome umfassen Defizite in der sozialen Kommunikation, exekutive Defizite und Beeinträchtigung der Stimmung.','Richtig','Falsch','','','','B'),
q(33,'2026','','Dr. med. Peter N. Kissling','Psychopharmakotherapie','Richtig/Falsch','Bei schweren depressiven Episoden ist eine psychopharmakologische Therapie in der Regel sicher indiziert.','Richtig','Falsch','','','','A'),
q(34,'2026','','Dr. med. Peter N. Kissling','Psychopharmakotherapie','Richtig/Falsch','Antidepressiva wirken ausschliesslich bei Depressionen und haben keine Wirksamkeit bei anderen psychischen oder somatischen Störungen.','Richtig','Falsch','','','','B'),
q(35,'2026','','Dr. med. Peter N. Kissling','Psychopharmakotherapie','Richtig/Falsch','Die Erhaltungstherapie bei Antidepressiva oder Antipsychotika sollte nicht länger als 3 Monate dauern.','Richtig','Falsch','','','','B'),
q(36,'2026','','Dr. med. Peter N. Kissling','Psychopharmakotherapie','Richtig/Falsch','Ein abruptes Absetzen von SSRI kann zu Absetzsymptomen wie Schwindel, Stimmungsschwankungen und Schlafstörungen führen.','Richtig','Falsch','','','','A'),
q(37,'2025','','Prof. Dr. Ueli Kramer','Einführung in die Psychotherapie der Persönlichkeitsstörungen','Richtig/Falsch','Die Diagnose der Persönlichkeitsstörungen gemäss ICD-11 umfasst obligatorisch nur die fünf Traitdomänen.','Richtig','Falsch','','','','B'),
q(38,'2025','','Prof. Dr. Ueli Kramer','Einführung in die Psychotherapie der Persönlichkeitsstörungen','Richtig/Falsch','Klärende Interventionen unterstützen in den meisten Fällen die interpersonale Effektivität der KlientInnen mit Persönlichkeitsstörungen.','Richtig','Falsch','','','','A'),
q(39,'2025','','Prof. Dr. Ueli Kramer','Einführung in die Psychotherapie der Persönlichkeitsstörungen','Richtig/Falsch','Dialektisch-Behaviorale Interventionen unterstützen vor allem die Stabilisierung des Selbstwertes und der Identität.','Richtig','Falsch','','','','B'),
q(40,'2025','','Prof. Dr. Ueli Kramer','Einführung in die Psychotherapie der Persönlichkeitsstörungen','Richtig/Falsch','Wirksame klärende Interventionen setzen immer eine emotionale Aktivierung voraus.','Richtig','Falsch','','','','A'),
q(41,'','','Hans Lieb','Systemische Paar- und Familientherapie','Richtig/Falsch','Funktionale Erklärungen im systemischen Ansatz sehen in Symptomen eine Lösung für ein Problem, das in der Therapie erst identifiziert werden muss.','Richtig','Falsch','','','','A'),
q(42,'','','Hans Lieb','Systemische Paar- und Familientherapie','Richtig/Falsch','Die moderne Systemtherapie hat sich vom Konstruktivismus als philosophisch-erkenntnistheoretischer Basis aufgrund neuerer Forschungsergebnisse verabschiedet.','Richtig','Falsch','','','','B'),
q(43,'','','Hans Lieb','Systemische Paar- und Familientherapie','Richtig/Falsch','In einem zirkulären Interaktionsmuster gilt: auf Verhalten a von Person X reagiert Person Y mit Verhalten b und darauf Person X wiederum mit Verhalten a usw.','Richtig','Falsch','','','','A'),
q(44,'','','Hans Lieb','Systemische Paar- und Familientherapie','Richtig/Falsch','Beim Reframing wird ein üblicherweise negativ bewertetes Verhalten in einen Kontext gestellt, in dem es eine positive Funktion hat und positiv bewertet wird.','Richtig','Falsch','','','','A'),
q(45,'2025','','Christian Lorenz','Integrative Psychotherapie bei Abhängigkeitserkrankungen','Single Choice','Welche Aussage beschreibt die Grundhaltung im Umgang mit Abhängigkeitserkrankungen am besten?','Klare Konfrontation und strikte Vorgaben, um Rückfälle zu verhindern','Empathie, Ressourcenorientierung und Respekt vor der Autonomie der Betroffenen','Konsequente Abstinenzforderung','Fokus auf Defizite und Fehlverhalten','','B'),
q(46,'2025','','Christian Lorenz','Integrative Psychotherapie bei Abhängigkeitserkrankungen','Single Choice','Welcher Grundsatz gehört NICHT zu einer evidenzbasierten Rückfallprävention?','Identifikation von Hochrisikosituationen','Förderung von Bewältigungsstrategien','Förderung sozialer Unterstützung','Negative Konsequenz bei Konsumereignissen','','D'),
q(47,'2025','','Christian Lorenz','Integrative Psychotherapie bei Abhängigkeitserkrankungen','Single Choice','Welches Ziel steht im Zentrum von Schadensminderungsstrategien bei intravenösem Drogenkonsum?','Vollständige Abstinenz in kürzester Zeit','Reduktion der Konsumhäufigkeit','Vermeidung von Infektionskrankheiten und Überdosierungen','Substitution durch andere illegale Substanzen','','C'),
q(48,'2025','','Christian Lorenz','Integrative Psychotherapie bei Abhängigkeitserkrankungen','Single Choice','Welcher Ansatz wird bei komorbider PTBS und Sucht im Rahmen integrativer Therapie empfohlen?','Zuerst vollständige Abstinenz, dann Traumatherapie','Parallele und verknüpfte Behandlung beider Störungsbilder','Traumatherapie nur in stabiler Abstinenz','Vollständige Fokussierung auf das Trauma','','B'),
q(49,'2025','','Dr. phil. Yoan Mihov','Essstörungen','Single Choice','Im Rahmen welcher Essstörungen können Essanfälle auftreten?','Anorexia nervosa und Bulimia nervosa, nicht bei Binge-Eating-Störung','Bulimia nervosa und Binge-Eating-Störung, nicht bei Anorexia nervosa','Binge-Eating-Störung und Anorexia nervosa, nicht bei Bulimia nervosa','Anorexia nervosa, Bulimia nervosa und Binge-Eating-Störung','','D'),
q(50,'2025','','Dr. phil. Yoan Mihov','Essstörungen','Single Choice','Welche Essstörung weist den frühesten typischen Beginn in der Lebensspanne auf?','Anorexia nervosa beginnt am frühesten','Bulimia nervosa beginnt am frühesten','Binge-Eating-Störung beginnt am frühesten','Alle drei beginnen typischerweise im selben Alter','','A'),
q(51,'2025','','Dr. phil. Yoan Mihov','Essstörungen','Single Choice','Ein Mann mit Binge-Eating-Störung isst nach einem Streit sehr viel; Ohnmacht und Frustration nehmen ab. Diese Wirkung des Essanfalls entspricht:','Einer positiven Verstärkung','Einer negativen Verstärkung','Einer Bestrafung','Einer Habituation','','B'),
q(52,'2025','','Dr. phil. Yoan Mihov','Essstörungen','Single Choice','Welche Behandlung wird laut S3-Leitlinie als erste Wahl bei Bulimia nervosa empfohlen?','Psychotherapie, erste Wahl: Interpersonelle Psychotherapie (IPT)','Psychotherapie, erste Wahl: Kognitive Verhaltenstherapie (KVT)','Kombinierte Behandlung mit IPT und Fluoxetin','Kombinierte Behandlung mit KVT und Fluoxetin','','B'),
q(53,'2025','','Dr. Jörg Petry','Sucht','Richtig/Falsch','Ist die Toleranzsteigerung ein Kriterium für eine Alkoholnutzungs-Störung?','Richtig','Falsch','','','','A'),
q(54,'2025','','Dr. Jörg Petry','Sucht','Richtig/Falsch','Dienen psychotrope Substanzen dazu, Emotionen zu regulieren?','Richtig','Falsch','','','','A'),
q(55,'2025','','Dr. Jörg Petry','Sucht','Richtig/Falsch','Wird süchtiges Glücksspielen im ICD-11 unter Impulskontrollstörungen klassifiziert?','Richtig','Falsch','','','','B'),
q(56,'2025','','Dr. Jörg Petry','Sucht','Richtig/Falsch','Handelt es sich bei exzessivem Sporttreiben um eine Sucht?','Richtig','Falsch','','','','B'),
q(57,'2025','','Marina Poppinger','Einführung Schematherapie','Richtig/Falsch','Maladaptive Schemata entstehen in der Kindheit durch unzureichend erfüllte Grundbedürfnisse und waren damals oft eine sinnvolle Anpassung.','Richtig','Falsch','','','','A'),
q(58,'2025','','Marina Poppinger','Einführung Schematherapie','Richtig/Falsch','Ein Modus beschreibt einen aktuellen, sichtbaren Erlebenszustand, während ein Schema im Hintergrund wirkt und nicht direkt erkennbar ist.','Richtig','Falsch','','','','A'),
q(59,'2025','','Marina Poppinger','Einführung Schematherapie','Richtig/Falsch','In der emotionsfokussierten Arbeit wird die Sacherinnerung an ein Ereignis verändert, um das Schema aufzulösen.','Richtig','Falsch','','','','B'),
q(60,'2025','','Marina Poppinger','Einführung Schematherapie','Richtig/Falsch','Die Schemata der Domänen I und II sind besonders relevant für die Gestaltung einer stabilen und wirksamen Therapiebeziehung.','Richtig','Falsch','','','','A'),
q(61,'2025','','Monika Renz','Sterbeprozesse','Single Choice','Welche Aussage ist richtig?','Sterbende kommunizieren nonverbal.','Sterbende können sich nicht mehr ausdrücken.','','','','A'),
q(62,'2025','','Monika Renz','Sterbeprozesse','Single Choice','Welche Aussage über das Bewusstsein Sterbender ist richtig?','Sterbende pendeln zwischen Alltagsbewusstsein und einem anderen Bewusstseinszustand hin und her.','Sterbende sind nicht mehr da; Hirnregionen sind schon teilweise tot.','','','','A'),
q(63,'2025','','Monika Renz','Sterbeprozesse','Single Choice','Können sterbende Menschen noch Würde erfahren, auch wenn sie nicht mehr immer im Ich präsent sind?','Ja, Sterbende können Würde erfahren, auch wenn sie nicht immer im Ich präsent sind.','Nein, der Mensch verliert dort, wo er nicht mehr über sich bestimmen kann, seine ganze Würde.','','','','A'),
q(64,'2025','','Monika Renz','Sterbeprozesse','Ja/Nein','Kann Vergebung und Loslassen das Sterben und das Zurückbleiben der Angehörigen erleichtern?','Ja','Nein','','','','A'),
q(65,'2025','','Dr. phil. Kristina Rohde','Akut- und Krisensituationen','Ja/Nein','Ist der erste Schritt in einer Akut- oder Krisensituation, die mögliche Gefahr für mich selbst abzuschätzen?','Ja','Nein','','','','A'),
q(66,'2025','','Dr. phil. Kristina Rohde','Akut- und Krisensituationen','Ja/Nein','Ist ein Delir ein potentiell lebensbedrohlicher Zustand?','Ja','Nein','','','','A'),
q(67,'2025','','Dr. phil. Kristina Rohde','Akut- und Krisensituationen','Ja/Nein','Muss man in der Akutsituation immer das Suizidrisiko einschätzen?','Ja','Nein','','','','A'),
q(68,'2025','','Dr. phil. Kristina Rohde','Akut- und Krisensituationen','Ja/Nein','Ist die Aktivierung von bestehenden Ressourcen und Bewältigungsstrategien Teil einer Krisenintervention?','Ja','Nein','','','','A'),
q(69,'2025','','Dr. phil. Kristina Rohde','Therapiemotivation','Ja/Nein','Kann man Veränderungsbereitschaft zu Beginn einer Therapie durch Motivational Interviewing gezielt fördern?','Ja','Nein','','','','A'),
q(70,'2025','','Dr. phil. Kristina Rohde','Therapiemotivation','Ja/Nein','Kann man Besserungserwartung zu Beginn einer Therapie durch hoffnungssteigernde Äusserungen gezielt fördern?','Ja','Nein','','','','A'),
q(71,'2025','','Dr. phil. Kristina Rohde','Therapiemotivation','Ja/Nein','Muss die Veränderungsmotivation auch im Verlauf der Therapie gefördert werden?','Ja','Nein','','','','A'),
q(72,'2025','','Dr. phil. Kristina Rohde','Therapiemotivation','Ja/Nein','Kann die gelungene Reparation von Brüchen in der therapeutischen Beziehung zu einem besseren Therapieergebnis beitragen?','Ja','Nein','','','','A'),
q(73,'2026','','Andrea Rotter','Schwierige Therapiesituationen','Multiple Choice','Welche Aspekte werden im Selbstverbalisationsmodell erläutert?','Gedanken','Impuls','Verhalten','Notfallplan','','A;C'),
q(74,'2026','','Andrea Rotter','Schwierige Therapiesituationen','Multiple Choice','Welche Strategien helfen im Umgang mit herausfordernden PatientInnen?','Keine Grenzen setzen','Sporadische Termine','Empathie','Kongruenz','','C;D'),
q(75,'2026','','Andrea Rotter','Schwierige Therapiesituationen','Multiple Choice','Wie zeigt sich Therapeuten-Sicherheit?','Keine Unsicherheit zeigen','Authentisch sein','Sich durchsetzen','Aufrechte Körperhaltung','','B;D'),
q(76,'2026','','Andrea Rotter','Schwierige Therapiesituationen','Multiple Choice','Wie funktioniert Gegenübertragung?','Die Projektion des Patienten auf die Therapeutin','Die Fähigkeit zur Emotionsregulation des Patienten','Die Reaktion der Therapeutin auf die Übertragung des Patienten','Gegenübertragung ist eine Art Sympathie zwischen Therapeut und Patient','','A;C'),
q(77,'2025','','Dr. phil. Armita Tschitsaz','Diagnostik und Therapie von Ess- und Gewichtsstörungen','Single Choice','Welche Interventionen sind Beispiele für eine interdisziplinäre Diagnostik und Therapie bei Essstörungen?','Medizinische Überwachung (internistische Untersuchung, Blutbildkontrolle)','Psychotherapie, Ernährungsberatung und hausärztliches Monitoring','Soziokulturelle Medienanalyse in Eigenarbeit ohne fachliche Begleitung','Physiotherapie zur Unterstützung der körperlichen Stabilisierung','','B'),
q(78,'2025','','Dr. phil. Armita Tschitsaz','Diagnostik und Therapie von Ess- und Gewichtsstörungen','Single Choice','Welcher Aspekt beschreibt die Eigendynamik einer Essstörung am zutreffendsten?','Die genetische Prädisposition, die unabhängig von Umweltfaktoren wirkt.','Der Einfluss von soziokulturellen Schönheitsidealen auf das Selbstbild.','Die Aufrechterhaltung durch das Zusammenspiel von Symptomen, Gedanken und Verhaltensmustern.','','','C'),
q(79,'2025','','Dr. phil. Armita Tschitsaz','Diagnostik und Therapie von Ess- und Gewichtsstörungen','Single Choice','Welches Ziel verfolgen Exposure-Verfahren in der Behandlung von Ess- und Gewichtsstörungen?','Systematische Konfrontation mit angstinduzierenden Situationen zur Reduktion der emotionalen Reaktion.','Vermeidung sämtlicher Essenssituationen, die Heisshungeranfälle auslösen könnten.','Direkte Reduktion der Kalorienaufnahme.','Sofortige Unterdrückung des Appetits durch pharmakologische Intervention.','','A'),
q(80,'2025','','Dr. phil. Armita Tschitsaz','Diagnostik und Therapie von Ess- und Gewichtsstörungen','Single Choice','Welcher Punkt beschreibt den zentralen Wirkfaktor der Familientherapie bei Essstörungen?','Vermeidung konfliktbelasteter Themen zur Reduktion familiärer Spannungen','Verbesserung der familiären Kommunikation und Förderung gemeinsamer Problemlösefähigkeiten','Strikte Kontrolle der Nahrungsaufnahme durch Angehörige','Individuelle Bewältigungsstrategien ohne Einbezug der Familie','','B'),
q(81,'2025','','Dr. phil. Armita Tschitsaz','Diagnostik und Therapie von Ess- und Gewichtsstörungen','Multiple Choice','Warum erweisen sich Methoden wie CFT in der Behandlung von Essstörungen als wirksam?','Sie zielen darauf ab, das Essverhalten durch strenge Verhaltensregeln zu kontrollieren.','Sie fokussieren auf emotionale Themen und die physiologische Hunger- und Sättigungsregulation.','Sie fördern die Wahrnehmung eigener Gefühle und reduzieren selbstkritische Gedanken.','Sie sind so evidenzbasiert, dass andere Therapieformen nicht mehr erforderlich sind.','','B;C'),
q(82,'2025','','Dr. phil. Daniel Zehnder','Einführung in die Problem- und Verhaltensanalyse, Therapieplanung und Falldokumentation','Richtig/Falsch','In der kognitiven Verhaltenstherapie sind Problem- und Verhaltensanalysen nicht unbedingt nötig für ein vertieftes Fallverständnis.','Richtig','Falsch','','','','B'),
q(83,'2025','','Dr. phil. Daniel Zehnder','Einführung in die Problem- und Verhaltensanalyse, Therapieplanung und Falldokumentation','Richtig/Falsch','Bei der Erstellung einer Verhaltensanalyse gemäss SORKC-Modell macht es am meisten Sinn, bei der Stimulus-Variablen zu beginnen.','Richtig','Falsch','','','','B'),
q(84,'2025','','Dr. phil. Daniel Zehnder','Einführung in die Problem- und Verhaltensanalyse, Therapieplanung und Falldokumentation','Richtig/Falsch','Besonders die kurzfristigen Konsequenzen einer Verhaltensanalyse beeinflussen zukünftiges Problemverhalten.','Richtig','Falsch','','','','A'),
q(85,'2025','','Dr. phil. Daniel Zehnder','Einführung in die Problem- und Verhaltensanalyse, Therapieplanung und Falldokumentation','Richtig/Falsch','Die Funktionalität von Symptomen lässt sich in intraindividuelle und interaktionelle Funktionen unterscheiden.','Richtig','Falsch','','','','A'),
q(86,'2025','','Fanny de Tribolet-Hardy','Sexuelle Störungen','Richtig/Falsch','Das ICD-11 definiert keine zeitlichen Vorgaben zur Diagnostik der Ejakulationsstörung.','Richtig','Falsch','','','','A'),
q(87,'2025','','Fanny de Tribolet-Hardy','Sexuelle Störungen','Richtig/Falsch','Soziokulturelle Faktoren (Familie, Religion) spielen im Fallkonzept zu sexuellen Funktionsstörungen keine Rolle.','Richtig','Falsch','','','','B'),
q(88,'2025','','Fanny de Tribolet-Hardy','Sexuelle Störungen','Richtig/Falsch','Eine paraphile Störung unterscheidet sich von einer Paraphilie dadurch, dass das Interesse erheblichen Leidensdruck, Fremdgefährdung oder soziale Beeinträchtigung begründet.','Richtig','Falsch','','','','A'),
q(89,'2025','','Fanny de Tribolet-Hardy','Sexuelle Störungen','Richtig/Falsch','Die Diagnose Compulsive Sexual Behavior Disorder im ICD-11 definiert sich anhand der Anzahl sexueller Aktivitäten pro Woche.','Richtig','Falsch','','','','B'),
];

const mod=(year='',lecturer='',course='')=>({year,lecturer,course});
const sem=(nr,modules=[])=>({sem:nr,modules:Array.from({length:MODULES_PER_SEMESTER},(_,i)=>({year:'',lecturer:'',course:'',...(modules[i]||{})}))});
const INIT_P=[
{id:1,name:'WBS 55 (2020)',startYear:'2024',startTerm:'HS',semesters:[
  sem(1,[mod('2025','Dr. Jörg Petry','Sucht'),mod('2026','Jannis Behr','Einführung in die Akzeptanz- und Commitmenttherapie'),mod('2025','Dr. phil. Armin Blickenstorfer','CBASP als Weg aus dem Dauertief'),mod('','Stephan Goppel','Psychopharmakotherapie für Psychotherapeutinnen und Psychotherapeuten')]),
  sem(2,[mod('2025','Dr. phil. Dominique Holstein','Emotionsfokussierte Therapie'),mod('2025','lic.phil. Florian Hug','Plananalyse und motivorientierte Beziehungsgestaltung'),mod('2025','Verena Jaggi','Autismus-Spektrum-Störungen im Erwachsenenalter'),mod('2026','Dr. med. Peter N. Kissling','Psychopharmakotherapie')]),
  sem(3,[mod('2025','Prof. Dr. Ueli Kramer','Einführung in die Psychotherapie der Persönlichkeitsstörungen'),mod('','Hans Lieb','Systemische Paar- und Familientherapie'),mod('2025','Christian Lorenz','Integrative Psychotherapie bei Abhängigkeitserkrankungen'),mod('2025','Dr. phil. Yoan Mihov','Essstörungen')]),
  sem(4,[mod('2025','Dr. Jörg Petry','Sucht'),mod('2025','Marina Poppinger','Einführung Schematherapie'),mod('2025','Monika Renz','Sterbeprozesse'),mod('2025','Dr. phil. Kristina Rohde','Akut- und Krisensituationen')]),
  sem(5,[mod('2025','Dr. phil. Kristina Rohde','Therapiemotivation'),mod('2026','Andrea Rotter','Schwierige Therapiesituationen'),mod('2025','Dr. phil. Armita Tschitsaz','Diagnostik und Therapie von Ess- und Gewichtsstörungen'),mod('2025','Dr. phil. Daniel Zehnder','Einführung in die Problem- und Verhaltensanalyse, Therapieplanung und Falldokumentation')]),
  sem(6,[mod('2025','Fanny de Tribolet-Hardy','Sexuelle Störungen'),mod('','',''),mod('','',''),mod('','','')]),
]},
{id:2,name:'WBS Zürich (Gruppe 2)',startYear:'2025',startTerm:'FS',semesters:[
  sem(1,[mod('2026','Jannis Behr','Einführung in die Akzeptanz- und Commitmenttherapie'),mod('2025','Dr. Jörg Petry','Sucht'),mod('2025','Dr. phil. Dominique Holstein','Emotionsfokussierte Therapie'),mod('2025','Prof. Dr. Ueli Kramer','Einführung in die Psychotherapie der Persönlichkeitsstörungen')]),
  sem(2,[mod('2025','lic.phil. Florian Hug','Plananalyse und motivorientierte Beziehungsgestaltung'),mod('2025','Verena Jaggi','Autismus-Spektrum-Störungen im Erwachsenenalter'),mod('','Hans Lieb','Systemische Paar- und Familientherapie'),mod('2025','Marina Poppinger','Einführung Schematherapie')]),
  sem(3,[mod('2026','Andrea Rotter','Schwierige Therapiesituationen'),mod('2025','Dr. phil. Kristina Rohde','Therapiemotivation'),mod('2025','Christian Lorenz','Integrative Psychotherapie bei Abhängigkeitserkrankungen'),mod('2025','Dr. phil. Yoan Mihov','Essstörungen')]),
  sem(4,[mod('2025','Monika Renz','Sterbeprozesse'),mod('2025','Dr. phil. Kristina Rohde','Akut- und Krisensituationen'),mod('2025','Dr. phil. Armita Tschitsaz','Diagnostik und Therapie von Ess- und Gewichtsstörungen'),mod('2025','Dr. phil. Daniel Zehnder','Einführung in die Problem- und Verhaltensanalyse, Therapieplanung und Falldokumentation')]),
  sem(5,[mod('2025','Fanny de Tribolet-Hardy','Sexuelle Störungen'),mod('','',''),mod('','',''),mod('','','')]),
  sem(6,[mod('','',''),mod('','',''),mod('','',''),mod('','','')]),
]},
{id:3,name:'WBS Bern (Gruppe 3)',startYear:'2025',startTerm:'HS',semesters:[
  sem(1,[mod('2025','Dr. phil. Armin Blickenstorfer','CBASP als Weg aus dem Dauertief'),mod('2025','Verena Jaggi','Autismus-Spektrum-Störungen im Erwachsenenalter'),mod('2025','Christian Lorenz','Integrative Psychotherapie bei Abhängigkeitserkrankungen'),mod('2025','Monika Renz','Sterbeprozesse')]),
  sem(2,[mod('2025','Dr. phil. Armita Tschitsaz','Diagnostik und Therapie von Ess- und Gewichtsstörungen'),mod('2025','Dr. Jörg Petry','Sucht'),mod('2025','Dr. phil. Dominique Holstein','Emotionsfokussierte Therapie'),mod('2025','Prof. Dr. Ueli Kramer','Einführung in die Psychotherapie der Persönlichkeitsstörungen')]),
  sem(3,[mod('2025','Dr. phil. Kristina Rohde','Therapiemotivation'),mod('2025','Marina Poppinger','Einführung Schematherapie'),mod('2025','Dr. phil. Kristina Rohde','Akut- und Krisensituationen'),mod('2025','Dr. phil. Daniel Zehnder','Einführung in die Problem- und Verhaltensanalyse, Therapieplanung und Falldokumentation')]),
  sem(4,[mod('2025','Fanny de Tribolet-Hardy','Sexuelle Störungen'),mod('','',''),mod('','',''),mod('','','')]),
  sem(5,[mod('','',''),mod('','',''),mod('','',''),mod('','','')]),
  sem(6,[mod('','',''),mod('','',''),mod('','',''),mod('','','')]),
]},
{id:4,name:'WBS Basel (Gruppe 4)',startYear:'2026',startTerm:'FS',semesters:[
  sem(1,[mod('','Stephan Goppel','Psychopharmakotherapie für Psychotherapeutinnen und Psychotherapeuten'),mod('2026','Dr. med. Peter N. Kissling','Psychopharmakotherapie'),mod('2025','Dr. phil. Yoan Mihov','Essstörungen'),mod('2025','Dr. phil. Kristina Rohde','Akut- und Krisensituationen')]),
  sem(2,[mod('2025','Dr. phil. Daniel Zehnder','Einführung in die Problem- und Verhaltensanalyse, Therapieplanung und Falldokumentation'),mod('2025','Dr. Jörg Petry','Sucht'),mod('2025','Dr. phil. Dominique Holstein','Emotionsfokussierte Therapie'),mod('2025','Prof. Dr. Ueli Kramer','Einführung in die Psychotherapie der Persönlichkeitsstörungen')]),
  sem(3,[mod('','',''),mod('','',''),mod('','',''),mod('','','')]),
  sem(4,[mod('','',''),mod('','',''),mod('','',''),mod('','','')]),
  sem(5,[mod('','',''),mod('','',''),mod('','',''),mod('','','')]),
  sem(6,[mod('','',''),mod('','',''),mod('','',''),mod('','','')]),
]},
];

const currentAcademicTag=()=>{
  const now=new Date();
  return{year:String(now.getFullYear()),term:now.getMonth()+1>=8?'HS':'FS'};
};

export function abbreviateCourseName(course=''){
  const text=String(course||'').trim();
  if(!text) return '';
  const normalized=text
    .replace(/[()/,:]+/g,' ')
    .replace(/[-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  const words=normalized.split(' ').filter(Boolean);
  const stopWords=new Set(['in','und','der','die','das','des','dem','den','von','vom','für','mit','zu','zur','zum','am','an','auf','bei','im','als','oder']);
  const coreWords=words.filter(word=>!stopWords.has(word.toLowerCase()));
  const source=coreWords.length?coreWords:words;
  const initialism=source
    .map(word=>{
      const upper=word.match(/[A-ZÄÖÜ]{2,}/g)?.[0];
      if(upper) return upper;
      return word[0]?.toUpperCase()||'';
    })
    .join('');
  if(initialism.length>=2 && initialism.length<=12) return initialism;
  const shortened=source.slice(0,3).map(word=>word.slice(0,4)).join(' · ');
  return shortened || text.slice(0,12);
}

// Compact form of a Weiterbildungsgang's name for in-row display. Strips
// trailing parentheticals — "WBS 55 (2020)" → "WBS 55", "WBS Zürich
// (Gruppe 2)" → "WBS Zürich" — so chips stay readable in narrow cells.
function shortProgramName(name=''){
  return String(name||'').replace(/\s*\([^)]*\)\s*$/,'').trim()||String(name||'').trim();
}

// Return the list of Weiterbildungsgänge a question belongs to, based on the
// EXPLICIT course-level tags stored in courseTags (a map: courseName ->
// [wbgId, ...]). Previously this matched course/lecturer/year against WBG
// modules; that implicit relationship is now replaced by the explicit tag
// so users can manage memberships from the Kurs-Übersicht page directly.
//
// Returns [] for questions whose course has no tag entry (e.g. a brand-new
// course before its first save), or whose course doesn't match any active
// program ID.
function programsForQuestion(question,programs,courseTags){
  if(!question || !Array.isArray(programs) || !courseTags) return [];
  const ids=courseTags[question.course];
  if(!Array.isArray(ids) || !ids.length) return [];
  const idSet=new Set(ids.map(String));
  return programs
    .filter(p=>idSet.has(String(p.id)))
    .map(p=>({id:p.id,name:p.name}));
}

// Build the initial courseTags map by computing memberships from the OLD
// implicit rule (course/lecturer/year vs. WBG modules). Used exactly once
// on first launch of v1.0.13 to migrate existing data; after that, tags are
// explicit and edited via the Kurs-Übersicht page or the question form.
function migrateCourseTagsFromMatrix(questions,programs){
  const out={};
  if(!Array.isArray(questions) || !Array.isArray(programs)) return out;
  const uniqueCourses=[...new Set(questions.map(q=>q.course).filter(Boolean))];
  for(const course of uniqueCourses){
    const wbgIds=[];
    for(const p of programs){
      let hit=false;
      for(const s of (p.semesters||[])){
        for(const m of (s.modules||[])){
          if(m.course===course){ hit=true; break; }
        }
        if(hit) break;
      }
      if(hit) wbgIds.push(p.id);
    }
    out[course]=wbgIds;
  }
  return out;
}

// Compute each semester's expected (term, year) given a WBG's start. Used
// by autofill to place a course in the semester whose academic year matches
// the course's most-common year.
//   HS-Start (Y): sem 1=HS Y, 2=FS Y+1, 3=HS Y+1, 4=FS Y+2, 5=HS Y+2, 6=FS Y+3
//   FS-Start (Y): sem 1=FS Y, 2=HS Y,   3=FS Y+1, 4=HS Y+1, 5=FS Y+2, 6=HS Y+2
function semesterCalendarFor(program){
  const yearRaw=Number(program.startYear);
  const baseYear=Number.isFinite(yearRaw)&&yearRaw>1900?yearRaw:Number(currentAcademicTag().year);
  const startIsHS=program.startTerm==='HS';
  const out=[];
  for(let i=0;i<SEMESTER_COUNT;i++){
    let term,year;
    if(startIsHS){
      term=i%2===0?'HS':'FS';
      year=baseYear+Math.ceil(i/2);
    }else{
      term=i%2===0?'FS':'HS';
      year=baseYear+Math.floor(i/2);
    }
    out.push({term,year:String(year)});
  }
  return out;
}

// Best-effort autofill of a WBG's 6x4 module matrix from the courses tagged
// for that WBG. Existing modules are PRESERVED — only empty slots get
// filled. Each tagged course picks up its most-common (year, lecturer)
// values from existing questions in the database, then lands in the
// semester whose calendar year matches, falling back to the first empty
// slot anywhere. Returns { semesters, stats } or null if there are no
// tagged courses at all.
//
// Limitations (surfaced to the user via Hinweis text):
//   - Questions don't track HS vs FS within a year, so within a year we
//     just take the first matching semester (sem 1 if HS-start, sem 1 if
//     FS-start — both fit year Y).
//   - If multiple tagged courses share a year, alphabetical fills
//     ascending — won't always match the institute's actual teaching plan.
//   - Skips courses already present anywhere in the matrix.
function autofillModulesForProgram(program,courseTags,questions){
  if(!program || !courseTags) return null;
  const programId=String(program.id);
  const taggedCourses=Object.entries(courseTags)
    .filter(([_,ids])=>Array.isArray(ids)&&ids.map(String).includes(programId))
    .map(([course])=>course);
  if(!taggedCourses.length) return null;

  // Determine each tagged course's preferred (year, lecturer) from the
  // database. Pick the most-common values across questions of that course.
  const mostCommon=obj=>{
    const entries=Object.entries(obj).sort((a,b)=>b[1]-a[1]);
    return entries[0]?.[0]||'';
  };
  const courseMeta={};
  for(const course of taggedCourses){
    const qs=(questions||[]).filter(q=>q.course===course);
    const yC={}; const lC={};
    qs.forEach(q=>{
      if(q.year) yC[q.year]=(yC[q.year]||0)+1;
      if(q.lecturer) lC[q.lecturer]=(lC[q.lecturer]||0)+1;
    });
    courseMeta[course]={year:mostCommon(yC),lecturer:mostCommon(lC)};
  }

  // Calendar for this WBG: { sem index → expected year string }
  const calendar=semesterCalendarFor(program);

  // Work on a deep-ish copy so we don't mutate the input
  const newSemesters=(program.semesters||[]).map(s=>({
    sem:s.sem,
    modules:(s.modules||[]).map(m=>({...m})),
  }));

  // Sort by year ascending (blank year last), alphabetical tie-break.
  const sortedCourses=[...taggedCourses].sort((a,b)=>{
    const yA=courseMeta[a].year||'9999';
    const yB=courseMeta[b].year||'9999';
    if(yA!==yB) return yA.localeCompare(yB);
    return a.localeCompare(b);
  });

  const stats={placed:0,alreadyPresent:0,skipped:0};
  const placedInSemester=[]; // for the toast detail
  for(const course of sortedCourses){
    // If this course is already a module somewhere in the matrix, skip.
    const present=newSemesters.some(s=>(s.modules||[]).some(m=>m.course===course));
    if(present){ stats.alreadyPresent++; continue; }

    const meta=courseMeta[course];
    let targetSemIdx=-1;
    // Prefer the semester whose academic year matches the course's preferred year.
    if(meta.year){
      for(let i=0;i<calendar.length;i++){
        if(calendar[i].year===meta.year){
          const emptyIdx=newSemesters[i].modules.findIndex(m=>!m.course);
          if(emptyIdx!==-1){ targetSemIdx=i; break; }
        }
      }
    }
    // Fallback: first empty slot anywhere.
    if(targetSemIdx===-1){
      for(let i=0;i<newSemesters.length;i++){
        const emptyIdx=newSemesters[i].modules.findIndex(m=>!m.course);
        if(emptyIdx!==-1){ targetSemIdx=i; break; }
      }
    }
    if(targetSemIdx===-1){ stats.skipped++; continue; }
    const emptyIdx=newSemesters[targetSemIdx].modules.findIndex(m=>!m.course);
    newSemesters[targetSemIdx].modules[emptyIdx]={
      course,
      year:meta.year||'',
      lecturer:meta.lecturer||'',
    };
    placedInSemester.push({course,sem:targetSemIdx+1});
    stats.placed++;
  }

  return {semesters:newSemesters,stats,placedInSemester};
}

const emptyModule=()=>({year:'',lecturer:'',course:''});
const emptySemester=n=>({sem:n,modules:Array.from({length:MODULES_PER_SEMESTER},()=>emptyModule())});
const createProgram=(id,name,startYear=currentAcademicTag().year,startTerm=currentAcademicTag().term)=>({
  id,name,startYear,startTerm,semesters:Array.from({length:SEMESTER_COUNT},(_,i)=>emptySemester(i+1))
});

const normalizePrograms=programs=>(programs||[]).map((p,idx)=>({
  id:p.id||Date.now()+idx,
  name:p.name||`Weiterbildungsgang ${idx+1}`,
  startYear:String(p.startYear||currentAcademicTag().year),
  startTerm:p.startTerm==='HS'?'HS':'FS',
  semesters:Array.from({length:SEMESTER_COUNT},(_,i)=>{
    const found=(p.semesters||[]).find(s=>Number(s.sem)===i+1)||{};
    if(Array.isArray(found.modules)){
      return{
        sem:i+1,
        modules:Array.from({length:MODULES_PER_SEMESTER},(_,m)=>({year:'',lecturer:'',course:'',...(found.modules[m]||{})}))
      };
    }
    const legacyCourse=found.course||'';
    return{
      sem:i+1,
      modules:Array.from({length:MODULES_PER_SEMESTER},(_,m)=>m===0?{
        year:found.year||'',
        lecturer:found.lecturer||'',
        course:legacyCourse
      }:emptyModule())
    };
  })
}));

// ─── Export helpers ───────────────────────────────────────────────────────────
function buildTxt(qs){
  return qs.map((q,i)=>{
    const correct=q.answer?q.answer.split(';'):[];
    const opts=[{k:'A',t:q.optA},{k:'B',t:q.optB},{k:'C',t:q.optC},{k:'D',t:q.optD},{k:'E',t:q.optE}].filter(o=>o.t);
    let s=`${i+1}. ${q.question}\n\n`;
    opts.forEach(o=>{
      const lbl=o.k.toLowerCase();
      s+=correct.includes(o.k)?`**${lbl}) ${o.t}**\n`:`${lbl}) ${o.t}\n`;
    });
    return s+'\n';
  }).join('');
}

function dlFile(content,name,type='text/plain;charset=utf-8'){
  const b=new Blob([content],{type});
  const u=URL.createObjectURL(b);
  const a=Object.assign(document.createElement('a'),{href:u,download:name});
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);
}

function buildSemesterOverviewEntries(programs){
  const rows=[];
  programs.forEach(program=>{
    (program.semesters||[]).forEach((semester,semIndex)=>{
      (semester.modules||[]).forEach((module,moduleIndex)=>{
        rows.push({
          weiterbildungsgang: program.name||'',
          startjahr: program.startYear||'',
          startsemester: program.startTerm||'',
          semester: semIndex+1,
          modul: moduleIndex+1,
          jahr: module.year||'',
          dozentin: module.lecturer||'',
          kursname: module.course||'',
        });
      });
    });
  });
  return rows;
}

function buildSemesterOverviewSheet(programs){
  const title=['Ausbildungsansicht der Weiterbildungsgänge'];
  const head1=['Nr.','Weiterbildungsgang','Startjahr','Startsemester'];
  const head2=['','','',''];
  for(let i=1;i<=SEMESTER_COUNT;i++){
    head1.push(`Semester ${i}`,'','');
    head2.push('Erstelldatum (Jahr)','Dozent/in','Kursname');
  }

  const rows=[title,head1,head2];
  const totalCols=4+SEMESTER_COUNT*3;
  const merges=[
    {s:{r:0,c:0},e:{r:0,c:totalCols-1}},
    {s:{r:1,c:0},e:{r:2,c:0}},
    {s:{r:1,c:1},e:{r:2,c:1}},
    {s:{r:1,c:2},e:{r:2,c:2}},
    {s:{r:1,c:3},e:{r:2,c:3}},
  ];

  for(let i=0;i<SEMESTER_COUNT;i++){
    const startCol=4+i*3;
    merges.push({s:{r:1,c:startCol},e:{r:1,c:startCol+2}});
  }

  let rowIndex=3;
  programs.forEach((program,programIndex)=>{
    for(let moduleIndex=0;moduleIndex<MODULES_PER_SEMESTER;moduleIndex++){
      const row=[
        moduleIndex===0?programIndex+1:'',
        moduleIndex===0?(program.name||''):'',
        moduleIndex===0?(program.startYear||''):'',
        moduleIndex===0?(program.startTerm||''):'',
      ];
      for(let semIndex=0;semIndex<SEMESTER_COUNT;semIndex++){
        const module=program.semesters?.[semIndex]?.modules?.[moduleIndex]||emptyModule();
        row.push(module.year||'',module.lecturer||'',module.course||'');
      }
      rows.push(row);
    }
    merges.push(
      {s:{r:rowIndex,c:0},e:{r:rowIndex+MODULES_PER_SEMESTER-1,c:0}},
      {s:{r:rowIndex,c:1},e:{r:rowIndex+MODULES_PER_SEMESTER-1,c:1}},
      {s:{r:rowIndex,c:2},e:{r:rowIndex+MODULES_PER_SEMESTER-1,c:2}},
      {s:{r:rowIndex,c:3},e:{r:rowIndex+MODULES_PER_SEMESTER-1,c:3}},
    );
    rowIndex+=MODULES_PER_SEMESTER;
  });

  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!merges']=merges;
  ws['!cols']=[
    {wch:6},
    {wch:30},
    {wch:12},
    {wch:14},
    ...Array.from({length:SEMESTER_COUNT},()=>[{wch:16},{wch:22},{wch:38}]).flat(),
  ];
  ws['!rows']=[
    {hpt:24},
    {hpt:22},
    {hpt:20},
    ...Array.from({length:Math.max(programs.length,1)*MODULES_PER_SEMESTER},()=>({hpt:22})),
  ];
  ws['!freeze']={xSplit:4,ySplit:3,topLeftCell:'E4',activePane:'bottomRight',state:'frozen'};
  ws['!autofilter']={ref:`A3:${XLSX.utils.encode_col(totalCols-1)}3`};

  const styles={
    title:{font:{bold:true,sz:14},alignment:{horizontal:'center',vertical:'center'},fill:{fgColor:{rgb:'F2F2F0'}}},
    head:{font:{bold:true,sz:11},alignment:{horizontal:'center',vertical:'center',wrapText:true},fill:{fgColor:{rgb:'E6E6E2'}},border:{top:{style:'medium',color:{rgb:'1F1F1F'}},bottom:{style:'medium',color:{rgb:'1F1F1F'}},left:{style:'thin',color:{rgb:'7A7A7A'}},right:{style:'thin',color:{rgb:'7A7A7A'}}}},
    sub:{font:{bold:true,sz:10},alignment:{horizontal:'center',vertical:'center',wrapText:true},fill:{fgColor:{rgb:'F2F2F0'}},border:{top:{style:'thin',color:{rgb:'7A7A7A'}},bottom:{style:'medium',color:{rgb:'1F1F1F'}},left:{style:'thin',color:{rgb:'7A7A7A'}},right:{style:'thin',color:{rgb:'7A7A7A'}}}},
    fixed:{font:{sz:10},alignment:{vertical:'center',horizontal:'center',wrapText:true},fill:{fgColor:{rgb:'FAFAF8'}},border:{top:{style:'thin',color:{rgb:'B5B5B5'}},bottom:{style:'thin',color:{rgb:'B5B5B5'}},left:{style:'thin',color:{rgb:'B5B5B5'}},right:{style:'medium',color:{rgb:'1F1F1F'}}}},
    cell:{font:{sz:10},alignment:{vertical:'center',wrapText:true},border:{top:{style:'thin',color:{rgb:'D0D0D0'}},bottom:{style:'thin',color:{rgb:'D0D0D0'}},left:{style:'thin',color:{rgb:'D0D0D0'}},right:{style:'thin',color:{rgb:'D0D0D0'}}}},
    groupEnd:{font:{sz:10},alignment:{vertical:'center',wrapText:true},border:{top:{style:'thin',color:{rgb:'D0D0D0'}},bottom:{style:'thin',color:{rgb:'D0D0D0'}},left:{style:'thin',color:{rgb:'D0D0D0'}},right:{style:'medium',color:{rgb:'1F1F1F'}}}},
  };

  for(let c=0;c<totalCols;c++){
    const ref=XLSX.utils.encode_cell({r:0,c});
    if(ws[ref]) ws[ref].s=styles.title;
  }
  for(let c=0;c<totalCols;c++){
    const ref1=XLSX.utils.encode_cell({r:1,c});
    const ref2=XLSX.utils.encode_cell({r:2,c});
    if(ws[ref1]) ws[ref1].s=styles.head;
    if(ws[ref2]) ws[ref2].s=styles.sub;
  }
  for(let r=3;r<rows.length;r++){
    for(let c=0;c<totalCols;c++){
      const ref=XLSX.utils.encode_cell({r,c});
      if(!ws[ref]) continue;
      if(c<4){
        ws[ref].s=styles.fixed;
      }else{
        const isSemesterEdge=((c-4)%3)===2;
        ws[ref].s=isSemesterEdge?styles.groupEnd:styles.cell;
      }
    }
    if((r-3)%MODULES_PER_SEMESTER===0){
      for(let c=0;c<totalCols;c++){
        const ref=XLSX.utils.encode_cell({r,c});
        if(ws[ref]&&ws[ref].s&&ws[ref].s.border){
          ws[ref].s={...ws[ref].s,border:{...ws[ref].s.border,top:{style:'medium',color:{rgb:'1F1F1F'}}}};
        }
      }
    }
  }
  return ws;
}

function buildProgramsFromSemesterSheet(ws,pRows=[]){
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  if(!rows.length) return [];

  const metaMap=new Map(
    (pRows||[])
      .filter(r=>String(r['Name']||'').trim())
      .map(r=>[
        String(r['Name']).trim(),
        {
          startYear:String(r['Startjahr']||''),
          startTerm:String(r['Startsemester']||''),
        },
      ])
  );

  let subHeaderRowIndex=-1;
  for(let i=0;i<rows.length;i++){
    const row=rows[i].map(v=>String(v||'').trim());
    if(row.includes('Kursname') && (row.includes('Erstelldatum (Jahr)') || row.includes('Jahr'))){
      subHeaderRowIndex=i;
      break;
    }
  }
  if(subHeaderRowIndex===-1) return [];

  const programMap=new Map();
  let currentProgram='';
  let currentStartYear='';
  let currentStartTerm='';
  let moduleIndex=-1;

  rows.slice(subHeaderRowIndex+1).forEach(rawRow=>{
    const row=rawRow.map(v=>String(v||''));
    const hasAny=row.some(cell=>cell.trim());
    if(!hasAny) return;

    const rowProgram=row[1]?.trim()||'';
    const rowStartYear=row[2]?.trim()||'';
    const rowStartTerm=row[3]?.trim()||'';

    if(rowProgram){
      currentProgram=rowProgram;
      currentStartYear=rowStartYear;
      currentStartTerm=rowStartTerm;
      moduleIndex=0;
    }else if(currentProgram){
      moduleIndex+=1;
    }

    if(!currentProgram || moduleIndex<0 || moduleIndex>=MODULES_PER_SEMESTER) return;

    if(!programMap.has(currentProgram)){
      const meta=metaMap.get(currentProgram)||{};
      programMap.set(currentProgram,{
        id:Date.now()+programMap.size+10000,
        name:currentProgram,
        startYear:currentStartYear||meta.startYear||'',
        startTerm:(currentStartTerm||meta.startTerm||'HS')==='FS'?'FS':'HS',
        semesters:Array.from({length:SEMESTER_COUNT},(_,i)=>emptySemester(i+1)),
      });
    }

    const program=programMap.get(currentProgram);
    if(currentStartYear) program.startYear=currentStartYear;
    if(currentStartTerm) program.startTerm=currentStartTerm==='FS'?'FS':'HS';

    for(let semIndex=0;semIndex<SEMESTER_COUNT;semIndex++){
      const start=4+semIndex*3;
      program.semesters[semIndex].modules[moduleIndex]={
        year:row[start]?.trim()||'',
        lecturer:row[start+1]?.trim()||'',
        course:row[start+2]?.trim()||'',
      };
    }
  });

  return Array.from(programMap.values());
}

// ─── Excel round-trip (v1.0.15) ───────────────────────────────────────────
// The export produces a self-documenting workbook with ID columns
// throughout so the import can detect updates vs new rows reliably.

// Sheet 1: README. Plain text help that opens to the user when they open the
// Excel file in any spreadsheet program. Explains what each sheet does and
// the editing rules.
function buildReadmeSheet(){
  const rows=[
    ['AIM Pruefungs-Manager — Excel Backup'],
    [],
    [`Exportiert am ${new Date().toLocaleString('de-CH')}`],
    [],
    ['DIESE DATEI BEARBEITEN'],
    ['Du kannst diese Excel-Datei bearbeiten und sie danach im AIM Pruefungs-Manager wieder importieren.'],
    ['(Dashboard → "Excel importieren").'],
    [],
    ['REGELN'],
    ['1. Die Spalte "ID" identifiziert jeden Eintrag eindeutig. NICHT veraendern.'],
    ['   • Zeile mit vorhandener ID → wird beim Import aktualisiert.'],
    ['   • Zeile mit leerer ID → wird als NEU hinzugefuegt (App vergibt eine ID).'],
    ['   • Geloeschte Zeile in Excel → bleibt im App-Bestand bestehen (KEIN Loeschen via Excel).'],
    [],
    ['2. Vor dem Import wird automatisch eine Sicherung des aktuellen Standes erstellt.'],
    ['   Du kannst auf dem Dashboard mit "Letzten Stand wiederherstellen" zurueckspulen.'],
    [],
    ['3. Beim Import zeigt die App eine Vorschau (X neu, Y aktualisiert, Z unveraendert).'],
    ['   Erst nach Bestaetigung werden die Aenderungen uebernommen.'],
    [],
    ['SHEETS IN DIESER DATEI'],
    ['• Fragen — eine Zeile pro Pruefungsfrage'],
    ['• Kurs Uebersicht — pro Kurs die zugeordneten Weiterbildungsgaenge (Spalte je WBG, "x" = zugeordnet)'],
    ['• Weiterbildungsgaenge — die 6×4-Modulmatrix je Programm'],
    ['• Gespeicherte Pruefungen — frueher gespeicherte Pruefungen mit Fragen'],
    [],
    ['AENDERN, NICHT EINFUEGEN'],
    ['Wenn du in der Fragen-Tabelle Zellen aendern willst, einfach den Wert ueberschreiben.'],
    ['Beim Re-Import aktualisiert die App die Frage anhand der ID.'],
    [],
    ['NEUE ZEILE HINZUFUEGEN'],
    ['Spalte "ID" leer lassen — die App vergibt eine ID beim Import.'],
    ['Pflichtfelder: Kurs, Frage, Korrekte Antwort(en).'],
    [],
    ['HINWEIS'],
    ['Diese Datei ist KEIN ZIP-Backup. Hilfe-Inhalte und Bilder werden via "JSON exportieren" gesichert.'],
  ];
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:80}];
  return ws;
}

// Sheet "Kurs Uebersicht" — one row per unique course, with one column per
// Weiterbildungsgang. Cell value "x" means the course is tagged for that
// WBG, empty means not. This is the round-trip surface for editing tags
// in Excel.
function buildCourseTagsSheetRows(questions, programs, courseTags){
  const courseMap=new Map();
  (questions||[]).forEach(q=>{
    if(!q.course) return;
    if(!courseMap.has(q.course)) courseMap.set(q.course,{course:q.course,lecturers:new Set(),years:new Set(),count:0});
    const info=courseMap.get(q.course);
    info.count++;
    if(q.lecturer) info.lecturers.add(q.lecturer);
    if(q.year) info.years.add(q.year);
  });
  const rows=[...courseMap.values()].sort((a,b)=>a.course.localeCompare(b.course)).map(info=>{
    const out={
      'Kurs':info.course,
      'Dozent/in (haeufigster)':info.lecturers.size===1?[...info.lecturers][0]:info.lecturers.size>1?'mehrere':'',
      'Jahr (haeufigstes)':info.years.size===1?[...info.years][0]:info.years.size>1?'mehrere':'',
      'Anzahl Fragen':info.count,
    };
    const tags=(courseTags||{})[info.course]||[];
    const idSet=new Set(tags.map(String));
    (programs||[]).forEach(p=>{
      out[`WBG: ${p.name}`]=idSet.has(String(p.id))?'x':'';
    });
    return out;
  });
  return rows;
}

// Parse the Kurs Uebersicht sheet back into a courseTags map. Returns
// { courseTags: {[course]: [wbgId, ...]}, courses: [course names seen] }
function readCourseTagsFromSheet(ws, programs){
  if(!ws) return {courseTags:{},courses:[]};
  const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
  const tags={};
  const courses=[];
  // Map "WBG: <name>" column back to program ID via name match
  const programByName=new Map((programs||[]).map(p=>[p.name,p.id]));
  rows.forEach(r=>{
    const course=String(r['Kurs']||'').trim();
    if(!course) return;
    courses.push(course);
    const ids=[];
    Object.entries(r).forEach(([key,value])=>{
      if(!key.startsWith('WBG: ')) return;
      const name=key.slice(5);
      const id=programByName.get(name);
      if(!id) return;
      const cell=String(value||'').trim().toLowerCase();
      if(cell==='x'||cell==='ja'||cell==='yes'||cell==='true'||cell==='1') ids.push(String(id));
    });
    tags[course]=ids;
  });
  return {courseTags:tags,courses};
}

// Sheet "Weiterbildungsgaenge" — full program metadata with ID + start info
function buildProgramsMetaSheet(programs){
  const rows=(programs||[]).map(p=>({
    'ID':p.id??'',
    'Name':p.name||'',
    'Startjahr':p.startYear||'',
    'Startsemester':p.startTerm||'',
  }));
  const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{'ID':'','Name':'','Startjahr':'','Startsemester':''}]);
  ws['!cols']=[{wch:32},{wch:32},{wch:12},{wch:14}];
  ws['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'};
  ws['!autofilter']={ref:`A1:D${Math.max(1,rows.length)+1}`};
  return ws;
}

function exportExcel(questions, programs, savedExams=[], courseTags={}){
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: README (orient the user) ────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, buildReadmeSheet(), 'README');

  // ── Sheet 2: Fragen (with ID for round-trip merge) ───────────────────────
  const qRows = buildQuestionSheetRows(questions);
  const wsQ = XLSX.utils.json_to_sheet(qRows.length?qRows:[{
    'ID':'','Jahr':'','Standort':'','Dozent/in':'','Kurs':'','Format':'',
    'Frage':'','Antwort A':'','Antwort B':'','Antwort C':'','Antwort D':'',
    'Antwort E':'','Korrekte Antwort(en)':'',
  }]);
  // ID column wide enough for UUID-ish strings; question column extra-wide.
  wsQ['!cols']=[{wch:18},{wch:6},{wch:10},{wch:28},{wch:52},{wch:16},{wch:80},{wch:50},{wch:50},{wch:50},{wch:50},{wch:50},{wch:20}];
  wsQ['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'};
  wsQ['!autofilter']={ref:`A1:M${Math.max(1,qRows.length)+1}`};
  XLSX.utils.book_append_sheet(wb, wsQ, 'Fragen');

  // ── Sheet 3: Kurs Uebersicht (per-course WBG tags, round-trip) ───────────
  const tagRows=buildCourseTagsSheetRows(questions, programs, courseTags);
  const wsT = XLSX.utils.json_to_sheet(tagRows.length?tagRows:[Object.fromEntries([
    ['Kurs',''],['Dozent/in (haeufigster)',''],['Jahr (haeufigstes)',''],['Anzahl Fragen',''],
    ...((programs||[]).map(p=>[`WBG: ${p.name}`,'']))
  ])]);
  const fixedCols=[{wch:52},{wch:24},{wch:14},{wch:12}];
  const wbgCols=(programs||[]).map(()=>({wch:22}));
  wsT['!cols']=[...fixedCols,...wbgCols];
  wsT['!freeze']={xSplit:1,ySplit:1,topLeftCell:'B2',activePane:'bottomRight',state:'frozen'};
  const totalCols=4+(programs||[]).length;
  const lastCol=XLSX.utils.encode_col(Math.max(0,totalCols-1));
  wsT['!autofilter']={ref:`A1:${lastCol}${Math.max(1,tagRows.length)+1}`};
  XLSX.utils.book_append_sheet(wb, wsT, 'Kurs Uebersicht');

  // ── Sheet 4: Weiterbildungsgaenge metadata (ID for round-trip) ───────────
  XLSX.utils.book_append_sheet(wb, buildProgramsMetaSheet(programs), 'Weiterbildungsgaenge');

  // ── Sheet 5: Semesteransicht (the visible matrix; export-only) ───────────
  const wsS = buildSemesterOverviewSheet(programs);
  XLSX.utils.book_append_sheet(wb, wsS, 'Semesteransicht');

  // ── Sheet 6: Gespeicherte Pruefungen (preserved across round-trips) ──────
  const examRows=buildSavedExamSheetRows(savedExams);
  const wsE = XLSX.utils.json_to_sheet(examRows.length?examRows:[{
    'Prüfungs-ID':'',
    'Prüfungsname':'',
    'Weiterbildungsgang':'',
    'Gespeichert am':'',
    'Reihenfolge':'',
    'Jahr':'',
    'Standort':'',
    'Dozent/in':'',
    'Kurs':'',
    'Format':'',
    'Frage':'',
    'Antwort A':'',
    'Antwort B':'',
    'Antwort C':'',
    'Antwort D':'',
    'Antwort E':'',
    'Korrekte Antwort(en)':'',
  }]);
  wsE['!cols']=[{wch:22},{wch:28},{wch:28},{wch:22},{wch:10},{wch:6},{wch:10},{wch:26},{wch:38},{wch:16},{wch:80},{wch:40},{wch:40},{wch:40},{wch:40},{wch:40},{wch:20}];
  wsE['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'};
  XLSX.utils.book_append_sheet(wb, wsE, 'Gespeicherte Pruefungen');

  const buf = XLSX.write(wb,{bookType:'xlsx',type:'array'});
  dlFile(buf,`AIM_Backup_${new Date().toISOString().slice(0,10)}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function buildQuestionSheetRows(questions){
  return questions.map(q=>({
    'ID': q.id ?? '',
    'Jahr': q.year||'',
    'Standort': q.location||'',
    'Dozent/in': q.lecturer||'',
    'Kurs': q.course||'',
    'Format': q.format||'',
    'Frage': q.question||'',
    'Antwort A': q.optA||'',
    'Antwort B': q.optB||'',
    'Antwort C': q.optC||'',
    'Antwort D': q.optD||'',
    'Antwort E': q.optE||'',
    'Korrekte Antwort(en)': q.answer||'',
  }));
}

function readQuestionsFromSheet(ws){
  if(!ws) return [];
  const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
  return rows
    .filter(r=>r['Frage']&&r['Kurs'])
    .map((r,i)=>({
      id: String(r['ID']||'').trim() ? String(r['ID']).trim() : `import_${Date.now()}_${i}`,
      year: String(r['Jahr']||''),
      location: String(r['Standort']||''),
      lecturer: String(r['Dozent/in']||''),
      course: String(r['Kurs']||''),
      format: FORMATS.includes(String(r['Format']||'')) ? String(r['Format']) : 'Single Choice',
      question: String(r['Frage']||''),
      optA: String(r['Antwort A']||''),
      optB: String(r['Antwort B']||''),
      optC: String(r['Antwort C']||''),
      optD: String(r['Antwort D']||''),
      optE: String(r['Antwort E']||''),
      answer: String(r['Korrekte Antwort(en)']||'A'),
    }));
}

function exportQuestionsExcel(questions){
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.json_to_sheet(buildQuestionSheetRows(questions));
  ws['!cols']=[{wch:16},{wch:6},{wch:10},{wch:28},{wch:52},{wch:16},{wch:80},{wch:50},{wch:50},{wch:50},{wch:50},{wch:50},{wch:20}];
  XLSX.utils.book_append_sheet(wb,ws,'Fragen');
  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  dlFile(buf,`AIM_Fragen_${new Date().toISOString().slice(0,10)}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function importQuestionsExcel(file,setQuestions,showToast){
  const reader=new FileReader();
  reader.onload=evt=>{
    try{
      const wb=XLSX.read(evt.target.result,{type:'array'});
      const ws=wb.Sheets['Fragen']||wb.Sheets['Questions']||wb.Sheets[wb.SheetNames[0]];
      const imported=readQuestionsFromSheet(ws);
      if(!imported.length){
        showToast('Keine gültigen Fragen in der Excel-Datei gefunden.','error');
        return;
      }
      let added=0, updated=0;
      setQuestions(prev=>{
        const byId=new Map(prev.map(q=>[String(q.id),q]));
        imported.forEach(q=>{
          const normalizedId=String(q.id||newId('q'));
          const merged={...q,id:normalizedId};
          if(byId.has(normalizedId)){
            byId.set(normalizedId,merged);
            updated++;
            return;
          }
          const duplicate=[...byId.values()].find(existing=>
            existing.course===merged.course &&
            existing.question.trim().toLowerCase()===merged.question.trim().toLowerCase()
          );
          if(duplicate){
            byId.set(String(duplicate.id),{...duplicate,...merged,id:duplicate.id});
            updated++;
          }else{
            byId.set(normalizedId,merged);
            added++;
          }
        });
        return [...byId.values()];
      });
      const parts=[];
      if(added) parts.push(`${added} neu hinzugefügt`);
      if(updated) parts.push(`${updated} aktualisiert`);
      showToast(parts.length?`Excel-Import: ${parts.join(', ')}.`:'Keine Änderungen aus Excel übernommen.','success');
    }catch{
      showToast('Excel-Datei konnte nicht gelesen werden.','error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function createSavedExamSnapshot(questions,name,programName=''){
  const stamp=new Date().toISOString();
  const safeName=String(name||programName||'Prüfung').trim()||'Prüfung';
  return{
    id:`saved_exam_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    name:safeName,
    programName:programName||safeName,
    createdAt:stamp,
    questions:(questions||[]).map(q=>({...q})),
  };
}

function buildSavedExamSheetRows(savedExams=[]){
  const rows=[];
  (savedExams||[]).forEach(savedExam=>{
    (savedExam.questions||[]).forEach((q,index)=>{
      rows.push({
        'Prüfungs-ID': savedExam.id||'',
        'Prüfungsname': savedExam.name||'',
        'Weiterbildungsgang': savedExam.programName||'',
        'Gespeichert am': savedExam.createdAt||'',
        'Reihenfolge': index+1,
        'Jahr': q.year||'',
        'Standort': q.location||'',
        'Dozent/in': q.lecturer||'',
        'Kurs': q.course||'',
        'Format': q.format||'',
        'Frage': q.question||'',
        'Antwort A': q.optA||'',
        'Antwort B': q.optB||'',
        'Antwort C': q.optC||'',
        'Antwort D': q.optD||'',
        'Antwort E': q.optE||'',
        'Korrekte Antwort(en)': q.answer||'',
      });
    });
  });
  return rows;
}

function readSavedExamsFromSheet(ws){
  if(!ws) return [];
  const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
  const grouped=new Map();
  rows.forEach((row,idx)=>{
    const examId=String(row['Prüfungs-ID']||'').trim()||`saved_exam_import_${idx}`;
    if(!grouped.has(examId)){
      grouped.set(examId,{
        id:examId,
        name:String(row['Prüfungsname']||'Prüfung'),
        programName:String(row['Weiterbildungsgang']||row['Prüfungsname']||'Prüfung'),
        createdAt:String(row['Gespeichert am']||new Date().toISOString()),
        questions:[],
      });
    }
    if(row['Frage']||row['Kurs']){
      grouped.get(examId).questions.push({
        id:`saved_q_${examId}_${idx}`,
        year:String(row['Jahr']||''),
        location:String(row['Standort']||''),
        lecturer:String(row['Dozent/in']||''),
        course:String(row['Kurs']||''),
        format:String(row['Format']||'Single Choice'),
        question:String(row['Frage']||''),
        optA:String(row['Antwort A']||''),
        optB:String(row['Antwort B']||''),
        optC:String(row['Antwort C']||''),
        optD:String(row['Antwort D']||''),
        optE:String(row['Antwort E']||''),
        answer:String(row['Korrekte Antwort(en)']||'A'),
      });
    }
  });
  return [...grouped.values()].filter(savedExam=>savedExam.questions.length>0);
}

// Parse a Programs metadata sheet (the new "Weiterbildungsgaenge" sheet
// produced by buildProgramsMetaSheet). Returns an array of program-shaped
// objects with IDs preserved when present in the sheet.
function readProgramsMetaFromSheet(ws){
  if(!ws) return [];
  const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
  return rows
    .filter(r=>String(r['Name']||'').trim())
    .map(r=>({
      id: String(r['ID']||'').trim() || null,
      name: String(r['Name']||'').trim(),
      startYear: String(r['Startjahr']||''),
      startTerm: String(r['Startsemester']||'HS')==='FS'?'FS':'HS',
    }));
}

// ─── v1.0.15 Excel round-trip pipeline ───────────────────────────────────────
// The flow is: parse → diff against current state → preview → apply (with
// auto-backup). This is the single source of truth for `Excel importieren`.
// Each step is a pure-ish function so the preview dialog can render counts
// before any state changes.

// parseExcelImport(arrayBuffer) → { questions, programs, courseTags, savedExams }
//
// Reads each sheet, preserves IDs verbatim where present, and returns
// structured data. NEVER calls `newId()` here — the diff step assigns IDs
// to genuinely new rows, so the preview can show "23 hinzufügen" honestly.
function parseExcelImport(arrayBuffer){
  const wb = XLSX.read(arrayBuffer,{type:'array'});
  const wsQ = wb.Sheets['Fragen'] || wb.Sheets['Questions'];
  // The new export uses "Weiterbildungsgaenge"; older exports used
  // "Weiterbildungsgänge". Accept both; the Semesteransicht sheet is also
  // accepted as a structural fallback.
  const wsP = wb.Sheets['Weiterbildungsgaenge'] || wb.Sheets['Weiterbildungsgänge'] || wb.Sheets['Programs'];
  const wsT = wb.Sheets['Kurs Uebersicht'] || wb.Sheets['Kurs Übersicht'];
  const wsS = wb.Sheets['Semesteransicht'] || wb.Sheets['Semester'];
  const wsE = wb.Sheets['Gespeicherte Pruefungen'] || wb.Sheets['Gespeicherte Prüfungen'] || wb.Sheets['SavedExams'];

  // Questions: preserved IDs only — let the diff step generate IDs for new rows
  const questions = wsQ ? readQuestionsFromSheet(wsQ).map(q=>{
    // readQuestionsFromSheet generates `import_<ts>_<i>` IDs for empty cells —
    // we strip those here so the diff step sees them as "no ID, treat as new"
    const isGenerated = typeof q.id==='string' && q.id.startsWith('import_');
    return isGenerated ? {...q,id:''} : q;
  }) : [];

  // Programs: pull metadata sheet for IDs; merge in matrix sheet for semesters
  const programsMeta = readProgramsMetaFromSheet(wsP);
  const pRowsRaw = wsP ? XLSX.utils.sheet_to_json(wsP,{defval:''}) : [];
  const fromSemesterSheet = wsS ? buildProgramsFromSemesterSheet(wsS, pRowsRaw) : [];
  // buildProgramsFromSemesterSheet returns semesters keyed by name; merge IDs in
  const programs = fromSemesterSheet.map(p=>{
    const meta = programsMeta.find(m=>m.name===p.name);
    return {
      ...p,
      id: meta?.id || p.id || null,
      startYear: meta?.startYear || p.startYear || '',
      startTerm: meta?.startTerm || p.startTerm || 'HS',
    };
  });
  // If the matrix sheet was missing but metadata exists, surface the
  // programs with empty semesters so the diff can still match them by ID.
  if(!programs.length && programsMeta.length){
    programsMeta.forEach(m=>{
      programs.push({
        id: m.id || null,
        name: m.name,
        startYear: m.startYear,
        startTerm: m.startTerm,
        semesters: Array.from({length:SEMESTER_COUNT},(_,i)=>emptySemester(i+1)),
      });
    });
  }

  const courseTagsParsed = wsT ? readCourseTagsFromSheet(wsT, programs) : {courseTags:{},courses:[]};
  const savedExams = wsE ? readSavedExamsFromSheet(wsE) : [];

  return {
    questions,
    programs,
    courseTags: courseTagsParsed.courseTags,
    coursesInTagSheet: courseTagsParsed.courses,
    savedExams,
  };
}

// computeExcelImportDiff(parsed, current) → diff with counts per category.
// "delete" intentionally not computed — the v1.0.15 contract is never to
// delete rows missing from the Excel. Users delete in-app.
function computeExcelImportDiff(parsed, current){
  const diff = {
    questions: { add:[], update:[], unchanged:[] },
    programs:  { add:[], update:[], unchanged:[] },
    courseTags:{ add:[], update:[], unchanged:[] },
    savedExams:{ add:[], update:[], unchanged:[] },
    conflicts: [],
  };

  // Helper: stable JSON-ish equality on a fixed set of fields.
  const sameQuestion = (a,b)=> (
    a.year===b.year && a.location===b.location && a.lecturer===b.lecturer &&
    a.course===b.course && a.format===b.format && a.question===b.question &&
    a.optA===b.optA && a.optB===b.optB && a.optC===b.optC &&
    a.optD===b.optD && a.optE===b.optE && a.answer===b.answer
  );
  const sameProgram = (a,b)=> (
    a.name===b.name && a.startYear===b.startYear && a.startTerm===b.startTerm &&
    JSON.stringify(a.semesters||[])===JSON.stringify(b.semesters||[])
  );

  // ── Questions ────────────────────────────────────────────────────────────
  const currentQById = new Map((current.questions||[]).map(q=>[String(q.id),q]));
  (parsed.questions||[]).forEach(q=>{
    // Required fields validation
    if(!q.course || !q.question){
      diff.conflicts.push({type:'question',reason:'Pflichtfeld fehlt (Kurs oder Frage)',row:q});
      return;
    }
    if(q.id && currentQById.has(String(q.id))){
      const existing = currentQById.get(String(q.id));
      const merged = {...existing,...q,id:existing.id};
      if(sameQuestion(existing,merged)){
        diff.questions.unchanged.push(merged);
      }else{
        diff.questions.update.push({before:existing,after:merged});
      }
    }else{
      // New row → generate ID at apply time. Mark with sentinel for now.
      diff.questions.add.push({...q,id:''});
    }
  });

  // ── Programs ─────────────────────────────────────────────────────────────
  const currentPById = new Map((current.programs||[]).map(p=>[String(p.id),p]));
  const currentPByName = new Map((current.programs||[]).map(p=>[p.name,p]));
  (parsed.programs||[]).forEach(p=>{
    if(!p.name){
      diff.conflicts.push({type:'program',reason:'Name fehlt',row:p});
      return;
    }
    let existing = p.id ? currentPById.get(String(p.id)) : null;
    if(!existing) existing = currentPByName.get(p.name) || null;
    if(existing){
      const merged = {...existing,...p,id:existing.id,semesters:p.semesters||existing.semesters};
      if(sameProgram(existing,merged)){
        diff.programs.unchanged.push(merged);
      }else{
        diff.programs.update.push({before:existing,after:merged});
      }
    }else{
      diff.programs.add.push({...p,id:''});
    }
  });

  // ── Course tags ──────────────────────────────────────────────────────────
  const currentTags = current.courseTags || {};
  const seenCourses = new Set();
  Object.entries(parsed.courseTags||{}).forEach(([course,ids])=>{
    seenCourses.add(course);
    const before = (currentTags[course]||[]).map(String).sort();
    const after = (ids||[]).map(String).sort();
    if(before.join('|')===after.join('|')){
      diff.courseTags.unchanged.push({course,ids:after});
    }else if(!currentTags[course]){
      diff.courseTags.add.push({course,ids:after});
    }else{
      diff.courseTags.update.push({course,before,after});
    }
  });

  // ── Saved exams ──────────────────────────────────────────────────────────
  const currentExamById = new Map((current.savedExams||[]).map(e=>[String(e.id),e]));
  (parsed.savedExams||[]).forEach(exam=>{
    if(exam.id && currentExamById.has(String(exam.id))){
      const existing = currentExamById.get(String(exam.id));
      if(JSON.stringify(existing.questions)===JSON.stringify(exam.questions) && existing.name===exam.name){
        diff.savedExams.unchanged.push(existing);
      }else{
        diff.savedExams.update.push({before:existing,after:{...existing,...exam,id:existing.id}});
      }
    }else{
      diff.savedExams.add.push(exam);
    }
  });

  return diff;
}

// applyExcelImport(diff, state, setters) — performs the writes after the
// user clicks "Anwenden" in the preview modal. Snapshots the current state
// to `aim_last_backup` first so "Letzten Stand wiederherstellen" works.
function applyExcelImport(diff, state, setters){
  const {questions, programs, courseTags, savedExams} = state;
  const {setQuestions, setPrograms, setCourseTags, setSavedExams, saveLastBackup, normalizePrograms} = setters;

  // 1. Snapshot for undo
  if(typeof saveLastBackup === 'function'){
    saveLastBackup({questions, programs, courseTags, savedExams});
  }

  // 2. Apply questions: keep current order, update in place, append new at end
  const newQuestions = [...(questions||[])];
  const qById = new Map(newQuestions.map((q,i)=>[String(q.id),i]));
  diff.questions.update.forEach(({after})=>{
    const idx = qById.get(String(after.id));
    if(idx!==undefined) newQuestions[idx] = after;
  });
  diff.questions.add.forEach(q=>{
    const fresh = {...q,id:newId('q')};
    newQuestions.push(fresh);
  });
  setQuestions(newQuestions);

  // 3. Apply programs: same merge strategy
  const newPrograms = [...(programs||[])];
  const pById = new Map(newPrograms.map((p,i)=>[String(p.id),i]));
  diff.programs.update.forEach(({after})=>{
    const idx = pById.get(String(after.id));
    if(idx!==undefined) newPrograms[idx] = after;
  });
  diff.programs.add.forEach(p=>{
    const fresh = {...p,id:newId('p')};
    newPrograms.push(fresh);
  });
  setPrograms(normalizePrograms ? normalizePrograms(newPrograms) : newPrograms);

  // 4. Apply course tags: full merge (we keep tags for courses not in the sheet)
  const newTags = {...(courseTags||{})};
  diff.courseTags.add.forEach(({course,ids})=>{ newTags[course]=ids; });
  diff.courseTags.update.forEach(({course,after})=>{ newTags[course]=after; });
  setCourseTags(newTags);

  // 5. Apply saved exams
  const newSavedExams = [...(savedExams||[])];
  const eById = new Map(newSavedExams.map((e,i)=>[String(e.id),i]));
  diff.savedExams.update.forEach(({after})=>{
    const idx = eById.get(String(after.id));
    if(idx!==undefined) newSavedExams[idx] = after;
  });
  diff.savedExams.add.forEach(exam=>{ newSavedExams.push(exam); });
  setSavedExams(newSavedExams);
}

// Thin wrapper used by Dashboard: parse + diff, then call the preview opener.
// The preview opener owns the apply step so the user can cancel.
function previewExcelImport(file, current, onPreview, showToast){
  const reader = new FileReader();
  reader.onload = evt => {
    try{
      const parsed = parseExcelImport(evt.target.result);
      if(!parsed.questions.length && !parsed.programs.length && !Object.keys(parsed.courseTags).length && !parsed.savedExams.length){
        showToast('Keine gültigen Daten in der Excel-Datei gefunden.','error');
        return;
      }
      const diff = computeExcelImportDiff(parsed, current);
      onPreview(diff, parsed);
    }catch(e){
      console.error('Excel parse error:',e);
      showToast('Excel-Datei konnte nicht gelesen werden.','error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ─── Word (.docx) export for Testportal import ─────────────────────────────
// Testportal detects the correct answer from BOLD text. A PDF can't carry
// "bold" reliably: in a PDF, bold is only a font choice, and text extraction
// discards the font association — so Testportal sees every line as the same
// weight and marks no correct answer. A .docx stores bold as an explicit
// <w:b/> run property that Testportal reads directly, so the correct answers
// come through every time (this matches Testportal's own import template).
// We build the .docx by hand as a STORE (uncompressed) zip of OOXML parts so
// there is no third-party dependency.

export function docxEsc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// One <w:p> paragraph. bold=true wraps the run in <w:b/><w:bCs/>.
function docxPara(text,bold){
  const rpr=`<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${bold?'<w:b/><w:bCs/>':''}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>`;
  return `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r>${rpr}<w:t xml:space="preserve">${docxEsc(text)}</w:t></w:r></w:p>`;
}
function buildDocxDocumentXml(qs){
  const blocks=qs.map((q,i)=>{
    const correct=q.answer?q.answer.split(';'):[];
    const opts=[{k:'A',t:q.optA},{k:'B',t:q.optB},{k:'C',t:q.optC},{k:'D',t:q.optD},{k:'E',t:q.optE}].filter(o=>o.t);
    // IMPORTANT: ONLY the correct answer line is bold (the letter prefix is
    // part of the bold run, exactly like the import template). The course
    // title, the question stem and the wrong answers MUST stay normal weight —
    // Testportal reads every bold run as a correct answer ("do not use bold
    // for any other purpose"), so a stray bold would corrupt the answer key.
    const head=docxPara(`${i+1}. Titel des Kurses: ${q.course||''}`,false);
    const stem=docxPara(q.question||'',false);
    const answers=opts.map(o=>docxPara(`${o.k.toLowerCase()}) ${o.t}`,correct.includes(o.k))).join('');
    const spacer='<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
    return head+stem+answers+spacer;
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+blocks+
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>'+
    '</w:body></w:document>';
}
export const DOCX_CONTENT_TYPES='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
export const DOCX_RELS='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';

function crc32(b){
  let crc=0xFFFFFFFF;
  for(let i=0;i<b.length;i++){
    let c=(crc^b[i])&0xFF;
    for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
    crc=(crc>>>8)^c;
  }
  return(crc^0xFFFFFFFF)>>>0;
}
// Minimal STORE (uncompressed) zip writer — valid enough for a .docx that Word
// and Testportal both parse. Portable across the Electron renderer (TextEncoder,
// Uint8Array). Filenames/data are ASCII+UTF-8; never spreads the large data
// array, so it is safe for big exams.
export function zipStore(files){
  const enc=new TextEncoder();
  const u16=n=>[n&0xFF,(n>>>8)&0xFF];
  const u32=n=>[n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF];
  const chunks=[],central=[];let offset=0;
  for(const f of files){
    const nameB=enc.encode(f.name),dataB=enc.encode(f.data),crc=crc32(dataB);
    const local=[...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(dataB.length),...u32(dataB.length),...u16(nameB.length),...u16(0),...nameB];
    chunks.push(Uint8Array.from(local),dataB);
    central.push([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(dataB.length),...u32(dataB.length),...u16(nameB.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...nameB]);
    offset+=local.length+dataB.length;
  }
  const cdStart=offset;const cd=[];
  for(const c of central){cd.push(...c);offset+=c.length;}
  const eocd=[...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(offset-cdStart),...u32(cdStart),...u16(0)];
  const out=new Uint8Array(cdStart+cd.length+eocd.length);let p=0;
  for(const ch of chunks){out.set(ch,p);p+=ch.length;}
  out.set(Uint8Array.from(cd),p);p+=cd.length;out.set(Uint8Array.from(eocd),p);
  return out;
}
// Returns the .docx file as a Uint8Array, ready to hand to dlFile().
function buildDocx(qs){
  return zipStore([
    {name:'[Content_Types].xml',data:DOCX_CONTENT_TYPES},
    {name:'_rels/.rels',data:DOCX_RELS},
    {name:'word/document.xml',data:buildDocxDocumentXml(qs)},
  ]);
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
export const inp={width:'100%',fontFamily:sans,fontSize:'14px',padding:'8px 12px',border:'1px solid var(--c-bo)',borderRadius:4,background:'var(--c-wh)',color:'var(--c-tx)',boxSizing:'border-box',outline:'none'};
export const gridTh={padding:'10px 8px',border:'1px solid var(--c-grid-border)',background:'var(--c-wh)',color:'var(--c-tx)',fontSize:'11px',fontWeight:700,textAlign:'center',whiteSpace:'nowrap'};
export const gridSemesterHead={padding:'10px 8px',borderTop:'1px solid var(--c-grid-border)',borderBottom:'1px solid var(--c-grid-border)',borderRight:'1px solid var(--c-grid-border)',background:'var(--c-wh)',color:'var(--c-tx)',fontSize:'13px',fontWeight:700,textAlign:'center'};
export const gridSubHead={padding:'8px 6px',borderBottom:'1px solid var(--c-grid-border)',borderRight:'1px solid var(--c-bo)',background:'var(--c-grid-sub)',color:'var(--c-tx)',fontSize:'10px',fontWeight:600,textAlign:'center',whiteSpace:'nowrap'};
export const gridCell={padding:'6px',borderRight:'1px solid var(--c-bo)',borderBottom:'1px solid var(--c-bo)',verticalAlign:'top'};
export const gridCellMuted={padding:'10px 8px',borderRight:'1px solid var(--c-bo)',borderBottom:'1px solid var(--c-bo)',fontSize:'12px',color:'var(--c-mu)',verticalAlign:'top',textAlign:'center'};
export const gridStickyName={padding:'8px',borderRight:'1px solid var(--c-grid-border)',borderBottom:'1px solid var(--c-bo)',verticalAlign:'top'};
export const gridInput={...inp,fontSize:'12px',padding:'6px 8px',borderRadius:0,background:'transparent',border:'1px solid transparent',transition:'border-color 0.15s'};
// Focus style applied via onFocus/onBlur in inputs

function getSemesterState(program,semNumber){
  const now=currentAcademicTag();
  // Guard: empty/invalid startYear must fall back to the current academic
  // year, otherwise NaN propagates and every semester is misclassified.
  const yearRaw=Number(program.startYear);
  const startYear=Number.isFinite(yearRaw)&&yearRaw>1900?yearRaw:Number(now.year);
  const startIndex=startYear*2+(program.startTerm==='HS'?1:0);
  const currentIndex=Number(now.year)*2+(now.term==='HS'?1:0);
  const semesterIndex=startIndex+(semNumber-1);
  if(semesterIndex<currentIndex)return'completed';
  if(semesterIndex===currentIndex)return'current';
  return'future';
}

function semesterBg(program,semNumber,rowSelected){
  const state=getSemesterState(program,semNumber);
  if(rowSelected&&state==='current')return'var(--c-sem-sel-cur)';
  if(rowSelected&&state==='completed')return'var(--c-sem-sel-comp)';
  if(rowSelected)return'var(--c-sem-sel)';
  if(state==='current')return'var(--c-sem-cur)';
  if(state==='completed')return'var(--c-sem-comp)';
  return'var(--c-wh)';
}

function getModuleQuestionCount(questions,module){
  if(!module.course)return 0;
  return questions.filter(q=>
    q.course===module.course &&
    (!module.lecturer || !q.lecturer || q.lecturer===module.lecturer) &&
    (!module.year || !q.year || q.year===module.year)
  ).length;
}

function getModuleSelectionKey(programId,sem,moduleIndex,module){
  return `${programId}:${sem}:${moduleIndex}:${module.year||''}:${module.lecturer||''}:${module.course||''}`;
}

export function Field({label,children,half}){
  return(
    <div style={{marginBottom:12,flex:half?'1':undefined,minWidth:half?'45%':undefined}}>
      {label&&<label style={{display:'block',fontSize:'11px',fontWeight:500,color:C.mu,marginBottom:4,letterSpacing:'0.5px',textTransform:'uppercase'}}>{label}</label>}
      {children}
    </div>
  );
}

export function Btn({ch,onClick,v='primary',sm,dis,full,style:s={},autoFocus,title}){
  const base={fontFamily:sans,fontWeight:500,cursor:dis?'not-allowed':'pointer',border:'none',borderRadius:4,padding:sm?'6px 14px':'9px 20px',fontSize:sm?'12px':'14px',opacity:dis?.55:1,width:full?'100%':undefined,...s};
  const vs={primary:{background:C.t,color:C.wh},secondary:{background:'transparent',color:C.t,border:`1.5px solid ${C.t}`},ghost:{background:'transparent',color:C.mu,border:`1px solid ${C.bo}`},danger:{background:C.re,color:C.wh},accent:{background:C.ac,color:C.wh},success:{background:C.gr,color:C.wh}};
  return<button type="button" autoFocus={autoFocus} title={title} onClick={dis?undefined:onClick} style={{...base,...(vs[v]||vs.primary)}}>{ch}</button>;
}

export function Badge({ch,color='teal',sm}){
  const colors={teal:{bg:C.tP,tx:C.tD},warm:{bg:C.wmP,tx:C.wm},gray:{bg:C.st,tx:C.mu},green:{bg:C.gP,tx:C.gr},red:{bg:C.rP,tx:C.re}};
  const co=colors[color]||colors.teal;
  return<span style={{background:co.bg,color:co.tx,fontSize:sm?'10px':'11px',fontWeight:500,padding:sm?'2px 7px':'3px 10px',borderRadius:20,whiteSpace:'nowrap'}}>{ch}</span>;
}

function ToastContainer({toasts,onRemove}){
  if(!toasts.length)return null;
  return(
    <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,display:'flex',flexDirection:'column',gap:8,maxWidth:360,pointerEvents:'none'}}>
      {toasts.map(t=>(
        <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,background:t.type==='error'?C.re:t.type==='warning'?'#b45309':'#1a7a4a',color:C.wh,borderRadius:6,padding:'11px 14px',fontSize:'13px',fontFamily:sans,boxShadow:'0 4px 16px rgba(0,0,0,0.2)',pointerEvents:'auto'}}>
          <span style={{flex:1,lineHeight:1.4}}>{t.message}</span>
          <button onClick={()=>onRemove(t.id)} aria-label="Schließen" style={{background:'transparent',border:'none',color:C.wh,cursor:'pointer',padding:0,fontSize:'16px',lineHeight:1,opacity:0.75,flexShrink:0}}>✕</button>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({confirm,onClose}){
  useEffect(()=>{
    if(!confirm) return;
    const prevActive=document.activeElement;
    const onKey=e=>{
      if(e.key==='Escape'){
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown',onKey);
    return()=>{
      window.removeEventListener('keydown',onKey);
      try{ if(prevActive && typeof prevActive.focus==='function') prevActive.focus(); }catch{}
    };
  },[confirm,onClose]);
  if(!confirm)return null;
  return(
    <div role="dialog" aria-modal="true" aria-labelledby="aim-confirm-title" style={{position:'fixed',inset:0,background:'rgba(17,17,17,0.5)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:C.wh,borderRadius:8,padding:'24px',maxWidth:400,width:'90%',boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
        <div id="aim-confirm-title" style={{fontFamily:serif,fontSize:'17px',color:C.tD,marginBottom:10,fontWeight:700}}>Bestätigung</div>
        <p style={{fontSize:'14px',color:C.tx,margin:'0 0 20px',lineHeight:1.5}}>{confirm.message}</p>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn ch="Abbrechen" onClick={onClose} v="ghost" autoFocus/>
          <Btn ch={confirm.confirmLabel||'Löschen'} onClick={()=>{confirm.onConfirm?.();onClose();}} v={confirm.confirmV||'danger'}/>
        </div>
      </div>
    </div>
  );
}

// Excel import preview modal — v1.0.15
// Shows the user exactly what will happen before any state changes. Reads
// counts off the diff returned by computeExcelImportDiff().
function ExcelImportPreviewModal({preview,onCancel,onApply}){
  useEffect(()=>{
    if(!preview) return;
    const prevActive=document.activeElement;
    const onKey=e=>{ if(e.key==='Escape'){ e.preventDefault(); onCancel(); } };
    window.addEventListener('keydown',onKey);
    return()=>{
      window.removeEventListener('keydown',onKey);
      try{ if(prevActive && typeof prevActive.focus==='function') prevActive.focus(); }catch{}
    };
  },[preview,onCancel]);
  if(!preview) return null;
  const {diff}=preview;
  const sections=[
    {key:'questions',label:'Fragen',d:diff.questions},
    {key:'programs',label:'Weiterbildungsgänge',d:diff.programs},
    {key:'courseTags',label:'Kurs-Tags',d:diff.courseTags},
    {key:'savedExams',label:'Gespeicherte Prüfungen',d:diff.savedExams},
  ];
  const totals={
    add:sections.reduce((s,x)=>s+x.d.add.length,0),
    update:sections.reduce((s,x)=>s+x.d.update.length,0),
    unchanged:sections.reduce((s,x)=>s+x.d.unchanged.length,0),
  };
  const hasChanges=totals.add+totals.update>0;
  return(
    <div role="dialog" aria-modal="true" aria-labelledby="aim-xls-preview-title" style={{position:'fixed',inset:0,background:'rgba(17,17,17,0.5)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={onCancel}>
      <div style={{background:C.wh,borderRadius:8,padding:'24px',maxWidth:560,width:'100%',boxShadow:'0 8px 40px rgba(0,0,0,0.25)',maxHeight:'80vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}>
        <div id="aim-xls-preview-title" style={{fontFamily:serif,fontSize:'17px',color:C.tD,marginBottom:6,fontWeight:700}}>Excel-Import — Vorschau</div>
        <p style={{fontSize:'13px',color:C.mu,margin:'0 0 16px',lineHeight:1.5}}>
          Vor dem Anwenden wird der aktuelle Stand automatisch gesichert. Du kannst danach auf dem Dashboard mit „Letzten Stand wiederherstellen" zurück.
        </p>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto auto auto',gap:'6px 14px',fontSize:'13px',alignItems:'center',marginBottom:16}}>
          <div style={{fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',color:C.mu}}>Kategorie</div>
          <div style={{fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',color:C.mu,textAlign:'right'}}>Neu</div>
          <div style={{fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',color:C.mu,textAlign:'right'}}>Aktual.</div>
          <div style={{fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',color:C.mu,textAlign:'right'}}>Unverändert</div>
          {sections.map(s=>(
            <React.Fragment key={s.key}>
              <div style={{color:C.tx}}>{s.label}</div>
              <div style={{textAlign:'right',fontWeight:s.d.add.length?700:400,color:s.d.add.length?C.gr:C.mu}}>{s.d.add.length}</div>
              <div style={{textAlign:'right',fontWeight:s.d.update.length?700:400,color:s.d.update.length?C.t:C.mu}}>{s.d.update.length}</div>
              <div style={{textAlign:'right',color:C.mu}}>{s.d.unchanged.length}</div>
            </React.Fragment>
          ))}
        </div>
        {diff.conflicts && diff.conflicts.length>0 && (
          <div style={{background:C.rP,border:`1px solid ${C.re}`,borderRadius:6,padding:'10px 12px',marginBottom:16}}>
            <div style={{fontSize:'12px',fontWeight:600,color:C.re,marginBottom:4}}>{diff.conflicts.length} Konflikte — werden übersprungen</div>
            <ul style={{margin:0,paddingLeft:18,fontSize:'12px',color:C.tx}}>
              {diff.conflicts.slice(0,5).map((c,i)=>(<li key={i}>{c.type}: {c.reason}</li>))}
              {diff.conflicts.length>5 && <li style={{color:C.mu}}>… und {diff.conflicts.length-5} weitere</li>}
            </ul>
          </div>
        )}
        <div style={{background:C.wmP,border:`1px solid ${C.tL}`,borderRadius:6,padding:'10px 12px',marginBottom:16,fontSize:'12px',color:C.wm}}>
          <strong>Hinweis:</strong> Zeilen, die in der Excel-Datei FEHLEN, werden NICHT gelöscht. Lösche Einträge bei Bedarf direkt in der App.
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn ch="Abbrechen" onClick={onCancel} v="ghost"/>
          <Btn ch={hasChanges?`Anwenden — ${totals.add} neu, ${totals.update} aktualisiert`:'Keine Änderungen'} onClick={hasChanges?onApply:onCancel} v={hasChanges?'primary':'ghost'} dis={!hasChanges} autoFocus/>
        </div>
      </div>
    </div>
  );
}

export function SectionHeader({title,sub,action}){
  return(
    <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:20}}>
      <div>
        <h1 style={{fontFamily:serif,fontSize:'20px',color:C.tD,margin:'0 0 2px',fontWeight:700}}>{title}</h1>
        {sub&&<p style={{color:C.mu,fontSize:'13px',margin:0}}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────
const SETTINGS_KEY='aim_settings';
const DEFAULT_SETTINGS={lockedByDefault:true,defaultScale:55};

function Toggle({value,onChange}){
  return(
    <button onClick={()=>onChange(!value)} aria-label={value?'An':'Aus'} style={{width:44,height:24,borderRadius:12,background:value?'var(--c-gr)':'var(--c-bo)',border:'none',cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0,padding:0}}>
      <span style={{position:'absolute',width:18,height:18,borderRadius:'50%',background:'#fff',top:3,left:value?23:3,transition:'left 0.18s',display:'block',boxShadow:'0 1px 3px rgba(0,0,0,0.25)'}}/>
    </button>
  );
}
function SettingRow({title,sub,control}){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,padding:'14px 0',borderBottom:'1px solid var(--c-bo)'}}>
      <div>
        <div style={{fontSize:'14px',fontWeight:500,color:'var(--c-tD)'}}>{title}</div>
        {sub&&<div style={{fontSize:'12px',color:'var(--c-mu)',marginTop:2}}>{sub}</div>}
      </div>
      <div style={{flexShrink:0}}>{control}</div>
    </div>
  );
}

// ─── AIM Logo ────────────────────────────────────────────────────────────────
function AimLogo({size=32}){
  const h=size,w=size;
  const sq=Math.round(w*0.43);
  const gap=Math.round(w*0.14);
  const r=Math.round(sq*0.18);
  const x2=w-sq;
  const y2=h-sq;
  const x3=Math.round((w-sq)/2);
  return(
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
      <rect x="0" y="0" width={sq} height={sq} rx={r} fill="#d71920"/>
      <rect x={x2} y="0" width={sq} height={sq} rx={r} fill="#f08a00"/>
      <rect x={x3} y={y2} width={sq} height={sq} rx={r} fill="#f2c230"/>
    </svg>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({view,setView,qCount,pCount,examCount,collapsed,onToggle,darkMode,onToggleDark,lastSavedAt}){
  const nav=[
    {k:'dashboard',icon:'▦',label:'Dashboard'},
    {k:'questions',icon:'≡',label:'Fragen Datenbank',badge:qCount},
    {k:'courses',icon:'❖',label:'Kurs Übersicht'},
    {k:'programs',icon:'◫',label:'Weiterbildungsgänge',badge:pCount},
    {k:'exam',icon:'✎',label:'Prüfung erstellen'},
    {k:'export',icon:'↓',label:'Export & Download',badge:examCount||null},
    {k:'anleitung',icon:'📖',label:'Anleitung'},
    {k:'settings',icon:'⚙',label:'Einstellungen'},
  ];
  return(
    <div style={{width:collapsed?56:226,background:C.inv,display:'flex',flexDirection:'column',flexShrink:0,transition:'width 0.2s ease',overflow:'hidden'}}>
      <div style={{padding:collapsed?'14px 0':'14px 16px',borderBottom:`1px solid rgba(255,255,255,0.1)`,display:'flex',alignItems:'center',justifyContent:collapsed?'center':'space-between',gap:8,minHeight:60,boxSizing:'border-box'}}>
        <div style={{display:'flex',alignItems:'center',gap:collapsed?0:10,overflow:'hidden'}}>
          <AimLogo size={collapsed?28:30}/>
          {!collapsed&&(
            <div style={{overflow:'hidden'}}>
              <div style={{fontFamily:serif,fontSize:'18px',color:C.wh,fontWeight:700,lineHeight:1.1,letterSpacing:'1px'}}>AIM</div>
              <div style={{fontSize:'9px',letterSpacing:'2px',color:C.tL,textTransform:'uppercase',whiteSpace:'nowrap'}}>Prüfungs-Manager</div>
            </div>
          )}
        </div>
        <button onClick={onToggle} aria-label={collapsed?'Sidebar ausklappen':'Sidebar einklappen'} style={{background:'transparent',border:'none',color:'rgba(255,255,255,0.55)',cursor:'pointer',fontSize:'15px',padding:'2px 4px',lineHeight:1,flexShrink:0}}>{collapsed?'›':'‹'}</button>
      </div>
      <nav style={{flex:1,paddingTop:6}}>
        {nav.map(n=>{
          const active=view===n.k;
          return(
            <button data-nav={n.k} key={n.k} onClick={()=>setView(n.k)} title={collapsed?n.label:undefined} aria-label={n.label} style={{width:'100%',display:'flex',alignItems:'center',gap:collapsed?0:10,padding:collapsed?'12px 0':'10px 16px',justifyContent:collapsed?'center':'flex-start',background:active?'rgba(255,255,255,0.08)':'transparent',color:active?'#ffffff':'#cfcfcf',border:'none',borderLeft:active?`3px solid ${C.ac}`:'3px solid transparent',cursor:'pointer',fontFamily:sans,fontSize:'13px',fontWeight:active?600:400,textAlign:'left'}}>
              <span style={{fontSize:'14px',width:collapsed?undefined:16,textAlign:'center'}}>{n.icon}</span>
              {!collapsed&&<span style={{flex:1}}>{n.label}</span>}
              {!collapsed&&n.badge!=null&&<span style={{background:'rgba(255,255,255,0.18)',color:C.wh,fontSize:'11px',borderRadius:10,padding:'1px 7px',minWidth:18,textAlign:'center'}}>{n.badge}</span>}
            </button>
          );
        })}
      </nav>
      {!collapsed&&<SaveIndicator lastSavedAt={lastSavedAt}/>}
      <div style={{borderTop:'1px solid rgba(255,255,255,0.1)',padding:collapsed?'8px 0':'8px 12px',display:'flex',alignItems:'center',justifyContent:collapsed?'center':'space-between',gap:8}}>
        {!collapsed&&<span style={{fontSize:'11px',color:'rgba(200,190,180,0.7)'}}>AIM AG · Basel · Bern · Zürich</span>}
        <button onClick={onToggleDark} aria-label={darkMode?'Hellmodus':'Dunkelmodus'} title={darkMode?'Hellmodus':'Dunkelmodus'} style={{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:6,color:'rgba(255,255,255,0.8)',cursor:'pointer',padding:'5px 8px',fontSize:'14px',lineHeight:1}}>{darkMode?'☀️':'🌙'}</button>
      </div>
    </div>
  );
}

// Small status chip in the sidebar footer that flashes "Gespeichert ✓ HH:MM"
// briefly after each successful persist, then fades to a less prominent
// "Letzte Sicherung: HH:MM" so the user always knows their work is safe.
function SaveIndicator({lastSavedAt}){
  const[recent,setRecent]=useState(false);
  useEffect(()=>{
    if(!lastSavedAt) return;
    setRecent(true);
    const t=setTimeout(()=>setRecent(false),2500);
    return ()=>clearTimeout(t);
  },[lastSavedAt]);
  if(!lastSavedAt) return null;
  const savedDate=new Date(lastSavedAt);
  const now=new Date();
  // Include the date when the timestamp isn't from today, so an app left
  // open across midnight doesn't display a misleading bare HH:MM.
  const sameDay=savedDate.toDateString()===now.toDateString();
  const stamp=sameDay
    ?savedDate.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'})
    :savedDate.toLocaleString('de-CH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  return(
    <div
      role="status"
      aria-live="polite"
      style={{
        padding:'6px 12px',
        borderTop:'1px solid rgba(255,255,255,0.06)',
        fontSize:'11px',
        color:recent?'#86efac':'rgba(200,190,180,0.55)',
        display:'flex',
        alignItems:'center',
        gap:6,
        transition:'color 0.4s',
      }}
    >
      <span aria-hidden>{recent?'✓':'·'}</span>
      <span>{recent?`Gespeichert ${stamp}`:`Letzte Sicherung ${stamp}`}</span>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function Dashboard({questions,programs,exam,examName,savedExams,courseTags={},setCourseTags=()=>{},setView,setQuestions,setPrograms,setSavedExams,setExam,setExamName,showToast,showConfirm,onClearAllData,saveLastBackup}){
  const restoreRef=useRef(null);
  const excelImportRef=useRef(null);
  // Excel import preview state — when set, the modal renders and the user
  // can either Anwenden or Abbrechen. v1.0.15.
  const[excelPreview,setExcelPreview]=useState(null);
  // Tick to force re-read of aim_last_backup when destructive ops run.
  const[lastBackupTick,setLastBackupTick]=useState(0);
  const lastBackupMeta=React.useMemo(()=>{
    try{
      const raw=window.localStorage.getItem('aim_last_backup');
      if(!raw) return null;
      const parsed=JSON.parse(raw);
      return{
        capturedAt:parsed.capturedAt,
        questionCount:parsed.questions?.length||0,
        programCount:parsed.programs?.length||0,
        examCount:parsed.savedExams?.length||0,
      };
    }catch{ return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[questions,programs,savedExams,exam,lastBackupTick]);
  const restoreLastBackup=()=>{
    if(!lastBackupMeta) return;
    showConfirm({
      message:`Letzten gespeicherten Stand vom ${new Date(lastBackupMeta.capturedAt).toLocaleString('de-CH')} wiederherstellen? Aktuelle Daten werden überschrieben (und vor dem Wiederherstellen erneut gesichert).`,
      confirmLabel:'Wiederherstellen',
      confirmV:'danger',
      onConfirm:()=>{
        try{
          const raw=window.localStorage.getItem('aim_last_backup');
          if(!raw){ showToast('Kein gespeicherter Stand vorhanden.','error'); return; }
          const data=JSON.parse(raw);
          // Snapshot CURRENT state first so the user can undo the undo.
          saveLastBackup?.();
          applyRestore(data);
          setLastBackupTick(t=>t+1);
        }catch{
          showToast('Stand konnte nicht wiederhergestellt werden.','error');
        }
      },
    });
  };
  const courses=[...new Set(questions.map(q=>q.course))];
  const fmtCounts=FORMATS.map(f=>({f,n:questions.filter(q=>q.format===f).length}));
  const exportBackup=()=>{
    const data=JSON.stringify({
      version:4,
      exportedAt:new Date().toISOString(),
      questions,
      programs,
      semesterView:buildSemesterOverviewEntries(programs),
      savedExams,
      currentExam:exam?{exam,name:examName||''}:null,
      courseTags,
    },null,2);
    dlFile(data,`AIM_Backup_${new Date().toISOString().slice(0,10)}.json`,'application/json');
    showToast('Backup-Datei wird heruntergeladen.','success');
  };
  const applyRestore=data=>{
    if(!Array.isArray(data.questions)||!Array.isArray(data.programs)){
      showToast('Ungültige Backup-Datei.','error');
      return;
    }
    setQuestions(data.questions);
    setPrograms(normalizePrograms(data.programs));
    setSavedExams(Array.isArray(data.savedExams)?data.savedExams:[]);
    setExam(data.currentExam?.exam||null);
    setExamName(data.currentExam?.name||'');
    // v4+ backups carry explicit courseTags. Older (v3 or v2) backups don't
    // — when restoring those, run the migration to compute initial tags
    // from the restored programs matrix.
    if(data.courseTags && typeof data.courseTags==='object'){
      setCourseTags(data.courseTags);
    }else{
      const migrated=migrateCourseTagsFromMatrix(data.questions,normalizePrograms(data.programs));
      setCourseTags(migrated);
    }
    showToast(`Backup wiederhergestellt: ${data.questions.length} Fragen, ${data.programs.length} Weiterbildungsgänge, ${(data.savedExams||[]).length} gespeicherte Prüfungen.`,'success');
  };
  const restoreBackup=e=>{
    const file=e.target.files[0];
    e.target.value='';
    if(!file)return;
    showConfirm({
      message:`Die aktuelle Datenbank wird durch den Inhalt von „${file.name}“ ersetzt. Fortfahren?`,
      confirmLabel:'Wiederherstellen',
      confirmV:'danger',
      onConfirm:()=>{
        const reader=new FileReader();
        reader.onload=evt=>{
          try{
            const data=JSON.parse(evt.target.result);
            // Snapshot current state first so the user can recover.
            saveLastBackup?.();
            applyRestore(data);
            setLastBackupTick(t=>t+1);
          }catch{ showToast('Backup-Datei konnte nicht gelesen werden.','error'); }
        };
        reader.readAsText(file);
      },
    });
  };
  // Excel import — v1.0.15 round-trip pipeline:
  //   1. Parse the file into structured data (preserving IDs)
  //   2. Diff against current state
  //   3. Show preview modal so user sees exact counts
  //   4. On apply: snapshot current state, then merge
  // The previous wipe-and-replace behaviour is gone — Excel imports now MERGE
  // by ID and never delete missing rows.
  const requestExcelImport=file=>{
    if(!file)return;
    previewExcelImport(
      file,
      {questions, programs, courseTags, savedExams},
      (diff, parsed)=>{ setExcelPreview({diff, parsed, fileName:file.name}); },
      showToast,
    );
  };
  const applyExcelPreview=()=>{
    if(!excelPreview) return;
    try{
      applyExcelImport(excelPreview.diff,{questions,programs,courseTags,savedExams},{
        setQuestions,setPrograms,setCourseTags,setSavedExams,
        saveLastBackup:()=>saveLastBackup?.(),
        normalizePrograms,
      });
      const d=excelPreview.diff;
      const totalAdd=d.questions.add.length+d.programs.add.length+d.courseTags.add.length+d.savedExams.add.length;
      const totalUpd=d.questions.update.length+d.programs.update.length+d.courseTags.update.length+d.savedExams.update.length;
      showToast(`Excel-Import: ${totalAdd} neu, ${totalUpd} aktualisiert.`,'success');
      setLastBackupTick(t=>t+1);
    }catch(e){
      console.error('applyExcelImport failed:',e);
      showToast('Import konnte nicht angewendet werden.','error');
    }finally{
      setExcelPreview(null);
    }
  };
  return(
    <>
    <ExcelImportPreviewModal preview={excelPreview} onCancel={()=>setExcelPreview(null)} onApply={applyExcelPreview}/>
    <div style={{padding:28}}>
      <SectionHeader title="Dashboard" sub="AIM Prüfungs-Manager — Willkommen" action={<Btn ch="Neue Prüfung →" onClick={()=>setView('exam')} v="primary"/>}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
        {[
          {label:'Fragen gesamt',val:questions.length,bg:C.tP,tx:C.tD},
          {label:'Kurse',val:courses.length,bg:C.wmP,tx:C.wm},
          {label:'Weiterbildungsgänge',val:programs.length,bg:C.st,tx:C.mu},
          {label:'Gespeicherte Prüfungen',val:savedExams.length,bg:savedExams.length?C.gP:C.st,tx:savedExams.length?C.gr:C.mu},
        ].map(s=>(
          <div key={s.label} style={{background:s.bg,borderRadius:8,padding:'14px 16px'}}>
            <div style={{fontSize:'11px',color:s.tx,opacity:.7,marginBottom:4,fontWeight:500}}>{s.label}</div>
            <div style={{fontSize:'30px',fontWeight:700,color:s.tx,lineHeight:1}}>{s.val}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:16}}>
          <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.mu,marginBottom:12,fontWeight:500}}>Frageformate</div>
          {fmtCounts.map(({f,n})=>{
            const pct=Math.round(n/questions.length*100)||0;
            return(
              <div key={f} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',marginBottom:3}}>
                  <span style={{color:C.tx}}>{f}</span><span style={{color:C.mu}}>{n} ({pct}%)</span>
                </div>
                <div style={{background:C.st,borderRadius:2,height:5}}>
                  <div style={{background:C.t,height:5,borderRadius:2,width:`${pct}%`,transition:'width .3s'}}/>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:16}}>
          <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.mu,marginBottom:12,fontWeight:500}}>Schnellzugriff</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <button onClick={()=>setView('exam')} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:C.tP,border:`1px solid ${C.tL}`,borderRadius:6,cursor:'pointer',textAlign:'left'}}>
              <span style={{fontSize:'18px'}}>✎</span>
              <div><div style={{fontSize:'13px',fontWeight:500,color:C.tD}}>Prüfung erstellen</div><div style={{fontSize:'11px',color:C.mu}}>Weiterbildungsgang auswählen</div></div>
            </button>
            <button onClick={()=>setView('questions')} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:C.wW,border:`1px solid ${C.bo}`,borderRadius:6,cursor:'pointer',textAlign:'left'}}>
              <span style={{fontSize:'18px'}}>≡</span>
              <div><div style={{fontSize:'13px',fontWeight:500,color:C.tx}}>Fragen verwalten</div><div style={{fontSize:'11px',color:C.mu}}>{questions.length} Fragen in der Datenbank</div></div>
            </button>
            {exam?.length>0&&(
              <button onClick={()=>setView('export')} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:C.gP,border:`1px solid #86efac`,borderRadius:6,cursor:'pointer',textAlign:'left'}}>
                <span style={{fontSize:'18px'}}>↓</span>
                <div><div style={{fontSize:'13px',fontWeight:500,color:C.gr}}>Export herunterladen</div><div style={{fontSize:'11px',color:C.mu}}>{exam.length} Fragen bereit</div></div>
              </button>
            )}
          </div>
        </div>
        <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:16,marginTop:16}}>
          <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.mu,marginBottom:8,fontWeight:500}}>Datensicherung</div>
          <p style={{fontSize:'13px',color:C.tx,margin:'0 0 12px',lineHeight:1.55}}>Alle Daten werden automatisch auf diesem Computer gespeichert. Zum Weitergeben oder als Sicherheitskopie eignet sich der Export. Backups enthalten auch die <strong>gespeicherten Prüfungen</strong>.</p>
          <input ref={restoreRef} type="file" accept=".json" style={{display:'none'}} onChange={restoreBackup}/>
          <input ref={excelImportRef} type="file" accept=".xlsx" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];e.target.value='';requestExcelImport(f);}}/>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:'11px',color:C.mu,marginBottom:6,fontWeight:500}}>JSON (vollständiges Backup)</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <Btn ch="💾 Jetzt sichern" onClick={()=>{try{window.localStorage.setItem('aim_q',JSON.stringify(questions));window.localStorage.setItem('aim_p',JSON.stringify(programs));window.localStorage.setItem('aim_saved_exams',JSON.stringify(savedExams));if(exam){window.localStorage.setItem('aim_exam',JSON.stringify({exam,name:examName||''}));}showToast('Daten gespeichert.','success');}catch{showToast('Speichern fehlgeschlagen.','error');}}} v="secondary"/>
              <Btn ch="↑ JSON laden" onClick={()=>restoreRef.current?.click()} v="ghost"/>
              <Btn ch="↓ JSON exportieren" onClick={exportBackup} v="ghost"/>
            </div>
          </div>
          <div>
            <div style={{fontSize:'11px',color:C.mu,marginBottom:6,fontWeight:500}}>Excel (Fragen, Weiterbildungsgänge, Semesteransicht, Gespeicherte Prüfungen)</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <Btn ch="↓ Excel exportieren" onClick={()=>{exportExcel(questions,programs,savedExams,courseTags);showToast('Excel-Datei wird heruntergeladen.','success');}} v="ghost"/>
              <Btn ch="↑ Excel importieren" onClick={()=>excelImportRef.current?.click()} v="ghost"/>
            </div>
          </div>
        </div>
        <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:16,marginTop:16}}>
          <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.mu,marginBottom:8,fontWeight:500}}>Daten zurücksetzen</div>
          <p style={{fontSize:'13px',color:C.tx,margin:'0 0 12px',lineHeight:1.55}}>Löscht alle Fragen, Weiterbildungsgänge, gespeicherten Prüfungen und die aktuell erstellte Prüfung aus der App. Danach kann direkt eine neue JSON- oder Excel-Version importiert werden. <strong>Der bisherige Stand wird automatisch gesichert</strong> und kann unten wiederhergestellt werden.</p>
          <Btn ch="✕ Alle Daten löschen" onClick={()=>showConfirm({message:'Möchtest du wirklich alle Daten in der App löschen? Fragen, Weiterbildungsgänge, gespeicherte Prüfungen und die aktuelle Prüfung werden entfernt. Der vorherige Stand wird automatisch gesichert.',confirmLabel:'Alle Daten löschen',confirmV:'danger',onConfirm:onClearAllData})} v="danger"/>
        </div>
        {lastBackupMeta&&(
          <div style={{background:C.gP,border:`1px solid #86efac`,borderRadius:8,padding:16,marginTop:16}}>
            <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.gr,marginBottom:8,fontWeight:500}}>↺ Letzten Stand wiederherstellen</div>
            <p style={{fontSize:'13px',color:C.tx,margin:'0 0 12px',lineHeight:1.55}}>
              Automatische Sicherung vom <strong>{new Date(lastBackupMeta.capturedAt).toLocaleString('de-CH')}</strong> ·{' '}
              {lastBackupMeta.questionCount} Fragen, {lastBackupMeta.programCount} Weiterbildungsgänge, {lastBackupMeta.examCount} gespeicherte Prüfungen.
              <br/>Wird automatisch erstellt, bevor Daten gelöscht oder ein Backup importiert wird.
            </p>
            <Btn ch="↺ Letzten Stand wiederherstellen" onClick={restoreLastBackup} v="success"/>
          </div>
        )}
        <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:16,marginTop:16}}>
          <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.mu,marginBottom:8,fontWeight:500}}>Gespeicherte Prüfungen</div>
          {savedExams.length===0?(
            <p style={{fontSize:'13px',color:C.tx,margin:0,lineHeight:1.55}}>Noch keine gespeicherte Prüfung vorhanden. In <strong>Export &amp; Download</strong> kannst du eine fertige Prüfung speichern und direkt mit einer neuen starten.</p>
          ):(
            <div style={{display:'grid',gap:8}}>
              {savedExams.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(saved=>(
                <div key={saved.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'10px 12px',border:'1px solid '+C.bo,borderRadius:8,background:C.wW,flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontSize:'14px',fontWeight:600,color:C.tD}}>{saved.name}</div>
                    <div style={{fontSize:'12px',color:C.mu}}>{saved.programName||'Prüfung'} · {saved.questions?.length||0} Fragen · {saved.createdAt?new Date(saved.createdAt).toLocaleString('de-CH'):'-'}</div>
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <Btn ch="Öffnen" onClick={()=>{setExam(saved.questions||[]);setExamName(saved.name||saved.programName||'Prüfung');setView('export');}} v="ghost" sm/>
                    <Btn ch="✕" onClick={()=>showConfirm({message:`Gespeicherte Prüfung „${saved.name}“ löschen?`,confirmLabel:'Prüfung löschen',confirmV:'danger',onConfirm:()=>{setSavedExams(prev=>prev.filter(item=>item.id!==saved.id));showToast('Gespeicherte Prüfung gelöscht.','success');}})} v="danger" sm/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:16,marginTop:16}}>
          <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.mu,marginBottom:8,fontWeight:500}}>App schliessen</div>
          <p style={{fontSize:'13px',color:C.tx,margin:'0 0 12px',lineHeight:1.55}}>Schliesst das Programm. Alle Daten bleiben gespeichert und sind beim nächsten Start wieder da.</p>
          <Btn ch="⏻ App schliessen" onClick={()=>showConfirm({message:'App wirklich schliessen? Alle Daten sind gespeichert und beim nächsten Öffnen wieder da.',confirmLabel:'App schliessen',confirmV:'danger',onConfirm:()=>window.close()})} v="ghost"/>
        </div>
      </div>
    </div>
    </>
  );
}

// ─── Question DB ──────────────────────────────────────────────────────────────
const emptyQ=()=>({id:newId('q'),year:'',location:'',lecturer:'',course:'',format:'Single Choice',question:'',optA:'',optB:'',optC:'',optD:'',optE:'',answer:'A'});

export function QuestionDB({questions,setQuestions,programs=[],courseTags={},setCourseTags=()=>{},showToast,showConfirm}){
  const[mode,setMode]=useState('list'); // 'list' | 'form'
  const[editing,setEditing]=useState(null);
  const[search,setSearch]=useState('');
  const[filterCourse,setFilterCourse]=useState('');
  const[filterFmt,setFilterFmt]=useState('');
  const[filterLecturer,setFilterLecturer]=useState('');
  const[filterProgram,setFilterProgram]=useState('');
  const[page,setPage]=useState(0);
  const[pageSize,setPageSize]=useState(15);
  const[editMode,setEditMode]=useState(false);
  const[showImportInfo,setShowImportInfo]=useState(false);
  const importRef=useRef(null);

  const courses=useMemo(()=>[...new Set(questions.map(q=>q.course))].sort(),[questions]);
  const lecturers=useMemo(()=>[...new Set(questions.map(q=>q.lecturer).filter(Boolean))].sort(),[questions]);
  // Computed: for each question, which Weiterbildungsgänge does it belong
  // to? Uses the same matching rule as the exam builder. Recomputed only
  // when questions or programs change, not on every keystroke.
  const programsByQuestionId=useMemo(()=>{
    const map=new Map();
    questions.forEach(q=>{
      map.set(q.id,programsForQuestion(q,programs,courseTags));
    });
    return map;
  },[questions,programs,courseTags]);
  const filtered=useMemo(()=>questions.filter(q=>{
    const s=search.toLowerCase();
    if(s && !(q.question.toLowerCase().includes(s)||q.course.toLowerCase().includes(s)||q.lecturer.toLowerCase().includes(s))) return false;
    if(filterCourse && q.course!==filterCourse) return false;
    if(filterFmt && q.format!==filterFmt) return false;
    if(filterLecturer && q.lecturer!==filterLecturer) return false;
    if(filterProgram){
      const list=programsByQuestionId.get(q.id)||[];
      if(!list.some(p=>String(p.id)===String(filterProgram))) return false;
    }
    return true;
  }),[questions,search,filterCourse,filterFmt,filterLecturer,filterProgram,programsByQuestionId]);
  const paged=pageSize==='all'?filtered:filtered.slice(page*pageSize,(page+1)*pageSize);

  useEffect(()=>{setPage(0);},[pageSize]);

  const openNew=()=>{
    // Brand-new question: start with no tags. User picks WBGs explicitly.
    setEditing({...emptyQ(),_tags:[]});
    setMode('form');
  };
  const openEdit=q=>{
    // Edit: load the course's current tags as the form's starting point.
    setEditing({...q,_tags:(courseTags[q.course]||[]).map(String)});
    setMode('form');
  };
  const cancel=()=>{setEditing(null);setMode('list');};
  const save=()=>{
    if(!editing.question.trim()||!editing.course.trim()){showToast('Kursname und Frage sind Pflichtfelder.','error');return;}
    const isEdit=questions.some(q=>q.id===editing.id);
    if(!isEdit){
      const dup=questions.find(q=>q.question.trim().toLowerCase()===editing.question.trim().toLowerCase());
      if(dup)showToast(`Hinweis: Ähnliche Frage bereits im Kurs „${dup.course}" vorhanden.`,'warning');
    }
    // Persist the tags as a course-level entry. Strip the _tags field from
    // the question object itself — it's UI-only state, not part of the
    // serialised question shape.
    const finalCourse=editing.course.trim();
    const newTags=Array.isArray(editing._tags)?editing._tags.map(String):[];
    setCourseTags(prev=>({...prev,[finalCourse]:newTags}));
    const {_tags,...questionData}=editing;
    questionData.course=finalCourse;
    setQuestions(prev=>isEdit?prev.map(q=>q.id===editing.id?questionData:q):[...prev,questionData]);
    showToast(isEdit?'Frage aktualisiert.':'Frage gespeichert.','success');
    cancel();
  };
  const del=id=>{
    showConfirm({
      message:'Frage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
      confirmLabel:'Löschen',
      confirmV:'danger',
      onConfirm:()=>{
        setQuestions(prev=>prev.filter(q=>q.id!==id));
        showToast('Frage gelöscht.','success');
      },
    });
  };
  const importFile=e=>{
    const file=e.target.files[0];
    if(!file)return;
    const lower=file.name.toLowerCase();
    if(lower.endsWith('.xlsx')||lower.endsWith('.xls')){
      importQuestionsExcel(file,setQuestions,showToast);
      e.target.value='';
      return;
    }
    const reader=new FileReader();
    reader.onload=evt=>{
      try{
        let rows=[];
        if(file.name.toLowerCase().endsWith('.json')){
          const parsed=JSON.parse(evt.target.result);
          rows=Array.isArray(parsed)?parsed:[];
        }else{
          const lines=evt.target.result.split('\n').filter(l=>l.trim());
          if(lines.length<2){showToast('CSV-Datei enthält keine Daten.','error');return;}
          const header=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
          rows=lines.slice(1).map(line=>{
            const vals=line.split(',').map(v=>v.trim().replace(/^"|"$/g,''));
            const obj={};header.forEach((h,i)=>{obj[h]=vals[i]||'';});return obj;
          });
        }
        let added=0,skipped=0;
        const toAdd=[];
        rows.forEach(r=>{
          if(!r.course||!r.question||!r.answer){skipped++;return;}
          toAdd.push({id:newId('q'),year:r.year||'',location:r.location||'',lecturer:r.lecturer||'',course:r.course,format:FORMATS.includes(r.format)?r.format:'Single Choice',question:r.question,optA:r.optA||'',optB:r.optB||'',optC:r.optC||'',optD:r.optD||'',optE:r.optE||'',answer:r.answer});
          added++;
        });
        setQuestions(prev=>[...prev,...toAdd]);
        showToast(`${added} Fragen importiert${skipped?`, ${skipped} übersprungen`:''}`,added>0?'success':'warning');
      }catch{showToast('Importfehler: Dateiformat ungültig.','error');}
    };
    reader.readAsText(file);
    e.target.value='';
  };
  const exportQuestions=()=>{
    dlFile(JSON.stringify(filtered,null,2),`AIM_Fragen_${new Date().toISOString().slice(0,10)}.json`,'application/json');
    showToast(`${filtered.length} Fragen exportiert.`,'success');
  };
  const exportQuestionsXlsx=()=>{
    exportQuestionsExcel(filtered);
    showToast(`${filtered.length} Fragen als Excel exportiert.`,'success');
  };
  const upd=k=>v=>setEditing(e=>{
    const next={...e,[k]:v};
    // When the course name changes, re-prime the tag selection from whatever
    // tags the new course has on record (empty for brand-new course names).
    if(k==='course'){
      const trimmed=(v||'').trim();
      next._tags=trimmed?((courseTags[trimmed]||[]).map(String)):[];
    }
    return next;
  });

  if(mode==='form'&&editing) return(
    <div style={{padding:28}}>
      <SectionHeader title={editing.id&&questions.find(q=>q.id===editing.id)?'Frage bearbeiten':'Neue Frage'} sub="Alle markierten Felder sind Pflichtfelder" action={<div style={{display:'flex',gap:8}}><Btn ch="Abbrechen" onClick={cancel} v="ghost"/><Btn ch="Speichern" onClick={save} v="primary"/></div>}/>
      <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:20}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <Field label="Kursname *" half>
            <input list="course-list" style={inp} value={editing.course} onChange={e=>upd('course')(e.target.value)} placeholder="z.B. Psychoonkologie"/>
            <datalist id="course-list">{courses.map(c=><option key={c} value={c}/>)}</datalist>
          </Field>
          <Field label="Dozent/in" half><input style={inp} value={editing.lecturer} onChange={e=>upd('lecturer')(e.target.value)} placeholder="z.B. Dr. Muster"/></Field>
          <Field label="Erstellungsjahr" half><input style={inp} value={editing.year} onChange={e=>upd('year')(e.target.value)} placeholder="2025"/></Field>
          <Field label="Standort" half><input style={inp} value={editing.location} onChange={e=>upd('location')(e.target.value)} placeholder="Bern / Zürich …"/></Field>
        </div>
        {/* Weiterbildungsgang-Tags. These are stored AT COURSE LEVEL, not per
            question — picking a tag here applies to every question in the
            same Kurs. The editing form carries them in editing._tags during
            the session, committing to courseTags only on Save. */}
        <Field label="Weiterbildungsgänge — diese Frage ist relevant für">
          {programs.length===0
            ?<div style={{fontSize:'12px',color:'var(--c-mu)',fontStyle:'italic'}}>Noch kein Weiterbildungsgang vorhanden — zuerst einen anlegen, dann hier auswählen.</div>
            :<div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {programs.map(p=>{
                const tags=editing._tags||[];
                const checked=tags.map(String).includes(String(p.id));
                return(
                  <label key={p.id} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 10px',border:`1px solid ${checked?C.t:C.bo}`,borderRadius:6,cursor:'pointer',fontSize:'12px',background:checked?C.tP:C.wh,color:checked?C.tD:C.tx,transition:'all 0.15s'}}>
                    <input type="checkbox" checked={checked} onChange={()=>{
                      setEditing(prev=>{
                        const cur=(prev._tags||[]).map(String);
                        const id=String(p.id);
                        const next=cur.includes(id)?cur.filter(x=>x!==id):[...cur,id];
                        return{...prev,_tags:next};
                      });
                    }} style={{margin:0}}/>
                    <span>{shortProgramName(p.name)}</span>
                  </label>
                );
              })}
            </div>
          }
          <div style={{fontSize:'11px',color:C.mu,marginTop:6,lineHeight:1.5}}>
            Diese Auswahl gilt für <strong>alle Fragen</strong> im Kurs „{editing.course||'…'}". Änderungen werden beim Speichern für den Kurs übernommen.
          </div>
        </Field>
        <Field label="Format *">
          <select style={{...inp,width:'auto'}} value={editing.format} onChange={e=>{const f=e.target.value;upd('format')(f);if(f==='Richtig/Falsch'){upd('optA')('Richtig');upd('optB')('Falsch');upd('optC')('');upd('optD')('');upd('optE')('');setEditing(prev=>({...prev,format:f,optA:'Richtig',optB:'Falsch',optC:'',optD:'',optE:'',answer:'A'}));}else if(f==='Ja/Nein'){setEditing(prev=>({...prev,format:f,optA:'Ja',optB:'Nein',optC:'',optD:'',optE:'',answer:'A'}));}else setEditing(prev=>({...prev,format:f}));}}>
            {FORMATS.map(f=><option key={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Frage *"><textarea style={{...inp,minHeight:80,resize:'vertical'}} value={editing.question} onChange={e=>upd('question')(e.target.value)} placeholder="Fragetext eingeben…"/></Field>
        {editing.format!=='Richtig/Falsch'&&editing.format!=='Ja/Nein'&&(
          <>
            <div style={{fontSize:'11px',letterSpacing:'1px',textTransform:'uppercase',color:C.mu,marginBottom:8,fontWeight:500}}>Antwortoptionen</div>
            {['A','B','C','D','E'].map(k=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{width:20,fontSize:'13px',color:C.mu,fontWeight:500}}>{k}</span>
                <input style={{...inp,flex:1}} value={editing[`opt${k}`]} onChange={e=>upd(`opt${k}`)(e.target.value)} placeholder={`Option ${k}`}/>
              </div>
            ))}
          </>
        )}
        <Field label="Richtige Antwort(en)">
          {editing.format==='Richtig/Falsch'||editing.format==='Ja/Nein'?(
            <div style={{display:'flex',gap:16}}>
              {['A','B'].map(k=>(
                <label key={k} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:'14px',color:C.tx}}>
                  <input type="radio" checked={editing.answer===k} onChange={()=>upd('answer')(k)}/>
                  {k==='A'?(editing.format==='Richtig/Falsch'?'Richtig':'Ja'):(editing.format==='Richtig/Falsch'?'Falsch':'Nein')}
                </label>
              ))}
            </div>
          ):editing.format==='Multiple Choice'?(
            <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
              {['A','B','C','D','E'].filter(k=>editing[`opt${k}`]).map(k=>(
                <label key={k} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:'14px',color:C.tx}}>
                  <input type="checkbox" checked={(editing.answer||'').split(';').includes(k)} onChange={e=>{const cur=(editing.answer||'').split(';').filter(Boolean);const next=e.target.checked?[...cur,k]:cur.filter(x=>x!==k);upd('answer')(next.sort().join(';'));}}/>
                  {k}
                </label>
              ))}
            </div>
          ):(
            <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
              {['A','B','C','D','E'].filter(k=>editing[`opt${k}`]).map(k=>(
                <label key={k} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:'14px',color:C.tx}}>
                  <input type="radio" checked={editing.answer===k} onChange={()=>upd('answer')(k)}/>
                  {k}
                </label>
              ))}
            </div>
          )}
        </Field>
      </div>
    </div>
  );

  return(
    <div style={{padding:28}}>
      <SectionHeader title="Fragen Datenbank" sub={`${questions.length} Fragen · ${courses.length} Kurse`} action={
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <input ref={importRef} type="file" accept=".json,.csv,.xlsx,.xls" style={{display:'none'}} onChange={importFile}/>
          <Btn ch={editMode?'🔒 Ansicht':'✏️ Bearbeiten'} onClick={()=>setEditMode(m=>!m)} v={editMode?'secondary':'ghost'} sm/>
          <Btn ch="↑ Import" onClick={()=>{setShowImportInfo(v=>!v);}} v="ghost" sm/>
          {editMode&&<>
            <Btn ch="↓ JSON Export" onClick={exportQuestions} v="ghost" sm/>
            <Btn ch="↓ Excel Export" onClick={exportQuestionsXlsx} v="ghost" sm/>
            <Btn ch="+ Neue Frage" onClick={openNew} v="primary"/>
          </>}
        </div>
      }/>
      {showImportInfo&&(
        <div style={{background:'var(--c-tP)',border:'1px solid var(--c-tL)',borderRadius:8,padding:'14px 16px',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{fontWeight:600,fontSize:'13px',color:'var(--c-tD)',marginBottom:8}}>Import-Vorlage: JSON, CSV oder Excel</div>
            <button onClick={()=>setShowImportInfo(false)} style={{background:'transparent',border:'none',cursor:'pointer',color:'var(--c-mu)',fontSize:16,lineHeight:1}}>✕</button>
          </div>
          <div style={{fontSize:'12px',color:'var(--c-tx)',lineHeight:1.7,marginBottom:8}}>
            Pflichtfelder: <strong>course</strong>, <strong>question</strong>, <strong>answer</strong><br/>
            Optionale Felder: <code>format</code>, <code>optA</code>, <code>optB</code>, <code>optC</code>, <code>optD</code>, <code>optE</code>, <code>lecturer</code>, <code>year</code>, <code>location</code>, <code>ID</code><br/>
            Tipp: Für Excel-Roundtrips zuerst <strong>↓ Excel Export</strong> verwenden. Die <strong>ID</strong>-Spalte sorgt dafür, dass bearbeitete Fragen wieder sauber aktualisiert werden statt doppelt zu erscheinen.
          </div>
          <div style={{background:'var(--c-wh)',borderRadius:6,padding:'10px 12px',fontFamily:'monospace',fontSize:'11px',color:'var(--c-tx)',lineHeight:1.8,marginBottom:10}}>
            {`[{\n  "ID": "1",\n  "course": "Psychoonkologie",\n  "question": "Welche Intervention ist angezeigt?",\n  "format": "Single Choice",\n  "optA": "Option A",\n  "optB": "Option B",\n  "optC": "Option C",\n  "optD": "Option D",\n  "answer": "A",\n  "lecturer": "Dr. Muster",\n  "year": "2025"\n}]`}
          </div>
          <Btn ch="↑ Datei auswählen" onClick={()=>importRef.current?.click()} v="primary" sm/>
        </div>
      )}
      {!showImportInfo&&(
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          <input style={{...inp,width:240}} placeholder="Suche Frage, Kurs, Dozent…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/>
          <select style={{...inp,width:200}} value={filterCourse} onChange={e=>{setFilterCourse(e.target.value);setPage(0);}}>
            <option value="">Alle Kurse</option>{courses.map(c=><option key={c}>{c}</option>)}
          </select>
          <select style={{...inp,width:190}} value={filterLecturer} onChange={e=>{setFilterLecturer(e.target.value);setPage(0);}}>
            <option value="">Alle Dozenten</option>{lecturers.map(l=><option key={l}>{l}</option>)}
          </select>
          <select style={{...inp,width:220}} value={filterProgram} onChange={e=>{setFilterProgram(e.target.value);setPage(0);}}>
            <option value="">Alle Weiterbildungsgänge</option>
            {programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select style={{...inp,width:150}} value={filterFmt} onChange={e=>{setFilterFmt(e.target.value);setPage(0);}}>
            <option value="">Alle Formate</option>{FORMATS.map(f=><option key={f}>{f}</option>)}
          </select>
          <select style={{...inp,width:160}} value={pageSize} onChange={e=>setPageSize(e.target.value==='all'?'all':Number(e.target.value))}>
            <option value={15}>15 pro Seite</option>
            <option value={30}>30 pro Seite</option>
            <option value={50}>50 pro Seite</option>
            <option value="all">Alle Fragen</option>
          </select>
          {(search||filterCourse||filterFmt||filterLecturer||filterProgram)&&<Btn ch="✕ Zurücksetzen" onClick={()=>{setSearch('');setFilterCourse('');setFilterFmt('');setFilterLecturer('');setFilterProgram('');setPage(0);}} v="ghost" sm/>}
          <span style={{fontSize:'12px',color:'var(--c-mu)',alignSelf:'center',marginLeft:'auto'}}>{filtered.length} Treffer</span>
        </div>
      )}
      {!editMode&&<div style={{background:'var(--c-st)',border:'1px solid var(--c-bo)',borderRadius:6,padding:'7px 12px',marginBottom:12,fontSize:'12px',color:'var(--c-mu)',display:'flex',alignItems:'center',gap:6}}>🔒 Lesemodus — klicke <strong>✏️ Bearbeiten</strong> um Fragen zu bearbeiten oder zu löschen.</div>}
      <div style={{background:'var(--c-wh)',border:'1px solid var(--c-bo)',borderRadius:8,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:C.inv}}>
              {['#','Kurs','Dozent/in','Weiterbildungsgänge','Format','Frage','Antwort',...(editMode?['']:[''])].map(h=>(
                <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:'11px',fontWeight:500,color:'#f3dcc9',letterSpacing:'0.5px',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length===0&&<tr><td colSpan={8} style={{padding:32,textAlign:'center',color:'var(--c-mu)',fontSize:'14px'}}>{questions.length===0?<span>Noch keine Fragen — klicke <strong>✏️ Bearbeiten</strong> dann <strong>+ Neue Frage</strong>.</span>:'Keine Treffer. Filter anpassen oder zurücksetzen.'}</td></tr>}
            {paged.map((q,i)=>{
              const matchedPrograms=programsByQuestionId.get(q.id)||[];
              return(
              <React.Fragment key={q.id}>
                {i>0&&q.course!==paged[i-1].course&&(
                  <tr><td colSpan={8} style={{padding:0,height:2,background:'rgba(0,0,0,0.07)'}}></td></tr>
                )}
              <tr style={{borderBottom:'1px solid var(--c-bo)',background:i%2===0?'var(--c-wh)':'var(--c-wW)'}}>
                <td style={{padding:'8px 12px',fontSize:'12px',color:'var(--c-mu)',width:36}}>{q.id}</td>
                <td style={{padding:'8px 12px',fontSize:'12px',maxWidth:160}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--c-tD)',fontWeight:500}}>{q.course}</div><div style={{fontSize:'11px',color:'var(--c-mu)'}}>{q.year||'–'}</div></td>
                <td style={{padding:'8px 12px',fontSize:'12px',color:'var(--c-tx)',maxWidth:140}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.lecturer||'–'}</div></td>
                <td style={{padding:'8px 12px',maxWidth:180}}>
                  {matchedPrograms.length===0
                    ?<span style={{fontSize:'11px',color:'var(--c-mu)',fontStyle:'italic'}} title="Diese Frage erscheint in keinem aktuellen Weiterbildungsgang. Kurs oder Dozent/in passt zu keinem Modul.">— keiner</span>
                    :<div style={{display:'flex',flexWrap:'wrap',gap:4}} title={matchedPrograms.map(p=>p.name).join(', ')}>
                      {matchedPrograms.map(p=>(
                        <Badge key={p.id} ch={shortProgramName(p.name)} color="gray" sm/>
                      ))}
                    </div>
                  }
                </td>
                <td style={{padding:'8px 12px'}}><Badge ch={q.format} color={q.format==='Multiple Choice'?'warm':q.format==='Richtig/Falsch'?'gray':'teal'} sm/></td>
                <td style={{padding:'8px 12px',fontSize:'12px',color:'var(--c-tx)',maxWidth:300}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.question}</div></td>
                <td style={{padding:'8px 12px',fontSize:'12px',fontWeight:600,color:'var(--c-gr)'}}>{q.answer}</td>
                <td style={{padding:'8px 12px',width:editMode?130:0}}>
                  {editMode&&<div style={{display:'flex',gap:6}}>
                    <Btn ch="Bearbeiten" onClick={()=>openEdit(q)} v="ghost" sm/>
                    <Btn ch="✕" onClick={()=>del(q.id)} v="danger" sm/>
                  </div>}
                </td>
              </tr>
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {pageSize!=='all'&&filtered.length>pageSize&&(
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:12,justifyContent:'center'}}>
          <Btn ch="‹" onClick={()=>setPage(p=>Math.max(0,p-1))} v="ghost" sm dis={page===0}/>
          <span style={{fontSize:'13px',color:'var(--c-mu)'}}>Seite {page+1} / {Math.ceil(filtered.length/pageSize)}</span>
          <Btn ch="›" onClick={()=>setPage(p=>p+1)} v="ghost" sm dis={(page+1)*pageSize>=filtered.length}/>
        </div>
      )}
    </div>
  );
}

// ─── Course Autocomplete ──────────────────────────────────────────────────────
function CourseAutocomplete({value,onChange,courses,locked,placeholder,questions,programId,courseTags={}}){
  const[open,setOpen]=useState(false);
  const[input,setInput]=useState(value||'');
  const ref=useRef(null);
  const pendingSelectAllRef=useRef(false);
  useEffect(()=>{setInput(value||'');},[value]);
  useEffect(()=>{
    if(!open)return;
    const handler=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',handler);
    return()=>document.removeEventListener('mousedown',handler);
  },[open]);
  // The autocomplete suggests courses for a specific Weiterbildungsgang.
  // We narrow the list to only courses tagged for THIS WBG (so the dropdown
  // only shows courses that "belong" to this program). Free-text typing is
  // still allowed for anything not in the list — the user can always add a
  // course later by tagging it from Kurs Übersicht.
  const filtered=useMemo(()=>{
    const q=input.trim().toLowerCase();
    const pid=programId?String(programId):'';
    return courses.filter(c=>{
      if(q && !c.toLowerCase().includes(q)) return false;
      if(pid){
        const tags=(courseTags[c]||[]).map(String);
        if(!tags.includes(pid)) return false;
      }
      return true;
    });
  },[courses,input,programId,courseTags]);
  const lecturersByCourse=useMemo(()=>{
    const m={};
    (questions||[]).forEach(q=>{if(q.course&&q.lecturer){(m[q.course]||(m[q.course]=new Set())).add(q.lecturer);}});
    return m;
  },[questions]);
  if(locked)return<div style={{padding:'4px 2px',fontSize:'12px',color:'var(--c-tx)'}}>{value||<span style={{color:'var(--c-mu)',fontSize:'11px'}}>{placeholder}</span>}</div>;
  return(
    <div ref={ref} style={{position:'relative'}}>
      <input style={{...gridInput,border:'1px solid var(--c-bo)',width:'100%',paddingRight:input?'30px':'8px'}} value={input}
        onChange={e=>{setInput(e.target.value);onChange(e.target.value);setOpen(true);}}
        onFocus={e=>{
          setOpen(true);
          if(pendingSelectAllRef.current){
            pendingSelectAllRef.current=false;
            requestAnimationFrame(()=>e.currentTarget.select());
          }
        }} placeholder={placeholder}
        onMouseDown={e=>{
          pendingSelectAllRef.current=document.activeElement!==e.currentTarget && !!String(input||'').trim();
        }}
        onBlur={()=>setOpen(false)}
      />
      {!!input&&(
        <button
          type="button"
          onMouseDown={e=>e.preventDefault()}
          onClick={()=>{
            setInput('');
            onChange('');
            setOpen(false);
            pendingSelectAllRef.current=false;
          }}
          aria-label="Kursname leeren"
          style={{
            position:'absolute',
            right:6,
            top:'50%',
            transform:'translateY(-50%)',
            width:18,
            height:18,
            border:'none',
            borderRadius:'50%',
            background:'var(--c-st)',
            color:'var(--c-mu)',
            cursor:'pointer',
            fontSize:'12px',
            lineHeight:1,
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            padding:0,
          }}
        >
          ×
        </button>
      )}
      {open&&filtered.length>0&&(
        <div style={{position:'absolute',top:'100%',left:0,zIndex:200,background:'var(--c-wh)',border:'1px solid var(--c-bo)',borderRadius:4,boxShadow:'0 4px 16px rgba(0,0,0,0.18)',maxHeight:220,overflowY:'auto',minWidth:220,width:'max-content'}}>
          {filtered.map(c=>{
            const lecs=[...(lecturersByCourse[c]||[])];
            return(
              <div key={c} onMouseDown={e=>{e.preventDefault();onChange(c);setInput(c);setOpen(false);}}
                style={{padding:'8px 12px',cursor:'pointer',borderBottom:'1px solid var(--c-bo)'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--c-tP)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              >
                <div style={{fontSize:'13px',fontWeight:500,color:'var(--c-tD)'}}>{c}</div>
                {lecs.length>0&&<div style={{fontSize:'11px',color:'var(--c-mu)',marginTop:2}}>{lecs.join(' · ')}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const NR_W=44;export const WBG_W=260;export const YR_W=72;export const LE_W=150;export const CO_W=200;
export const stickyCell={position:'sticky',zIndex:3};
export const stickyNr={...stickyCell,left:0};
export const stickyWbg={...stickyCell,left:NR_W};

// HOISTED out of SemesterMatrix. Previously this was declared inside the
// parent's render, which meant React saw a new component type on every
// render and unmounted+remounted the input on every keystroke (losing
// focus). Hoisting makes the input stable.
function GridInput({value,onChange,placeholder,list,locked}){
  if(locked){
    return (
      <div style={{padding:'4px 2px',fontSize:'12px',color:value?'var(--c-tx)':'var(--c-mu)',minHeight:24,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>
        {value||<span style={{opacity:.45}}>{placeholder}</span>}
      </div>
    );
  }
  return (
    <input
      list={list}
      style={{...gridInput,border:'1px solid var(--c-bo)',borderRadius:3,width:'100%',boxSizing:'border-box',minWidth:0}}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}

function SemesterMatrix({programs,questions,courseTags={},mode='manage',onProgramsChange,selectedProgramId,selectedModuleKeys,onSelectProgram,onToggleModule,onDeleteProgram,onAutofillProgram,locked=false,scale=100,compact=false}){
  const courses=useMemo(()=>[...new Set(questions.map(q=>q.course))].sort(),[questions]);
  const prefillForCourse=course=>{const match=questions.find(q=>q.course===course);return match?{year:match.year||'',lecturer:match.lecturer||''}:{year:'',lecturer:''};};
  const updateProgram=(programId,updater)=>onProgramsChange?.(prev=>prev.map(p=>p.id===programId?updater(p):p));
  const widths=compact
    ?{wbg:188,yr:46,lec:88,course:94}
    :{wbg:WBG_W,yr:YR_W,lec:LE_W,course:CO_W};
  const minW=NR_W+widths.wbg+SEMESTER_COUNT*(widths.yr+widths.lec+widths.course+6);
  const updateModule=(programId,sem,moduleIndex,field,value)=>{
    updateProgram(programId,p=>({...p,semesters:p.semesters.map(s=>{
      if(s.sem!==sem)return s;
      return{...s,modules:s.modules.map((m,i)=>{
        if(i!==moduleIndex)return m;
        if(field==='course'){
          const nextCourse=String(value||'');
          if(!nextCourse.trim()) return {...m,course:'',year:'',lecturer:''};
          const auto=prefillForCourse(nextCourse);
          return {...m,course:nextCourse,year:auto.year||'',lecturer:auto.lecturer||''};
        }
        return{...m,[field]:value};
      })};
    })}));
  };

  return(
    <div style={{background:'var(--c-wh)',border:'1px solid var(--c-bo)',borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,0.06)',overflow:'hidden'}}>
      <div style={{overflowX:'auto',zoom:`${scale}%`}}>
        <table style={{minWidth:minW,borderCollapse:'collapse',tableLayout:'fixed'}}>
          <colgroup>
            <col style={{width:NR_W}}/>
            <col style={{width:widths.wbg}}/>
            {Array.from({length:SEMESTER_COUNT},(_,i)=>(
              <React.Fragment key={i}>
                <col style={{width:widths.yr}}/><col style={{width:widths.lec}}/><col style={{width:widths.course}}/>
              </React.Fragment>
            ))}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={{...gridTh,...stickyNr,background:'var(--c-wh)',zIndex:5}}>Nr.</th>
              <th rowSpan={2} style={{...gridTh,...stickyWbg,background:'var(--c-wh)',zIndex:5,borderRight:'2px solid var(--c-grid-border)'}}>Weiterbildungsgang</th>
              {Array.from({length:SEMESTER_COUNT},(_,i)=>(
                <th key={i} colSpan={3} style={{...gridSemesterHead,borderLeft:i===0?'1px solid var(--c-bo)':'2px solid var(--c-tx)'}}>Semester {i+1}</th>
              ))}
            </tr>
            <tr>
              {Array.from({length:SEMESTER_COUNT},(_,i)=>(
                <React.Fragment key={i}>
                  <th style={{...gridSubHead,borderLeft:'1px solid var(--c-bo)',width:widths.yr,fontSize:compact?9:gridSubHead.fontSize}}>{compact?'J':'Jahr'}</th>
                  <th style={{...gridSubHead,width:widths.lec,fontSize:compact?9:gridSubHead.fontSize}}>{compact?'Doz':'Dozent/in'}</th>
                  <th style={{...gridSubHead,width:widths.course,fontSize:compact?9:gridSubHead.fontSize}}>{compact?'Kurs':'Kursname'}</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {programs.map((p,index)=>(
              Array.from({length:MODULES_PER_SEMESTER},(_,moduleIndex)=>{
                const rowSelected=mode==='exam'&&selectedProgramId===p.id;
                const rowBg=index%2===0?'var(--c-wh)':'var(--c-row-alt)';
                const stickyBg=rowSelected?'var(--c-sem-sel)':rowBg;
                return(
                  <tr key={`${p.id}-${moduleIndex}`} style={{background:rowBg}}>
                    {moduleIndex===0&&(
                      <>
                        <td rowSpan={MODULES_PER_SEMESTER} style={{...gridCellMuted,...stickyNr,background:stickyBg,borderRight:'1px solid var(--c-bo)',borderBottom:'2px solid var(--c-grid-border)'}}>
                          {index+1}
                        </td>
                        <td rowSpan={MODULES_PER_SEMESTER} style={{...gridStickyName,...stickyWbg,background:stickyBg,borderRight:'2px solid var(--c-grid-border)',borderBottom:'2px solid var(--c-grid-border)',minWidth:widths.wbg,maxWidth:widths.wbg,padding:compact?'6px':'8px'}}>
                          {mode==='manage'?(
                            <div style={{display:'grid',gap:compact?4:6}}>
                              {locked?(
                                <div style={{fontWeight:600,fontSize:compact?11:13,color:'var(--c-tD)',wordBreak:'break-word',lineHeight:1.2}}>{p.name}</div>
                              ):(
                                <input style={{...inp,fontWeight:600,fontSize:compact?11:13,padding:compact?'5px 7px':'8px 12px'}} value={p.name} onChange={e=>updateProgram(p.id,cur=>({...cur,name:e.target.value}))}/>
                              )}
                              <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                                {locked?(
                                  <Badge ch={`${p.startTerm} ${p.startYear}`} color="warm" sm/>
                                ):(
                                  <>
                                    <input style={{...inp,fontSize:11,padding:'4px 6px',width:compact?60:72}} value={p.startYear||''} onChange={e=>updateProgram(p.id,cur=>({...cur,startYear:e.target.value}))} placeholder="2026"/>
                                    <select style={{...inp,fontSize:11,padding:'4px 6px',width:compact?54:64}} value={p.startTerm||'FS'} onChange={e=>updateProgram(p.id,cur=>({...cur,startTerm:e.target.value}))}>
                                      {TERM_OPTIONS.map(term=><option key={term} value={term}>{term}</option>)}
                                    </select>
                                  </>
                                )}
                              </div>
                              {!locked&&(
                                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                                  <Btn ch="✨ Auto-Füllen" onClick={()=>onAutofillProgram?.(p.id)} v="secondary" sm title="Leere Module aus den dem Weiterbildungsgang zugeordneten Kursen auffüllen"/>
                                  <Btn ch="✕ Löschen" onClick={()=>onDeleteProgram?.(p.id)} v="danger" sm/>
                                </div>
                              )}
                            </div>
                          ):(
                            <button onClick={()=>onSelectProgram?.(p.id)} style={{background:'transparent',border:'none',padding:0,cursor:'pointer',width:'100%',textAlign:'left'}}>
                              <div style={{fontSize:compact?12:14,fontWeight:600,color:'var(--c-tx)',fontFamily:serif,marginBottom:compact?4:6,lineHeight:1.2}}>{p.name}</div>
                              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:compact?4:6}}>
                                <Badge ch={`${p.startTerm} ${p.startYear}`} color="warm" sm/>
                                {rowSelected?<Badge ch="✓ Ausgewählt" color="teal" sm/>:<Badge ch="Auswählen" color="gray" sm/>}
                              </div>
                            </button>
                          )}
                        </td>
                      </>
                    )}
                    {p.semesters.map(s=>{
                      const module=s.modules[moduleIndex]||emptyModule();
                      const bg=semesterBg(p,s.sem,rowSelected);
                      const moduleKey=getModuleSelectionKey(p.id,s.sem,moduleIndex,module);
                      const isChecked=selectedModuleKeys?.has(moduleKey);
                      const questionCount=getModuleQuestionCount(questions,module);
                      const listId=`cl-${p.id}-${s.sem}-${moduleIndex}`;
                      return mode==='manage'?(
                        <React.Fragment key={`${p.id}-${s.sem}-${moduleIndex}`}>
                          <td style={{...gridCell,borderLeft:'2px solid var(--c-grid-border)',background:bg,width:widths.yr,minWidth:widths.yr,padding:compact?'4px':'6px'}}>
                            <GridInput locked={locked} value={module.year} onChange={e=>updateModule(p.id,s.sem,moduleIndex,'year',e.target.value)} placeholder={compact?'J':'Jahr'}/>
                          </td>
                          <td style={{...gridCell,background:bg,width:widths.lec,minWidth:widths.lec,padding:compact?'4px':'6px'}}>
                            <GridInput locked={locked} value={module.lecturer} onChange={e=>updateModule(p.id,s.sem,moduleIndex,'lecturer',e.target.value)} placeholder={compact?'Doz':'Dozent/in'}/>
                          </td>
                          <td style={{...gridCell,background:bg,width:widths.course,minWidth:widths.course,padding:compact?'4px':'6px'}}>
                            {locked?(compact&&module.course
                                ?<div title={module.course} style={{padding:'4px 2px',fontSize:'11px',color:'var(--c-tx)',minHeight:24,wordBreak:'break-word',lineHeight:1.2,fontWeight:600}}>{abbreviateCourseName(module.course)}</div>
                                :<GridInput locked={locked} value={module.course} onChange={()=>{}} placeholder="Kursname eingeben…"/>)
                              :<CourseAutocomplete value={module.course} onChange={v=>updateModule(p.id,s.sem,moduleIndex,'course',v)} courses={courses} locked={false} placeholder="Kursname eingeben…" questions={questions} programId={p.id} courseTags={courseTags}/>}
                            {module.course&&<div style={{fontSize:compact?'9px':'10px',color:'var(--c-mu)',marginTop:compact?2:3}}>{questionCount} Fragen</div>}
                          </td>
                        </React.Fragment>
                      ):(
                        <React.Fragment key={`${p.id}-${s.sem}-${moduleIndex}`}>
                          <td style={{...gridCell,borderLeft:'2px solid var(--c-grid-border)',background:bg,fontSize:compact?10:11,color:'var(--c-mu)',textAlign:'center',width:widths.yr,padding:compact?'4px':'6px'}}>{module.year||'–'}</td>
                          <td style={{...gridCell,background:bg,fontSize:compact?10:11,color:'var(--c-tx)',width:widths.lec,padding:compact?'4px':'6px'}}>
                            <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{module.lecturer||'–'}</div>
                          </td>
                          <td style={{...gridCell,background:bg,padding:compact?'3px 4px':'4px 6px',width:widths.course}}>
                            {module.course?(
                              <label style={{display:'flex',alignItems:'flex-start',gap:6,cursor:rowSelected?'pointer':'default',opacity:rowSelected?1:0.65}}>
                                <input type="checkbox" checked={!!isChecked} disabled={!rowSelected} onChange={()=>onToggleModule?.(moduleKey)} style={{marginTop:3,flexShrink:0}}/>
                                <span>
                                  <span title={module.course} style={{display:'block',fontSize:compact?10:12,fontWeight:600,color:'var(--c-tx)',lineHeight:1.2,wordBreak:'break-word'}}>{compact?abbreviateCourseName(module.course):module.course}</span>
                                  <span style={{display:'block',fontSize:compact?9:10,color:'var(--c-mu)',marginTop:2}}>{questionCount} Fragen</span>
                                </span>
                              </label>
                            ):<span style={{fontSize:11,color:'var(--c-mu)',opacity:.5}}>—</span>}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })
            )).flat()}
            {programs.length===0&&(
              <tr><td colSpan={2+SEMESTER_COUNT*3} style={{padding:40,textAlign:'center',fontSize:13,color:'var(--c-mu)'}}>{mode==='manage'?<span>Noch keine Weiterbildungsgänge — klicke <strong>+ Neuer Weiterbildungsgang</strong> um einen zu erstellen.</span>:'Kein Weiterbildungsgang ausgewählt.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Programs ─────────────────────────────────────────────────────────────────
const SCALE_STEPS=[100,85,70,55];
// ─── Kurs Übersicht ───────────────────────────────────────────────────────
// One row per unique course in the database. Shows Dozent/Jahr/Fragen-count
// aggregated across all questions of that course, plus an editable
// Weiterbildungsgang-tag list. Editing tags here propagates to every
// question of that course (because tags are stored once at course level).
//
// The user-stated rule: courses can only be created by adding a question
// with that course name in the Fragen Datenbank. This page therefore
// doesn't have a "create new course" button — only edit-tags.
export function KursUebersicht({questions,programs,courseTags,setCourseTags,showToast}){
  const courseInfo=useMemo(()=>{
    const map=new Map();
    questions.forEach(q=>{
      if(!q.course) return;
      if(!map.has(q.course)) map.set(q.course,{course:q.course,lecturers:new Set(),years:new Set(),count:0});
      const info=map.get(q.course);
      info.count++;
      if(q.lecturer) info.lecturers.add(q.lecturer);
      if(q.year) info.years.add(q.year);
    });
    return [...map.values()].sort((a,b)=>a.course.localeCompare(b.course));
  },[questions]);

  const[search,setSearch]=useState('');
  const[filterProgram,setFilterProgram]=useState('');

  const filtered=useMemo(()=>{
    const s=search.trim().toLowerCase();
    return courseInfo.filter(info=>{
      if(s && !info.course.toLowerCase().includes(s)) return false;
      if(filterProgram){
        const tags=(courseTags[info.course]||[]).map(String);
        if(!tags.includes(String(filterProgram))) return false;
      }
      return true;
    });
  },[courseInfo,search,filterProgram,courseTags]);

  const toggleTag=(course,programId)=>{
    setCourseTags(prev=>{
      const cur=(prev[course]||[]).map(String);
      const id=String(programId);
      const next=cur.includes(id)?cur.filter(x=>x!==id):[...cur,id];
      return{...prev,[course]:next};
    });
  };

  // For "Set all" / "Clear all" bulk actions on a single course
  const setAllTags=(course,ids)=>{
    setCourseTags(prev=>({...prev,[course]:ids.map(String)}));
  };

  const totalUntagged=courseInfo.filter(c=>!(courseTags[c.course]||[]).length).length;

  return(
    <div style={{padding:28}}>
      <SectionHeader title="Kurs Übersicht" sub={`${courseInfo.length} Kurse in der Datenbank${totalUntagged?` · ${totalUntagged} ohne Weiterbildungsgang-Zuordnung`:''}`}/>
      <div style={{background:C.tP,border:`1px solid ${C.tL}`,borderRadius:8,padding:'12px 16px',marginBottom:16,fontSize:13,color:C.tD,lineHeight:1.55}}>
        Hier legst du fest, zu welchen Weiterbildungsgängen ein Kurs gehört. Setzt du ein Häkchen, gilt das automatisch für <strong>alle Fragen</strong> dieses Kurses. Neue Kurse entstehen, indem du in der <strong>Fragen Datenbank</strong> eine Frage mit einem neuen Kursnamen anlegst.
      </div>
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <input style={{...inp,width:280}} placeholder="Kurs suchen…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={{...inp,width:240}} value={filterProgram} onChange={e=>setFilterProgram(e.target.value)}>
          <option value="">Alle Weiterbildungsgänge</option>
          {programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(search||filterProgram)&&<Btn ch="✕ Zurücksetzen" onClick={()=>{setSearch('');setFilterProgram('');}} v="ghost" sm/>}
        <span style={{fontSize:12,color:C.mu,marginLeft:'auto'}}>{filtered.length} Treffer</span>
      </div>
      <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:C.inv}}>
              {['Kursname','Dozent/in','Jahr','Fragen','Weiterbildungsgänge','Aktionen'].map(h=>(
                <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:11,fontWeight:500,color:C.invTx,letterSpacing:'0.5px',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={6} style={{padding:32,textAlign:'center',color:C.mu,fontSize:13}}>{courseInfo.length===0?<span>Noch keine Kurse — Kurse entstehen durch Hinzufügen von Fragen.</span>:'Keine Treffer. Filter anpassen oder zurücksetzen.'}</td></tr>}
            {filtered.map((info,i)=>{
              const tags=(courseTags[info.course]||[]).map(String);
              const lecturerLabel=info.lecturers.size===0?'—':info.lecturers.size===1?[...info.lecturers][0]:`${info.lecturers.size} Dozent/innen`;
              const yearLabel=info.years.size===0?'—':info.years.size===1?[...info.years][0]:'mehrere';
              return(
                <tr key={info.course} style={{borderBottom:`1px solid ${C.bo}`,background:i%2===0?C.wh:C.wW,verticalAlign:'top'}}>
                  <td style={{padding:'10px 12px',fontSize:13,color:C.tD,fontWeight:600,maxWidth:260}}>
                    <div style={{wordBreak:'break-word',lineHeight:1.3}}>{info.course}</div>
                  </td>
                  <td style={{padding:'10px 12px',fontSize:12,color:C.tx,maxWidth:160}}>
                    <div style={{wordBreak:'break-word',lineHeight:1.3}}>{lecturerLabel}</div>
                  </td>
                  <td style={{padding:'10px 12px',fontSize:12,color:C.mu}}>{yearLabel}</td>
                  <td style={{padding:'10px 12px',fontSize:12,fontWeight:600,color:C.tD}}>{info.count}</td>
                  <td style={{padding:'10px 12px',maxWidth:420}}>
                    {programs.length===0
                      ?<span style={{fontSize:11,color:C.mu,fontStyle:'italic'}}>Kein Weiterbildungsgang verfügbar</span>
                      :<div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                        {programs.map(p=>{
                          const checked=tags.includes(String(p.id));
                          return(
                            <label key={p.id} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 8px',border:`1px solid ${checked?C.t:C.bo}`,borderRadius:5,cursor:'pointer',fontSize:11,background:checked?C.tP:C.wh,color:checked?C.tD:C.tx,transition:'all 0.15s'}}>
                              <input type="checkbox" checked={checked} onChange={()=>toggleTag(info.course,p.id)} style={{margin:0}}/>
                              <span>{shortProgramName(p.name)}</span>
                            </label>
                          );
                        })}
                      </div>
                    }
                  </td>
                  <td style={{padding:'10px 12px',whiteSpace:'nowrap'}}>
                    <div style={{display:'flex',gap:4}}>
                      <Btn ch="Alle" onClick={()=>setAllTags(info.course,programs.map(p=>p.id))} v="ghost" sm/>
                      <Btn ch="Keiner" onClick={()=>setAllTags(info.course,[])} v="ghost" sm/>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Programs({programs,setPrograms,questions,courseTags={},showToast,showConfirm,settings}){
  const[adding,setAdding]=useState(false);
  const[newName,setNewName]=useState('');
  const[newStartYear,setNewStartYear]=useState(currentAcademicTag().year);
  const[newStartTerm,setNewStartTerm]=useState(currentAcademicTag().term);
  const[search,setSearch]=useState('');
  const[locked,setLocked]=useState(()=>settings?.lockedByDefault??true);
  const[scale,setScale]=useState(()=>settings?.defaultScale??100);
  const[compact,setCompact]=useState(false);

  const addProgram=()=>{
    if(!newName.trim())return;
    setPrograms(prev=>[...prev,createProgram(newId('p'),newName.trim(),newStartYear,newStartTerm)]);
    showToast(`Weiterbildungsgang „${newName.trim()}" erstellt.`,'success');
    setNewName('');setNewStartYear(currentAcademicTag().year);setNewStartTerm(currentAcademicTag().term);setAdding(false);
  };
  const delProgram=id=>{
    const prog=programs.find(p=>p.id===id);
    showConfirm({
      message:`Weiterbildungsgang „${prog?.name||'diesen Eintrag'}“ wirklich löschen? Alle Semesterdaten gehen verloren.`,
      confirmLabel:'Löschen',
      confirmV:'danger',
      onConfirm:()=>{
        setPrograms(prev=>prev.filter(p=>p.id!==id));
        showToast('Weiterbildungsgang gelöscht.','success');
      },
    });
  };
  const autofillProgram=id=>{
    const prog=programs.find(p=>p.id===id);
    if(!prog){showToast('Weiterbildungsgang nicht gefunden.','error');return;}
    const result=autofillModulesForProgram(prog,courseTags,questions);
    if(!result){
      showConfirm({
        message:`„${prog.name}" hat keine zugeordneten Kurse. Erst in „Kurs Übersicht" Tags für diesen Weiterbildungsgang setzen, dann kann das Auto-Füllen die zugeordneten Kurse auf die Semester verteilen.`,
        confirmLabel:'Verstanden',
        confirmV:'primary',
        onConfirm:()=>{},
      });
      return;
    }
    const {semesters:newSemesters,stats}=result;
    if(stats.placed===0){
      showToast(`„${prog.name}": ${stats.alreadyPresent} Kurse sind bereits im Plan${stats.skipped?', '+stats.skipped+' Kurse passten in kein freies Modul':''}. Nichts zu tun.`,'warning');
      return;
    }
    const lines=[
      `Auto-Füllen für „${prog.name}":`,
      '',
      `  • ${stats.placed} Kurs(e) werden in leere Module eingefügt`,
    ];
    if(stats.alreadyPresent) lines.push(`  • ${stats.alreadyPresent} Kurs(e) sind bereits vorhanden und werden übersprungen`);
    if(stats.skipped) lines.push(`  • ${stats.skipped} Kurs(e) passten in kein freies Modul`);
    lines.push('','Vorhandene Einträge in der Matrix werden NICHT überschrieben.','');
    lines.push('Hinweis: Die Verteilung ist eine Annahme — diese Funktion arbeitet nicht immer perfekt. Bitte die Semester und Module nach dem Einfügen nochmals überprüfen.');
    showConfirm({
      message:lines.join('\n'),
      confirmLabel:'Auto-Füllen',
      confirmV:'primary',
      onConfirm:()=>{
        setPrograms(prev=>prev.map(p=>p.id===id?{...p,semesters:newSemesters}:p));
        showToast(`Auto-Füllen abgeschlossen: ${stats.placed} Kurse eingefügt.`,'success');
      },
    });
  };
  const filteredPrograms=programs.filter(p=>!search.trim()||p.name.toLowerCase().includes(search.toLowerCase()));

  return(
    <div style={{padding:28}}>
      <SectionHeader title="Weiterbildungsgänge" sub={`${programs.length} Weiterbildungsgänge`} action={
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:4,background:'var(--c-st)',borderRadius:6,padding:3}}>
            {[
              {key:'normal',label:'Standard'},
              {key:'compact',label:'Kompakt'},
            ].map(v=>{
              const active=(v.key==='compact')===compact;
              return(
                <button key={v.key} onClick={()=>setCompact(v.key==='compact')} style={{padding:'4px 9px',borderRadius:4,border:'none',cursor:'pointer',fontSize:'12px',fontFamily:sans,background:active?'var(--c-wh)':'transparent',color:active?'var(--c-tD)':'var(--c-mu)',fontWeight:active?600:400}}>{v.label}</button>
              );
            })}
          </div>
          <div style={{display:'flex',gap:4,background:'var(--c-st)',borderRadius:6,padding:3}}>
            {SCALE_STEPS.map(s=>(
              <button key={s} onClick={()=>setScale(s)} style={{padding:'4px 9px',borderRadius:4,border:'none',cursor:'pointer',fontSize:'12px',fontFamily:sans,background:scale===s?'var(--c-wh)':'transparent',color:scale===s?'var(--c-tD)':'var(--c-mu)',fontWeight:scale===s?600:400}}>{s}%</button>
            ))}
          </div>
          <Btn ch={locked?'🔓 Bearbeiten':'🔒 Sperren'} onClick={()=>setLocked(l=>!l)} v={locked?'secondary':'ghost'} sm/>
          {!locked&&<Btn ch="+ Neuer Weiterbildungsgang" onClick={()=>setAdding(true)} v="primary"/>}
        </div>
      }/>
      {adding&&(
        <div style={{background:'var(--c-wh)',border:'1px solid var(--c-bo)',borderRadius:8,padding:16,marginBottom:16,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <input style={{...inp,flex:'1 1 260px'}} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name, z.B. WBS 56 (2025)" onKeyDown={e=>e.key==='Enter'&&addProgram()}/>
          <input style={{...inp,width:100}} value={newStartYear} onChange={e=>setNewStartYear(e.target.value)} placeholder="2026"/>
          <select style={{...inp,width:86}} value={newStartTerm} onChange={e=>setNewStartTerm(e.target.value)}>
            {TERM_OPTIONS.map(term=><option key={term} value={term}>{term}</option>)}
          </select>
          <Btn ch="Erstellen" onClick={addProgram} v="primary"/>
          <Btn ch="Abbrechen" onClick={()=>{setAdding(false);setNewName('');}} v="ghost"/>
        </div>
      )}
      {locked&&<div style={{background:'var(--c-gP)',border:'1px solid var(--c-gr)',borderRadius:6,padding:'8px 14px',marginBottom:12,fontSize:'12px',color:'var(--c-gr)',display:'flex',alignItems:'center',gap:8}}>🔒 Ansicht gesperrt — Klicke «Bearbeiten» um Änderungen vorzunehmen.</div>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:12}}>
        <div style={{fontSize:'12px',color:'var(--c-mu)'}}>{compact?'Kompaktansicht aktiv · Kursnamen werden abgekürzt angezeigt.':'6 Semester · 4 Module pro Semester'}</div>
        <input style={{...inp,width:260}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Weiterbildungsgang suchen…"/>
      </div>
      <SemesterMatrix programs={filteredPrograms} questions={questions} courseTags={courseTags} mode="manage" onProgramsChange={setPrograms} onDeleteProgram={delProgram} onAutofillProgram={autofillProgram} locked={locked} scale={scale} compact={compact}/>
    </div>
  );
}

// ─── Exam Builder ─────────────────────────────────────────────────────────────
export function ExamBuilder({programs,questions,onBuild,setView}){
  const[selectedProgramId,setSelectedProgramId]=useState(null);
  const[selectedModuleKeys,setSelectedModuleKeys]=useState(new Set());
  const[built,setBuilt]=useState(false);
  const[scale,setScale]=useState(55);

  const selectedProgram=programs.find(p=>p.id===selectedProgramId);

  const selectProgram=programId=>{
    setSelectedProgramId(programId);
    setBuilt(false);
    const program=programs.find(p=>p.id===programId);
    const allKeys=new Set();
    (program?.semesters||[]).forEach(s=>{
      (s.modules||[]).forEach((module,moduleIndex)=>{
        if(module.course){
          allKeys.add(getModuleSelectionKey(programId,s.sem,moduleIndex,module));
        }
      });
    });
    setSelectedModuleKeys(allKeys);
  };

  const toggleModule=key=>{
    setBuilt(false);
    setSelectedModuleKeys(prev=>{
      const next=new Set(prev);
      next.has(key)?next.delete(key):next.add(key);
      return next;
    });
  };

  const selectedModules=useMemo(()=>{
    if(!selectedProgram)return[];
    return selectedProgram.semesters.flatMap(s=>
      s.modules.map((module,moduleIndex)=>({
        ...module,
        sem:s.sem,
        moduleIndex,
        key:getModuleSelectionKey(selectedProgram.id,s.sem,moduleIndex,module)
      }))
    ).filter(module=>module.course && selectedModuleKeys.has(module.key));
  },[selectedProgram,selectedModuleKeys]);

  const selectedQuestions=useMemo(()=>{
    const byId=new Map();
    selectedModules.forEach(module=>{
      questions.forEach(q=>{
        if(
          q.course===module.course &&
          (!module.lecturer || !q.lecturer || q.lecturer===module.lecturer) &&
          (!module.year || !q.year || q.year===module.year)
        ){
          byId.set(q.id,q);
        }
      });
    });
    return [...byId.values()];
  },[selectedModules,questions]);

  const totalQ=selectedQuestions.length;

  const build=()=>{
    if(!selectedProgram)return;
    onBuild(selectedQuestions,selectedProgram.name);
    setBuilt(true);
  };

  const reset=()=>{setSelectedProgramId(null);setSelectedModuleKeys(new Set());setBuilt(false);};
  return(
    <div style={{padding:28}}>
      <SectionHeader title="Prüfung erstellen" sub="Weiterbildungsgang auswählen, dann Module aktivieren" action={
        <div style={{display:'flex',gap:4,background:'var(--c-st)',borderRadius:6,padding:3}}>
          {SCALE_STEPS.map(s=>(
            <button key={s} onClick={()=>setScale(s)} style={{padding:'4px 9px',borderRadius:4,border:'none',cursor:'pointer',fontSize:'12px',fontFamily:sans,background:scale===s?'var(--c-wh)':'transparent',color:scale===s?'var(--c-tD)':'var(--c-mu)',fontWeight:scale===s?600:400}}>{s}%</button>
          ))}
        </div>
      }/>
      {/* Zusammenfassung — full-width above the matrix */}
      <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:'14px 18px',marginBottom:14,display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}>
        <div style={{flex:'1 1 200px'}}>
          <div style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.mu,marginBottom:3,fontWeight:600}}>Zusammenfassung</div>
          <div style={{fontSize:'15px',fontWeight:600,color:C.tD}}>{selectedProgram?.name||<span style={{color:C.mu,fontWeight:400}}>Noch kein Weiterbildungsgang ausgewählt</span>}</div>
        </div>
        <div style={{display:'flex',gap:20,alignItems:'center'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'11px',color:C.mu,marginBottom:2}}>Module</div>
            <div style={{fontSize:'24px',fontWeight:700,color:C.tD,lineHeight:1}}>{selectedModules.length}</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'11px',color:C.mu,marginBottom:2}}>Fragen</div>
            <div style={{fontSize:'24px',fontWeight:700,lineHeight:1,color:totalQ===40?C.gr:totalQ>0?C.tM:C.tD}}>{totalQ}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {selectedProgram&&selectedModules.length>0&&totalQ!==40&&<span style={{background:C.wmP,color:C.wm,borderRadius:6,padding:'5px 10px',fontSize:'12px'}}>Standard: 40 Fragen</span>}
          {built&&<span style={{background:C.gP,color:C.gr,borderRadius:6,padding:'5px 10px',fontSize:'12px'}}>✓ Prüfung erstellt</span>}
          {selectedProgram&&selectedModules.length===0&&<span style={{background:C.rP,color:C.re,borderRadius:6,padding:'5px 10px',fontSize:'12px'}}>Keine Module ausgewählt</span>}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginLeft:'auto'}}>
          {selectedProgram&&<Btn ch="✕ Zurücksetzen" onClick={reset} v="ghost" sm/>}
          <Btn ch="Prüfung erstellen →" onClick={build} v="primary" dis={!selectedProgram||selectedModules.length===0}/>
          {built&&<Btn ch="Zum Export ↓" onClick={()=>setView?.('export')} v="accent"/>}
        </div>
      </div>
      <div style={{background:'var(--c-wh)',border:'1px solid var(--c-bo)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13,color:'var(--c-mu)'}}>
        Weiterbildungsgang in der Matrix anklicken → alle Module werden ausgewählt. Einzelne Module können per Checkbox an- oder abgewählt werden.
      </div>
      <SemesterMatrix programs={programs} questions={questions} mode="exam" selectedProgramId={selectedProgramId} selectedModuleKeys={selectedModuleKeys} onSelectProgram={selectProgram} onToggleModule={toggleModule} scale={scale}/>
    </div>
  );
}

// ─── Export View ──────────────────────────────────────────────────────────────
export function ExportView({exam,programName,setView,showToast,showConfirm,onSaveAndNew,onUpdateExam,onClear}){
  const[copied,setCopied]=useState(false);
  const[editMode,setEditMode]=useState(false);
  // null = dialog closed; string = current input value
  const[saveDraftName,setSaveDraftName]=useState(null);

  if(!exam||exam.length===0) return(
    <div style={{padding:28}}>
      <SectionHeader title="Export & Download" sub="Noch keine Prüfung erstellt"/>
      <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:40,textAlign:'center'}}>
        <div style={{fontSize:'32px',marginBottom:12}}>✎</div>
        <div style={{fontSize:'16px',color:C.tx,marginBottom:6,fontFamily:serif}}>Keine Prüfung vorhanden</div>
        <div style={{fontSize:'13px',color:C.mu,marginBottom:16}}>Bitte zuerst eine Prüfung im Bereich &ldquo;Prüfung erstellen&rdquo; konfigurieren.</div>
        <Btn ch="Zur Prüfungserstellung →" onClick={()=>setView('exam')} v="primary"/>
      </div>
    </div>
  );

  const txt=buildTxt(exam);
  const copy=()=>navigator.clipboard.writeText(txt).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  const suggestedSaveName=()=>`${programName||'Prüfung'} · ${new Date().toLocaleDateString('de-CH')}`;
  const openSaveDialog=()=>setSaveDraftName(suggestedSaveName());
  const confirmSave=()=>{
    const chosen=(saveDraftName||'').trim()||suggestedSaveName();
    setSaveDraftName(null);
    onSaveAndNew?.(chosen);
  };
  const moveQuestion=(index,direction)=>{
    onUpdateExam?.(prev=>{
      const next=[...(prev||[])];
      const target=index+direction;
      if(target<0 || target>=next.length) return prev;
      [next[index],next[target]]=[next[target],next[index]];
      return next;
    });
  };
  const removeQuestion=index=>{
    showConfirm?.({
      message:'Diese Frage aus der aktuellen Prüfung entfernen?',
      confirmLabel:'Entfernen',
      confirmV:'danger',
      onConfirm:()=>onUpdateExam?.(prev=>prev.filter((_,i)=>i!==index)),
    });
  };

  return(
    <div style={{padding:28}}>
      <SectionHeader title="Export & Download" sub={`${exam.length} Fragen · ${programName||'Prüfung'}`} action={
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Btn ch={editMode?'✓ Bearbeiten aktiv':'Bearbeiten'} onClick={()=>setEditMode(v=>!v)} v={editMode?'secondary':'ghost'}/>
          <Btn ch="💾 Speichern & neu" onClick={openSaveDialog} v="primary"/>
          <Btn ch={copied?'✓ Kopiert!':'Kopieren'} onClick={copy} v={copied?'success':'ghost'}/>
          <Btn ch="↓ TXT" onClick={()=>dlFile(txt,`AIM_Pruefung_${(programName||'Export').replace(/\s+/g,'_')}.txt`)} v="secondary"/>
          <Btn ch="↓ Word (.docx)" onClick={()=>{
            try{
              dlFile(buildDocx(exam),`AIM_Pruefung_${(programName||'Export').replace(/\s+/g,'_')}.docx`,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            }catch(e){
              console.error('DOCX export error:',e);
              showToast('Word-Datei konnte nicht erstellt werden. Bitte erneut versuchen.','error');
            }
          }} v="accent" title="Word-Datei für den Testportal-Import — korrekte Antworten sind fett markiert"/>
          <Btn ch="✕ Prüfung löschen" onClick={onClear} v="ghost"/>
        </div>
      }/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
        {[{label:'Fragen',val:exam.length},{label:'Kurse',val:new Set(exam.map(q=>q.course)).size},{label:'Formate',val:new Set(exam.map(q=>q.format)).size}].map(s=>(
          <div key={s.label} style={{background:C.tP,borderRadius:8,padding:'12px 16px'}}>
            <div style={{fontSize:'11px',color:C.mu,marginBottom:2}}>{s.label}</div>
            <div style={{fontSize:'24px',fontWeight:700,color:C.tD}}>{s.val}</div>
          </div>
        ))}
      </div>
      <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,overflow:'hidden',marginBottom:16}}>
        <div style={{padding:'10px 16px',background:C.inv,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{color:C.invTx,fontSize:'11px',letterSpacing:'1px',textTransform:'uppercase',fontWeight:500}}>Vorschau — Testportal-Format</span>
          <span style={{color:C.invTx,fontSize:'11px'}}>{editMode?'Bearbeiten: Reihenfolge ändern oder Fragen entfernen':'Fettdruck = korrekte Antwort'}</span>
        </div>
        <div style={{padding:20,maxHeight:420,overflowY:'auto',fontFamily:'monospace',fontSize:'13px',lineHeight:1.7,color:C.tx,background:C.wW}}>
          {exam.map((q,i)=>{
            const correct=q.answer?q.answer.split(';'):[];
            const opts=[{k:'A',t:q.optA},{k:'B',t:q.optB},{k:'C',t:q.optC},{k:'D',t:q.optD},{k:'E',t:q.optE}].filter(o=>o.t);
            return(
              <div key={`${q.id}-${i}`} style={{marginBottom:20,position:'relative',paddingRight:editMode?96:0}}>
                {editMode&&(
                  <div style={{position:'absolute',top:0,right:0,display:'flex',gap:4}}>
                    <button onClick={()=>moveQuestion(i,-1)} disabled={i===0} style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:4,cursor:i===0?'not-allowed':'pointer',fontSize:'11px',padding:'2px 6px',opacity:i===0?0.45:1}}>↑</button>
                    <button onClick={()=>moveQuestion(i,1)} disabled={i===exam.length-1} style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:4,cursor:i===exam.length-1?'not-allowed':'pointer',fontSize:'11px',padding:'2px 6px',opacity:i===exam.length-1?0.45:1}}>↓</button>
                    <button onClick={()=>removeQuestion(i)} style={{background:C.re,color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontSize:'11px',padding:'2px 6px'}}>✕</button>
                  </div>
                )}
                <div style={{fontStyle:'italic',textDecoration:'underline',color:C.tD,marginBottom:4,fontSize:'13px'}}>{i+1}. Titel des Kurses: {q.course}</div>
                <div style={{fontWeight:600,color:C.tD,marginBottom:6}}>{q.question}</div>
                {opts.map(o=>{
                  const isC=correct.includes(o.k);
                  return<div key={o.k} style={{paddingLeft:16,fontWeight:isC?700:400,color:isC?C.gr:C.tx,background:isC?C.gP:'transparent',borderRadius:isC?3:0,padding:isC?'1px 6px':'0 6px'}}>{o.k.toLowerCase()}) {o.t}{isC&&' ✓'}</div>;
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{background:C.wmP,border:`1px solid ${C.tL}`,borderRadius:8,padding:14,fontSize:'13px',color:C.wm}}>
        <strong>Hinweis:</strong> Die Word-Datei (.docx) lässt sich direkt im Testportal importieren. Korrekte Antworten sind darin fett markiert.
      </div>
      {saveDraftName!==null&&(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="aim-save-dialog-title"
          style={{position:'fixed',inset:0,background:'rgba(17,17,17,0.5)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={()=>setSaveDraftName(null)}
        >
          <div
            style={{background:C.wh,borderRadius:8,padding:'24px',maxWidth:480,width:'90%',boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}
            onClick={e=>e.stopPropagation()}
          >
            <div id="aim-save-dialog-title" style={{fontFamily:serif,fontSize:'17px',color:C.tD,marginBottom:10,fontWeight:700}}>Prüfung speichern</div>
            <p style={{fontSize:'13px',color:C.mu,margin:'0 0 10px',lineHeight:1.5}}>Wähle einen Namen, unter dem die fertige Prüfung gespeichert werden soll. Danach kann direkt eine neue Prüfung gestartet werden.</p>
            <input
              autoFocus
              style={{...inp,marginBottom:16}}
              value={saveDraftName}
              onChange={e=>setSaveDraftName(e.target.value)}
              onKeyDown={e=>{
                if(e.key==='Enter'){ e.preventDefault(); confirmSave(); }
                if(e.key==='Escape'){ e.preventDefault(); setSaveDraftName(null); }
              }}
              placeholder="Name der Prüfung"
            />
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <Btn ch="Abbrechen" onClick={()=>setSaveDraftName(null)} v="ghost"/>
              <Btn ch="Speichern" onClick={confirmSave} v="primary"/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Page ───────────────────────────────────────────────────────────
export function SettingsPage({settings,setSettings,darkMode,onToggleDark}){
  return(
    <div style={{padding:28,maxWidth:680}}>
      <SectionHeader title="Einstellungen" sub="Standardverhalten und Darstellung"/>
      <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:'0 20px',marginBottom:16}}>
        <div style={{padding:'14px 0 8px',borderBottom:`1px solid ${C.bo}`,fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.mu,fontWeight:600}}>Matrix &amp; Ansicht</div>
        <SettingRow title="Weiterbildungsgänge gesperrt beim Start" sub="Schützt vor versehentlichen Änderungen beim Öffnen" control={<Toggle value={settings.lockedByDefault} onChange={v=>setSettings(s=>({...s,lockedByDefault:v}))}/>}/>
        <SettingRow title="Standard-Zoomstufe" sub="Wird beim Öffnen der Matrix-Ansicht verwendet" control={
          <div style={{display:'flex',gap:4,background:'var(--c-st)',borderRadius:6,padding:3}}>
            {SCALE_STEPS.map(s=>(
              <button key={s} onClick={()=>setSettings(st=>({...st,defaultScale:s}))} style={{padding:'4px 9px',borderRadius:4,border:'none',cursor:'pointer',fontSize:'12px',fontFamily:sans,background:settings.defaultScale===s?'var(--c-wh)':'transparent',color:settings.defaultScale===s?'var(--c-tD)':'var(--c-mu)',fontWeight:settings.defaultScale===s?600:400}}>{s}%</button>
            ))}
          </div>
        }/>
        <SettingRow title="Dunkelmodus" sub="Zwischen hellem und dunklem Design wechseln" control={<Toggle value={darkMode} onChange={onToggleDark}/>}/>
      </div>
      <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:'0 20px',marginBottom:16}}>
        <div style={{padding:'14px 0 8px',borderBottom:`1px solid ${C.bo}`,fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.mu,fontWeight:600}}>Einstellungen zurücksetzen</div>
        <div style={{padding:'14px 0'}}>
          <p style={{margin:'0 0 12px',fontSize:'13px',color:C.mu,lineHeight:1.55}}>Setzt alle Einstellungen auf die Standardwerte zurück. Deine Fragen, Programme und Prüfungen bleiben unberührt.</p>
          <Btn ch="Einstellungen zurücksetzen" onClick={()=>setSettings(DEFAULT_SETTINGS)} v="ghost" sm/>
        </div>
      </div>
    </div>
  );
}


const APP_INIT_KEY='aim_app_initialized_v1';

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function AIMExamManager(){
  const[view,setView]=useState('dashboard');
  const[questions,setQuestions]=useState(()=>{try{const r=window.localStorage.getItem('aim_q');if(r)return JSON.parse(r);}catch{}return INIT_Q;});
  const[programs,setPrograms]=useState(()=>{try{const r=window.localStorage.getItem('aim_p');if(r)return normalizePrograms(JSON.parse(r));}catch{}return normalizePrograms(INIT_P);});
  const[savedExams,setSavedExams]=useState(()=>{try{const r=window.localStorage.getItem('aim_saved_exams');if(r)return JSON.parse(r);}catch{}return[];});
  const[exam,setExam]=useState(null);
  const[examName,setExamName]=useState('');
  const[toasts,setToasts]=useState([]);
  const[confirm,setConfirm]=useState(null);
  const[sidebarCollapsed,setSidebarCollapsed]=useState(()=>window.localStorage.getItem('aim_sidebar')==='1');
  const[darkMode,setDarkMode]=useState(()=>window.localStorage.getItem('aim_dark')==='1');
  const[settings,setSettings]=useState(()=>{try{const s=JSON.parse(window.localStorage.getItem(SETTINGS_KEY));return s?{...DEFAULT_SETTINGS,...s}:DEFAULT_SETTINGS;}catch{return DEFAULT_SETTINGS;}});
  // Explicit per-course Weiterbildungsgang tags. Replaces the previously-
  // implicit relationship that matched course/lecturer/year against WBG
  // modules. Format: { [courseName]: [wbgId, ...] }
  const[courseTags,setCourseTags]=useState(()=>{
    try{const r=window.localStorage.getItem('aim_course_tags');if(r)return JSON.parse(r);}catch{}
    return{};
  });

  const showToast=useCallback((message,type='success')=>{
    const id=newId('toast');
    setToasts(prev=>[...prev,{id,message,type}]);
    // Scale display time with message length so long errors stay readable.
    const text=String(message||'');
    const duration=Math.max(4000,Math.min(15000,3000+text.length*60));
    setTimeout(()=>setToasts(prev=>prev.filter(t=>t.id!==id)),duration);
  },[]);

  // Unified showConfirm. Accepts either {message, confirmLabel, confirmV,
  // onConfirm} OR legacy positional (message, onConfirm). Both Dashboard
  // (object form) and other views (positional form) used to call this
  // differently; the two shapes had silently diverged.
  const showConfirm=useCallback((arg,maybeOnConfirm)=>{
    if(typeof arg==='string'){
      setConfirm({message:arg,onConfirm:maybeOnConfirm});
    }else if(arg && typeof arg==='object'){
      setConfirm(arg);
    }
  },[]);

  // Persist effects — wrap every write so a quota overflow doesn't kill the
  // render commit. Show a toast at most once per session so we don't spam.
  // Also track lastSavedAt for the small "Gespeichert" indicator in the
  // sidebar footer so users can see at a glance that their work is safe.
  const persistErrorShownRef=useRef(false);
  const[lastSavedAt,setLastSavedAt]=useState(0);
  const safePersist=useCallback((key,value)=>{
    try{
      window.localStorage.setItem(key,value);
      persistErrorShownRef.current=false;
      setLastSavedAt(Date.now());
    }catch(err){
      if(!persistErrorShownRef.current){
        persistErrorShownRef.current=true;
        showToast(`Speicherfehler (${err?.name||'unbekannt'}): ${err?.message||'Speicher voll'}. Bitte jetzt ein JSON-Backup exportieren.`,'error');
      }
    }
  },[showToast]);

  // Snapshot ALL user data to `aim_last_backup`. Called automatically before
  // any destructive operation (clearAllData, JSON restore, Excel import).
  // The Dashboard exposes a "Letzten Stand wiederherstellen" button when
  // this key is present so a regret-click is always one click away from
  // being undone.
  //
  // Returns true on success, false if the snapshot couldn't be written
  // (e.g. quota exceeded). On false we warn the user — the destructive
  // op still proceeds, but they should know the safety net is missing.
  const saveLastBackup=useCallback(()=>{
    const snapshot={
      version:4,
      capturedAt:new Date().toISOString(),
      reason:'auto-before-destructive-op',
      questions,
      programs,
      savedExams,
      currentExam:exam?{exam,name:examName||''}:null,
      courseTags,
    };
    try{
      window.localStorage.setItem('aim_last_backup',JSON.stringify(snapshot));
      return true;
    }catch(err){
      showToast(`Automatische Sicherung konnte nicht erstellt werden (${err?.name||'Speicher voll'}). „Letzten Stand wiederherstellen" ist nach dieser Aktion nicht verfügbar. Bitte vorab ein JSON-Backup exportieren.`,'warning');
      return false;
    }
  },[questions,programs,savedExams,exam,examName,showToast,courseTags]);

  const clearAllData=useCallback(()=>{
    // Snapshot first so "Letzten Stand wiederherstellen" can undo the wipe.
    saveLastBackup();
    setQuestions([]);
    setPrograms([]);
    setSavedExams([]);
    setExam(null);
    setExamName('');
    setCourseTags({});
    // Wipe ALL data-bearing keys. Preserve user-preference keys (dark mode,
    // sidebar, settings, init flag, update-dismissed, last_backup) so the
    // app's chrome stays as the user configured it AND the safety net survives.
    const DATA_KEYS=['aim_q','aim_p','aim_saved_exams','aim_exam','aim_course_tags'];
    try{
      DATA_KEYS.forEach(k=>window.localStorage.removeItem(k));
    }catch{}
    setView('dashboard');
    showToast('Alle App-Daten wurden gelöscht. Vorheriger Stand wurde gesichert (siehe Dashboard → Letzten Stand wiederherstellen).','success');
  },[showToast,saveLastBackup]);

  const toggleSidebar=()=>{
    setSidebarCollapsed(prev=>{
      try{ window.localStorage.setItem('aim_sidebar',prev?'0':'1'); }catch{}
      return !prev;
    });
  };

  // Inject theme CSS + global focus-visible style once. Fonts are bundled
  // via index.html. The focus-visible rule gives keyboard users a clear
  // outline on every interactive element without disturbing mouse users.
  useEffect(()=>{
    if(document.getElementById('aim-theme')) return;
    const style=document.createElement('style');
    style.id='aim-theme';
    style.textContent=`
      :root{${THEMES.light}}
      :root.dark{${THEMES.dark}}
      *{box-sizing:border-box;}
      :focus-visible{outline:2px solid var(--c-ac); outline-offset:2px; border-radius:3px;}
      button:focus-visible, a:focus-visible{outline:2px solid var(--c-ac); outline-offset:2px;}
    `;
    document.head.appendChild(style);
  },[]);

  // Apply dark/light class
  useEffect(()=>{
    darkMode?document.documentElement.classList.add('dark'):document.documentElement.classList.remove('dark');
    try{ window.localStorage.setItem('aim_dark',darkMode?'1':'0'); }catch{}
  },[darkMode]);

  // Persist — these only save on change after the initial mount.
  useEffect(()=>{safePersist(SETTINGS_KEY,JSON.stringify(settings));},[settings,safePersist]);
  useEffect(()=>{safePersist('aim_q',JSON.stringify(questions));},[questions,safePersist]);
  useEffect(()=>{safePersist('aim_p',JSON.stringify(programs));},[programs,safePersist]);
  useEffect(()=>{safePersist('aim_saved_exams',JSON.stringify(savedExams));},[savedExams,safePersist]);
  useEffect(()=>{safePersist('aim_course_tags',JSON.stringify(courseTags));},[courseTags,safePersist]);
  useEffect(()=>{
    if(exam){
      safePersist('aim_exam',JSON.stringify({exam,name:examName}));
    }else{
      try{ window.localStorage.removeItem('aim_exam'); }catch{}
    }
  },[exam,examName,safePersist]);

  // First-launch migration: if no explicit courseTags exist yet, compute
  // them from the OLD implicit rule (course matched against WBG modules).
  // Runs once per device — flag prevents re-running. After this, tags are
  // edited explicitly via the question form or the Kurs-Übersicht page.
  useEffect(()=>{
    try{
      const done=window.localStorage.getItem('aim_course_tags_migrated_v1')==='1';
      if(done) return;
      if(Object.keys(courseTags).length>0){
        // User already has tags (e.g. from a restored backup) — mark done.
        window.localStorage.setItem('aim_course_tags_migrated_v1','1');
        return;
      }
      const initial=migrateCourseTagsFromMatrix(questions,programs);
      setCourseTags(initial);
      window.localStorage.setItem('aim_course_tags_migrated_v1','1');
    }catch{}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // First-mount: restore the open exam if one was saved. Previously this
  // effect wiped aim_exam on the very first run when the init flag was
  // missing — which destroyed user data if they ever cleared cookies.
  // Now we ALWAYS restore a saved exam if present and only set the init
  // flag as a one-time marker.
  useEffect(()=>{
    try{
      const r=window.localStorage.getItem('aim_exam');
      if(r){
        const d=JSON.parse(r);
        if(d && d.exam){
          setExam(d.exam);
          setExamName(d.name||'');
        }
      }
      if(window.localStorage.getItem(APP_INIT_KEY)!=='1'){
        window.localStorage.setItem(APP_INIT_KEY,'1');
      }
    }catch{}
  },[]);

  // navTo is a thin wrapper around setView, passed to child pages as setView.
  const navTo=useCallback(v=>{
    setView(v);
  },[]);

  return(
    <div style={{display:'flex',minHeight:'100vh',fontFamily:sans,background:C.wW}}>
      <Sidebar view={view} setView={navTo} qCount={questions.length} pCount={programs.length} examCount={exam?.length} collapsed={sidebarCollapsed} onToggle={toggleSidebar} darkMode={darkMode} onToggleDark={()=>setDarkMode(d=>!d)} lastSavedAt={lastSavedAt}/>
      <div style={{flex:1,overflow:'auto'}}>
        {view==='dashboard'&&<Dashboard questions={questions} programs={programs} exam={exam} examName={examName} savedExams={savedExams} courseTags={courseTags} setCourseTags={setCourseTags} setView={navTo} setQuestions={setQuestions} setPrograms={setPrograms} setSavedExams={setSavedExams} setExam={setExam} setExamName={setExamName} showToast={showToast} showConfirm={showConfirm} onClearAllData={clearAllData} saveLastBackup={saveLastBackup}/>}
        {view==='questions'&&<QuestionDB questions={questions} setQuestions={setQuestions} programs={programs} courseTags={courseTags} setCourseTags={setCourseTags} showToast={showToast} showConfirm={showConfirm}/>}
        {view==='courses'&&<KursUebersicht questions={questions} programs={programs} courseTags={courseTags} setCourseTags={setCourseTags} showToast={showToast}/>}
        {view==='programs'&&<Programs programs={programs} setPrograms={setPrograms} questions={questions} courseTags={courseTags} showToast={showToast} showConfirm={showConfirm} settings={settings}/>}
        {view==='exam'&&<ExamBuilder programs={programs} questions={questions} setView={navTo} onBuild={(qs,name)=>{setExam(qs);setExamName(name||'');showToast(`Prüfung „${name}“ mit ${qs.length} Fragen erstellt.`,'success');setView('export');}}/>}
        {view==='export'&&<ExportView exam={exam} programName={examName} setView={navTo} showToast={showToast} showConfirm={showConfirm} onSaveAndNew={(savedName)=>{if(!exam?.length)return;const snapshot=createSavedExamSnapshot(exam,savedName||examName||'Prüfung',examName||'Prüfung');setSavedExams(prev=>[snapshot,...prev]);setExam(null);setExamName('');try{window.localStorage.removeItem('aim_exam');}catch{}showToast(`Prüfung „${snapshot.name}“ gespeichert. Neue Prüfung kann gestartet werden.`,'success');setView('exam');}} onUpdateExam={updater=>setExam(prev=>typeof updater==='function'?updater(prev||[]):updater)} onClear={()=>{setExam(null);setExamName('');try{window.localStorage.removeItem('aim_exam');}catch{}}}/>}
        {view==='anleitung'&&<AnleitungPage/>}
        {view==='settings'&&<SettingsPage settings={settings} setSettings={setSettings} darkMode={darkMode} onToggleDark={v=>setDarkMode(typeof v==='boolean'?v:d=>!d)}/>}
      </div>
      <ToastContainer toasts={toasts} onRemove={id=>setToasts(prev=>prev.filter(t=>t.id!==id))}/>
      <ConfirmModal confirm={confirm} onClose={()=>setConfirm(null)}/>
    </div>
  );
}
