// Who the student is, for Your Path: their start term, level, and student
// type. A choice they've made always wins. Otherwise the value is suggested
// from what they've done, but only from strong signals; with none, the field
// stays blank and they choose. No DOM code, so tests, Under the hood, and the
// header share it.

import { LEVEL_OF_PROGRAM, STUDENT_LEVELS, STUDENT_TYPES } from "../vocab.ts";
import type { PlanChoices, WorkbenchItem } from "./types.ts";

type Level = (typeof STUDENT_LEVELS)[number];

// What inference looks at: this tab's page views and request-info answers
// (from personalization), and the saved items
export type Signals = {
  views: { type: string; id: string; level?: string }[];
  requestInfo?: { level?: string; startTerm?: string; studentType?: string };
  items: WorkbenchItem[];
};

export type Field = { value?: string; source?: "chosen" | "inferred"; why?: string };
export type ResolvedProfile = {
  startTerm: Field & { value: string };
  level: Field & { mixed?: boolean };
  studentType: Field;
  // A plan exists once level and student type are known
  ready: boolean;
};

// Pages and offices that say what kind of student someone is. Two views of
// any of them, or one save, is a strong enough signal.
export const TYPE_SIGNALS: { type: string; level?: Level; pages: string[]; services: string[]; label: string }[] = [
  { type: "Transfer", level: "Undergraduate", pages: ["admissions/transfer"], services: ["transfer-center"], label: "transfer" },
  { type: "International", pages: ["admissions/international"], services: ["international-student-services"], label: "international" },
  { type: "New graduate student", level: "Graduate", pages: ["admissions/graduate"], services: ["graduate-school-office"], label: "graduate" },
];

const studentLevel = (programLevel?: string) => (programLevel ? LEVEL_OF_PROGRAM[programLevel as keyof typeof LEVEL_OF_PROGRAM] : undefined);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const validType = (level: string | undefined, type: string | undefined) =>
  Boolean(type && (!level || (STUDENT_TYPES[level as Level] as readonly string[] | undefined)?.includes(type)));

// The level programs point to: one level, or "mixed" when they span both
function levelOf(programLevels: (string | undefined)[]) {
  const levels = new Set(programLevels.map(studentLevel).filter(Boolean));
  if (levels.size === 1) return { level: [...levels][0] as Level };
  return levels.size > 1 ? { mixed: true } : {};
}

function inferLevel(signals: Signals): Field & { mixed?: boolean } {
  const formLevel = studentLevel(signals.requestInfo?.level);
  if (formLevel) return { value: formLevel, source: "inferred", why: `You chose ${signals.requestInfo!.level} programs in the request-info form.` };

  const saved = signals.items.filter((i) => i.kind === "program" && i.interest?.level);
  const fromSaved = levelOf(saved.map((i) => i.interest!.level));
  if (fromSaved.mixed) return { mixed: true, why: "You've saved both undergraduate and graduate programs, so choose the level this plan is for." };
  if (fromSaved.level) return { value: fromSaved.level, source: "inferred", why: `You saved ${plural(saved.length, fromSaved.level === "Graduate" ? "graduate program" : "undergraduate program")}.` };

  const viewed = signals.views.filter((v) => v.type === "program" && v.level);
  const fromViews = levelOf(viewed.map((v) => v.level));
  if (fromViews.mixed) return { mixed: true, why: "You've looked at both undergraduate and graduate programs, so choose the level this plan is for." };
  if (fromViews.level) {
    const names = [...new Set(viewed.map((v) => v.level!))];
    return { value: fromViews.level, source: "inferred", why: `You looked at ${plural(new Set(viewed.map((v) => v.id)).size, "program")} (${names.join(", ")}).` };
  }
  return {};
}

function inferType(signals: Signals, level: string | undefined): Field {
  const formType = signals.requestInfo?.studentType;
  if (formType && validType(level, formType)) return { value: formType, source: "inferred", why: `You chose ${formType} in the request-info form.` };
  for (const signal of TYPE_SIGNALS) {
    if (signal.level && level && signal.level !== level) continue;
    if (!validType(level, signal.type)) continue;
    const saves = signals.items.filter((i) => i.kind === "service" && i.ref && signal.services.includes(i.ref));
    if (saves.length) return { value: signal.type, source: "inferred", why: `You saved a ${signal.label} office to your path.` };
    const views = signals.views.filter((v) => (v.type === "page" && signal.pages.includes(v.id)) || (v.type === "service" && signal.services.includes(v.id)));
    if (views.length >= 2) return { value: signal.type, source: "inferred", why: `You looked at ${signal.label} pages ${views.length} times.` };
  }
  return {};
}

// `upcomingTerms` lists the start terms that haven't begun, in order
export function resolveProfile(choices: PlanChoices, signals: Signals, upcomingTerms: string[]): ResolvedProfile {
  // Start term: chosen, then the request-info form's, then the next to begin
  const formTerm = signals.requestInfo?.startTerm;
  const startTerm: ResolvedProfile["startTerm"] = choices.startTerm
    ? { value: choices.startTerm, source: "chosen" }
    : formTerm && upcomingTerms.includes(formTerm)
      ? { value: formTerm, source: "inferred", why: "You chose it in the request-info form." }
      : { value: upcomingTerms[0], source: "inferred", why: "It's the next term to start." };

  let level: ResolvedProfile["level"] = choices.level ? { value: choices.level, source: "chosen" } : inferLevel(signals);
  const typeChoice = validType(level.value, choices.studentType) ? choices.studentType : undefined;
  let studentType: Field = typeChoice ? { value: typeChoice, source: "chosen" } : inferType(signals, level.value);

  // A type that belongs to one level settles the level too (Transfer → Undergraduate)
  if (!level.value && studentType.value) {
    const levels = STUDENT_LEVELS.filter((l) => (STUDENT_TYPES[l] as readonly string[]).includes(studentType.value!));
    if (levels.length === 1) level = { value: levels[0], source: studentType.source, why: studentType.source === "chosen" ? undefined : `${studentType.value} students are ${levels[0].toLowerCase()}s.` };
  }
  if (studentType.value && !validType(level.value, studentType.value)) studentType = {};
  return { startTerm, level, studentType, ready: Boolean(level.value && studentType.value) };
}

// "transfer undergraduates", "international graduate students", "new graduate students"
export function describeStudents(level: string, type: string) {
  if (type === "International" || type === "Current student") return `${type === "International" ? "international" : "current"} ${level === "Graduate" ? "graduate students" : "undergraduates"}`;
  if (type === "New graduate student") return "new graduate students";
  return `${type.toLowerCase()} ${type === "First-year" ? "students" : "undergraduates"}`;
}
