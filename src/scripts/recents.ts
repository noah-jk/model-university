// The Recents panel (src/components/Recents.astro): recently viewed pages and
// the next step in the application journey, from this tab's session. It's
// filled in when it opens, and re-filled if the session changes while open.

import { JOURNEY, RECENT_COUNT, TYPE_LABELS } from "../lib/personalization-settings.ts";
import { loadSession, nextStep, recentPages, top, type Session } from "./personalize.ts";

const panel = document.getElementById("recents")!;
const heading = panel.querySelector<HTMLElement>("#recents-title")!;
const toggles = [...document.querySelectorAll<HTMLButtonElement>("[data-recents-toggle]")];
let opener: HTMLElement | undefined;
const isOpen = () => !panel.hidden;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });

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

// Why this step is next, in terms of what the person has done
function explain(session: Session) {
  const { profile, forms, views } = session;
  const programViews = views.filter((v) => v.type === "program");
  const field = top(profile.department)?.[0];
  switch (nextStep(profile)?.step) {
    case "explore":
      return "Most students start by exploring programs. Viewing any program page completes this step.";
    case "requestInfo":
      return `You've looked at ${plural(programViews.length, "program")}${field ? `, mostly in ${field}` : ""}. Requesting information is the usual next step, and the form starts with ${programViews.at(-1)!.name} chosen.`;
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
  const { forms, views } = session;
  const lastProgram = views.filter((v) => v.type === "program").at(-1);
  switch (nextStep(session.profile)?.step) {
    case "explore":
      return "Find a program that fits you, from nursing to data science.";
    case "requestInfo":
      return `Get details about ${lastProgram?.name ?? "the programs you like"}: costs, deadlines, and what to expect.`;
    case "visit":
      return "Tour campus with a current student and meet an admissions counselor.";
    case "apply":
      return forms.visit ? `You're visiting on ${day(forms.visit.date)}. When you're ready, start your application.` : "You're ready. Start your application to Cascadia State.";
    default:
      return "You've done every step. Next, plan how to pay for it.";
  }
}

function renderNext(session: Session) {
  const next = nextStep(session.profile);
  const lastProgram = session.views.filter((v) => v.type === "program").at(-1);
  const tile = panel.querySelector<HTMLAnchorElement>(".next-tile")!;
  tile.href = !next ? "/admissions/tuition-and-aid/" : next.step === "requestInfo" && lastProgram ? `${next.href}?program=${encodeURIComponent(lastProgram.id)}` : next.href;
  tile.toggleAttribute("data-journey-apply", next?.step === "apply");
  tile.querySelector(".title")!.textContent = next ? next.label : "Tuition and financial aid";
  tile.querySelector(".pitch")!.textContent = pitch(session);
  tile.querySelector(".count")!.textContent = next ? `Step ${JOURNEY.indexOf(next) + 1} of ${JOURNEY.length}` : "";
  tile.querySelectorAll<SVGElement>(".icon svg").forEach((icon) => icon.classList.toggle("shown", icon.dataset.icon === (next?.step ?? "done")));
  panel.querySelector(".why")!.textContent = explain(session);
}

function render(session: Session) {
  renderRecent(session);
  renderNext(session);
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
