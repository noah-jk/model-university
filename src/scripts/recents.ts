// The Recents panel (src/components/Recents.astro): recently viewed pages and
// the next step in the application journey, from this tab's session. It's
// filled in when it opens, and re-filled if the session changes while open.

import { RECENT_COUNT, TYPE_LABELS } from "../lib/personalization-settings.ts";
import { loadSession, recentPages, type Session } from "./personalize.ts";
import { renderNext } from "./next-step.ts";

const panel = document.getElementById("recents")!;
const heading = panel.querySelector<HTMLElement>("#recents-title")!;
const toggles = [...document.querySelectorAll<HTMLButtonElement>("[data-recents-toggle]")];
let opener: HTMLElement | undefined;
const isOpen = () => !panel.hidden;

function renderRecent(session: Session) {
  const recent = recentPages(session, RECENT_COUNT);
  const rows = recent.map((view) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = view.url;
    a.textContent = view.name;
    const span = document.createElement("span");
    span.textContent = TYPE_LABELS[view.type];
    li.append(a, span);
    return li;
  });
  panel.querySelector(".recent-list")!.replaceChildren(...rows);
  panel.querySelector<HTMLElement>(".empty")!.hidden = recent.length > 0;
}

function render(session: Session) {
  renderRecent(session);
  renderNext(panel, session);
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

// A form sent, Reset session, or any other change: refresh. Wait until the
// current click is over: clicking the Apply tile changes the next step, and
// re-rendering right away would swap the tile's link before the browser
// follows it.
window.addEventListener("personalization:change", (e) => {
  if (isOpen()) setTimeout(() => render((e as CustomEvent<Session>).detail));
});
