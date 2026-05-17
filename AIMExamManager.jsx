import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";

// Color tokens — values come from CSS custom properties so dark/light mode works
const C={tD:'var(--c-tD)',t:'var(--c-t)',tM:'var(--c-tM)',tL:'var(--c-tL)',tP:'var(--c-tP)',wW:'var(--c-wW)',st:'var(--c-st)',tx:'var(--c-tx)',mu:'var(--c-mu)',bo:'var(--c-bo)',ac:'var(--c-ac)',wh:'var(--c-wh)',re:'var(--c-re)',rP:'var(--c-rP)',gr:'var(--c-gr)',gP:'var(--c-gP)'};
const THEMES={
  light:`
    --c-tD:#111111;--c-t:#d71920;--c-tM:#f08a00;--c-tL:#f3dcc9;--c-tP:#fff5ee;
    --c-wW:#f7f7f5;--c-st:#efefec;--c-tx:#111111;--c-mu:#666666;--c-bo:#d7d7d2;
    --c-ac:#f2c230;--c-wh:#ffffff;--c-re:#b42318;--c-rP:#fff1f0;--c-gr:#1d6b3e;--c-gP:#edf7ef;
    --c-sem-sel-cur:#fff0dc;--c-sem-sel-comp:#f3ede7;--c-sem-sel:#fff6f0;
    --c-sem-cur:#fff7e7;--c-sem-comp:#f5f5f2;--c-row-alt:#fcfcfb;
    --c-grid-sub:#f2f2f0;--c-grid-border:#1f1f1f;--c-sidebar:#111111;`,
  dark:`
    --c-tD:#f0f0ee;--c-t:#e86068;--c-tM:#f0a030;--c-tL:#4a3028;--c-tP:#2a1a14;
    --c-wW:#18181a;--c-st:#252528;--c-tx:#e0e0de;--c-mu:#909090;--c-bo:#38383c;
    --c-ac:#f2c230;--c-wh:#222228;--c-re:#e06060;--c-rP:#2a1414;--c-gr:#5dbf7a;--c-gP:#1a2d1e;
    --c-sem-sel-cur:#2a1e0c;--c-sem-sel-comp:#201a16;--c-sem-sel:#1e1714;
    --c-sem-cur:#1e1c10;--c-sem-comp:#1e1e24;--c-row-alt:#1c1c1e;
    --c-grid-sub:#1c1c20;--c-grid-border:#444448;--c-sidebar:#0d0d10;`
};
const sans="'Source Sans 3',system-ui,sans-serif";
const serif="'Libre Baskerville',Georgia,serif";
const FORMATS=['Single Choice','Multiple Choice','Richtig/Falsch','Ja/Nein'];
const KEYS=['A','B','C','D','E'];
const TERM_OPTIONS=['FS','HS'];
const SEMESTER_COUNT=6;
const MODULES_PER_SEMESTER=4;

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

