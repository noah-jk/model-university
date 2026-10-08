// Fills "Recommended for you" in the For you section (src/components/ForYou.astro).
// The inline script there has already shown the section and filled
// "Recently viewed"; this runs after the page loads.

import { RECOMMEND_AFTER } from "../lib/personalization-settings.ts";
import { PROGRAM_LEVELS } from "../lib/vocab.ts";
import { loadSession, top, type Session } from "./personalize.ts";

type ProgramSummary = { id: string; name: string; url: string; department: string; college: string; level: string; modality: string };

const section = document.querySelector<HTMLElement>(".for-you");
const recommended = section?.querySelector<HTMLElement>(".recommended");

let programs: Promise<ProgramSummary[]> | undefined;
const loadPrograms = () => (programs ??= fetch("/personalization/programs.json").then((r) => r.json()));

// Programs matching the person's top department, program level, and format,
// skipping programs they've already viewed.
export function pickPrograms(session: Session, all: ProgramSummary[]) {
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

async function renderRecommendations() {
  if (!recommended) return;
  const session = loadSession();
  if (session.views.length < RECOMMEND_AFTER) return; // the inline script showed a "view more pages" message
  const list = recommended.querySelector<HTMLUListElement>(".recommended-list")!;
  const message = recommended.querySelector<HTMLElement>(".message")!;
  const why = recommended.querySelector<HTMLElement>(".why")!;
  const signals = pickPrograms(session, await loadPrograms());

  why.textContent = explain(session, signals);
  if (!signals.picks.length) {
    list.hidden = true;
    message.textContent = "Nothing to go on yet: the pages you've viewed don't point to a field of study. Try a few program or course pages.";
    recommended.dataset.personalized = "Recommended for you: no programs matched your views yet.";
  } else {
    list.hidden = false;
    message.textContent = "";
    // Fill the reserved rows in place, so nothing moves
    signals.picks.forEach((p, i) => {
      const li = list.children[i] as HTMLLIElement;
      const a = document.createElement("a");
      a.href = p.url;
      a.textContent = p.name;
      const meta = document.createElement("span");
      meta.textContent = `${p.level}, ${p.modality.toLowerCase()}`;
      li.replaceChildren(a, meta);
    });
    const basis = signals.department ? signals.department[0] : "your most-viewed level and format";
    recommended.dataset.personalized = `Recommended for you: ${signals.picks.length} programs picked for ${basis}.`;
  }
  window.dispatchEvent(new Event("personalization:rendered"));
}

if (section) {
  renderRecommendations();
  // After "Reset session" in the Under the hood panel, hide personal content
  window.addEventListener("personalization:change", (e) => {
    if ((e as CustomEvent<Session>).detail.views.length === 0) {
      section.hidden = true;
      section.querySelectorAll("[data-personalized]").forEach((el) => el.removeAttribute("data-personalized"));
      window.dispatchEvent(new Event("personalization:rendered"));
    }
  });
}
