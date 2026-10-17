// The "Under the hood" panel (src/components/UnderTheHood.astro): opens from
// any [data-under-the-hood-toggle] button, shows the session's visit log and
// interest profile, lists what was personalized on this page, and resets.

import siteConfig from "../../site.config.ts";
import { JOURNEY, PANEL_KEY, TYPE_LABELS } from "../lib/personalization-settings.ts";
import { loadSession, nextStep, resetSession, SAVED_WEIGHT, storageAvailable, type Profile, type Session } from "./personalize.ts";
import { workbench } from "../lib/workbench/store.ts";
import { STORAGE_KEY as WORKBENCH_KEY, WORKBENCH_LABEL } from "../lib/workbench/types.ts";
import type { Field } from "../lib/workbench/profile.ts";
import { pathState } from "./workbench/path-state.ts";

const html = document.documentElement;
const panel = document.getElementById("under-the-hood")!;
const heading = panel.querySelector<HTMLElement>("#uth-title")!;
const live = panel.querySelector<HTMLElement>(".uth-live")!;
const toggles = [...document.querySelectorAll<HTMLButtonElement>("[data-under-the-hood-toggle]")];
let opener: HTMLElement | undefined;

const isOpen = () => html.dataset.underTheHood === "open";

function setOpen(open: boolean, { focus = true } = {}) {
  if (open) html.dataset.underTheHood = "open";
  else delete html.dataset.underTheHood;
  try {
    if (open) sessionStorage.setItem(PANEL_KEY, "open");
    else sessionStorage.removeItem(PANEL_KEY);
  } catch {
    // Without storage the panel just won't stay open across pages
  }
  toggles.forEach((t) => t.setAttribute("aria-expanded", String(open)));
  if (open) {
    render(loadSession());
    panel.classList.add("opening");
    if (focus) heading.focus();
  } else if (focus) {
    (opener ?? toggles[0])?.focus();
  }
}

toggles.forEach((toggle) => {
  toggle.setAttribute("aria-controls", panel.id);
  toggle.addEventListener("click", () => {
    opener = toggle;
    setOpen(!isOpen());
  });
});
panel.querySelector(".uth-close")!.addEventListener("click", () => setOpen(false));
panel.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setOpen(false);
});
panel.addEventListener("animationend", () => panel.classList.remove("opening"));
// Resets this tab's session and, with Your Path on, its plan (saved items stay)
panel.querySelector(".uth-reset")!.addEventListener("click", () => {
  if (siteConfig.features.workbench) workbench.resetPlan();
  resetSession();
});

// Rendering -------------------------------------------------------------------

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

function barGroup(title: string, counts: Record<string, number>, limit = 5) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
  if (!entries.length) return [];
  const max = entries[0][1];
  const list = el("ul");
  for (const [label, count] of entries) {
    const li = el("li");
    const bar = el("span", undefined, "bar");
    bar.setAttribute("aria-hidden", "true");
    const fill = el("span");
    fill.style.setProperty("--share", `${Math.round((count / max) * 100)}%`);
    bar.append(fill);
    const value = el("span", String(count), "count");
    value.append(el("span", count === 1 ? " view" : " views", "visually-hidden"));
    li.append(el("span", label, "label"), value, bar);
    list.append(li);
  }
  return [el("h4", title), list];
}

const shortDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function renderJourney(profile: Profile) {
  const next = nextStep(profile)?.step;
  const items = JOURNEY.map(({ step, label }) => {
    const done = profile.journey[step];
    const li = el("li", label);
    li.append(el("span", done ? ` — done ${shortDate(done)}` : step === next ? " — next" : " — not yet", "state"));
    if (step === next) li.setAttribute("aria-current", "step");
    return li;
  });
  panel.querySelector(".uth-steps")!.replaceChildren(...items);
}

// Everything the forms stored, as label and value pairs
function renderAnswers(profile: Profile) {
  const { stated, contact } = profile;
  const rows: [string, string | undefined][] = [
    ["Name", [contact.firstName, contact.lastName].filter(Boolean).join(" ") || undefined],
    ["Email", contact.email],
    ["Phone", contact.phone],
    ["Degree level", stated.level],
    ["Student type", stated.studentType],
    ["Program", stated.program],
    ["Start term", stated.startTerm],
    ["Visit date", stated.visitDate && shortDate(stated.visitDate)],
    ["Guests", stated.guests === undefined ? undefined : String(stated.guests)],
  ];
  const filled = rows.filter(([, value]) => value);
  const container = panel.querySelector(".uth-answers")!;
  if (!filled.length) {
    container.replaceChildren(el("p", "Nothing yet. The request-info and visit forms save their answers here."));
    return;
  }
  const list = el("dl");
  list.append(...filled.flatMap(([label, value]) => [el("dt", label), el("dd", value)]));
  container.replaceChildren(list);
}

function renderProfile(profile: Profile) {
  const groups = [
    ...barGroup("Departments", profile.department),
    ...barGroup("Colleges", profile.college),
    ...barGroup("Levels", profile.level),
    ...barGroup("Formats", profile.modality),
  ];
  // Form answers win over page views, however many views there are
  if (groups.length && profile.stated.program) {
    groups.push(el("p", `You chose ${profile.stated.program} in the request-info form, so ${profile.stated.college} is your preferred college, whatever the page-view counts say.`));
  }
  panel.querySelector(".uth-bars")!.replaceChildren(...(groups.length ? groups : [el("p", "Nothing yet. Program, course, and faculty pages add to the profile.")]));
}

