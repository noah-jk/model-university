// Handoffs: short prompts on key pages that explain Your Path where it
// matters. All their words are here, as small functions of the plan, so the
// copy moves easily (the homepage may be redesigned) and tests can check
// every state. No DOM code. src/components/workbench/PathHandoff.astro
// renders a panel, and src/scripts/workbench/handoffs.ts keeps it current.
//
// Each panel has two states: "start" (no plan yet) and "continue" (a plan
// exists). Numbers and dates come from the plan, never fixed text.

import type { PlanStep } from "./plan.ts";
import { describeStudents } from "./profile.ts";
import { WORKBENCH_LABEL, WORKBENCH_PATH } from "./types.ts";

// Handoffs the student can hide with "Don't show this again", one per kind of
// page (the Transfer Center and /admissions/transfer/ share "transfer").
// "first-save" isn't a panel: it's shown once, then added to hiddenHandoffs.
export const HANDOFF_IDS = ["home", "admissions", "program", "tuition", "transfer", "international", "graduate", "first-save"] as const;
export type HandoffId = (typeof HANDOFF_IDS)[number];
export type PanelId = Exclude<HandoffId, "program" | "first-save">;

// What a handoff knows about the student's plan. `steps` is the plan's steps
// for the current profile; with the full rules (calendar included) they carry dates.
export type PathSummary = {
  ready: boolean;
  level?: string;
  studentType?: string;
  startTerm: string;
  steps?: PlanStep[];
};

export type HandoffCopy = { heading: string; text: string; action: { label: string; href: string } };

// A link to Your Path that fills in the student's answers. They go after the
// #, which never reaches the server, so no log records them. Your Path saves
// them as the student's choices (see applyLink in src/scripts/workbench/page.ts).
export function pathLink(choices: { type?: string; level?: string } = {}) {
  const params = [
    "plan",
    choices.type && `type=${encodeURIComponent(choices.type)}`,
    choices.level && `level=${encodeURIComponent(choices.level)}`,
  ].filter(Boolean);
  return `${WORKBENCH_PATH}#${params.join("&")}`;
}

const shortDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const who = (s: PathSummary) => `${describeStudents(s.level!, s.studentType!)} starting ${s.startTerm}`;
const continueAction = { label: "Continue your path", href: WORKBENCH_PATH };

// "Next: Submit your FAFSA, due Feb 15, 2027." A date shows only when the
// steps have one (the full rules) and it hasn't passed.
export function nextLine(steps: PlanStep[]) {
  const next = steps.find((s) => s.next);
  if (!next) return "You've done every step.";
  const title = next.step.short ?? next.step.title;
  return `Next: ${title}${next.date && next.status !== "overdue" ? `, due ${shortDate(next.date)}` : ""}.`;
}

// No step counts: a long list left can feel overwhelming (#25). Just what's next.
const status = (s: PathSummary) => nextLine(s.steps!);
const continuing = (s?: PathSummary): s is PathSummary & { steps: PlanStep[] } => Boolean(s?.ready && s.steps);

// Homepage ------------------------------------------------------------------------

export function homeCopy(s?: PathSummary): HandoffCopy {
  if (continuing(s)) return { heading: "Your path", text: status(s), action: continueAction };
  return {
    heading: "Skip the scavenger hunt",
    text: "Tell us a little about you, and we'll put your steps, deadlines, and the offices that can help in one place.",
    action: { label: "Plan your path", href: pathLink() },
  };
}

// Admissions landing: a type and level picker in the start state ---------------

export function admissionsCopy(s?: PathSummary): HandoffCopy {
  const heading = "Your path to Cascadia State";
  if (continuing(s)) return { heading, text: `Your plan is for ${who(s)}. ${status(s)}`, action: continueAction };
  return {
    heading,
    text: "First-year, transfer, graduate, or international? Choose yours and see every step and deadline for your start term.",
    action: { label: "See my path", href: pathLink() },
  };
}

// Tuition and aid: the next aid step -------------------------------------------------

// Steps about paying for college, in the order they come up
export const AID_STEPS = ["fafsa", "financial-documents", "assistantship"];

// What to say about a passed date, for steps where waiting still helps
const LATE: Record<string, string> = {
  fafsa: "The FAFSA priority date has passed. File as soon as you can; aid is still available.",
};

export function aidLine(steps: PlanStep[]) {
  const aid = steps.filter((s) => AID_STEPS.includes(s.step.id));
  const next = aid.find((s) => s.status !== "done");
  if (!next) return aid.length ? `Your aid steps are done. ${nextLine(steps)}` : nextLine(steps);
  const title = next.step.short ?? next.step.title;
  if (next.status === "overdue") return LATE[next.step.id] ?? `${title}: the date has passed. Do it as soon as you can.`;
  return `Next aid step on your path: ${title}${next.date ? `, by ${shortDate(next.date)}` : ""}.`;
}

