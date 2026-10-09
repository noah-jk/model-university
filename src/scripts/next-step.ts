// The "Your next step" tile (src/components/NextStep.astro): the next step in
// the application journey, worded from this tab's session.

import { JOURNEY } from "../lib/personalization-settings.ts";
import { focusProgram, interestReason, markPersonalized, nextStep, preferred, type Session } from "./personalize.ts";

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

// Where the next step goes. Used by the tile below and the header button.
// Request information starts with the program in the person's top-interest
// department chosen (see focusProgram).
export function nextAction(session: Session) {
  const next = nextStep(session.profile);
  const program = focusProgram(session);
  const href = !next ? "/admissions/tuition-and-aid/" : next.step === "requestInfo" && program ? `${next.href}?program=${encodeURIComponent(program.id)}` : next.href;
  return { next, href, isApply: next?.step === "apply" };
}

// Why the next step is what it is, in a few words, for "What changed on this
// page". Undefined while it's still the default first step.
export function nextStepReason(session: Session) {
  const { next } = nextAction(session);
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
  const { next, href, isApply } = nextAction(session);
  const tile = root.querySelector<HTMLAnchorElement>(".next-tile")!;
  tile.href = href;
  tile.toggleAttribute("data-journey-apply", isApply);
  tile.querySelector(".title")!.textContent = next ? next.label : "Tuition and financial aid";
  tile.querySelector(".pitch")!.textContent = pitch(session);
  tile.querySelector(".count")!.textContent = next ? `Step ${JOURNEY.indexOf(next) + 1} of ${JOURNEY.length}` : "";
  tile.querySelectorAll<SVGElement>(".icon svg").forEach((icon) => icon.classList.toggle("shown", icon.dataset.icon === (next?.step ?? "done")));
  root.querySelector(".why")!.textContent = explain(session);
  const reason = nextStepReason(session);
  markPersonalized(tile, reason && `${where}: “${tile.querySelector(".title")!.textContent}”, because ${reason}.`);
}