function abbreviateCourseName(course=''){
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

function exportExcel(questions, programs, savedExams=[]){
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Fragen ──────────────────────────────────────────────────────
  const qRows = questions.map(q=>({
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
  const wsQ = XLSX.utils.json_to_sheet(qRows);
  wsQ['!cols']=[{wch:6},{wch:10},{wch:28},{wch:52},{wch:16},{wch:80},{wch:50},{wch:50},{wch:50},{wch:50},{wch:50},{wch:20}];
  XLSX.utils.book_append_sheet(wb, wsQ, 'Fragen');

  // ── Sheet 2: Weiterbildungsgänge ─────────────────────────────────────────
  const pRows = programs.map(p=>({'Name':p.name,'Startjahr':p.startYear||'','Startsemester':p.startTerm||''}));
  const wsP = XLSX.utils.json_to_sheet(pRows);
  wsP['!cols']=[{wch:30},{wch:12},{wch:16}];
  XLSX.utils.book_append_sheet(wb, wsP, 'Weiterbildungsgänge');

  // ── Sheet 3: Semesteransicht (wie in der App) ────────────────────────────
  const wsS = buildSemesterOverviewSheet(programs);
  XLSX.utils.book_append_sheet(wb, wsS, 'Semesteransicht');

  // ── Sheet 4: Gespeicherte Prüfungen ───────────────────────────────────────
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
  XLSX.utils.book_append_sheet(wb, wsE, 'Gespeicherte Prüfungen');

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
      const ws=wb.Sheets['Fragen']||wb.Sheets[wb.SheetNames[0]];
      const imported=readQuestionsFromSheet(ws);
      if(!imported.length){
        showToast('Keine gültigen Fragen in der Excel-Datei gefunden.','error');
        return;
      }
      setQuestions(prev=>{
        const byId=new Map(prev.map(q=>[String(q.id),q]));
        imported.forEach((q,idx)=>{
          const normalizedId=String(q.id||`import_${Date.now()}_${idx}`);
          const merged={...q,id:normalizedId};
          if(byId.has(normalizedId)){
            byId.set(normalizedId,merged);
            return;
          }
          const duplicate=[...byId.values()].find(existing=>
            existing.course===merged.course &&
            existing.question.trim().toLowerCase()===merged.question.trim().toLowerCase()
          );
          if(duplicate){
            byId.set(String(duplicate.id),{...duplicate,...merged,id:duplicate.id});
          }else{
            byId.set(normalizedId,merged);
          }
        });
        return [...byId.values()];
      });
      showToast(`${imported.length} Fragen aus Excel übernommen.`,`success`);
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

function importExcel(file, setQuestions, setPrograms, setSavedExams, showToast, normalizePrograms){
  const reader = new FileReader();
  reader.onload = evt => {
    try{
      const wb = XLSX.read(evt.target.result,{type:'array'});

      // ── Fragen ────────────────────────────────────────────────────────────
      let newQuestions=[];
      const wsQ = wb.Sheets['Fragen'];
      if(wsQ){
        newQuestions = readQuestionsFromSheet(wsQ).map((q,i)=>({...q,id:Date.now()+i}));
      }

      // ── Weiterbildungsgänge + Module ──────────────────────────────────────
      let newPrograms=[];
      const wsP = wb.Sheets['Weiterbildungsgänge'];
      const wsS = wb.Sheets['Semesteransicht'];
      const wsM = wb.Sheets['Module'];
      const wsE = wb.Sheets['Gespeicherte Prüfungen'];
      const pRows = wsP ? XLSX.utils.sheet_to_json(wsP,{defval:''}) : [];
      const fromSemesterSheet = wsS ? buildProgramsFromSemesterSheet(wsS,pRows) : [];
      if(fromSemesterSheet.length){
        newPrograms=fromSemesterSheet;
      }else if(wsP){
        const mRows = wsM ? XLSX.utils.sheet_to_json(wsM,{defval:''}) : [];
        const semesterMatrixRows = wsS ? XLSX.utils.sheet_to_json(wsS,{header:1,defval:''}) : [];
        const semesterMap = new Map();

        if(semesterMatrixRows.length>2){
          let currentProgram='';
          const startRow=Math.max(semesterMatrixRows.findIndex(row=>row.map(v=>String(v||'').trim()).includes('Kursname'))+1,2);
          semesterMatrixRows.slice(startRow).forEach(row=>{
            if(!row.some(cell=>String(cell||'').trim())) return;
            if(String(row[1]||'').trim()) currentProgram=String(row[1]||'').trim();
            if(!currentProgram) return;
            for(let semIndex=0;semIndex<SEMESTER_COUNT;semIndex++){
              const start=4+semIndex*3;
              const key=`${currentProgram}__${semIndex+1}`;
              if(!semesterMap.has(key)) semesterMap.set(key,[]);
              semesterMap.get(key).push({
                year:String(row[start]||''),
                lecturer:String(row[start+1]||''),
                course:String(row[start+2]||''),
              });
            }
          });
        }

        newPrograms = pRows.filter(r=>r['Name']).map((r,i)=>{
          const semesters = Array.from({length:6},(_,si)=>({
            sem: si+1,
            modules: Array.from({length:4},(_,mi)=>{
              const semesterKey=`${String(r['Name'])}__${si+1}`;
              const fromMatrix=(semesterMap.get(semesterKey)||[])[mi];
              if(fromMatrix){
                return{
                  year:String(fromMatrix.year||''),
                  lecturer:String(fromMatrix.lecturer||''),
                  course:String(fromMatrix.course||''),
                };
              }
              const mod = mRows.find(m=>
                String(m['Weiterbildungsgang'])===String(r['Name'])&&
                Number(m['Semester'])===si+1&&
                Number(m['Modul'])===mi+1
              );
              return { year:mod?String(mod['Jahr']||''):'', lecturer:mod?String(mod['Dozent/in']||''):'', course:mod?String(mod['Kurs']||''):'' };
            }),
          }));
          return { id:Date.now()+i+10000, name:String(r['Name']), startYear:String(r['Startjahr']||''), startTerm:String(r['Startsemester']||'HS'), semesters };
        });
      }
      const newSavedExams=wsE?readSavedExamsFromSheet(wsE):[];

      if(!newQuestions.length && !newPrograms.length && !newSavedExams.length){
        showToast('Keine gültigen Daten in der Excel-Datei gefunden.','error');
        return;
      }
      if(newQuestions.length) setQuestions(newQuestions);
      if(newPrograms.length) setPrograms(normalizePrograms(newPrograms));
      if(newSavedExams.length) setSavedExams(newSavedExams);
      showToast(`Excel importiert: ${newQuestions.length} Fragen, ${newPrograms.length} Weiterbildungsgänge, ${newSavedExams.length} gespeicherte Prüfungen.`,'success');
    }catch(e){
      showToast('Excel-Datei konnte nicht gelesen werden.','error');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function dlDocx(qs,filename){
  const D=window.docxLib;
  if(!D)return false;
  const{Document,Packer,Paragraph,TextRun}=D;
  const children=[];
  qs.forEach((q,i)=>{
    const correct=q.answer?q.answer.split(';'):[];
    const opts=[{k:'A',t:q.optA},{k:'B',t:q.optB},{k:'C',t:q.optC},{k:'D',t:q.optD},{k:'E',t:q.optE}].filter(o=>o.t);
    // "N. Titel des Kurses: [Course]" — italic + underline
    children.push(new Paragraph({
      children:[
        new TextRun({text:`${i+1}. Titel des Kurses: `,size:20,font:'Calibri',italics:true,underline:{type:'single'}}),
        new TextRun({text:q.course||'',size:20,font:'Calibri',italics:true,underline:{type:'single'}}),
      ],spacing:{after:80}
    }));
    // Question text
    children.push(new Paragraph({children:[new TextRun({text:q.question,size:20,font:'Calibri'})],spacing:{after:80}}));
    // Answer options a) b) c) — correct answers in bold
    opts.forEach(o=>{
      const lbl=o.k.toLowerCase();
      const isCorrect=correct.includes(o.k);
      children.push(new Paragraph({children:[new TextRun({text:`${lbl}) ${o.t}`,size:20,font:'Calibri',bold:isCorrect})],spacing:{after:40}}));
    });
    // Spacer paragraph
    children.push(new Paragraph({children:[new TextRun({text:' ',size:20,font:'Calibri'})],spacing:{after:160}}));
  });
  const doc=new Document({sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1440,right:1440,bottom:1440,left:1440}}},children}]});
  const blob=await Packer.toBlob(doc);
  dlFile(blob,filename,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  return true;
}

function printAsPdf(qs,title){
  const w=window.open('','_blank');
  if(!w)return;
  const body=qs.map((q,i)=>{
    const correct=q.answer?q.answer.split(';'):[];
    const opts=[{k:'A',t:q.optA},{k:'B',t:q.optB},{k:'C',t:q.optC},{k:'D',t:q.optD},{k:'E',t:q.optE}].filter(o=>o.t);
    const optsHtml=opts.map(o=>{
      const isC=correct.includes(o.k);
      return`<p style="margin:1px 0 1px 14px;font-weight:${isC?'bold':'normal'}">${o.k.toLowerCase()}) ${o.t}</p>`;
    }).join('');
    return`<div style="margin-bottom:16px"><p style="margin:0 0 3px;font-style:italic;text-decoration:underline">${i+1}. Titel des Kurses: ${q.course||''}</p><p style="margin:0 0 4px;font-weight:600">${q.question}</p>${optsHtml}</div>`;
  }).join('');
  w.document.write(`<!DOCTYPE html><html><head><title>${title||'AIM Prüfung'}</title><style>body{font-family:Calibri,sans-serif;font-size:10pt;margin:0.5cm}@media print{@page{margin:0.5cm}}</style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(()=>w.print(),400);
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const inp={width:'100%',fontFamily:sans,fontSize:'14px',padding:'8px 12px',border:'1px solid var(--c-bo)',borderRadius:4,background:'var(--c-wh)',color:'var(--c-tx)',boxSizing:'border-box',outline:'none'};
const gridTh={padding:'10px 8px',border:'1px solid var(--c-grid-border)',background:'var(--c-wh)',color:'var(--c-tx)',fontSize:'11px',fontWeight:700,textAlign:'center',whiteSpace:'nowrap'};
const gridSemesterHead={padding:'10px 8px',borderTop:'1px solid var(--c-grid-border)',borderBottom:'1px solid var(--c-grid-border)',borderRight:'1px solid var(--c-grid-border)',background:'var(--c-wh)',color:'var(--c-tx)',fontSize:'13px',fontWeight:700,textAlign:'center'};
const gridSubHead={padding:'8px 6px',borderBottom:'1px solid var(--c-grid-border)',borderRight:'1px solid var(--c-bo)',background:'var(--c-grid-sub)',color:'var(--c-tx)',fontSize:'10px',fontWeight:600,textAlign:'center',whiteSpace:'nowrap'};
const gridCell={padding:'6px',borderRight:'1px solid var(--c-bo)',borderBottom:'1px solid var(--c-bo)',verticalAlign:'top'};
const gridCellMuted={padding:'10px 8px',borderRight:'1px solid var(--c-bo)',borderBottom:'1px solid var(--c-bo)',fontSize:'12px',color:'var(--c-mu)',verticalAlign:'top',textAlign:'center'};
const gridStickyName={padding:'8px',borderRight:'1px solid var(--c-grid-border)',borderBottom:'1px solid var(--c-bo)',verticalAlign:'top'};
const gridInput={...inp,fontSize:'12px',padding:'6px 8px',borderRadius:0,background:'transparent',border:'1px solid transparent',transition:'border-color 0.15s'};
// Focus style applied via onFocus/onBlur in inputs

function getSemesterState(program,semNumber){
  const now=currentAcademicTag();
  const startIndex=Number(program.startYear||now.year)*2+(program.startTerm==='HS'?1:0);
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

function Field({label,children,half}){
  return(
    <div style={{marginBottom:12,flex:half?'1':undefined,minWidth:half?'45%':undefined}}>
      {label&&<label style={{display:'block',fontSize:'11px',fontWeight:500,color:C.mu,marginBottom:4,letterSpacing:'0.5px',textTransform:'uppercase'}}>{label}</label>}
      {children}
    </div>
  );
}

function Btn({ch,onClick,v='primary',sm,dis,full,style:s={}}){
  const base={fontFamily:sans,fontWeight:500,cursor:dis?'not-allowed':'pointer',border:'none',borderRadius:4,padding:sm?'6px 14px':'9px 20px',fontSize:sm?'12px':'14px',opacity:dis?.55:1,width:full?'100%':undefined,...s};
  const vs={primary:{background:C.t,color:C.wh},secondary:{background:'transparent',color:C.t,border:`1.5px solid ${C.t}`},ghost:{background:'transparent',color:C.mu,border:`1px solid ${C.bo}`},danger:{background:C.re,color:C.wh},accent:{background:C.ac,color:C.wh},success:{background:C.gr,color:C.wh}};
  return<button onClick={dis?undefined:onClick} style={{...base,...(vs[v]||vs.primary)}}>{ch}</button>;
}

function Badge({ch,color='teal',sm}){
  const colors={teal:{bg:C.tP,tx:C.tD},warm:{bg:'#FEF3E2',tx:'#7A4F10'},gray:{bg:C.st,tx:'#4A4A48'},green:{bg:C.gP,tx:C.gr},red:{bg:C.rP,tx:C.re}};
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
  if(!confirm)return null;
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(17,17,17,0.5)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:C.wh,borderRadius:8,padding:'24px',maxWidth:400,width:'90%',boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:serif,fontSize:'17px',color:C.tD,marginBottom:10,fontWeight:700}}>Bestätigung</div>
        <p style={{fontSize:'14px',color:C.tx,margin:'0 0 20px',lineHeight:1.5}}>{confirm.message}</p>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn ch="Abbrechen" onClick={onClose} v="ghost"/>
          <Btn ch={confirm.confirmLabel||'Löschen'} onClick={()=>{confirm.onConfirm();onClose();}} v={confirm.confirmV||'danger'}/>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({title,sub,action}){
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

// ─── Image Slot (for Help page screenshots) ───────────────────────────────────
const HELP_COLORS=['#d71920','#f08a00','#f2c230','#2563eb','#16a34a','#7c3aed','#111111'];
let activeHelpSlotId=null;
const mkHelpAnno=(type)=>({
  id:`anno_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
  type,
  color:type==='text'?'#111111':'#d71920',
  x:18,
  y:18,
  w:type==='arrow'?26:24,
  h:type==='text'?12:18,
  rotation:0,
  text:type==='text'?'Text':'',
});

function getHelpGallery(storageId,legacyId){
  try{
    const gallery=window.localStorage.getItem(`aim_gallery_${storageId}`);
    if(gallery){
      const parsed=JSON.parse(gallery);
      if(Array.isArray(parsed)) return parsed;
    }
    if(legacyId){
      const legacyGallery=window.localStorage.getItem(`aim_gallery_${legacyId}`);
      if(legacyGallery){
        const parsed=JSON.parse(legacyGallery);
        if(Array.isArray(parsed)) return parsed;
      }
    }
    const legacy=window.localStorage.getItem(`aim_img_${legacyId||storageId}`);
    if(legacy){
      return [{id:`img_${Date.now()}`,src:legacy,annotations:[]}];
    }
  }catch{}
  return [];
}

function saveHelpGallery(storageId,items){
  try{
    window.localStorage.setItem(`aim_gallery_${storageId}`,JSON.stringify(items));
    window.localStorage.removeItem(`aim_img_${storageId}`);
  }catch{}
}

function renderHelpAnnotation(anno){
  const base={position:'absolute',left:`${anno.x}%`,top:`${anno.y}%`,pointerEvents:'none',transform:`rotate(${anno.rotation||0}deg)`};
  if(anno.type==='box'){
    return <div key={anno.id} style={{...base,width:`${anno.w}%`,height:`${anno.h}%`,border:`3px solid ${anno.color}`,borderRadius:6,boxSizing:'border-box',transformOrigin:'center center'}}/>;
  }
  if(anno.type==='circle'){
    return <div key={anno.id} style={{...base,width:`${anno.w}%`,height:`${anno.h}%`,border:`3px solid ${anno.color}`,borderRadius:'999px',boxSizing:'border-box',transformOrigin:'center center'}}/>;
  }
  if(anno.type==='arrow'){
    return(
      <div key={anno.id} style={{...base,width:`${anno.w}%`,height:`${anno.h}%`,transformOrigin:'left center'}}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{width:'100%',height:'100%',display:'block',overflow:'visible'}}>
          <line x1="0" y1="50" x2="78" y2="50" stroke={anno.color} strokeWidth="10" strokeLinecap="round"/>
          <polygon points="78,24 100,50 78,76" fill={anno.color}/>
        </svg>
      </div>
    );
  }
  if(anno.type==='text'){
    return <div key={anno.id} style={{...base,color:anno.color,fontWeight:700,fontSize:'16px',lineHeight:1.2,background:'rgba(255,255,255,0.82)',padding:'2px 6px',borderRadius:4,width:`${anno.w}%`,minHeight:`${anno.h}%`,wordBreak:'break-word',transformOrigin:'left top',boxSizing:'border-box'}}>{anno.text||'Text'}</div>;
  }
  return null;
}

function ImageSlot({id,storageId,editMode}){
  const[items,setItems]=useState(()=>getHelpGallery(storageId,id));
  const[selectedId,setSelectedId]=useState(null);
  const slotIdRef=useRef(`help_slot_${storageId}_${id}_${Math.random().toString(36).slice(2,8)}`);
  const ref=useRef(null);
  const selected=items.find(item=>item.id===selectedId)||items[0]||null;
  const activateSlot=useCallback(()=>{
    activeHelpSlotId=slotIdRef.current;
  },[]);
  useEffect(()=>{
    const nextItems=getHelpGallery(storageId,id);
    setItems(nextItems);
    setSelectedId(nextItems[0]?.id||null);
    setSelectedAnnoId(null);
  },[storageId,id]);
  const sync=next=>{
    setItems(next);
    saveHelpGallery(storageId,next);
    if(!next.find(item=>item.id===selectedId)) setSelectedId(next[0]?.id||null);
  };
  const save=e=>{
    if(!editMode) return;
    const files=[...(e.target.files||[])];
    if(!files.length)return;
    files.forEach(file=>{
      const reader=new FileReader();
      reader.onload=evt=>{
        const d=evt.target.result;
        const next=[...getHelpGallery(storageId,id),{id:`img_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,src:d,annotations:[]}];
        sync(next);
        if(!selectedId && next[0]) setSelectedId(next[next.length-1].id);
      };
      reader.readAsDataURL(file);
    });
    e.target.value='';
  };
  const removeImage=imgId=>{
    sync(items.filter(item=>item.id!==imgId));
  };
  const replaceImage=(imgId,file)=>{
    if(!editMode) return;
    if(!file)return;
    const reader=new FileReader();
    reader.onload=evt=>{
      sync(items.map(item=>item.id===imgId?{...item,src:evt.target.result}:item));
    };
    reader.readAsDataURL(file);
  };
  const updateSelectedAnno=updater=>{
    if(!selected)return;
    sync(items.map(item=>item.id!==selected.id?item:{...item,annotations:item.annotations.map((anno,idx)=>idx===0 && false?anno:anno)}));
    setItems(cur=>{
      const next=cur.map(item=>item.id!==selected.id?item:{...item,annotations:item.annotations.map(anno=>anno.id===selectedAnnotation?.id?updater(anno):anno)});
      saveHelpGallery(storageId,next);
      return next;
    });
  };
  const[selectedAnnoId,setSelectedAnnoId]=useState(null);
  const selectedAnnotation=selected?.annotations?.find(anno=>anno.id===selectedAnnoId)||null;
  useEffect(()=>{
    if(selected && selectedAnnoId && !selected.annotations.find(anno=>anno.id===selectedAnnoId)){
      setSelectedAnnoId(null);
    }
  },[selected,selectedAnnoId]);
  useEffect(()=>{
    if(!editMode || !selected || !selectedAnnotation) return;
    const onKeyDown=e=>{
      if(activeHelpSlotId!==slotIdRef.current) return;
      const target=e.target;
      const tag=target?.tagName?.toLowerCase();
      if(tag==='input' || tag==='textarea' || tag==='select' || target?.isContentEditable) return;
      const step=e.shiftKey?3:1;
      const rotateStep=e.shiftKey?15:5;
      const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
      const key=e.key.toLowerCase();
      if(!['w','a','s','d','q','e','x','c','y','v'].includes(key)) return;
      e.preventDefault();
      if(key==='w') patchAnnotation(selectedAnnotation.id,{y:clamp(Number(selectedAnnotation.y||0)-step,0,95)});
      if(key==='s') patchAnnotation(selectedAnnotation.id,{y:clamp(Number(selectedAnnotation.y||0)+step,0,95)});
      if(key==='a') patchAnnotation(selectedAnnotation.id,{x:clamp(Number(selectedAnnotation.x||0)-step,0,95)});
      if(key==='d') patchAnnotation(selectedAnnotation.id,{x:clamp(Number(selectedAnnotation.x||0)+step,0,95)});
      if(key==='q') patchAnnotation(selectedAnnotation.id,{rotation:Number(selectedAnnotation.rotation||0)-rotateStep});
      if(key==='e') patchAnnotation(selectedAnnotation.id,{rotation:Number(selectedAnnotation.rotation||0)+rotateStep});
      if(key==='x') patchAnnotation(selectedAnnotation.id,{w:clamp(Number(selectedAnnotation.w||0)+step,4,95)});
      if(key==='y') patchAnnotation(selectedAnnotation.id,{w:clamp(Number(selectedAnnotation.w||0)-step,4,95)});
      if(key==='c') patchAnnotation(selectedAnnotation.id,{h:clamp(Number(selectedAnnotation.h||0)+step,4,95)});
      if(key==='v') patchAnnotation(selectedAnnotation.id,{h:clamp(Number(selectedAnnotation.h||0)-step,4,95)});
    };
    window.addEventListener('keydown',onKeyDown);
    return()=>window.removeEventListener('keydown',onKeyDown);
  },[editMode,selected,selectedAnnotation,items]);
  useEffect(()=>()=>{ if(activeHelpSlotId===slotIdRef.current) activeHelpSlotId=null; },[]);
  const addAnnotation=type=>{
    if(!editMode || !selected)return;
    activateSlot();
    const newAnno=mkHelpAnno(type);
    const next=items.map(item=>item.id!==selected.id?item:{...item,annotations:[...item.annotations,newAnno]});
    sync(next);
    setSelectedAnnoId(newAnno.id);
  };
  const patchAnnotation=(annoId,patch)=>{
    if(!editMode || !selected)return;
    activateSlot();
    sync(items.map(item=>item.id!==selected.id?item:{...item,annotations:item.annotations.map(anno=>anno.id===annoId?{...anno,...patch}:anno)}));
  };
  const removeAnnotation=annoId=>{
    if(!editMode || !selected)return;
    activateSlot();
    const next=items.map(item=>item.id!==selected.id?item:{...item,annotations:item.annotations.filter(anno=>anno.id!==annoId)});
    sync(next);
    setSelectedAnnoId(null);
  };
  return(
    <div style={{marginTop:10,marginBottom:4}} onMouseDown={activateSlot}>
      <input ref={ref} type="file" accept="image/*" multiple style={{display:'none'}} onChange={save}/>
      {!items.length?(
        editMode?(
          <div onClick={()=>ref.current?.click()} style={{border:'2px dashed var(--c-bo)',borderRadius:6,padding:'12px 16px',textAlign:'center',cursor:'pointer',color:'var(--c-mu)',fontSize:'12px',background:'var(--c-wW)',transition:'border-color 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='var(--c-t)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='var(--c-bo)'}
          >📷 Bilder hinzufügen — mehrere Screenshots pro Schritt möglich</div>
        ):null
      ):(
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
            <div style={{fontSize:'11px',color:'var(--c-mu)'}}>{items.length} Bild{items.length===1?'':'er'} · horizontal scrollbar</div>
            {editMode&&<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button onClick={()=>ref.current?.click()} style={{background:'var(--c-wh)',border:'1px solid var(--c-bo)',borderRadius:4,cursor:'pointer',padding:'4px 8px',fontSize:'11px'}}>+ Bilder</button>
              {selected&&(
                <>
                  <button onClick={()=>addAnnotation('box')} style={{background:'var(--c-wh)',border:'1px solid var(--c-bo)',borderRadius:4,cursor:'pointer',padding:'4px 8px',fontSize:'11px'}}>□ Box</button>
                  <button onClick={()=>addAnnotation('circle')} style={{background:'var(--c-wh)',border:'1px solid var(--c-bo)',borderRadius:4,cursor:'pointer',padding:'4px 8px',fontSize:'11px'}}>◯ Kreis</button>
                  <button onClick={()=>addAnnotation('arrow')} style={{background:'var(--c-wh)',border:'1px solid var(--c-bo)',borderRadius:4,cursor:'pointer',padding:'4px 8px',fontSize:'11px'}}>→ Pfeil</button>
                  <button onClick={()=>addAnnotation('text')} style={{background:'var(--c-wh)',border:'1px solid var(--c-bo)',borderRadius:4,cursor:'pointer',padding:'4px 8px',fontSize:'11px'}}>T Text</button>
                </>
              )}
            </div>}
          </div>
          <div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:6,scrollbarWidth:'thin'}}>
            {items.map(item=>(
              <div key={item.id} style={{minWidth:300,maxWidth:300,flex:'0 0 auto'}}>
                <div onClick={()=>{ if(editMode){ activateSlot(); setSelectedId(item.id); setSelectedAnnoId(null); } }} style={{position:'relative',border:editMode&&selected?.id===item.id?'2px solid var(--c-t)':'1px solid var(--c-bo)',borderRadius:8,overflow:'hidden',background:'var(--c-wh)',cursor:editMode?'pointer':'default'}}>
                  <div style={{position:'relative'}}>
                    <img src={item.src} alt="Screenshot" style={{width:'100%',display:'block'}}/>
                    <div style={{position:'absolute',inset:0}}>
                      {(item.annotations||[]).map(renderHelpAnnotation)}
                    </div>
                  </div>
                  {editMode&&<div style={{position:'absolute',top:6,right:6,display:'flex',gap:4}}>
                    <label style={{background:'rgba(0,0,0,0.55)',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',padding:'3px 8px',fontSize:'11px'}}>
                      ✎
                      <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{replaceImage(item.id,e.target.files?.[0]);e.target.value='';}}/>
                    </label>
                    <button onClick={(e)=>{e.stopPropagation();removeImage(item.id);}} style={{background:'rgba(180,0,0,0.7)',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',padding:'3px 8px',fontSize:'11px'}}>✕</button>
                  </div>}
                </div>
              </div>
            ))}
          </div>
          {editMode&&selected&&(
            <div style={{marginTop:10,border:'1px solid var(--c-bo)',borderRadius:8,padding:12,background:'var(--c-wW)'}}>
              <div style={{fontSize:'11px',letterSpacing:'1px',textTransform:'uppercase',color:'var(--c-mu)',fontWeight:600,marginBottom:8}}>Bild schnell bearbeiten</div>
              <div style={{fontSize:'12px',color:'var(--c-mu)',marginBottom:10}}>Tastatur: <strong>W A S D</strong> bewegt das ausgewählte Element, <strong>Q</strong> dreht nach links, <strong>E</strong> dreht nach rechts, <strong>X</strong> vergrössert die Breite, <strong>Y</strong> verkleinert die Breite, <strong>C</strong> vergrössert die Höhe, <strong>V</strong> verkleinert die Höhe. Mit <strong>Shift</strong> geht es schneller.</div>
              {!selected.annotations.length?<div style={{fontSize:'12px',color:'var(--c-mu)'}}>Wähle oben ein Werkzeug, um Boxen, Kreise, Pfeile oder Text hinzuzufügen.</div>:(
                <>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                    {selected.annotations.map(anno=>(
                      <button key={anno.id} onClick={()=>{ activateSlot(); setSelectedAnnoId(anno.id); }} style={{padding:'4px 8px',border:'1px solid var(--c-bo)',borderRadius:4,cursor:'pointer',background:selectedAnnotation?.id===anno.id?'var(--c-tP)':'var(--c-wh)',fontSize:'11px'}}>
                        {anno.type}
                      </button>
                    ))}
                  </div>
                  {selectedAnnotation&&(
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8}}>
                      <label style={{fontSize:'11px',color:'var(--c-mu)'}}>Farbe
                        <select style={{...inp,fontSize:'12px',padding:'5px 7px'}} value={selectedAnnotation.color} onChange={e=>patchAnnotation(selectedAnnotation.id,{color:e.target.value})}>
                          {HELP_COLORS.map(color=><option key={color} value={color}>{color}</option>)}
                        </select>
                      </label>
                      <label style={{fontSize:'11px',color:'var(--c-mu)'}}>X %
                        <input type="number" min="0" max="90" style={{...inp,fontSize:'12px',padding:'5px 7px'}} value={selectedAnnotation.x} onChange={e=>patchAnnotation(selectedAnnotation.id,{x:Number(e.target.value)})}/>
                      </label>
                      <label style={{fontSize:'11px',color:'var(--c-mu)'}}>Y %
                        <input type="number" min="0" max="90" style={{...inp,fontSize:'12px',padding:'5px 7px'}} value={selectedAnnotation.y} onChange={e=>patchAnnotation(selectedAnnotation.id,{y:Number(e.target.value)})}/>
                      </label>
                      <label style={{fontSize:'11px',color:'var(--c-mu)'}}>Breite %
                        <input type="number" min="4" max="90" style={{...inp,fontSize:'12px',padding:'5px 7px'}} value={selectedAnnotation.w} onChange={e=>patchAnnotation(selectedAnnotation.id,{w:Number(e.target.value)})}/>
                      </label>
                      <label style={{fontSize:'11px',color:'var(--c-mu)'}}>Rotation
                        <input type="number" style={{...inp,fontSize:'12px',padding:'5px 7px'}} value={selectedAnnotation.rotation||0} onChange={e=>patchAnnotation(selectedAnnotation.id,{rotation:Number(e.target.value)})}/>
                      </label>
                      {selectedAnnotation.type!=='text'&&(
                        <label style={{fontSize:'11px',color:'var(--c-mu)'}}>Höhe %
                          <input type="number" min="4" max="90" style={{...inp,fontSize:'12px',padding:'5px 7px'}} value={selectedAnnotation.h} onChange={e=>patchAnnotation(selectedAnnotation.id,{h:Number(e.target.value)})}/>
                        </label>
                      )}
                      {selectedAnnotation.type==='text'&&(
                        <label style={{fontSize:'11px',color:'var(--c-mu)',gridColumn:'span 3'}}>Text
                          <input style={{...inp,fontSize:'12px',padding:'5px 7px'}} value={selectedAnnotation.text||''} onChange={e=>patchAnnotation(selectedAnnotation.id,{text:e.target.value})}/>
                        </label>
                      )}
                      <div style={{display:'flex',alignItems:'end'}}>
                        <button onClick={()=>removeAnnotation(selectedAnnotation.id)} style={{background:'var(--c-re)',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',padding:'7px 10px',fontSize:'11px',width:'100%'}}>Annotation löschen</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
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
function Sidebar({view,setView,qCount,pCount,examCount,collapsed,onToggle,darkMode,onToggleDark}){
  const nav=[
    {k:'dashboard',icon:'▦',label:'Dashboard'},
    {k:'questions',icon:'≡',label:'Fragen Datenbank',badge:qCount},
    {k:'programs',icon:'◫',label:'Weiterbildungsgänge',badge:pCount},
    {k:'exam',icon:'✎',label:'Prüfung erstellen'},
    {k:'export',icon:'↓',label:'Export & Download',badge:examCount||null},
    {k:'help',icon:'?',label:'Hilfe & Anleitung'},
    {k:'settings',icon:'⚙',label:'Einstellungen'},
  ];
  return(
    <div style={{width:collapsed?56:226,background:C.tD,display:'flex',flexDirection:'column',flexShrink:0,transition:'width 0.2s ease',overflow:'hidden'}}>
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
            <button data-nav={n.k} key={n.k} onClick={()=>setView(n.k)} title={collapsed?n.label:undefined} aria-label={n.label} style={{width:'100%',display:'flex',alignItems:'center',gap:collapsed?0:10,padding:collapsed?'12px 0':'10px 16px',justifyContent:collapsed?'center':'flex-start',background:active?'rgba(255,255,255,0.08)':'transparent',color:active?C.wh:'#cfcfcf',border:'none',borderLeft:active?`3px solid ${C.ac}`:'3px solid transparent',cursor:'pointer',fontFamily:sans,fontSize:'13px',fontWeight:active?600:400,textAlign:'left'}}>
              <span style={{fontSize:'14px',width:collapsed?undefined:16,textAlign:'center'}}>{n.icon}</span>
              {!collapsed&&<span style={{flex:1}}>{n.label}</span>}
              {!collapsed&&n.badge!=null&&<span style={{background:'rgba(255,255,255,0.18)',color:C.wh,fontSize:'11px',borderRadius:10,padding:'1px 7px',minWidth:18,textAlign:'center'}}>{n.badge}</span>}
            </button>
          );
        })}
      </nav>
      <div style={{borderTop:'1px solid rgba(255,255,255,0.1)',padding:collapsed?'8px 0':'8px 12px',display:'flex',alignItems:'center',justifyContent:collapsed?'center':'space-between',gap:8}}>
        {!collapsed&&<span style={{fontSize:'11px',color:'rgba(200,190,180,0.7)'}}>AIM AG · Basel · Bern · Zürich</span>}
        <button onClick={onToggleDark} aria-label={darkMode?'Hellmodus':'Dunkelmodus'} title={darkMode?'Hellmodus':'Dunkelmodus'} style={{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:6,color:'rgba(255,255,255,0.8)',cursor:'pointer',padding:'5px 8px',fontSize:'14px',lineHeight:1}}>{darkMode?'☀️':'🌙'}</button>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({questions,programs,exam,examName,savedExams,setView,setQuestions,setPrograms,setSavedExams,setExam,setExamName,showToast,showConfirm,onClearAllData}){
  const restoreRef=useRef(null);
  const excelImportRef=useRef(null);
  const courses=[...new Set(questions.map(q=>q.course))];
  const fmtCounts=FORMATS.map(f=>({f,n:questions.filter(q=>q.format===f).length}));
  const exportBackup=()=>{
    const data=JSON.stringify({version:2,exportedAt:new Date().toISOString(),questions,programs,semesterView:buildSemesterOverviewEntries(programs),savedExams,currentExam:exam?{exam,name:examName||''}:null},null,2);
    dlFile(data,`AIM_Backup_${new Date().toISOString().slice(0,10)}.json`,'application/json');
    showToast('Backup-Datei wird heruntergeladen.','success');
  };
  const restoreBackup=e=>{
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=evt=>{
      try{
        const data=JSON.parse(evt.target.result);
        if(!Array.isArray(data.questions)||!Array.isArray(data.programs)){showToast('Ungültige Backup-Datei.','error');return;}
        setQuestions(data.questions);
        setPrograms(normalizePrograms(data.programs));
        setSavedExams(Array.isArray(data.savedExams)?data.savedExams:[]);
        setExam(data.currentExam?.exam||null);
        setExamName(data.currentExam?.name||'');
        showToast(`Backup wiederhergestellt: ${data.questions.length} Fragen, ${data.programs.length} Programme, ${(data.savedExams||[]).length} gespeicherte Prüfungen.`,'success');
      }catch{showToast('Backup-Datei konnte nicht gelesen werden.','error');}
    };
    reader.readAsText(file);
    e.target.value='';
  };
  return(
    <div style={{padding:28}}>
      <SectionHeader title="Dashboard" sub="AIM Prüfungs-Manager — Willkommen" action={<Btn ch="Neue Prüfung →" onClick={()=>setView('exam')} v="primary"/>}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
        {[
          {label:'Fragen gesamt',val:questions.length,bg:C.tP,tx:C.tD},
          {label:'Kurse',val:courses.length,bg:'#FEF3E2',tx:'#7A4F10'},
          {label:'Weiterbildungsgänge',val:programs.length,bg:C.st,tx:'#4A4A48'},
          {label:'Gespeicherte Prüfungen',val:savedExams.length,bg:savedExams.length?C.gP:C.st,tx:savedExams.length?C.gr:'#4A4A48'},
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
          <p style={{fontSize:'13px',color:C.tx,margin:'0 0 12px',lineHeight:1.55}}>Alle Daten werden automatisch im Browser gespeichert. Für die Weitergabe oder Neuübernahme einer Datenversion empfiehlt sich der Export. Backups enthalten jetzt auch die <strong>gespeicherten Prüfungen</strong>.</p>
          <input ref={restoreRef} type="file" accept=".json" style={{display:'none'}} onChange={restoreBackup}/>
          <input ref={excelImportRef} type="file" accept=".xlsx" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(f)importExcel(f,setQuestions,setPrograms,setSavedExams,showToast,normalizePrograms);e.target.value='';}}/>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:'11px',color:C.mu,marginBottom:6,fontWeight:500}}>JSON (vollständiges Backup)</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <Btn ch="💾 Jetzt sichern" onClick={()=>{try{window.localStorage.setItem('aim_q',JSON.stringify(questions));window.localStorage.setItem('aim_p',JSON.stringify(programs));window.localStorage.setItem('aim_saved_exams',JSON.stringify(savedExams));if(exam){window.localStorage.setItem('aim_exam',JSON.stringify({exam,name:examName||''}));}showToast('Daten im Browser gespeichert.','success');}catch{showToast('Speichern fehlgeschlagen.','error');}}} v="secondary"/>
              <Btn ch="↑ JSON laden" onClick={()=>restoreRef.current?.click()} v="ghost"/>
              <Btn ch="↓ JSON exportieren" onClick={exportBackup} v="ghost"/>
            </div>
          </div>
          <div>
            <div style={{fontSize:'11px',color:C.mu,marginBottom:6,fontWeight:500}}>Excel (Fragen, Weiterbildungsgänge, Semesteransicht, Gespeicherte Prüfungen)</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <Btn ch="↓ Excel exportieren" onClick={()=>{exportExcel(questions,programs,savedExams);showToast('Excel-Datei wird heruntergeladen.','success');}} v="ghost"/>
              <Btn ch="↑ Excel importieren" onClick={()=>excelImportRef.current?.click()} v="ghost"/>
            </div>
          </div>
        </div>
        <div style={{background:C.wh,border:`1px solid ${C.bo}`,borderRadius:8,padding:16,marginTop:16}}>
          <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.mu,marginBottom:8,fontWeight:500}}>Daten zurücksetzen</div>
          <p style={{fontSize:'13px',color:C.tx,margin:'0 0 12px',lineHeight:1.55}}>Löscht alle Fragen, Weiterbildungsgänge, gespeicherten Prüfungen und die aktuell erstellte Prüfung aus der App. Danach kann direkt eine neue JSON- oder Excel-Version importiert werden.</p>
          <Btn ch="✕ Alle Daten löschen" onClick={()=>showConfirm({message:'Möchtest du wirklich alle Daten in der App löschen? Fragen, Weiterbildungsgänge, gespeicherte Prüfungen und die aktuelle Prüfung werden entfernt. Dieser Schritt ist nur sinnvoll, wenn du danach ein neues Backup importierst.',confirmLabel:'Alle Daten löschen',confirmV:'danger',onConfirm:onClearAllData})} v="danger"/>
        </div>
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
          <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.mu,marginBottom:8,fontWeight:500}}>Sitzung</div>
          <p style={{fontSize:'13px',color:C.tx,margin:'0 0 12px',lineHeight:1.55}}>Schliesst die App im Browser. Der lokale Server läuft weiter bis du ihn im Terminal mit <code style={{background:C.st,padding:'1px 5px',borderRadius:3,fontSize:'12px'}}>Ctrl+C</code> beendest.</p>
          <Btn ch="⏻ App schliessen" onClick={()=>showConfirm({message:'Möchtest du die App wirklich schliessen? Alle Daten sind gespeichert. Du kannst die App jederzeit über den Start-Link wieder öffnen.',confirmLabel:'App schliessen',confirmV:'danger',onConfirm:()=>window.close()})} v="ghost"/>
        </div>
      </div>
    </div>
  );
}

// ─── Question DB ──────────────────────────────────────────────────────────────
const emptyQ=()=>({id:Date.now(),year:'',location:'',lecturer:'',course:'',format:'Single Choice',question:'',optA:'',optB:'',optC:'',optD:'',optE:'',answer:'A'});

function QuestionDB({questions,setQuestions,showToast,showConfirm}){
  const[mode,setMode]=useState('list'); // 'list' | 'form'
  const[editing,setEditing]=useState(null);
  const[search,setSearch]=useState('');
  const[filterCourse,setFilterCourse]=useState('');
  const[filterFmt,setFilterFmt]=useState('');
  const[filterLecturer,setFilterLecturer]=useState('');
  const[page,setPage]=useState(0);
  const[pageSize,setPageSize]=useState(15);
  const[editMode,setEditMode]=useState(false);
  const[showImportInfo,setShowImportInfo]=useState(false);
  const importRef=useRef(null);

  const courses=useMemo(()=>[...new Set(questions.map(q=>q.course))].sort(),[questions]);
  const lecturers=useMemo(()=>[...new Set(questions.map(q=>q.lecturer).filter(Boolean))].sort(),[questions]);
  const filtered=useMemo(()=>questions.filter(q=>{
    const s=search.toLowerCase();
    return(!s||q.question.toLowerCase().includes(s)||q.course.toLowerCase().includes(s)||q.lecturer.toLowerCase().includes(s))
      &&(!filterCourse||q.course===filterCourse)
      &&(!filterFmt||q.format===filterFmt)
      &&(!filterLecturer||q.lecturer===filterLecturer);
  }),[questions,search,filterCourse,filterFmt,filterLecturer]);
  const paged=pageSize==='all'?filtered:filtered.slice(page*pageSize,(page+1)*pageSize);

  useEffect(()=>{setPage(0);},[pageSize]);

  const openNew=()=>{setEditing(emptyQ());setMode('form');};
  const openEdit=q=>{setEditing({...q});setMode('form');};
  const cancel=()=>{setEditing(null);setMode('list');};
  const save=()=>{
    if(!editing.question.trim()||!editing.course.trim()){showToast('Kursname und Frage sind Pflichtfelder.','error');return;}
    const isEdit=questions.some(q=>q.id===editing.id);
    if(!isEdit){
      const dup=questions.find(q=>q.question.trim().toLowerCase()===editing.question.trim().toLowerCase());
      if(dup)showToast(`Hinweis: Ähnliche Frage bereits im Kurs „${dup.course}" vorhanden.`,'warning');
    }
    setQuestions(prev=>isEdit?prev.map(q=>q.id===editing.id?editing:q):[...prev,editing]);
    showToast(isEdit?'Frage aktualisiert.':'Frage gespeichert.','success');
    cancel();
  };
  const del=id=>{
    showConfirm('Frage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',()=>{
      setQuestions(prev=>prev.filter(q=>q.id!==id));
      showToast('Frage gelöscht.','success');
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
          toAdd.push({id:Date.now()+Math.random(),year:r.year||'',location:r.location||'',lecturer:r.lecturer||'',course:r.course,format:FORMATS.includes(r.format)?r.format:'Single Choice',question:r.question,optA:r.optA||'',optB:r.optB||'',optC:r.optC||'',optD:r.optD||'',optE:r.optE||'',answer:r.answer});
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
  const upd=k=>v=>setEditing(e=>({...e,[k]:v}));

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
          <select style={{...inp,width:150}} value={filterFmt} onChange={e=>{setFilterFmt(e.target.value);setPage(0);}}>
            <option value="">Alle Formate</option>{FORMATS.map(f=><option key={f}>{f}</option>)}
          </select>
          <select style={{...inp,width:160}} value={pageSize} onChange={e=>setPageSize(e.target.value==='all'?'all':Number(e.target.value))}>
            <option value={15}>15 pro Seite</option>
            <option value={30}>30 pro Seite</option>
            <option value={50}>50 pro Seite</option>
            <option value="all">Alle Fragen</option>
          </select>
          {(search||filterCourse||filterFmt||filterLecturer)&&<Btn ch="✕ Reset" onClick={()=>{setSearch('');setFilterCourse('');setFilterFmt('');setFilterLecturer('');setPage(0);}} v="ghost" sm/>}
          <span style={{fontSize:'12px',color:'var(--c-mu)',alignSelf:'center',marginLeft:'auto'}}>{filtered.length} Treffer</span>
        </div>
      )}
      {!editMode&&<div style={{background:'var(--c-st)',border:'1px solid var(--c-bo)',borderRadius:6,padding:'7px 12px',marginBottom:12,fontSize:'12px',color:'var(--c-mu)',display:'flex',alignItems:'center',gap:6}}>🔒 Lesemodus — klicke <strong>✏️ Bearbeiten</strong> um Fragen zu bearbeiten oder zu löschen.</div>}
      <div style={{background:'var(--c-wh)',border:'1px solid var(--c-bo)',borderRadius:8,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#111111'}}>
              {['#','Kurs','Dozent/in','Format','Frage','Antwort',...(editMode?['']:[''])].map(h=>(
                <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:'11px',fontWeight:500,color:'#f3dcc9',letterSpacing:'0.5px',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length===0&&<tr><td colSpan={7} style={{padding:32,textAlign:'center',color:'var(--c-mu)',fontSize:'14px'}}>{questions.length===0?<span>Noch keine Fragen — klicke <strong>✏️ Bearbeiten</strong> dann <strong>+ Neue Frage</strong>.</span>:'Keine Treffer. Filter anpassen oder zurücksetzen.'}</td></tr>}
            {paged.map((q,i)=>(
              <React.Fragment key={q.id}>
                {i>0&&q.course!==paged[i-1].course&&(
                  <tr><td colSpan={7} style={{padding:0,height:2,background:'rgba(0,0,0,0.07)'}}></td></tr>
                )}
              <tr style={{borderBottom:'1px solid var(--c-bo)',background:i%2===0?'var(--c-wh)':'var(--c-wW)'}}>
                <td style={{padding:'8px 12px',fontSize:'12px',color:'var(--c-mu)',width:36}}>{q.id}</td>
                <td style={{padding:'8px 12px',fontSize:'12px',maxWidth:160}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--c-tD)',fontWeight:500}}>{q.course}</div><div style={{fontSize:'11px',color:'var(--c-mu)'}}>{q.year||'–'}</div></td>
                <td style={{padding:'8px 12px',fontSize:'12px',color:'var(--c-tx)',maxWidth:140}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.lecturer||'–'}</div></td>
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
            ))}
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
function CourseAutocomplete({value,onChange,courses,locked,placeholder,questions}){
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
  const filtered=useMemo(()=>{
    const q=input.trim().toLowerCase();
    return courses.filter(c=>!q||c.toLowerCase().includes(q));
  },[courses,input]);
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

const NR_W=44;const WBG_W=260;const YR_W=72;const LE_W=150;const CO_W=200;
const stickyCell={position:'sticky',zIndex:3};
const stickyNr={...stickyCell,left:0};
const stickyWbg={...stickyCell,left:NR_W};

function SemesterMatrix({programs,questions,mode='manage',onProgramsChange,selectedProgramId,selectedModuleKeys,onSelectProgram,onToggleModule,onDeleteProgram,locked=false,scale=100,compact=false}){
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
  // Reusable editable / locked cell input
  const GridInput=({value,onChange,placeholder,list})=>locked?(
    <div style={{padding:'4px 2px',fontSize:'12px',color:value?'var(--c-tx)':'var(--c-mu)',minHeight:24,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>{value||<span style={{opacity:.45}}>{placeholder}</span>}</div>
  ):(
    <input list={list} style={{...gridInput,border:'1px solid var(--c-bo)',borderRadius:3,width:'100%',boxSizing:'border-box',minWidth:0}} value={value} onChange={onChange} placeholder={placeholder}/>
  );

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
                              {!locked&&<Btn ch="✕ Löschen" onClick={()=>onDeleteProgram?.(p.id)} v="danger" sm/>}
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
                            <GridInput value={module.year} onChange={e=>updateModule(p.id,s.sem,moduleIndex,'year',e.target.value)} placeholder={compact?'J':'Jahr'}/>
                          </td>
                          <td style={{...gridCell,background:bg,width:widths.lec,minWidth:widths.lec,padding:compact?'4px':'6px'}}>
                            <GridInput value={module.lecturer} onChange={e=>updateModule(p.id,s.sem,moduleIndex,'lecturer',e.target.value)} placeholder={compact?'Doz':'Dozent/in'}/>
                          </td>
                          <td style={{...gridCell,background:bg,width:widths.course,minWidth:widths.course,padding:compact?'4px':'6px'}}>
                            {locked?(compact&&module.course
                                ?<div title={module.course} style={{padding:'4px 2px',fontSize:'11px',color:'var(--c-tx)',minHeight:24,wordBreak:'break-word',lineHeight:1.2,fontWeight:600}}>{abbreviateCourseName(module.course)}</div>
                                :<GridInput value={module.course} onChange={()=>{}} placeholder="Kursname eingeben…"/>)
                              :<CourseAutocomplete value={module.course} onChange={v=>updateModule(p.id,s.sem,moduleIndex,'course',v)} courses={courses} locked={false} placeholder="Kursname eingeben…" questions={questions}/>}
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
              <tr><td colSpan={2+SEMESTER_COUNT*3} style={{padding:40,textAlign:'center',fontSize:13,color:'var(--c-mu)'}}>{mode==='manage'?<span>Noch keine Weiterbildungsgänge — klicke <strong>+ Neuer WBG</strong> um einen zu erstellen.</span>:'Kein Weiterbildungsgang ausgewählt.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Programs ─────────────────────────────────────────────────────────────────
const SCALE_STEPS=[100,85,70,55];
function Programs({programs,setPrograms,questions,showToast,showConfirm,settings}){
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
    setPrograms(prev=>[...prev,createProgram(Date.now(),newName.trim(),newStartYear,newStartTerm)]);
    showToast(`Weiterbildungsgang „${newName.trim()}" erstellt.`,'success');
    setNewName('');setNewStartYear(currentAcademicTag().year);setNewStartTerm(currentAcademicTag().term);setAdding(false);
  };
  const delProgram=id=>{
    const prog=programs.find(p=>p.id===id);
    showConfirm(`Weiterbildungsgang „${prog?.name||'diesen Eintrag'}" wirklich löschen? Alle Semesterdaten gehen verloren.`,()=>{
      setPrograms(prev=>prev.filter(p=>p.id!==id));
      showToast('Weiterbildungsgang gelöscht.','success');
    });
  };
  const filteredPrograms=programs.filter(p=>!search.trim()||p.name.toLowerCase().includes(search.toLowerCase()));

  return(
    <div style={{padding:28}}>
      <SectionHeader title="Weiterbildungsgänge" sub={`${programs.length} Programme konfiguriert`} action={
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:4,background:'var(--c-st)',borderRadius:6,padding:3}}>
            {[
              {key:'normal',label:'Standard'},
              {key:'compact',label:'Kompakt'},
            ].map(v=>(
              <button key={v.key} onClick={()=>setCompact(v.key==='compact')} style={{padding:'4px 9px',borderRadius:4,border:'none',cursor:'pointer',fontSize:'12px',fontFamily:sans,background:(compact? 'compact':'normal')===v.key?'var(--c-wh)':'transparent',color:(compact? 'compact':'normal')===v.key?'var(--c-tD)':'var(--c-mu)',fontWeight:(compact? 'compact':'normal')===v.key?600:400}}>{v.label}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:4,background:'var(--c-st)',borderRadius:6,padding:3}}>
            {SCALE_STEPS.map(s=>(
              <button key={s} onClick={()=>setScale(s)} style={{padding:'4px 9px',borderRadius:4,border:'none',cursor:'pointer',fontSize:'12px',fontFamily:sans,background:scale===s?'var(--c-wh)':'transparent',color:scale===s?'var(--c-tD)':'var(--c-mu)',fontWeight:scale===s?600:400}}>{s}%</button>
            ))}
          </div>
          <Btn ch={locked?'🔓 Bearbeiten':'🔒 Sperren'} onClick={()=>setLocked(l=>!l)} v={locked?'secondary':'ghost'} sm/>
          {!locked&&<Btn ch="+ Neuer WBG" onClick={()=>setAdding(true)} v="primary"/>}
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
      <SemesterMatrix programs={filteredPrograms} questions={questions} mode="manage" onProgramsChange={setPrograms} onDeleteProgram={delProgram} locked={locked} scale={scale} compact={compact}/>
    </div>
  );
}

// ─── Exam Builder ─────────────────────────────────────────────────────────────
function ExamBuilder({programs,questions,onBuild}){
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
          {selectedProgram&&selectedModules.length>0&&totalQ!==40&&<span style={{background:'#FEF3E2',color:'#7A4F10',borderRadius:6,padding:'5px 10px',fontSize:'12px'}}>Standard: 40 Fragen</span>}
          {built&&<span style={{background:C.gP,color:C.gr,borderRadius:6,padding:'5px 10px',fontSize:'12px'}}>✓ Prüfung erstellt</span>}
          {selectedProgram&&selectedModules.length===0&&<span style={{background:C.rP,color:C.re,borderRadius:6,padding:'5px 10px',fontSize:'12px'}}>Keine Module ausgewählt</span>}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginLeft:'auto'}}>
          {selectedProgram&&<Btn ch="✕ Zurücksetzen" onClick={reset} v="ghost" sm/>}
          <Btn ch="Prüfung erstellen →" onClick={build} v="primary" dis={!selectedProgram||selectedModules.length===0}/>
          {built&&<Btn ch="Zum Export ↓" onClick={()=>document.querySelector('[data-nav=export]')?.click()} v="accent"/>}
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
function ExportView({exam,programName,setView,showToast,onSaveAndNew,onUpdateExam,onClear}){
  const[copied,setCopied]=useState(false);
  const[editMode,setEditMode]=useState(false);

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
  const saveAndStartNew=()=>{
    const suggested=`${programName||'Prüfung'} · ${new Date().toLocaleDateString('de-CH')}`;
    const chosen=window.prompt('Name für die gespeicherte Prüfung',suggested);
    if(chosen===null) return;
    onSaveAndNew?.(chosen.trim()||suggested);
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
    onUpdateExam?.(prev=>prev.filter((_,i)=>i!==index));
  };

  return(
    <div style={{padding:28}}>
      <SectionHeader title="Export & Download" sub={`${exam.length} Fragen · ${programName||'Prüfung'}`} action={
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Btn ch={editMode?'✓ Bearbeiten aktiv':'Bearbeiten'} onClick={()=>setEditMode(v=>!v)} v={editMode?'secondary':'ghost'}/>
          <Btn ch="💾 Speichern & neu" onClick={saveAndStartNew} v="primary"/>
          <Btn ch={copied?'✓ Kopiert!':'Kopieren'} onClick={copy} v={copied?'success':'ghost'}/>
          <Btn ch="↓ TXT" onClick={()=>dlFile(txt,`AIM_Pruefung_${(programName||'Export').replace(/\s+/g,'_')}.txt`)} v="secondary"/>
          <Btn ch="↓ PDF drucken" onClick={()=>printAsPdf(exam,`AIM Prüfung – ${programName||'Export'}`)} v="accent"/>
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
        <div style={{padding:'10px 16px',background:C.tD,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{color:C.tL,fontSize:'11px',letterSpacing:'1px',textTransform:'uppercase',fontWeight:500}}>Vorschau — Testportal-Format</span>
          <span style={{color:C.tL,fontSize:'11px'}}>{editMode?'Bearbeiten: Reihenfolge ändern oder Fragen entfernen':'Fettdruck = korrekte Antwort'}</span>
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
      <div style={{background:'#FEF3E2',border:'1px solid #F6C90E44',borderRadius:8,padding:14,fontSize:'13px',color:'#7A4F10'}}>
        <strong>Hinweis zum Import:</strong> Das DOCX-Format enthält native Word-Fettschrift für korrekte Antworten — genau wie das Testportal-Import-Template. Nach dem Download die Datei direkt im Testportal hochladen.
      </div>
    </div>
  );
}

// ─── Settings Page ───────────────────────────────────────────────────────────
function SettingsPage({settings,setSettings,darkMode,onToggleDark}){
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


// ─── Help Page — Data & Renderer ─────────────────────────────────────────────
const HELP_KEY='aim_help_v2';
const APP_INIT_KEY='aim_app_initialized_v1';
let helpBlockSeed=1;
const nextHelpBlockId=()=>`hb_${helpBlockSeed++}`;
const mk=(t,o)=>({id:o?.id||nextHelpBlockId(),t,...o});
const BUILTIN_MANUAL_KEYS=['testportal','aimmanager'];
const HELP_DEFAULTS={
  testportal:{
    navLabel:'Testportal Handbuch',
    sections:[
      {k:'overview',label:'1. Zweck & Ablauf'},{k:'prepare',label:'2. Vorbereitung'},
      {k:'questions',label:'3. Fragen & Formate'},{k:'settings_tp',label:'4. Test-Einstellungen'},
      {k:'classes',label:'5. Durchführung'},{k:'results',label:'6. Resultate & Papier'},
      {k:'app',label:'7. AIM Manager'},{k:'faq',label:'8. FAQ'},
    ],
    content:{
      overview:{title:'Zweck & Gesamtprozess',sub:'Für Personen, die Prüfungen anlegen und für mehrere Klassen durchführen',blocks:[
        mk('info',{icon:'🎯',title:'Wofür diese Seite da ist',body:'Diese Anleitung fasst das Testportal-Tutorial in einer klaren Arbeitslogik für AIM zusammen. Sie ist nicht als technisches Handbuch gedacht, sondern als operative Seite für alle, die Prüfungen vorbereiten, freigeben, überwachen und danach die Resultate sichern müssen.',color:'default'}),
        mk('cards',{items:[{h:'Vor dem Test',b:'Prüfung im AIM Manager zusammenstellen, Weiterbildungsgang prüfen, Export vorbereiten.'},{h:'Im Testportal',b:'Test anlegen, Fragen aufbauen oder importieren, Sicherheit und Zeiten korrekt setzen.'},{h:'Nach dem Test',b:'Resultate sichern, PDFs herunterladen, Papier-Version bei Bedarf erzeugen, Test bereinigen.'}]}),
        mk('info',{icon:'⚡',title:'Empfohlener 6-Schritte-Ablauf',body:'1. Im AIM Manager den richtigen Weiterbildungsgang wählen.\n2. Die korrekten Module und Fragen für diese Prüfung zusammenstellen.\n3. Im Testportal einen neuen Test mit sauberer Benennung anlegen.\n4. Fragen prüfen und die Portal-Einstellungen konservativ setzen.\n5. Link erst nach letzter Kontrolle an die richtige Klasse verschicken.\n6. Nach Abschluss Resultate sofort sichern und den Test nicht unnötig offen lassen.',color:'green'}),
      ]},
      prepare:{title:'Vorbereitung',sub:'Vom Login bis zum sauberen Testgerüst',blocks:[
        mk('step',{n:1,title:'Konto und Zugang',body:'Das Tutorial beschreibt den Einstieg über www.testportal.net. Neue Nutzer gehen über Sign Up und wählen Education; bestehende Nutzer über Sign In. Nach einer Neuregistrierung muss die Aktivierungs-E-Mail bestätigt werden.',img:'prepare-1'}),
        mk('step',{n:2,title:'Neuen Test anlegen',body:'Nach dem Login auf New Test klicken. In den General Settings werden Testname, optional Kategorie und Beschreibung erfasst. Für viele Klassen lohnt sich ein festes Schema, damit Tests später bei Resultaten und Rückfragen sofort zuordenbar sind.',img:'prepare-2'}),
        mk('code',{body:'AIM · WBS 56 · Semester 3 · HS 2026 · Klasse A'}),
        mk('step',{n:3,title:'Vor dem Befüllen kurz prüfen',body:'Noch bevor Fragen eingetragen werden, muss klar sein: Welcher Weiterbildungsgang? Welche Module? Welcher Termin? Welche Klasse? Diese Vorarbeit passiert bei AIM idealerweise im eigenen Manager und nicht erst im Testportal.',img:'prepare-3'}),
      ]},
      questions:{title:'Fragen & Formate',sub:'Die Fragetypen aus dem Tutorial und ihre praktische Bedeutung',blocks:[
        mk('cards',{items:[{h:'Single Choice',b:'Eine richtige Antwort. Für Standardprüfungen meist der schnellste und stabilste Fragetyp.'},{h:'Multiple Choice',b:'Mehrere richtige Antworten. Scoring und Markierungen besonders sorgfältig kontrollieren.'},{h:'Descriptive',b:'Offene Antwort. Muss manuell korrigiert werden; nur einsetzen, wenn der Zusatzaufwand bewusst eingeplant ist.'},{h:'True / False',b:'Einfach, schnell auswertbar und gut für Wissensabfragen.'},{h:'Short Answer',b:'Kurze Eingabe. Im Tutorial wird betont, dass eine klare Bemerkung zur Schreibweise nötig ist.'}]}),
        mk('step',{n:1,title:'Question Manager nutzen',body:'Fragen werden im Question Manager hinzugefügt. Laut Tutorial lassen sich Fragen dort auch später wieder bearbeiten, löschen und in der Reihenfolge verschieben.',img:'questions-1'}),
        mk('step',{n:2,title:'Punkte und korrekte Antworten eindeutig setzen',body:'Bei automatisch auswertbaren Formaten müssen die korrekten Antworten klar markiert und die Punkte pro Frage sauber gesetzt sein. Bei Multiple Choice sollte zusätzlich geprüft werden, ob Punktabzüge für falsche Antworten sinnvoll gesetzt sind.',img:'questions-2'}),
        mk('step',{n:3,title:'Medien und Spezialelemente gezielt einsetzen',body:'Das Tutorial zeigt, dass Bilder, Videos, Links, Formeln und Symbole eingefügt werden können. Für grosse Prüfungen mit vielen Klassen empfiehlt sich jedoch Zurückhaltung.',img:'questions-3'}),
        mk('info',{icon:'💡',title:'Praxisregel',body:'Wenn viele Klassen geprüft werden, möglichst auf gut automatisch korrigierbare Formate setzen. Offene Formate nur dort einsetzen, wo der fachliche Mehrwert den zusätzlichen Korrekturaufwand klar rechtfertigt.',color:'warn'}),
      ]},
      settings_tp:{title:'Wichtige Test-Einstellungen',sub:'Die Stellen, an denen laut Tutorial besonders sorgfältig gearbeitet werden sollte',blocks:[
        mk('step',{n:1,title:'Test Sets aktiv nutzen',body:'Das Tutorial empfiehlt, mehrere Test Sets zu erzeugen, damit Varianten nicht identisch sind. Select All soll aktiv bleiben, damit alle erstellten Sets auch wirklich genutzt werden.',img:'settings-1'}),
        mk('step',{n:2,title:'Access to Test defensiv einstellen',body:'Im Tutorial werden diese Einstellungen ausdrücklich empfohlen:\n- Anti-Cheat- bzw. Browser-Skipping-Warnungen aktiv lassen.\n- Number of access times = 2, damit Lernende bei technischem Unterbruch nochmals einsteigen können.\n- Attempts = 1.',img:'settings-2'}),
        mk('step',{n:3,title:'Grading and Summary',body:'Laut Tutorial sollte mit Punkten und möglichst geraden Zahlen gearbeitet werden, da keine Dezimalbewertung vorgesehen ist. Korrekte Antworten sollen während eines laufenden Tests nicht sichtbar sein.',img:'settings-3'}),
        mk('step',{n:4,title:'Timer Settings',body:'Die Dauer wird für den gesamten Test gesetzt. Danach werden Aktivierungszeit und Endzeit terminiert. Das Tutorial empfiehlt ausserdem, die Rücksprung-Option ausgeschaltet zu lassen, wenn ein No-Backtrack-Ablauf gewünscht ist.',img:'settings-4'}),
        mk('note',{body:'Letzte Kontrolle vor dem Versand: Testname prüfen. Klasse prüfen. Aktivierungszeit prüfen. Endzeit prüfen. Anzahl Zugriffe prüfen. Versuchszahl prüfen. Anzeige korrekter Antworten prüfen.'}),
      ]},
      classes:{title:'Durchführung für viele Klassen',sub:'Wie der Prozess auch bei mehreren Gruppen sauber bleibt',blocks:[
        mk('step',{n:1,title:'Saubere Trennung pro Klasse oder Kohorte',body:'Jede Durchführung muss klar benannt und eindeutig zuordenbar sein. Ob mit getrennten Tests oder einem sehr präzisen Benennungsschema gearbeitet wird: Wichtig ist, dass bei Links, PDFs und Resultaten nie unklar ist, welche Klasse betroffen ist.',img:'classes-1'}),
        mk('step',{n:2,title:'Link erst nach der Schlusskontrolle verschicken',body:'Im Tutorial wird das Teilen über Microsoft Teams gezeigt: Link kopieren, in Teams in die richtige Unterhaltung einfügen und senden. Der Link öffnet sich erst ab der Aktivierungszeit.',img:'classes-2'}),
        mk('step',{n:3,title:'Während der Prüfung mit Warnungen rechnen',body:'Testportal erkennt laut Tutorial Browser-Wechsel oder das Öffnen weiterer Fenster. Lernende werden gewarnt und können bei zu vielen Warnungen blockiert werden.',img:'classes-3'}),
        mk('step',{n:4,title:'Kapazitätsgrenze mitdenken',body:'Im Tutorial steht der wichtige Hinweis, dass in der beschriebenen Paketstufe nur 100 Studierende gleichzeitig geprüft werden konnten. Für grössere Durchführungen heisst das: Klassen staffeln, Resultate direkt sichern.',img:'classes-4'}),
        mk('info',{icon:'✅',title:'Empfohlene Arbeitsregel',body:'Immer in derselben Reihenfolge arbeiten: Prüfung vorbereiten, Zeiten kontrollieren, Link verschicken, Durchführung begleiten, Resultate herunterladen, Test bereinigen.',color:'green'}),
      ]},
      results:{title:'Resultate & Papier-Version',sub:'Was nach dem Test heruntergeladen und dokumentiert werden sollte',blocks:[
        mk('step',{n:1,title:'Resultate herunterladen',body:'Nach Prüfungsende im Testportal die Resultate des abgeschlossenen Tests öffnen. Laut Tutorial können alle Lernenden markiert und die Resultate gesammelt heruntergeladen werden.',img:'results-1'}),
        mk('step',{n:2,title:'Resultatstabelle bewusst zusammenstellen',body:'Das Tutorial zeigt, dass beim Download gewählt werden kann, welche Angaben in der Tabelle erscheinen. Für den Alltag mit vielen Klassen hilft eine reduzierte, klare Auswahl der wirklich nötigen Spalten.',img:'results-2'}),
        mk('step',{n:3,title:'Papier-Version bei Hybrid-Situationen',body:'Über Print version kann eine Papierfassung erstellt werden. Laut Tutorial sollen dabei alle Dokumente und alle Sets markiert werden. Danach stehen Fragebogen, Antwortbogen und Lösungsschlüssel als PDF zur Verfügung.',img:'results-3'}),
        mk('step',{n:4,title:'Nachbereitung',body:'Resultate zuerst vollständig sichern und nur dann aufräumen. Im Tutorial wird ausdrücklich empfohlen, Tests nach erfassten Resultaten wieder zu löschen, damit die Übersicht erhalten bleibt.',img:'results-4'}),
      ]},
      app:{title:'AIM Manager im Gesamtprozess',sub:'Was bei uns vorbereitet wird, bevor Testportal beginnt',blocks:[
        mk('step',{n:1,title:'Weiterbildungsgang auswählen',body:'In Prüfung erstellen zuerst den richtigen Weiterbildungsgang in der Semesteransicht markieren. Die Zeile wird hervorgehoben und alle Module dieser Kohorte sind zuerst ausgewählt.',img:'app-1'}),
        mk('step',{n:2,title:'Module prüfen',body:'Danach direkt in der Semesteransicht entscheiden, welche Module in diese Prüfung gehören. So entsteht der Fragenpool exakt für die ausgewählte Kohorte.',img:'app-2'}),
        mk('step',{n:3,title:'Export als Grundlage nutzen',body:'Nach der Kontrolle wird die Prüfung exportiert. Diese exportierte Fassung ist die Grundlage für die weitere Arbeit im Testportal.',img:'app-3'}),
        mk('info',{icon:'🧭',title:'Rollenverteilung',body:'AIM beantwortet die Frage: Welche Inhalte gehören in die Prüfung?\nTestportal beantwortet die Frage: Wie wird die Prüfung durchgeführt, terminiert und ausgewertet?',color:'default'}),
      ]},
      faq:{title:'FAQ',sub:'Kurze Antworten auf die häufigsten Praxisfragen',blocks:[
        mk('info',{icon:'❓',title:'Soll ich zuerst im AIM Manager oder zuerst im Testportal arbeiten?',body:'Zuerst im AIM Manager. Dort wird die Prüfung inhaltlich korrekt pro Weiterbildungsgang zusammengestellt. Danach folgt die Durchführung im Testportal.',color:'default'}),
        mk('info',{icon:'❓',title:'Welche Einstellungen sind am fehleranfälligsten?',body:'Aktivierungszeit, Endzeit, Anzahl Zugriffe, Versuchszahl und die Sichtbarkeit korrekter Antworten.',color:'default'}),
        mk('info',{icon:'❓',title:'Wie gehe ich mit mehreren Klassen am selben Tag um?',body:'Mit klarer Benennung, sauber getrennten Links und einer festen Routine: prüfen, terminieren, verteilen, durchführen, Resultate sichern.',color:'default'}),
        mk('info',{icon:'❓',title:'Wann sollte ich offene Fragetypen vermeiden?',body:'Sobald viele Klassen oder enge Korrekturfristen im Spiel sind. Offene Fragen erhöhen den manuellen Aufwand deutlich.',color:'default'}),
        mk('info',{icon:'❓',title:'Wofür sind Test Sets besonders wichtig?',body:'Sie reduzieren identische Prüfungsvarianten und erschweren das Weitergeben von Antworten.',color:'default'}),
        mk('info',{icon:'❓',title:'Was ist nach dem Test der erste Schritt?',body:'Resultate und PDFs sichern. Erst danach aufräumen oder löschen.',color:'default'}),
      ]},
    },
  },
  aimmanager:{
    navLabel:'AIM Prüfungs-Manager Handbuch',
    sections:[
      {k:'overview',label:'1. Übersicht'},{k:'dashboard',label:'2. Dashboard'},
      {k:'db',label:'3. Fragen Datenbank'},{k:'programs',label:'4. Weiterbildungsgänge'},
      {k:'exam',label:'5. Prüfung erstellen'},{k:'export',label:'6. Export & Download'},
      {k:'backup',label:'7. Backup & Daten'},{k:'settings_aim',label:'8. Einstellungen'},
    ],
    content:{
      overview:{title:'Übersicht & Konzept',sub:'Der AIM Prüfungs-Manager im Überblick',blocks:[
        mk('info',{icon:'🎯',title:'Was ist der AIM Prüfungs-Manager?',body:'Der AIM Prüfungs-Manager ist ein browserbasiertes Werkzeug für die strukturierte Erstellung von Online-Prüfungen. Anstatt Fragen manuell aus Excel-Tabellen zusammenzusuchen, verwaltet der Manager alle Fragen, Kurse und Weiterbildungsgänge zentral — und stellt für jede Kohorte automatisch die richtigen Fragen zusammen.',color:'default'}),
        mk('cards',{items:[{h:'Fragen Datenbank',b:'Alle Prüfungsfragen zentral verwalten, suchen, filtern, importieren und exportieren.'},{h:'Weiterbildungsgänge',b:'Für jede Kohorte Semester und Module mit Kursen und Dozierenden verknüpfen.'},{h:'Prüfung erstellen',b:'Weiterbildungsgang auswählen, Module wählen, Fragenpool automatisch zusammenstellen.'},{h:'Export & Download',b:'Prüfung als PDF oder TXT herunterladen — im richtigen Format für das Testportal.'}]}),
        mk('info',{icon:'⚡',title:'Empfohlener Ablauf',body:'1. Fragen in der Datenbank pflegen oder importieren.\n2. Weiterbildungsgänge mit Semestern und Modulen konfigurieren.\n3. Prüfung erstellen: Kohorte auswählen, Module prüfen.\n4. Export herunterladen und ins Testportal laden.',color:'green'}),
        mk('info',{icon:'💾',title:'Datenspeicherung',body:'Alle Daten werden lokal im Browser (LocalStorage) gespeichert. Es gibt keine externe Datenbank. Erstelle regelmässig Backups über Dashboard → Backup erstellen, besonders vor dem Löschen des Browser-Caches.',color:'warn'}),
      ]},
      dashboard:{title:'Dashboard',sub:'Die Startseite des AIM Prüfungs-Managers',blocks:[
        mk('info',{icon:'📊',title:'Statistik-Karten',body:'Das Dashboard zeigt auf einen Blick: Anzahl Fragen in der Datenbank, Anzahl Kurse, Anzahl Weiterbildungsgänge und Anzahl Prüfungsfragen im aktuellen Export. Grüne Einfärbung signalisiert, dass eine Prüfung bereit ist.',color:'default'}),
        mk('step',{n:1,title:'Schnellzugriff nutzen',body:'Über die Schnellzugriff-Karten rechts gelangst du direkt zu den wichtigsten Funktionen: Neue Prüfung erstellen, Fragen verwalten oder den letzten Export herunterladen (falls vorhanden).',img:'aim-dashboard-1'}),
        mk('step',{n:2,title:'Datensicherung',body:'Im Bereich Datensicherung kannst du:\n- 💾 Jetzt sichern: Speichert Daten explizit im Browser.\n- ↑ JSON laden: Stellt ein JSON-Backup wieder her.\n- ↓ JSON exportieren: Lädt das vollständige JSON-Backup herunter.\n- ↓ Excel exportieren: Lädt die bearbeitbare Excel-Datei mit Fragen, Weiterbildungsgängen und Semesteransicht herunter.\n- ↑ Excel importieren: Lädt diese Excel-Datei wieder in die App.',img:'aim-dashboard-2'}),
        mk('step',{n:3,title:'Alle Daten löschen',body:'Mit ✕ Alle Daten löschen werden Fragen, Weiterbildungsgänge und die aktuell erstellte Prüfung vollständig aus der App entfernt. Diese Funktion ist dafür gedacht, danach direkt eine neue Datenversion per JSON oder Excel zu importieren.',img:'aim-dashboard-3'}),
        mk('info',{icon:'⚠️',title:'Wichtig',body:'Daten werden automatisch gespeichert, wenn du Änderungen machst. «💾 Jetzt sichern» ist eine manuelle Bestätigung. Backups sind Dateien auf deinem Computer — bewahre sie sicher auf. Beim ersten Start ist Export & Download absichtlich leer, bis eine Prüfung erstellt wurde.',color:'warn'}),
      ]},
      db:{title:'Fragen Datenbank',sub:'Alle Prüfungsfragen verwalten',blocks:[
        mk('info',{icon:'📋',title:'Übersicht',body:'Die Fragen Datenbank enthält alle verfügbaren Prüfungsfragen. Jede Frage gehört zu einem Kurs und hat ein Format (Single Choice, Multiple Choice, Richtig/Falsch, Ja/Nein), Antwortoptionen und eine Markierung der richtigen Antwort.',color:'default'}),
        mk('step',{n:1,title:'Lesemodus und Bearbeitungsmodus',body:'Standardmässig ist die Datenbank im Lesemodus (🔒). Klicke auf ✏️ Bearbeiten um den Bearbeitungsmodus zu aktivieren. Im Lesemodus sind keine Änderungen möglich — das schützt vor versehentlichen Löschungen.',img:'aim-db-1'}),
        mk('step',{n:2,title:'Frage hinzufügen',body:'Im Bearbeitungsmodus auf + Neue Frage klicken. Pflichtfelder sind: Kursname, Frage und mindestens eine korrekte Antwort. Optionale Felder: Dozent/in, Jahr, Standort, weitere Antwortoptionen.',img:'aim-db-2'}),
        mk('step',{n:3,title:'Fragen suchen und filtern',body:'Nutze die Suchleiste (Frage, Kurs, Dozent) oder die Dropdowns (Kurs, Dozent/in, Format) um Fragen zu finden. Zusätzlich kannst du wählen, ob 15, 30, 50 oder alle Fragen gleichzeitig angezeigt werden. Mit ✕ Reset werden alle Filter zurückgesetzt.',img:'aim-db-3'}),
        mk('step',{n:4,title:'Import aus JSON oder CSV',body:'Klicke auf ↑ Import um die Import-Vorlage zu sehen und eine Datei hochzuladen. Pflichtfelder in der Importdatei: course, question, answer. Die App prüft die Daten und zeigt eine Zusammenfassung.',img:'aim-db-4'}),
        mk('step',{n:5,title:'Export',body:'Im Bearbeitungsmodus: ↓ Export lädt die aktuell gefilterten Fragen als JSON-Datei herunter. Ideal für Backups einzelner Kurse oder zum Teilen mit Kollegen.',img:'aim-db-5'}),
        mk('note',{body:'Tipp: Die farbigen Trennlinien in der Tabelle zeigen Kursgrenzen — so erkennst du auf einen Blick, welche Fragen zum gleichen Kurs gehören.'}),
      ]},
      programs:{title:'Weiterbildungsgänge',sub:'Kohorten mit Semestern und Modulen verwalten',blocks:[
        mk('info',{icon:'🗂️',title:'Konzept',body:'Ein Weiterbildungsgang (WBG) ist eine Kohorte mit 6 Semestern und je 4 Modulen. Jedes Modul verknüpft einen Kurs (aus der Fragen Datenbank) mit einem Dozenten/einer Dozentin und einem Jahr. So weiss die App genau, welche Fragen zu welcher Kohorte gehören.',color:'default'}),
        mk('step',{n:1,title:'Weiterbildungsgang erstellen',body:'Klicke auf + Neuer WBG, gib den Namen (z.B. WBS 56 (2025)) und das Startjahr/-semester ein. Klicke auf Erstellen.',img:'aim-programs-1'}),
        mk('step',{n:2,title:'Module konfigurieren',body:'Die Matrix zeigt alle Weiterbildungsgänge mit je 6 Semestern. Klicke auf 🔓 Bearbeiten um die Matrix zu entsperren. Trage für jedes Modul Jahr, Dozent/in und Kursname ein. Beim Kursname wird automatisch eine Auswahl aller bekannten Kurse angezeigt — inklusive der zugeordneten Dozierenden.',img:'aim-programs-2'}),
        mk('step',{n:3,title:'Sperren und Zoomen',body:'🔒 Sperren schützt die Matrix vor versehentlichen Änderungen. Mit den Zoom-Stufen (100% bis 55%) lässt sich die Matrix verkleinern, um mehr auf einmal zu sehen.',img:'aim-programs-3'}),
        mk('note',{body:'Kursname und Dozent in der Matrix müssen exakt mit den Einträgen in der Fragen Datenbank übereinstimmen, damit die richtigen Fragen zugeordnet werden. Gross-/Kleinschreibung beachten.'}),
      ]},
      exam:{title:'Prüfung erstellen',sub:'Fragenpool für eine Kohorte zusammenstellen',blocks:[
        mk('step',{n:1,title:'Weiterbildungsgang auswählen',body:'Klicke in der Matrix auf den Namen des Weiterbildungsgangs. Die Zeile wird hervorgehoben und alle Module mit zugeordneten Kursen werden automatisch ausgewählt.',img:'aim-exam-1'}),
        mk('step',{n:2,title:'Module und Fragen prüfen',body:'In der Zusammenfassung oben siehst du sofort: Anzahl gewählter Module und Gesamtzahl der Fragen. Standard ist 40 Fragen — bei Abweichung erscheint ein Hinweis. Einzelne Module können per Checkbox an- oder abgewählt werden.',img:'aim-exam-2'}),
        mk('step',{n:3,title:'Prüfung erstellen',body:'Klicke auf Prüfung erstellen →. Die App wechselt automatisch in die Export-Ansicht. Standardmässig startet diese Ansicht im kleinen Zoom von 55%, damit auch grosse Semesteransichten schneller überblickt werden können.',img:'aim-exam-3'}),
        mk('step',{n:4,title:'Zurücksetzen',body:'Mit ✕ Zurücksetzen wird die Auswahl gelöscht und du kannst einen anderen Weiterbildungsgang wählen. Dies löscht keine Daten aus der Datenbank.',img:'aim-exam-4'}),
        mk('info',{icon:'💡',title:'Fragepool-Logik',body:'Fragen werden einem Modul zugeordnet, wenn Kursname übereinstimmt. Wenn Dozent/in im Modul eingetragen ist, werden nur Fragen dieses Dozenten/dieser Dozentin einbezogen. Bei Jahreszahl gilt dasselbe Prinzip.',color:'default'}),
      ]},
      export:{title:'Export & Download',sub:'Prüfung herunterladen und für das Testportal vorbereiten',blocks:[
        mk('info',{icon:'📭',title:'Beim ersten Start leer',body:'Beim ersten Öffnen der App ist Export & Download bewusst leer. Erst wenn im Bereich Prüfung erstellen eine Prüfung gebaut wurde, erscheinen Vorschau und Download-Funktionen.',color:'default'}),
        mk('info',{icon:'👁',title:'Vorschau',body:'Die Vorschau zeigt die Prüfung im Testportal-Format: Kursname kursiv-unterstrichen, Frage fett, Antworten mit a/b/c, korrekte Antworten grün markiert und mit ✓.',color:'default'}),
        mk('step',{n:1,title:'Kopieren',body:'Kopiert den Volltext der Prüfung in die Zwischenablage — im Format mit ** für Fettdruck. Nützlich für manuelle Anpassungen.',img:'aim-export-1'}),
        mk('step',{n:2,title:'TXT-Datei herunterladen',body:'↓ TXT lädt die Prüfung als Textdatei herunter. Eignet sich als Archiv oder zur Weiterbearbeitung.',img:'aim-export-2'}),
        mk('step',{n:3,title:'PDF drucken',body:'↓ PDF drucken öffnet ein neues Fenster mit der Prüfung im Drucklayout (Calibri, 10pt, 1cm Ränder). Nutze dann die Druckfunktion des Browsers oder speichere als PDF.',img:'aim-export-3'}),
        mk('info',{icon:'📥',title:'Testportal-Format',body:'Das Testportal erkennt beim Import Fettdruck als «korrekte Antwort». Die TXT-Datei enthält **fett** für korrekte Antworten — genau das Format, das Testportal beim Import verarbeitet.',color:'warn'}),
      ]},
      backup:{title:'Backup & Daten',sub:'Daten sichern, wiederherstellen und übertragen',blocks:[
        mk('info',{icon:'⚠️',title:'LocalStorage — was das bedeutet',body:'Alle Daten sind im Browser gespeichert. Das bedeutet: kein Zugriff von anderen Computern, Datenverlust beim Löschen des Browser-Caches, kein automatisches Cloud-Backup. Lokale Backup-Dateien sind der einzige Schutz.',color:'warn'}),
        mk('step',{n:1,title:'JSON-Backup erstellen',body:'Dashboard → ↓ JSON exportieren lädt eine Datei mit allen Fragen, Weiterbildungsgängen und einer zusätzlichen Semesterübersicht herunter. Speichere die Datei an einem sicheren Ort.',img:'aim-backup-1'}),
        mk('step',{n:2,title:'Excel-Datei als Arbeitsgrundlage',body:'Dashboard → ↓ Excel exportieren erstellt eine bearbeitbare Datei mit drei Blättern: Fragen, Weiterbildungsgänge und Semesteransicht. Diese Datei kann direkt in Excel gepflegt und später wieder in die App importiert werden.',img:'aim-backup-2'}),
        mk('step',{n:3,title:'Wiederherstellen oder austauschen',body:'Dashboard → ↑ JSON laden oder ↑ Excel importieren. Alle aktuellen Daten werden durch die importierten Daten ersetzt. Erstelle vorher ein aktuelles Backup, falls nötig.',img:'aim-backup-3'}),
        mk('note',{body:'Empfehlung: Backup nach jeder grösseren Änderung. Wenn du mit einer neuen Datenversion weiterarbeiten willst, zuerst ✕ Alle Daten löschen und danach die neue JSON- oder Excel-Datei importieren.'}),
      ]},
      settings_aim:{title:'Einstellungen',sub:'Standardverhalten des AIM Prüfungs-Managers anpassen',blocks:[
        mk('step',{n:1,title:'Weiterbildungsgänge gesperrt beim Start',body:'Wenn aktiv (Standard: AN), öffnet sich die Weiterbildungsgänge-Ansicht immer im gesperrten Modus. Das verhindert versehentliche Änderungen. Zum Bearbeiten auf 🔓 Bearbeiten klicken.',img:'aim-settings-1'}),
        mk('step',{n:2,title:'Standard-Zoomstufe',body:'Legt fest, in welcher Vergrösserung die Matrix-Ansicht standardmässig angezeigt wird. Standard ist jetzt 55%, damit die Semesteransicht in Prüfung erstellen sofort kompakter startet. 100% ist die volle Grösse, 55% der kleinste Massstab.',img:'aim-settings-2'}),
        mk('step',{n:3,title:'Dunkelmodus',body:'Wechselt zwischen hellem und dunklem Design. Die Einstellung wird gespeichert und beim nächsten Start wiederhergestellt. Auch über das Mond/Sonne-Symbol in der Seitenleiste umschaltbar.',img:'aim-settings-3'}),
        mk('info',{icon:'🔄',title:'Einstellungen zurücksetzen',body:'Setzt alle Einstellungen auf die Standardwerte zurück. Daten (Fragen, Programme) bleiben unberührt.',color:'default'}),
      ]},
    },
  },
};

function makeHelpBlock(type='step'){
  const imgId=`img_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  if(type==='step') return mk('step',{n:1,title:'Neuer Schritt',body:'Kurze Anleitung hier eintragen.',img:imgId});
  if(type==='info') return mk('info',{icon:'💡',title:'Neuer Hinweis',body:'Hinweistext hier eintragen.',color:'default'});
  if(type==='note') return mk('note',{body:'Notiz hier eintragen.'});
  if(type==='code') return mk('code',{body:'Beispiel oder Schema hier eintragen'});
  if(type==='cards') return mk('cards',{items:[{h:'Karte 1',b:'Text'},{h:'Karte 2',b:'Text'}]});
  return mk('step',{n:1,title:'Neuer Schritt',body:'Kurze Anleitung hier eintragen.',img:imgId});
}

function slugHandbookLabel(value=''){
  const base=String(value||'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
  return base||`handbuch-${Date.now()}`;
}

function makeHelpSection(key,label,title=''){
  return{
    k:key,
    label,
  };
}

function stripSectionNumber(label=''){
  return String(label||'').replace(/^\s*\d+\.\s*/,'').trim();
}

function formatSectionLabel(section,index,isCustom){
  if(!isCustom) return section?.label||`Abschnitt ${index+1}`;
  const base=stripSectionNumber(section?.label)||'Abschnitt';
  return `${index+1}. ${base}`;
}

function makeCustomManual(navLabel){
  const sectionKey='section_1';
  return{
    navLabel,
    isCustom:true,
    sections:[makeHelpSection(sectionKey,'1. Allgemein',navLabel)],
    content:{
      [sectionKey]:{
        title:navLabel,
        sub:'Eigene Anleitung',
        blocks:[makeHelpBlock('step')],
      }
    }
  };
}

function normalizeHelpContent(raw){
  const normalized={};
  const manualKeys=[
    ...BUILTIN_MANUAL_KEYS,
    ...Object.keys(raw||{}).filter(key=>!BUILTIN_MANUAL_KEYS.includes(key))
  ];
  manualKeys.forEach(manualKey=>{
    const defaultManual=HELP_DEFAULTS[manualKey];
    const sourceManual=raw?.[manualKey]||defaultManual;
    if(!sourceManual && !defaultManual) return;
    const sourceSections=Array.isArray(sourceManual?.sections)?sourceManual.sections:[];
    const sections=(defaultManual?.sections?.length?defaultManual.sections:sourceSections).map((section,idx)=>({
      ...section,
      k:section?.k||`section_${idx+1}`,
      label:section?.label||`${idx+1}. Abschnitt`,
    }));
    const sectionKeys=sections.map(section=>section.k);
    normalized[manualKey]={
      ...(defaultManual||{}),
      ...(sourceManual||{}),
      isCustom:sourceManual?.isCustom||(!defaultManual),
      sections,
      content:{...(defaultManual?.content||{}),...(sourceManual?.content||{})},
    };
    sectionKeys.forEach((sectionKey,idx)=>{
      const defaultSection=defaultManual?.content?.[sectionKey];
      const sourceSection=sourceManual?.content?.[sectionKey]||defaultSection||{
        title:sections[idx]?.label||`Abschnitt ${idx+1}`,
        sub:'',
        blocks:[],
      };
      let stepNo=1;
      const blocks=(sourceSection?.blocks||defaultSection?.blocks||[]).map(block=>{
        const normalizedBlock={...block,id:block?.id||nextHelpBlockId()};
        if(normalizedBlock.t==='step'){
          normalizedBlock.n=stepNo++;
          if(!normalizedBlock.img) normalizedBlock.img=`img_${normalizedBlock.id}`;
        }
        return normalizedBlock;
      });
      normalized[manualKey].content[sectionKey]={
        ...(defaultSection||{}),
        ...(sourceSection||{}),
        blocks,
      };
    });
  });
  return normalized;
}

function getManualGalleryEntries(content,manualKey){
  const manual=content?.[manualKey];
  if(!manual) return {};
  const entries={};
  (manual.sections||[]).forEach(section=>{
    const sectionContent=manual.content?.[section.k];
    (sectionContent?.blocks||[]).forEach(block=>{
      if(block.t==='step'&&block.img){
        const storageKey=`${manualKey}_${section.k}_${block.id}_${block.img}`;
        entries[storageKey]=getHelpGallery(storageKey,block.img);
      }
    });
  });
  return entries;
}

function saveManualGalleryEntries(entries={}){
  Object.entries(entries).forEach(([storageKey,items])=>{
    saveHelpGallery(storageKey,Array.isArray(items)?items:[]);
  });
}

function sanitizeZipPart(value=''){
  return String(value||'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'item';
}

function detectMimeFromDataUrl(dataUrl=''){
  const match=String(dataUrl).match(/^data:([^;]+);base64,/);
  return match?.[1]||'image/png';
}

function detectExtFromMime(mime='image/png'){
  if(mime==='image/jpeg') return 'jpg';
  if(mime==='image/svg+xml') return 'svg';
  if(mime==='image/gif') return 'gif';
  if(mime==='image/webp') return 'webp';
  return 'png';
}

async function exportManualZipBundle(manualKey,manualData,allContent){
  const zip=new JSZip();
  const galleries=getManualGalleryEntries(allContent,manualKey);
  const manifest={
    version:2,
    type:'aim-handbook-bundle',
    exportedAt:new Date().toISOString(),
    manualKey,
    manual:manualData,
    galleries:{},
  };

  for(const [storageKey,items] of Object.entries(galleries)){
    manifest.galleries[storageKey]=[];
    for(let index=0;index<(items||[]).length;index++){
      const item=items[index];
      const mime=detectMimeFromDataUrl(item?.src||'');
      const ext=detectExtFromMime(mime);
      const fileName=`images/${sanitizeZipPart(storageKey)}/${sanitizeZipPart(item?.id||String(index))}.${ext}`;
      if(item?.src){
        const blob=await fetch(item.src).then(r=>r.blob());
        zip.file(fileName,blob);
      }
      manifest.galleries[storageKey].push({
        id:item?.id||`img_${index}`,
        annotations:item?.annotations||[],
        file:fileName,
        mime,
      });
    }
  }

  zip.file('handbook.json',JSON.stringify(manifest,null,2));
  return zip.generateAsync({type:'blob'});
}

async function importManualBundle(file){
  const lower=String(file?.name||'').toLowerCase();
  if(lower.endsWith('.zip')){
    const zip=await JSZip.loadAsync(file);
    const manifestFile=zip.file('handbook.json');
    if(!manifestFile) throw new Error('missing manifest');
    const manifest=JSON.parse(await manifestFile.async('string'));
    const galleries={};
    for(const [storageKey,items] of Object.entries(manifest?.galleries||{})){
      galleries[storageKey]=[];
      for(const item of items){
        const imgFile=item?.file?zip.file(item.file):null;
        let src='';
        if(imgFile){
          const base64=await imgFile.async('base64');
          src=`data:${item?.mime||'image/png'};base64,${base64}`;
        }
        galleries[storageKey].push({
          id:item?.id||`img_${Date.now()}`,
          src,
          annotations:item?.annotations||[],
        });
      }
    }
    return{manualKey:manifest?.manualKey,manual:manifest?.manual,galleries};
  }

  const text=await file.text();
  const parsed=JSON.parse(text);
  return{
    manualKey:parsed?.manualKey,
    manual:parsed?.manual,
    galleries:parsed?.galleries||{},
  };
}

function RenderBlock({block,idx,editMode,onUpdate,onDelete,onMoveUp,onMoveDown,canMoveUp,canMoveDown,onAddAfter,imageScopeKey}){
  const upd=(field,val)=>onUpdate(idx,{...block,[field]:val});
  const inpStyle={width:'100%',fontFamily:sans,fontSize:'13px',color:'var(--c-tx)',background:'var(--c-wW)',border:'1px solid var(--c-ac)',borderRadius:4,padding:'5px 8px',boxSizing:'border-box'};
  const taStyle={...inpStyle,resize:'vertical',minHeight:64,lineHeight:1.65};
  let rendered=null;

  if(block.t==='step'){
    rendered=(
      <div style={{display:'flex',gap:16}}>
        <div style={{flexShrink:0,width:32,height:32,borderRadius:'50%',background:C.t,color:C.wh,fontFamily:sans,fontWeight:700,fontSize:'14px',display:'flex',alignItems:'center',justifyContent:'center'}}>{block.n}</div>
        <div style={{flex:1}}>
          {editMode?<input style={{...inpStyle,fontFamily:serif,fontSize:'15px',fontWeight:700,marginBottom:6}} value={block.title} onChange={e=>upd('title',e.target.value)}/>
            :<div style={{fontFamily:serif,fontSize:'15px',fontWeight:700,color:C.tD,marginBottom:6}}>{block.title}</div>}
          {editMode?<textarea style={{...taStyle,fontSize:'14px'}} value={block.body} onChange={e=>upd('body',e.target.value)}/>
            :<div style={{fontSize:'14px',color:C.tx,lineHeight:1.65,whiteSpace:'pre-line'}}>{block.body}</div>}
          {block.img&&<ImageSlot id={block.img} storageId={`${imageScopeKey}_${block.img}`} editMode={editMode}/>}
        </div>
      </div>
    );
  }
  if(block.t==='info'){
    const bg=block.color==='warn'?'#FEF3E2':block.color==='green'?C.gP:C.tP;
    const tx=block.color==='warn'?'#7A4F10':block.color==='green'?'#1a5c32':C.tD;
    const br=block.color==='warn'?'#F6C90E44':block.color==='green'?'#86efac':C.tL;
    rendered=(
      <div style={{background:bg,border:'1px solid '+br,borderRadius:8,padding:'14px 16px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          {editMode?<input style={{...inpStyle,width:44,textAlign:'center',fontSize:'18px',padding:'2px 4px'}} value={block.icon} onChange={e=>upd('icon',e.target.value)}/>
            :<span style={{fontSize:'18px'}}>{block.icon}</span>}
          {editMode?<input style={{...inpStyle,fontWeight:700,fontSize:'14px'}} value={block.title} onChange={e=>upd('title',e.target.value)}/>
            :<span style={{fontWeight:700,fontSize:'14px',color:tx}}>{block.title}</span>}
        </div>
        {editMode?<textarea style={{...taStyle}} value={block.body} onChange={e=>upd('body',e.target.value)}/>
          :<div style={{fontSize:'13px',color:tx,lineHeight:1.65,whiteSpace:'pre-line'}}>{block.body}</div>}
      </div>
    );
  }
  if(block.t==='cards'){
    const cols=Math.min(block.items.length,3);
    rendered=(
      <div style={{display:'grid',gridTemplateColumns:'repeat('+cols+',1fr)',gap:14,marginBottom:16}}>
        {block.items.map((item,ii)=>(
          <div key={ii} style={{background:C.wW,border:'1px solid '+C.bo,borderRadius:8,padding:14}}>
            {editMode?(
              <>
                <input style={{...inpStyle,fontWeight:700,fontSize:'14px',marginBottom:6}} value={item.h} onChange={e=>{const it=[...block.items];it[ii]={...item,h:e.target.value};upd('items',it);}}/>
                <textarea style={{...taStyle,fontSize:'13px',minHeight:50}} value={item.b} onChange={e=>{const it=[...block.items];it[ii]={...item,b:e.target.value};upd('items',it);}}/>
              </>
            ):(
              <>
                <div style={{fontWeight:700,fontSize:'14px',color:C.tD,marginBottom:6}}>{item.h}</div>
                <div style={{fontSize:'13px',color:C.tx,lineHeight:1.6}}>{item.b}</div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }
  if(block.t==='note'){
    rendered=(
      <div style={{background:C.tP,border:'1px solid '+C.tL,borderRadius:8,padding:'12px 16px',marginBottom:16}}>
        {editMode?<textarea style={{...taStyle}} value={block.body} onChange={e=>upd('body',e.target.value)}/>
          :<div style={{fontSize:'13px',color:C.tx,lineHeight:1.65,whiteSpace:'pre-line'}}>{block.body}</div>}
      </div>
    );
  }
  if(block.t==='code'){
    rendered=(
      <div style={{background:C.wh,border:'1px solid '+C.bo,borderRadius:8,padding:16,marginBottom:16}}>
        <div style={{fontSize:'11px',letterSpacing:'1.4px',textTransform:'uppercase',color:C.mu,marginBottom:8,fontWeight:600}}>Empfohlenes Benennungsschema</div>
        {editMode?<input style={{...inpStyle,fontFamily:'monospace',fontSize:'12px'}} value={block.body} onChange={e=>upd('body',e.target.value)}/>
          :<code style={{background:C.st,padding:'2px 6px',borderRadius:3,fontSize:'12px'}}>{block.body}</code>}
      </div>
    );
  }
  if(!rendered) return null;
  return(
    <div style={{marginBottom:28}}>
      {editMode&&(
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
          <div style={{fontSize:'11px',letterSpacing:'1px',textTransform:'uppercase',color:C.mu,fontWeight:600}}>
            {block.t==='step'?'Schritt':block.t==='info'?'Hinweis':block.t==='cards'?'Karten':block.t==='note'?'Notiz':'Code'}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button onClick={onMoveUp} disabled={!canMoveUp} style={{background:C.wh,border:'1px solid '+C.bo,borderRadius:4,cursor:canMoveUp?'pointer':'not-allowed',padding:'4px 8px',fontSize:'11px',opacity:canMoveUp?1:.45}}>↑</button>
            <button onClick={onMoveDown} disabled={!canMoveDown} style={{background:C.wh,border:'1px solid '+C.bo,borderRadius:4,cursor:canMoveDown?'pointer':'not-allowed',padding:'4px 8px',fontSize:'11px',opacity:canMoveDown?1:.45}}>↓</button>
            <button onClick={()=>onAddAfter?.('step')} style={{background:C.wh,border:'1px solid '+C.bo,borderRadius:4,cursor:'pointer',padding:'4px 8px',fontSize:'11px'}}>+ Schritt</button>
            <button onClick={onDelete} style={{background:'var(--c-re)',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',padding:'4px 8px',fontSize:'11px'}}>✕ Löschen</button>
          </div>
        </div>
      )}
      {rendered}
    </div>
  );
}

function escapeHtml(value=''){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function renderHelpBodyHtml(text=''){
  return escapeHtml(text).replace(/\n/g,'<br/>');
}

function renderHelpAnnotationHtml(anno){
  const rotation=Number(anno.rotation||0);
  const base=`position:absolute; left:${anno.x}%; top:${anno.y}%; transform:rotate(${rotation}deg);`;
  if(anno.type==='box'){
    return `<div style="${base} width:${anno.w}%; height:${anno.h}%; border:3px solid ${anno.color}; border-radius:6px; box-sizing:border-box; transform-origin:center center;"></div>`;
  }
  if(anno.type==='circle'){
    return `<div style="${base} width:${anno.w}%; height:${anno.h}%; border:3px solid ${anno.color}; border-radius:999px; box-sizing:border-box; transform-origin:center center;"></div>`;
  }
  if(anno.type==='arrow'){
    return `<div style="${base} width:${anno.w}%; height:${anno.h}%; transform-origin:left center;"><svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%; height:100%; display:block; overflow:visible;"><line x1="0" y1="50" x2="78" y2="50" stroke="${anno.color}" stroke-width="10" stroke-linecap="round"></line><polygon points="78,24 100,50 78,76" fill="${anno.color}"></polygon></svg></div>`;
  }
  if(anno.type==='text'){
    return `<div style="${base} color:${anno.color}; font-weight:700; font-size:16px; line-height:1.2; background:rgba(255,255,255,0.82); padding:2px 6px; border-radius:4px; width:${anno.w}%; min-height:${anno.h}%; word-break:break-word; transform-origin:left top; box-sizing:border-box;">${escapeHtml(anno.text||'Text')}</div>`;
  }
  return '';
}

function renderHelpImageHtml(storageId,imgId){
  try{
    const items=getHelpGallery(storageId,imgId);
    if(!items.length) return '';
    const images=items.map(item=>`
      <div style="flex:0 0 300px; max-width:300px;">
        <div style="position:relative; border:1px solid #d7d7d2; border-radius:8px; overflow:hidden; background:#fff;">
          <img src="${item.src}" alt="" style="width:100%; display:block;" />
          <div style="position:absolute; inset:0;">
            ${(item.annotations||[]).map(renderHelpAnnotationHtml).join('')}
          </div>
        </div>
      </div>
    `).join('');
    return `<div style="margin-top:12px; overflow-x:auto;"><div style="display:flex; gap:12px; min-width:min-content; padding-bottom:4px;">${images}</div></div>`;
  }catch{
    return '';
  }
}

function renderHelpBlockHtml(block,storageScope){
  if(block.t==='step'){
    return `
      <div style="display:flex; gap:14px; margin:0 0 22px; page-break-inside:avoid;">
        <div style="width:30px; height:30px; border-radius:50%; background:#d71920; color:#fff; display:flex; align-items:center; justify-content:center; font:700 14px 'Source Sans 3', sans-serif; flex-shrink:0;">${escapeHtml(block.n)}</div>
        <div style="flex:1">
          <div style="font:700 16px 'Libre Baskerville', Georgia, serif; color:#111; margin:0 0 6px;">${escapeHtml(block.title||'')}</div>
          <div style="font:400 13px/1.7 'Source Sans 3', system-ui, sans-serif; color:#111;">${renderHelpBodyHtml(block.body||'')}</div>
          ${block.img?renderHelpImageHtml(`${storageScope}_${block.id}_${block.img}`,block.img):''}
        </div>
      </div>
    `;
  }
  if(block.t==='info'){
    const styleMap={
      warn:{bg:'#FEF3E2',border:'#f3c97b',text:'#7A4F10'},
      green:{bg:'#edf7ef',border:'#86efac',text:'#1d6b3e'},
      default:{bg:'#fff5ee',border:'#f3dcc9',text:'#111111'},
    };
    const styles=styleMap[block.color]||styleMap.default;
    return `
      <div style="background:${styles.bg}; border:1px solid ${styles.border}; border-radius:8px; padding:14px 16px; margin:0 0 16px; page-break-inside:avoid;">
        <div style="font:700 14px 'Source Sans 3', sans-serif; color:${styles.text}; margin:0 0 6px;">${escapeHtml(block.icon||'')} ${escapeHtml(block.title||'')}</div>
        <div style="font:400 13px/1.7 'Source Sans 3', system-ui, sans-serif; color:${styles.text};">${renderHelpBodyHtml(block.body||'')}</div>
      </div>
    `;
  }
  if(block.t==='cards'){
    const cards=(block.items||[]).map(item=>`
      <div style="border:1px solid #d7d7d2; border-radius:8px; padding:14px; background:#fafaf8; min-height:92px;">
        <div style="font:700 14px 'Source Sans 3', sans-serif; color:#111; margin:0 0 6px;">${escapeHtml(item.h||'')}</div>
        <div style="font:400 13px/1.65 'Source Sans 3', system-ui, sans-serif; color:#111;">${renderHelpBodyHtml(item.b||'')}</div>
      </div>
    `).join('');
    return `<div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; margin:0 0 16px;">${cards}</div>`;
  }
  if(block.t==='note'){
    return `<div style="background:#fff5ee; border:1px solid #f3dcc9; border-radius:8px; padding:12px 16px; margin:0 0 16px; font:400 13px/1.7 'Source Sans 3', system-ui, sans-serif; color:#111;">${renderHelpBodyHtml(block.body||'')}</div>`;
  }
  if(block.t==='code'){
    return `
      <div style="border:1px solid #d7d7d2; border-radius:8px; padding:14px 16px; margin:0 0 16px;">
        <div style="font:600 11px 'Source Sans 3', sans-serif; letter-spacing:1.4px; text-transform:uppercase; color:#666; margin:0 0 8px;">Empfohlenes Benennungsschema</div>
        <code style="display:inline-block; background:#efefec; border-radius:4px; padding:4px 8px; font:400 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; color:#111;">${escapeHtml(block.body||'')}</code>
      </div>
    `;
  }
  return '';
}

function printHelpManualPdf(manualKey, manualData){
  const w=window.open('','_blank');
  if(!w)return;
  const sectionsHtml=(manualData.sections||[]).map(section=>{
    const content=manualData.content?.[section.k];
    if(!content)return '';
    const storageScope=`${manualKey}_${section.k}`;
    return `
      <section style="margin:0 0 34px;">
        <div style="border-bottom:2px solid #111; padding-bottom:8px; margin-bottom:14px;">
          <h2 style="margin:0 0 4px; font:700 20px 'Libre Baskerville', Georgia, serif; color:#111;">${escapeHtml(content.title||'')}</h2>
          ${content.sub?`<div style="font:400 13px 'Source Sans 3', system-ui, sans-serif; color:#666;">${escapeHtml(content.sub)}</div>`:''}
        </div>
        ${(content.blocks||[]).map(block=>renderHelpBlockHtml(block,storageScope)).join('')}
      </section>
    `;
  }).join('');

  w.document.write(`<!DOCTYPE html>
  <html>
    <head>
      <title>${escapeHtml(manualData.navLabel||manualKey)}</title>
      <style>
        body{font-family:'Source Sans 3',system-ui,sans-serif;color:#111;margin:0.5cm;background:#fff;}
        @page{margin:0.5cm;}
        h1,h2,h3{page-break-after:avoid;}
        section{page-break-inside:auto;}
      </style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap">
    </head>
    <body>
      <header style="margin:0 0 24px;">
        <div style="font:600 11px 'Source Sans 3', sans-serif; letter-spacing:1.8px; text-transform:uppercase; color:#666; margin-bottom:8px;">AIM Informationshandbuch</div>
        <h1 style="margin:0 0 6px; font:700 26px 'Libre Baskerville', Georgia, serif; color:#111;">${escapeHtml(manualData.navLabel||manualKey)}</h1>
        <div style="font:400 13px 'Source Sans 3', system-ui, sans-serif; color:#666;">Exportiert aus dem AIM Prüfungs-Manager</div>
      </header>
      ${sectionsHtml}
    </body>
  </html>`);
  w.document.close();
  w.focus();
  setTimeout(()=>w.print(),500);
}

function HelpPage(){
  const[manual,setManual]=useState('testportal');
  const[section,setSection]=useState(null);
  const[editMode,setEditMode]=useState(false);
  const[unsaved,setUnsaved]=useState(false);
  const importRef=useRef(null);
  const[content,setContent]=useState(()=>{
    try{
      const s=JSON.parse(window.localStorage.getItem(HELP_KEY));
      if(s) return normalizeHelpContent(s);
    }catch{}
    return normalizeHelpContent(HELP_DEFAULTS);
  });
  const manualKeys=[...BUILTIN_MANUAL_KEYS,...Object.keys(content).filter(key=>!BUILTIN_MANUAL_KEYS.includes(key))];
  useEffect(()=>{
    if(!content[manual]) setManual(manualKeys[0]||'testportal');
  },[content,manual,manualKeys]);

  const curManual=content[manual]||content[manualKeys[0]];
  if(!curManual) return null;
  const defaultSection=curManual.sections[0].k;
  const activeSection=section&&curManual.content[section]?section:defaultSection;
  const curSection=curManual.content[activeSection];

  const updateSectionBlocks=(sk,updater)=>{
    setUnsaved(true);
    setContent(c=>normalizeHelpContent({
      ...c,
      [manual]:{
        ...c[manual],
        content:{
          ...c[manual].content,
          [sk]:{
            ...c[manual].content[sk],
            blocks:updater(c[manual].content[sk].blocks||[]),
          }
        }
      }
    }));
  };
  const updateBlock=(sk,idx,nb)=>{
    updateSectionBlocks(sk,blocks=>blocks.map((b,i)=>i===idx?nb:b));
  };
  const updateMeta=(sk,field,val)=>{
    setUnsaved(true);
    setContent(c=>normalizeHelpContent({...c,[manual]:{...c[manual],content:{...c[manual].content,[sk]:{...c[manual].content[sk],[field]:val}}}}));
  };
  const addBlock=(sk,type='step',afterIndex=null)=>{
    const newBlock=makeHelpBlock(type);
    updateSectionBlocks(sk,blocks=>{
      const next=[...blocks];
      const insertAt=afterIndex===null?next.length:afterIndex+1;
      next.splice(insertAt,0,newBlock);
      return next;
    });
  };
  const deleteBlock=(sk,idx)=>{
    updateSectionBlocks(sk,blocks=>blocks.filter((_,i)=>i!==idx));
  };
  const moveBlock=(sk,idx,direction)=>{
    updateSectionBlocks(sk,blocks=>{
      const target=idx+direction;
      if(target<0 || target>=blocks.length) return blocks;
      const next=[...blocks];
      [next[idx],next[target]]=[next[target],next[idx]];
      return next;
    });
  };
  const save=()=>{window.localStorage.setItem(HELP_KEY,JSON.stringify(normalizeHelpContent(content)));setUnsaved(false);};
  const updateManual=(updater)=>{
    setUnsaved(true);
    setContent(c=>normalizeHelpContent({
      ...c,
      [manual]:updater(c[manual]),
    }));
  };
  const renameManual=label=>{
    updateManual(cur=>({...cur,navLabel:label}));
  };
  const renameSectionLabel=(sectionKey,label)=>{
    updateManual(cur=>({
      ...cur,
      sections:(cur.sections||[]).map(section=>section.k===sectionKey?{...section,label:stripSectionNumber(label)||'Abschnitt'}:section),
    }));
  };
  const addSection=()=>{
    if(!curManual?.isCustom) return;
    const nextIndex=(curManual.sections?.length||0)+1;
    const sectionKey=`section_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    updateManual(cur=>({
      ...cur,
      sections:[...(cur.sections||[]),makeHelpSection(sectionKey,'Abschnitt')],
      content:{
        ...cur.content,
        [sectionKey]:{
          title:`Abschnitt ${nextIndex}`,
          sub:'Eigene Sektion',
          blocks:[makeHelpBlock('step')],
        }
      }
    }));
    setSection(sectionKey);
  };
  const moveSection=(sectionKey,direction)=>{
    if(!curManual?.isCustom) return;
    updateManual(cur=>{
      const sections=[...(cur.sections||[])];
      const idx=sections.findIndex(section=>section.k===sectionKey);
      const target=idx+direction;
      if(idx===-1 || target<0 || target>=sections.length) return cur;
      [sections[idx],sections[target]]=[sections[target],sections[idx]];
      return {...cur,sections};
    });
  };
  const deleteSection=sectionKey=>{
    if(!curManual?.isCustom) return;
    if((curManual.sections||[]).length<=1){
      window.alert('Ein eigenes Handbuch muss mindestens eine Sektion haben.');
      return;
    }
    if(!window.confirm('Diese Sektion wirklich löschen?')) return;
    updateManual(cur=>{
      const nextSections=(cur.sections||[]).filter(section=>section.k!==sectionKey);
      const nextContent={...cur.content};
      delete nextContent[sectionKey];
      return {...cur,sections:nextSections,content:nextContent};
    });
    if(activeSection===sectionKey){
      const fallback=(curManual.sections||[]).find(section=>section.k!==sectionKey)?.k||null;
      setSection(fallback);
    }
  };
  const addManual=()=>{
    const input=window.prompt('Name des neuen Handbuchs');
    const label=String(input||'').trim();
    if(!label) return;
    let key=slugHandbookLabel(label);
    let counter=2;
    while(content[key]){
      key=`${slugHandbookLabel(label)}-${counter++}`;
    }
    const next=normalizeHelpContent({...content,[key]:makeCustomManual(label)});
    setContent(next);
    setManual(key);
    setSection(null);
    setUnsaved(true);
  };
  const deleteManual=()=>{
    if(!curManual?.isCustom) return;
    if(!window.confirm(`Handbuch „${curManual.navLabel}“ wirklich löschen?`)) return;
    setContent(c=>{
      const next={...c};
      delete next[manual];
      return normalizeHelpContent(next);
    });
    setManual('testportal');
    setSection(null);
    setUnsaved(true);
  };
  const exportManual=async()=>{
    try{
      const blob=await exportManualZipBundle(manual,curManual,content);
      dlFile(blob,`${slugHandbookLabel(curManual?.navLabel||manual)}.aim-handbook.zip`,'application/zip');
    }catch{
      window.alert('Das Handbuch konnte nicht als ZIP exportiert werden.');
    }
  };
  const importManual=async e=>{
    const file=e.target.files?.[0];
    if(!file) return;
    try{
      const parsed=await importManualBundle(file);
      const importedManual=parsed?.manual;
      if(!importedManual || !importedManual.navLabel){
        throw new Error('invalid');
      }
      const requestedKey=String(parsed.manualKey||slugHandbookLabel(importedManual.navLabel));
      const key=BUILTIN_MANUAL_KEYS.includes(requestedKey)?requestedKey:requestedKey;
      setContent(c=>normalizeHelpContent({...c,[key]:{...importedManual,isCustom:!BUILTIN_MANUAL_KEYS.includes(key)}}));
      saveManualGalleryEntries(parsed.galleries||{});
      setManual(key);
      setSection(null);
      setUnsaved(true);
    }catch{
      window.alert('Die Handbuch-Datei konnte nicht importiert werden.');
    }finally{
      e.target.value='';
    }
  };

  return(
    <div style={{padding:28}}>
      <input ref={importRef} type="file" accept=".zip,.json" style={{display:'none'}} onChange={importManual}/>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:6,flex:1,flexWrap:'wrap'}}>
          {manualKeys.map(m=>(
            <button key={m} onClick={()=>{setManual(m);setSection(null);}} style={{padding:'7px 16px',border:'1px solid '+C.bo,borderRadius:6,cursor:'pointer',fontFamily:sans,fontSize:'13px',fontWeight:600,background:manual===m?C.tD:'transparent',color:manual===m?C.wh:C.tx,transition:'all 0.15s'}}>
              {content[m]?.navLabel||HELP_DEFAULTS[m]?.navLabel||m}
            </button>
          ))}
          {editMode&&<button onClick={addManual} style={{padding:'7px 16px',border:'1px dashed '+C.bo,borderRadius:6,cursor:'pointer',fontFamily:sans,fontSize:'13px',fontWeight:600,background:'transparent',color:C.tx}}>+ Eigenes Handbuch</button>}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Btn ch="↑ Handbuch importieren" onClick={()=>importRef.current?.click()} v="ghost" sm/>
          <Btn ch="↓ Handbuch exportieren" onClick={exportManual} v="ghost" sm/>
          {editMode&&curManual?.isCustom&&<Btn ch="✕ Handbuch löschen" onClick={deleteManual} v="danger" sm/>}
          <Btn ch="↓ Handbuch als PDF" onClick={()=>printHelpManualPdf(manual,curManual)} v="ghost" sm/>
          {unsaved&&editMode&&<span style={{fontSize:'12px',color:C.tM,fontWeight:500}}>● Ungespeichert</span>}
          {editMode&&<Btn ch="💾 Speichern" onClick={save} v="primary" sm/>}
          <Btn ch={editMode?'🔒 Sperren':'🔓 Bearbeiten'} onClick={()=>{setEditMode(m=>!m);}} v={editMode?'secondary':'ghost'} sm/>
        </div>
      </div>
      {editMode&&<div style={{background:'#FEF3E2',border:'1px solid #F6C90E44',borderRadius:6,padding:'8px 14px',marginBottom:16,fontSize:'12px',color:'#7A4F10'}}>✏️ Bearbeitungsmodus aktiv — Klicke in die Felder um Text zu bearbeiten. Klicke auf 💾 Speichern um Änderungen dauerhaft zu sichern.</div>}
        <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:24,alignItems:'start'}}>
        <div style={{background:C.wh,border:'1px solid '+C.bo,borderRadius:8,overflow:'hidden',position:'sticky',top:20}}>
          <div style={{padding:'10px 14px',background:C.tD,fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:C.tL,fontWeight:500}}>{curManual.navLabel}</div>
          {editMode&&curManual?.isCustom&&(
            <div style={{padding:'10px 14px',borderBottom:'1px solid '+C.bo,background:C.wW}}>
              <button onClick={addSection} style={{width:'100%',background:C.wh,border:'1px solid '+C.bo,borderRadius:6,cursor:'pointer',padding:'7px 10px',fontSize:'12px'}}>+ Neue Sektion</button>
            </div>
          )}
          {curManual.sections.map((s,idx)=>(
            <div key={s.k} style={{borderBottom:'1px solid '+C.bo}}>
              <button onClick={()=>setSection(s.k)} style={{width:'100%',textAlign:'left',padding:'10px 14px',background:activeSection===s.k?C.tP:'transparent',color:activeSection===s.k?C.tD:C.tx,border:'none',borderLeft:activeSection===s.k?'3px solid '+C.t:'3px solid transparent',cursor:'pointer',fontFamily:sans,fontSize:'13px',fontWeight:activeSection===s.k?600:400}}>
                {formatSectionLabel(s,idx,!!curManual?.isCustom)}
              </button>
              {editMode&&curManual?.isCustom&&activeSection===s.k&&(
                <div style={{padding:'0 14px 10px',display:'grid',gap:8}}>
                  <input style={{width:'100%',fontSize:'12px',color:C.tx,border:'1px solid '+C.ac,borderRadius:4,padding:'5px 8px',boxSizing:'border-box',background:C.wh}} value={stripSectionNumber(s.label||'')} onChange={e=>renameSectionLabel(s.k,e.target.value)} placeholder="Sektionsname"/>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button onClick={()=>moveSection(s.k,-1)} disabled={idx===0} style={{background:C.wh,border:'1px solid '+C.bo,borderRadius:4,cursor:idx===0?'not-allowed':'pointer',padding:'4px 8px',fontSize:'11px',opacity:idx===0?0.45:1}}>↑</button>
                    <button onClick={()=>moveSection(s.k,1)} disabled={idx===curManual.sections.length-1} style={{background:C.wh,border:'1px solid '+C.bo,borderRadius:4,cursor:idx===curManual.sections.length-1?'not-allowed':'pointer',padding:'4px 8px',fontSize:'11px',opacity:idx===curManual.sections.length-1?0.45:1}}>↓</button>
                    <button onClick={()=>deleteSection(s.k)} style={{background:'var(--c-re)',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',padding:'4px 8px',fontSize:'11px'}}>✕ Löschen</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {curSection&&(
          <div>
            <div style={{marginBottom:20}}>
              {editMode&&(
                <input style={{width:'100%',fontSize:'12px',color:C.mu,border:'1px solid '+C.ac,borderRadius:4,padding:'4px 8px',boxSizing:'border-box',marginBottom:8}} value={curManual.navLabel||''} onChange={e=>renameManual(e.target.value)} placeholder="Handbuchname"/>
              )}
              {editMode
                ?<input style={{width:'100%',fontFamily:serif,fontSize:'20px',fontWeight:700,color:C.tD,border:'1px solid '+C.ac,borderRadius:4,padding:'5px 10px',marginBottom:6,boxSizing:'border-box'}} value={curSection.title} onChange={e=>updateMeta(activeSection,'title',e.target.value)}/>
                :<h1 style={{fontFamily:serif,fontSize:'20px',color:C.tD,margin:'0 0 4px',fontWeight:700}}>{curSection.title}</h1>}
              {editMode
                ?<input style={{width:'100%',fontSize:'13px',color:C.mu,border:'1px solid '+C.ac,borderRadius:4,padding:'4px 8px',boxSizing:'border-box'}} value={curSection.sub||''} onChange={e=>updateMeta(activeSection,'sub',e.target.value)}/>
                :<p style={{color:C.mu,fontSize:'13px',margin:0}}>{curSection.sub}</p>}
            </div>
            {editMode&&(
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
                <button onClick={()=>addBlock(activeSection,'step')} style={{background:C.wh,border:'1px solid '+C.bo,borderRadius:6,cursor:'pointer',padding:'7px 10px',fontSize:'12px'}}>+ Neuer Schritt</button>
                <button onClick={()=>addBlock(activeSection,'info')} style={{background:C.wh,border:'1px solid '+C.bo,borderRadius:6,cursor:'pointer',padding:'7px 10px',fontSize:'12px'}}>+ Neuer Hinweis</button>
                <button onClick={()=>addBlock(activeSection,'note')} style={{background:C.wh,border:'1px solid '+C.bo,borderRadius:6,cursor:'pointer',padding:'7px 10px',fontSize:'12px'}}>+ Neue Notiz</button>
                <button onClick={()=>addBlock(activeSection,'code')} style={{background:C.wh,border:'1px solid '+C.bo,borderRadius:6,cursor:'pointer',padding:'7px 10px',fontSize:'12px'}}>+ Neuer Codeblock</button>
              </div>
            )}
            {curSection.blocks.map((block,idx)=>(
              <RenderBlock
                key={`${manual}_${activeSection}_${block.id}`}
                block={block}
                idx={idx}
                editMode={editMode}
                onUpdate={(i,nb)=>updateBlock(activeSection,i,nb)}
                onDelete={()=>deleteBlock(activeSection,idx)}
                onMoveUp={()=>moveBlock(activeSection,idx,-1)}
                onMoveDown={()=>moveBlock(activeSection,idx,1)}
                canMoveUp={idx>0}
                canMoveDown={idx<curSection.blocks.length-1}
                onAddAfter={type=>addBlock(activeSection,type,idx)}
                imageScopeKey={`${manual}_${activeSection}_${block.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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

  const showToast=useCallback((message,type='success')=>{
    const id=Date.now()+Math.random();
    setToasts(prev=>[...prev,{id,message,type}]);
    setTimeout(()=>setToasts(prev=>prev.filter(t=>t.id!==id)),4000);
  },[]);

  const showConfirm=useCallback((message,onConfirm)=>{
    setConfirm({message,onConfirm});
  },[]);

  const clearAllData=useCallback(()=>{
    setQuestions([]);
    setPrograms([]);
    setSavedExams([]);
    setExam(null);
    setExamName('');
    try{
      window.localStorage.removeItem('aim_q');
      window.localStorage.removeItem('aim_p');
      window.localStorage.removeItem('aim_saved_exams');
      window.localStorage.removeItem('aim_exam');
    }catch{}
    setView('dashboard');
    showToast('Alle App-Daten wurden gelöscht. Du kannst jetzt eine neue JSON- oder Excel-Datei importieren.','success');
  },[showToast]);

  const toggleSidebar=()=>{
    setSidebarCollapsed(prev=>{
      window.localStorage.setItem('aim_sidebar',prev?'0':'1');
      return !prev;
    });
  };

  // Inject theme CSS once. Fonts are bundled via index.html for offline use.
  useEffect(()=>{
    const style=document.createElement('style');
    style.id='aim-theme';
    style.textContent=`:root{${THEMES.light}}:root.dark{${THEMES.dark}}*{box-sizing:border-box;}`;
    document.head.appendChild(style);
  },[]);

  // Apply dark/light class
  useEffect(()=>{
    darkMode?document.documentElement.classList.add('dark'):document.documentElement.classList.remove('dark');
    window.localStorage.setItem('aim_dark',darkMode?'1':'0');
  },[darkMode]);

  // Persist — data is loaded in useState initialisers above, these only save on change
  useEffect(()=>{window.localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));},[settings]);
  useEffect(()=>{window.localStorage.setItem('aim_q',JSON.stringify(questions));},[questions]);
  useEffect(()=>{window.localStorage.setItem('aim_p',JSON.stringify(programs));},[programs]);
  useEffect(()=>{window.localStorage.setItem('aim_saved_exams',JSON.stringify(savedExams));},[savedExams]);
  useEffect(()=>{
    if(exam){
      window.localStorage.setItem('aim_exam',JSON.stringify({exam,name:examName}));
    }else{
      window.localStorage.removeItem('aim_exam');
    }
  },[exam,examName]);
  useEffect(()=>{
    try{
      const alreadyInitialized=window.localStorage.getItem(APP_INIT_KEY)==='1';
      if(!alreadyInitialized){
        window.localStorage.setItem(APP_INIT_KEY,'1');
        window.localStorage.removeItem('aim_exam');
        setExam(null);
        setExamName('');
        return;
      }
      const r=window.localStorage.getItem('aim_exam');
      if(r){
        const d=JSON.parse(r);
        setExam(d.exam);
        setExamName(d.name||'');
      }
    }catch{}
  },[]);

  const navTo=v=>{setView(v);};

  return(
    <div style={{display:'flex',minHeight:'100vh',fontFamily:sans,background:C.wW}}>
      <Sidebar view={view} setView={navTo} qCount={questions.length} pCount={programs.length} examCount={exam?.length} collapsed={sidebarCollapsed} onToggle={toggleSidebar} darkMode={darkMode} onToggleDark={()=>setDarkMode(d=>!d)}/>
      <div style={{flex:1,overflow:'auto'}}>
        {view==='dashboard'&&<Dashboard questions={questions} programs={programs} exam={exam} examName={examName} savedExams={savedExams} setView={navTo} setQuestions={setQuestions} setPrograms={setPrograms} setSavedExams={setSavedExams} setExam={setExam} setExamName={setExamName} showToast={showToast} showConfirm={setConfirm} onClearAllData={clearAllData}/>}
        {view==='questions'&&<QuestionDB questions={questions} setQuestions={setQuestions} showToast={showToast} showConfirm={showConfirm}/>}
        {view==='programs'&&<Programs programs={programs} setPrograms={setPrograms} questions={questions} showToast={showToast} showConfirm={showConfirm} settings={settings}/>}
        {view==='exam'&&<ExamBuilder programs={programs} questions={questions} onBuild={(qs,name)=>{setExam(qs);setExamName(name||'');showToast(`Prüfung „${name}" mit ${qs.length} Fragen erstellt.`,'success');setView('export');}}/>}
        {view==='export'&&<ExportView exam={exam} programName={examName} setView={navTo} showToast={showToast} onSaveAndNew={(savedName)=>{if(!exam?.length)return;const snapshot=createSavedExamSnapshot(exam,savedName||examName||'Prüfung',examName||'Prüfung');setSavedExams(prev=>[snapshot,...prev]);setExam(null);setExamName('');try{window.localStorage.removeItem('aim_exam');}catch{}showToast(`Prüfung „${snapshot.name}" gespeichert. Neue Prüfung kann gestartet werden.`,'success');setView('exam');}} onUpdateExam={updater=>setExam(prev=>typeof updater==='function'?updater(prev||[]):updater)} onClear={()=>{setExam(null);setExamName('');try{window.localStorage.removeItem('aim_exam');}catch{}}}/>}
        {view==='help'&&<HelpPage/>}
        {view==='settings'&&<SettingsPage settings={settings} setSettings={setSettings} darkMode={darkMode} onToggleDark={v=>setDarkMode(typeof v==='boolean'?v:d=>!d)}/>}
      </div>
      <ToastContainer toasts={toasts} onRemove={id=>setToasts(prev=>prev.filter(t=>t.id!==id))}/>
      <ConfirmModal confirm={confirm} onClose={()=>setConfirm(null)}/>
    </div>
  );
}