export function tuitionCopy(s?: PathSummary): HandoffCopy {
  if (continuing(s)) return { heading: "Your aid deadlines", text: aidLine(s.steps), action: continueAction };
  return {
    heading: "Your aid deadlines",
    text: "See the aid deadlines that apply to you, like the FAFSA priority date, on your path.",
    action: { label: "Plan your path", href: pathLink() },
  };
}

// Pages for one kind of student (offices and admissions pages) ------------------

type TypeHandoff = { type: string; level?: string; heading: string; lead: string; students: string; name: string; matches: (s: PathSummary) => boolean };
export const TYPE_HANDOFFS: Record<"transfer" | "international" | "graduate", TypeHandoff> = {
  transfer: {
    type: "Transfer",
    heading: "Your path as a transfer student",
    lead: "Transferring?",
    students: "transfer students",
    name: "transfer",
    matches: (s) => s.studentType === "Transfer",
  },
  // International students study at both levels, so only the type is set and Your Path asks for the level
  international: {
    type: "International",
    heading: "Your path as an international student",
    lead: "Coming from another country?",
    students: "international students",
    name: "international",
    matches: (s) => s.studentType === "International",
  },
  graduate: {
    type: "New graduate student",
    level: "Graduate",
    heading: "Your path to graduate school",
    lead: "Applying to graduate school?",
    students: "graduate students",
    name: "graduate",
    matches: (s) => s.level === "Graduate",
  },
};

// Start: an invitation. Continue, same type: the plan's status. Continue,
// another type: switching keeps completed steps (they're kept by step id).
export function typeCopy(id: keyof typeof TYPE_HANDOFFS, s?: PathSummary): HandoffCopy {
  const t = TYPE_HANDOFFS[id];
  const text = `${t.lead} See every step for ${t.students}, with dates for your start term.`;
  const link = pathLink({ type: t.type, level: t.level });
  if (continuing(s) && t.matches(s)) return { heading: t.heading, text: `Your plan is for ${who(s)}. ${status(s)}`, action: continueAction };
  if (continuing(s)) return { heading: t.heading, text, action: { label: `Switch your path to ${t.name} steps`, href: link } };
  return { heading: t.heading, text, action: { label: `See ${t.name} steps`, href: link } };
}

export function panelCopy(id: PanelId, s?: PathSummary): HandoffCopy {
  if (id === "home") return homeCopy(s);
  if (id === "admissions") return admissionsCopy(s);
  if (id === "tuition") return tuitionCopy(s);
  return typeCopy(id, s);
}

// Program pages: one line next to the Save button -------------------------------

export const PROGRAM_HINT = "Save this program to see its deadlines alongside the rest of your steps.";

// After saving (or on arrival, if it's saved). `program.level` is the
// student level (Undergraduate or Graduate); `startTerms` are season names.
export function programSaved(program: { level: string; startTerms: string[] }, s: PathSummary) {
  if (!s.ready) return `Saved. Choose your student type on ${WORKBENCH_LABEL} to see its deadline with your steps.`;
  if (program.level !== s.level) {
    return `Saved. It's ${program.level === "Graduate" ? "a graduate" : "an undergraduate"} program, so it's in your saved items but not part of your ${s.level!.toLowerCase()} plan.`;
  }
  if (!program.startTerms.includes(s.startTerm.split(" ")[0])) return `Saved. It doesn't start in ${s.startTerm}, so ${WORKBENCH_LABEL} shows no deadline for it yet.`;
  return `Saved. ${WORKBENCH_LABEL} now shows the ${s.startTerm} deadline for this program.`;
}

// The first save anywhere, once -------------------------------------------------------

export const FIRST_SAVE = `Saved to ${WORKBENCH_LABEL}. It keeps the things you save, plus your steps and deadlines.`;
export const FIRST_SAVE_LINK = `See ${WORKBENCH_LABEL}`;

// After sending a journey form (not dismissable: it's part of the thank-you) ---

export function requestInfoCopy(s: PathSummary) {
  if (continuing(s)) return { text: `Your path is ready, with every step for ${who(s)}.`, action: { label: "See your path", href: WORKBENCH_PATH } };
  return {
    text: `Your path is started for ${s.startTerm}. Choose your student type and level to see every step.`,
    action: { label: "Finish your path", href: pathLink() },
  };
}

export const VISIT_COPY = { text: "Your visit is on your path, along with the steps to take before it.", action: { label: "See your path", href: WORKBENCH_PATH } };

// The dismiss button says what it hides
export const HIDE_LABEL = { visible: "Hide this tip", hidden: ` about ${WORKBENCH_LABEL}` };
