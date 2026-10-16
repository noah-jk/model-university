// The "Your next step" tile (src/components/NextStep.astro) and the header
// button: once Your Path has a plan (a level and student type), the plan's
// first step not done; before that, the next step in the application
// journey, worded from this tab's session.

import siteConfig from "../../site.config.ts";
import { JOURNEY } from "../lib/personalization-settings.ts";
import { describeStudents } from "../lib/workbench/profile.ts";
import { WORKBENCH_LABEL, WORKBENCH_PATH } from "../lib/workbench/types.ts";
import { focusProgram, interestReason, markPersonalized, nextStep, preferred, type Session } from "./personalize.ts";
import { pathState, stepHref, type PathState } from "./workbench/path-state.ts";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });

// Why this step is next, in terms of what the person has done
function explain(session: Session) {
  const { profile, forms, views } = session;
  const programViews = views.filter((v) => v.type === "program");
  const field = preferred(profile, "department");
  switch (nextStep(profile)?.step) {
    case "explore":
      return "Most students start by exploring programs. Viewing any program page completes this step.";
    case "requestInfo":
      return `You've looked at ${plural(programViews.length, "program")}${field ? `, mostly in ${field}` : ""}. Requesting information is the usual next step, and the form starts with ${focusProgram(session)!.name} chosen.`;
    case "visit":
      return `${forms.requestInfo ? `You requested information about ${forms.requestInfo.program?.name ?? `${forms.requestInfo.level} programs`}. ` : ""}Seeing campus in person is the usual next step before applying.`;
    case "apply":
      return `${forms.visit ? `Your visit is set for ${day(forms.visit.date)}. ` : ""}When you're ready, the next step is your application.`;
    default:
      return "You've done every step in this tab. Tuition and financial aid is a good place to go next.";
  }
}

// One line under the title, specific to what the person has done
function pitch(session: Session) {
  const { forms } = session;
  const program = focusProgram(session);
  switch (nextStep(session.profile)?.step) {
    case "explore":
      return "Find a program that fits you, from nursing to data science.";
    case "requestInfo":
      return `Get details about ${program?.name ?? "the programs you like"}: costs, deadlines, and what to expect.`;
    case "visit":
      return "Tour campus with a current student and meet an admissions counselor.";
    case "apply":
      return forms.visit ? `You're visiting on ${day(forms.visit.date)}. When you're ready, start your application.` : "You're ready. Start your application to Cascadia State.";
    default:
      return "You've done every step. Next, plan how to pay for it.";
  }
}

// What the next step is and where it goes, for the tile and the header
// button. Request information starts with the program in the person's
// top-interest department chosen (see focusProgram).
export type NextAction = {
  title: string;
  short: string; // for the header button
  href: string;
  isApply: boolean;
  icon: string; // which icon in NextStep.astro
  count: string; // "Step 2 of 9"
  pitch: string;
  why: string;
  reason?: string; // for "What changed on this page"
};

const withProgram = (href: string, session: Session) => {
  const program = focusProgram(session);
  return program ? `${href}?program=${encodeURIComponent(program.id)}` : href;
};

function fromPlan(state: PathState, session: Session): NextAction {
  const steps = state.steps!;
  const { level, studentType, startTerm } = state.profile;
  const who = `${describeStudents(level.value!, studentType.value!)} starting ${startTerm.value}`;
  const done = steps.length - state.toDo;
  const next = state.next;
  if (!next) {
    return { title: `See ${WORKBENCH_LABEL}`, short: WORKBENCH_LABEL, href: WORKBENCH_PATH, isApply: false, icon: "done", count: "", pitch: `You've done every step for ${startTerm.value}. ${WORKBENCH_LABEL} still has your dates.`, why: `You've done all ${steps.length} steps for ${who}.`, reason: `you've done every step on ${WORKBENCH_LABEL}` };
  }
  const { step } = next;
  const href = step.journey === "requestInfo" ? withProgram(stepHref(step), session) : stepHref(step);
  return {
    title: step.title,
    short: step.short ?? step.title,
    href,
    isApply: step.journey === "apply",
    icon: step.journey ?? "step",
    count: `Step ${steps.indexOf(next) + 1} of ${steps.length}`,
    pitch: step.description,
    why: `${WORKBENCH_LABEL} has ${steps.length} steps for ${who}. You've done ${done}, and this is the first one left.`,
    reason: `it's the first step not done on ${WORKBENCH_LABEL}, for ${who} (${done} of ${steps.length} done)`,
  };
}

function fromJourney(session: Session): NextAction {
  const next = nextStep(session.profile);
  const href = !next ? "/admissions/tuition-and-aid/" : next.step === "requestInfo" ? withProgram(next.href, session) : next.href;
  return {
    title: next ? next.label : "Tuition and financial aid",
    short: next ? next.label : "Tuition and aid",
    href,
    isApply: next?.step === "apply",
    icon: next?.step ?? "done",
    count: next ? `Step ${JOURNEY.indexOf(next) + 1} of ${JOURNEY.length}` : "",
    pitch: pitch(session),
    why: explain(session),
    reason: journeyReason(session),
  };
}

export function nextAction(session: Session): NextAction {
  const state = siteConfig.features.workbench ? pathState(session) : undefined;
  return state?.steps ? fromPlan(state, session) : fromJourney(session);
}

// Why the next step is what it is, in a few words, for "What changed on this
// page". Undefined while it's still the default first step.
export const nextStepReason = (session: Session) => nextAction(session).reason;

function journeyReason(session: Session) {
  const next = nextStep(session.profile);
  if (next?.step === "explore") return undefined;
  if (!next) return "you've done every step of the application journey";
  const done = Object.keys(session.profile.journey).length;
  const program = next.step === "requestInfo" ? focusProgram(session) : undefined;
  // Say why that program: it's in their top department, or it's simply the last one they viewed
  const inTopDepartment = program && "department" in program && program.department === preferred(session.profile, "department");
  const pick = program ? `, starting with ${program.name}, ${inTopDepartment ? interestReason(session, "department") : "the last program you viewed"}` : "";
  return `you've done ${plural(done, "step")} of the application journey and this is the next one${pick}`;
}

// Fill the next-step tile inside root (the Recents panel or the home page).
// `where` names it in the Under the hood panel's list of changes.
export function renderNext(root: ParentNode, session: Session, where = "Next-step tile") {
  const action = nextAction(session);
  const tile = root.querySelector<HTMLAnchorElement>(".next-tile")!;
  tile.href = action.href;
  tile.toggleAttribute("data-journey-apply", action.isApply);
  tile.querySelector(".title")!.textContent = action.title;
  tile.querySelector(".pitch")!.textContent = action.pitch;
  tile.querySelector(".count")!.textContent = action.count;
  tile.querySelectorAll<SVGElement>(".icon svg").forEach((icon) => icon.classList.toggle("shown", icon.dataset.icon === action.icon));
  root.querySelector(".why")!.textContent = action.why;
  markPersonalized(tile, action.reason && `${where}: “${action.title}”, because ${action.reason}.`);
}

