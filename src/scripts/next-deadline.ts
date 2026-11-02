// A program page's next application deadline, as of today rather than the
// day the page was built (see src/components/programs/ProgramHero.astro).
// The text keeps its place, so nothing moves.

import siteConfig from "../../site.config.ts";

const today = new Date().toLocaleDateString("en-CA", { timeZone: siteConfig.timezone });
for (const el of document.querySelectorAll<HTMLElement>("[data-next-deadline]")) {
  const deadlines = JSON.parse(el.dataset.nextDeadline!) as { date: string; text: string }[];
  const next = deadlines.find((d) => d.date >= today);
  if (next) el.textContent = next.text;
}
