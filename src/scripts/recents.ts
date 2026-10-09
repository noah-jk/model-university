// The Recents panel (src/components/Recents.astro): recently viewed pages and
// recommended programs from this tab's session. It's filled in when it opens,
// and re-filled if the session changes while it's open.

import { RECENT_COUNT, RECOMMEND_AFTER, TYPE_LABELS } from "../lib/personalization-settings.ts";
import { PROGRAM_LEVELS } from "../lib/vocab.ts";
import { loadSession, recentPages, top, type Session } from "./personalize.ts";

type ProgramSummary = { id: string; name: string; url: string; department: string; college: string; level: string; modality: string };

const panel = document.getElementById("recents")!;
const heading = panel.querySelector<HTMLElement>("#recents-title")!;
const recommended = panel.querySelector<HTMLElement>(".recommended")!;
const toggles = [...document.querySelectorAll<HTMLButtonElement>("[data-recents-toggle]")];
let opener: HTMLElement | undefined;
const isOpen = () => !panel.hidden;

let programs: Promise<ProgramSummary[]> | undefined;
const loadPrograms = () => (programs ??= fetch("/personalization/programs.json").then((r) => r.json()));

// Programs matching the person's top department, program level, and format,
// skipping programs they've already viewed.
function pickPrograms(session: Session, all: ProgramSummary[]) {
  const { profile } = session;
  const levels = Object.fromEntries(Object.entries(profile.level).filter(([level]) => (PROGRAM_LEVELS as readonly string[]).includes(level)));
  const department = top(profile.department);
  const level = top(levels);
  const modality = top(profile.modality);
  const viewed = new Set(session.views.filter((v) => v.type === "program").map((v) => v.id));
  const score = (p: ProgramSummary) =>
    // Department outweighs level and format together
    (p.department === department?.[0] ? 4 : 0) + (p.level === level?.[0] ? 2 : 0) + (p.modality === modality?.[0] ? 1 : 0);
  const picks = all
    .filter((p) => !viewed.has(p.id) && score(p) > 0)
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, 3);
  return { picks, department, level, modality };
}

function explain(session: Session, signals: ReturnType<typeof pickPrograms>) {
  const { department, level, modality } = signals;
  const total = session.profile.views;
  const parts: string[] = [];
  if (department) parts.push(`${department[1]} of your ${total} views were ${department[0]} pages.`);
  const alsoMatching = [level && `${level[0]} programs`, modality && `${modality[0].toLowerCase()} formats`].filter(Boolean);
  if (alsoMatching.length) parts.push(`These programs also match what you've looked at most: ${alsoMatching.join(" and ")}.`);
  parts.push("Programs you've already viewed are left out.");
  return parts.join(" ");
}

// A row: a link with a short description under it
function row(href: string, text: string, meta: string) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = href;
  a.textContent = text;
  const span = document.createElement("span");
  span.textContent = meta;
  li.append(a, span);
  return li;
}

function renderRecent(session: Session) {
  const recent = recentPages(session, RECENT_COUNT);
  panel.querySelector(".recent-list")!.replaceChildren(...recent.map((view) => row(view.url, view.name, TYPE_LABELS[view.type])));
  panel.querySelector<HTMLElement>(".empty")!.hidden = recent.length > 0;
}

// Recommendations show only when there are some; otherwise the whole
// "Recommended for you" half stays hidden.
async function renderRecommended(session: Session) {
  if (session.views.length < RECOMMEND_AFTER) {
    recommended.hidden = true;
    return;
  }
  const signals = pickPrograms(session, await loadPrograms());
  recommended.hidden = signals.picks.length === 0;
  if (recommended.hidden) return;
  panel.querySelector(".recommended-list")!.replaceChildren(...signals.picks.map((p) => row(p.url, p.name, `${p.level}, ${p.modality.toLowerCase()}`)));
  panel.querySelector(".why")!.textContent = explain(session, signals);
}

function render(session: Session) {
  renderRecent(session);
  renderRecommended(session);
}

function setOpen(open: boolean) {
  panel.hidden = !open;
  toggles.forEach((t) => t.setAttribute("aria-expanded", String(open)));
  if (open) {
    render(loadSession());
    heading.focus();
  } else {
    (opener ?? toggles.find((t) => t.offsetParent !== null))?.focus();
  }
}

toggles.forEach((toggle) => {
  toggle.setAttribute("aria-controls", panel.id);
  toggle.addEventListener("click", () => {
    opener = toggle;
    setOpen(!isOpen());
  });
});
panel.querySelector(".close")!.addEventListener("click", () => setOpen(false));
panel.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  e.stopPropagation(); // the header would otherwise also close its mobile menu
  setOpen(false);
});

// Reset session (in the Under the hood panel) or any other change: refresh
window.addEventListener("personalization:change", (e) => {
  if (isOpen()) render((e as CustomEvent<Session>).detail);
});