// Everything marked with data-personalized anywhere on the page (header,
// main content, Recents), as long as it's showing. Scripts mark elements with
// markPersonalized() in personalize.ts, which fires "personalized".
const showing = (node: HTMLElement) => (node.checkVisibility ? node.checkVisibility() : !node.closest("[hidden]"));

function renderChanges() {
  const marked = [...document.querySelectorAll<HTMLElement>("[data-personalized]")].filter((node) => !panel.contains(node) && showing(node));
  const changes = [...new Set(marked.map((node) => node.dataset.personalized!))];
  if (document.querySelector("main[data-page-type]")) changes.push("This page was added to your visit log.");
  const list = panel.querySelector(".uth-changes")!;
  list.replaceChildren(...(changes.length ? changes : ["Nothing on this page is personalized."]).map((text) => el("li", text)));
}

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function renderVisits(session: Session) {
  const items = [...session.views].reverse().map((view) => {
    const li = el("li");
    const time = el("time", timeFormat.format(new Date(view.at)));
    time.setAttribute("datetime", view.at);
    const what = el("div");
    const link = el("a", view.name);
    link.href = view.url;
    what.append(link, el("span", TYPE_LABELS[view.type], "type"));
    li.append(time, what);
    return li;
  });
  panel.querySelector(".uth-visits")!.replaceChildren(...(items.length ? items : [el("li", "No pages yet. Open a program, course, or faculty page to start.", "empty")]));
}

// The workbench is kept differently: in localStorage, so it outlasts the tab
function renderWorkbench(profile: Profile) {
  const target = panel.querySelector(".uth-workbench");
  if (!target) return;
  const count = workbench.get().items.length;
  let bytes = 0;
  try {
    bytes = new Blob([localStorage.getItem(WORKBENCH_KEY) ?? ""]).size;
  } catch {}
  const size = bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`;
  target.textContent = `${count} ${count === 1 ? "item" : "items"}, using ${size}. Unlike this session's profile, it's kept in localStorage, so it stays after the tab closes, until you remove it.${
    profile.saved ? ` Each saved item counts as much as ${SAVED_WEIGHT} page views in the interest profile.` : ""
  }`;
}

// Who Your Path thinks the student is, and where each answer came from:
// chosen on the Your Path page (stored), or suggested from this tab (worked
// out fresh on every page, never stored)
function renderPlan(session: Session) {
  const target = panel.querySelector(".uth-plan");
  if (!target) return;
  const { profile, steps, toDo } = pathState(session);
  const w = workbench.get();
  const tips = w.hiddenHandoffs.filter((id) => id !== "first-save").length;
  const source = (field: Field) => (field.source === "chosen" ? "you chose it" : field.why ? `suggested: ${field.why}` : "suggested");
  const value = (field: Field & { mixed?: boolean }) => (field.value ? `${field.value} (${source(field)})` : field.mixed ? `Not set: ${field.why}` : "Not set");
  const list = el("dl");
  list.append(
    ...([
      ["Student type", value(profile.studentType)],
      ["Level", value(profile.level)],
      ["Start term", value(profile.startTerm)],
      ["Steps", steps ? `${steps.length - toDo} of ${steps.length} done` : "No plan until level and student type are known"],
      ["Kept in localStorage", `${w.completed.length} completed ${w.completed.length === 1 ? "step" : "steps"}, ${w.dismissed.length} dismissed ${w.dismissed.length === 1 ? "item" : "items"}, ${tips} hidden ${tips === 1 ? "tip" : "tips"}${w.visit ? ", and your visit date" : ""}`],
    ] as const).flatMap(([label, text]) => [el("dt", label), el("dd", text)])
  );
  target.replaceChildren(list);
}

function render(session: Session) {
  const views = session.views.length;
  panel.querySelector(".uth-stat")!.textContent = storageAvailable
    ? `${views} ${views === 1 ? "page view" : "page views"} in this tab`
    : "Session storage isn't available in this browser, so nothing is tracked.";
  renderChanges();
  renderJourney(session.profile);
  renderProfile(session.profile);
  renderAnswers(session.profile);
  renderVisits(session);
  renderWorkbench(session.profile);
  renderPlan(session);
}

// Live updates: re-render while open, and announce one short summary
// instead of every row that changed.
window.addEventListener("personalization:change", (e) => {
  if (!isOpen()) return;
  const session = (e as CustomEvent<Session>).detail;
  render(session);
  live.textContent = session.views.length
    ? `Profile updated: ${session.views.length} views`
    : siteConfig.features.workbench
      ? `Session and plan reset. Your saved items are still on ${WORKBENCH_LABEL}.`
      : "Session reset: 0 views";
});
window.addEventListener("personalized", () => isOpen() && renderChanges());
window.addEventListener("workbench:change", () => isOpen() && renderPlan(loadSession()));

// Opened on load (?demo, or left open on the last page): sync state without
// moving focus away from where the page put it.
if (isOpen()) setOpen(true, { focus: false });
