// Handoffs on the page (src/components/workbench/PathHandoff.astro and
// ProgramPathHint.astro): fills in the plan's numbers, corrects the state
// BaseLayout guessed before paint, and handles "Hide this tip". Also the
// messages save.ts shows after a save: the first save anywhere, and what a
// program page's save means for the plan. Words are in src/lib/workbench/handoffs.ts.

import { announce } from "../enhance.ts";
import { rulesFrom, type Rules } from "../../lib/enrollment-rules.ts";
import { FIRST_SAVE, FIRST_SAVE_LINK, panelCopy, pathLink, PROGRAM_HINT, programSaved, type PanelId, type PathSummary } from "../../lib/workbench/handoffs.ts";
import { planSteps } from "../../lib/workbench/plan.ts";
import { workbench } from "../../lib/workbench/store.ts";
import { WORKBENCH_LABEL, WORKBENCH_PATH } from "../../lib/workbench/types.ts";
import { loadSession } from "../personalize.ts";
import { pathState, signalsFrom } from "./path-state.ts";

// Handoffs that show a date need the calendar (in /data/enrollment.json);
// only they download it, once, and the browser caches it
const NEEDS_DATES: PanelId[] = ["home", "tuition"];
let fullRules: ReturnType<typeof rulesFrom> | undefined;
let loadingRules: Promise<void> | undefined;

// The plan as handoffs see it: steps from the bundled steps alone, or with
// dates once the calendar has loaded
export function pathSummary(): PathSummary {
  const session = loadSession();
  const state = pathState(session);
  const { profile } = state;
  const summary: PathSummary = { ready: profile.ready, level: profile.level.value, studentType: profile.studentType.value, startTerm: profile.startTerm.value, steps: state.steps };
  if (fullRules && profile.ready) {
    const w = workbench.get();
    summary.steps = planSteps(fullRules, profile.level.value!, profile.studentType.value!, profile.startTerm.value, {
      completed: w.completed,
      journeyDone: signalsFrom(session).journeyDone,
      programDeadlines: [],
    });
  }
  return summary;
}

const panels = () => [...document.querySelectorAll<HTMLElement>("section[data-handoff]")];

function renderPanels(summary = pathSummary()) {
  for (const panel of panels()) {
    const id = panel.dataset.handoff as PanelId;
    const copy = panelCopy(id, summary);
    panel.dataset.state = summary.ready ? "continue" : "start";
    panel.querySelector("[data-handoff-heading]")!.textContent = copy.heading;
    panel.querySelector("[data-handoff-text]")!.textContent = copy.text;
    const action = panel.querySelector<HTMLAnchorElement>("[data-handoff-action]")!;
    action.textContent = copy.action.label;
    action.href = copy.action.href;
  }
  renderProgramHint(summary);
  // A date needs the calendar: load it once, then draw again
  if (summary.ready && !fullRules && !loadingRules && panels().some((p) => NEEDS_DATES.includes(p.dataset.handoff as PanelId) && !p.hidden)) {
    loadingRules = fetch("/data/enrollment.json")
      .then((res) => (res.ok ? (res.json() as Promise<Rules>) : Promise.reject()))
      .then((data) => {
        fullRules = rulesFrom(data);
        renderPanels();
      })
      .catch(() => {
        // Without the calendar the handoffs still work, just without dates
      });
  }
}

// Program pages ----------------------------------------------------------------------

const programHint = () => document.querySelector<HTMLElement>('[data-handoff="program"]');

function programMessage(hint: HTMLElement, summary: PathSummary) {
  return programSaved({ level: hint.dataset.programLevel!, startTerms: hint.dataset.startTerms!.split(" ") }, summary);
}

function renderProgramHint(summary: PathSummary) {
  const hint = programHint();
  // The first-save message stays until the page changes
  if (!hint || hint.dataset.firstSave !== undefined) return;
  const saved = workbench.has("program", hint.dataset.programRef!);
  hint.querySelector("[data-handoff-text]")!.textContent = saved ? programMessage(hint, summary) : PROGRAM_HINT;
}

// After a save (save.ts): the first save anywhere gets a short explanation
// once, under the button; a program page's save says what it means for the
// plan. Returns what to announce, or undefined for the usual message.
export function afterSave(button: HTMLElement, kind: string, ref: string) {
  const hint = programHint();
  const onThisProgram = kind === "program" && hint?.dataset.programRef === ref;
  if (!workbench.get().hiddenHandoffs.includes("first-save")) {
    workbench.hideHandoff("first-save");
    const line = onThisProgram && !hint!.hidden ? hint! : document.createElement("p");
    if (line === hint) line.dataset.firstSave = "";
    else {
      line.className = "first-save";
      button.insertAdjacentElement("afterend", line);
    }
    const target = line === hint ? hint.querySelector("[data-handoff-text]")! : line;
    target.textContent = `${FIRST_SAVE} `;
    const link = document.createElement("a");
    link.href = WORKBENCH_PATH;
    link.textContent = FIRST_SAVE_LINK;
    target.append(link);
    return FIRST_SAVE;
  }
  if (onThisProgram) return programMessage(hint!, pathSummary());
  return undefined;
}

// Hide this tip ------------------------------------------------------------------------

// Focus goes to the nearest heading before the handoff, so it isn't lost
function headingBefore(el: HTMLElement) {
  const headings = [...document.querySelectorAll<HTMLElement>("main h1, main h2, main h3")].filter(
    (h) => !el.contains(h) && h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
  );
  return headings.at(-1);
}

document.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-handoff-hide]");
  if (!button) return;
  const handoff = button.closest<HTMLElement>("[data-handoff]")!;
  const heading = headingBefore(handoff);
  workbench.hideHandoff(handoff.dataset.handoff!);
  handoff.hidden = true;
  if (heading) {
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus();
  }
  announce(`Tip hidden. ${WORKBENCH_LABEL} is still in the header.`);
});

// The admissions landing's picker: open Your Path with the answers filled in
document.addEventListener("submit", (event) => {
  const form = (event.target as Element).closest<HTMLFormElement>("[data-handoff-pick]");
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  location.href = pathLink({ type: String(data.get("type") || "") || undefined, level: String(data.get("level") || "") || undefined });
});

if (document.querySelector("[data-handoff]")) {
  renderPanels();
  window.addEventListener("workbench:change", () => renderPanels());
  window.addEventListener("personalization:change", () => renderPanels());
}
