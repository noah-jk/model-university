// The "For me" panel (src/components/Recents.astro): recently or most viewed pages and
// the next step in the application journey, from this tab's session. It's
// filled in when it opens, and re-filled if the session changes while open.

import { RECENT_COUNT, TYPE_LABELS } from "../lib/personalization-settings.ts";
import { loadSession, mostViewedPages, recentPages, type Session } from "./personalize.ts";
import { renderNext } from "./next-step.ts";

const panel = document.getElementById("recents")!;
const heading = panel.querySelector<HTMLElement>("#recents-title")!;
const toggles = [...document.querySelectorAll<HTMLButtonElement>("[data-recents-toggle]")];
let opener: HTMLElement | undefined;
const isOpen = () => !panel.hidden;

// The pages list is either the last pages opened or the ones opened most. The
// choice is kept for this tab.
type Sort = "recent" | "most";
const SORT_KEY = "cascadia:recents-sort";
let sort: Sort = "recent";
try {
  if (sessionStorage.getItem(SORT_KEY) === "most") sort = "most";
} catch {}
const sortButtons = [...panel.querySelectorAll<HTMLButtonElement>("[data-sort]")];

const WHY: Record<Sort, string> = {
  recent: "These are the last pages you opened in this tab. They're kept in your browser's session storage, never sent to us, and cleared when you close the tab.",
  most: "These are the pages you've opened most often in this tab, counted from the same page log in your browser's session storage. Pages opened the same number of times are ordered by which you opened last.",
};

function renderRecent(session: Session) {
  const pages =
    sort === "most"
      ? mostViewedPages(session, RECENT_COUNT)
      : recentPages(session, RECENT_COUNT).map((view) => ({ view, views: 0 }));
  const rows = pages.map(({ view, views }) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = view.url;
    a.textContent = view.name;
    const span = document.createElement("span");
    span.textContent = sort === "most" ? `${TYPE_LABELS[view.type]} · ${views} ${views === 1 ? "view" : "views"}` : TYPE_LABELS[view.type];
    li.append(a, span);
    return li;
  });
  panel.querySelector(".recent-list")!.replaceChildren(...rows);
  panel.querySelector<HTMLElement>(".empty")!.hidden = pages.length > 0;
  panel.querySelector(".recent-why")!.textContent = WHY[sort];
  sortButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sort === sort)));
}

sortButtons.forEach((button) =>
  button.addEventListener("click", () => {
    sort = button.dataset.sort as Sort;
    try {
      sessionStorage.setItem(SORT_KEY, sort);
    } catch {}
    renderRecent(loadSession());
  }),
);

function render(session: Session) {
  renderRecent(session);
  renderNext(panel, session, "Next-step tile in For me");
}

function setOpen(open: boolean) {
  panel.hidden = !open;
  toggles.forEach((t) => t.setAttribute("aria-expanded", String(open)));
  if (open) {
    render(loadSession());
    heading.focus();
  } else {
    (opener ?? toggles.find((t) => t.offsetParent !== null))?.focus();
    // Its tile is no longer on screen, so it drops out of "What changed on this page"
    window.dispatchEvent(new Event("personalized"));
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

// A form sent, Reset session, or any other change: refresh. Wait until the
// current click is over: clicking the Apply tile changes the next step, and
// re-rendering right away would swap the tile's link before the browser
// follows it.
window.addEventListener("personalization:change", (e) => {
  if (isOpen()) setTimeout(() => render((e as CustomEvent<Session>).detail));
});
