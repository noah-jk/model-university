// The "Under the hood" panel (src/components/UnderTheHood.astro): opens from
// any [data-under-the-hood-toggle] button, shows the session's visit log and
// interest profile, lists what was personalized on this page, and resets.

import { PANEL_KEY, TYPE_LABELS } from "../lib/personalization-settings.ts";
import { loadSession, resetSession, storageAvailable, type Profile, type Session } from "./personalize.ts";

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
panel.querySelector(".uth-reset")!.addEventListener("click", () => resetSession());

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

function renderProfile(profile: Profile) {
  const groups = [
    ...barGroup("Departments", profile.department),
    ...barGroup("Colleges", profile.college),
    ...barGroup("Levels", profile.level),
    ...barGroup("Formats", profile.modality),
  ];
  panel.querySelector(".uth-bars")!.replaceChildren(...(groups.length ? groups : [el("p", "Nothing yet. Program, course, and faculty pages add to the profile.")]));
}

function renderChanges() {
  const changes = [...document.querySelectorAll<HTMLElement>("main [data-personalized]")].map((node) => node.dataset.personalized!);
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
  panel.querySelector(".uth-visits")!.replaceChildren(...(items.length ? items : [el("li", "No pages yet. Open a program, course, or faculty page to start.")]));
}

function render(session: Session) {
  const views = session.views.length;
  panel.querySelector(".uth-stat")!.textContent = storageAvailable
    ? `${views} ${views === 1 ? "page view" : "page views"} in this tab`
    : "Session storage isn't available in this browser, so nothing is tracked.";
  renderChanges();
  renderProfile(session.profile);
  renderVisits(session);
}

// Live updates: re-render while open, and announce one short summary
// instead of every row that changed.
window.addEventListener("personalization:change", (e) => {
  if (!isOpen()) return;
  const session = (e as CustomEvent<Session>).detail;
  render(session);
  live.textContent = session.views.length ? `Profile updated: ${session.views.length} views` : "Session reset: 0 views";
});
window.addEventListener("personalization:rendered", () => isOpen() && renderChanges());

// Opened on load (?demo, or left open on the last page): sync state without
// moving focus away from where the page put it.
if (isOpen()) setOpen(true, { focus: false });
