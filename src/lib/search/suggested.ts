// Prewritten AI summaries for the suggested searches (the pills in the search
// overlay, src/lib/search/suggestions.ts), from content/search/suggested-summaries.json.
// They show straight away, with no model call. Dates come from the catalog
// and the academic calendar when the page is built for a visitor, so they
// never go stale: a summary's text can hold a {slot}, filled in below, and an
// event source can name a series (the start of its ids), meaning the next ones.

import summariesData from "../../../content/search/suggested-summaries.json" with { type: "json" };
import siteConfig from "../../../site.config.ts";
import { events, hasEnded } from "../catalog.ts";
import { longDay } from "../dates.ts";
import { calendar } from "../enrollment.ts";
import { straightQuotes } from "../words.ts";
import { resultFor } from "./results.ts";
import type { Kind } from "./types.ts";

export type SuggestedSource = { kind: Kind; ref: string } | { kind: "event"; series: string; count?: number };
export type SuggestedSummary = { query: string; text: string; sources: SuggestedSource[] };
export const suggestedSummaries = summariesData as SuggestedSummary[];

// "How do I apply as an undergrad?" and "how do i apply as an undergrad ?" are the same search
const key = (query: string) => straightQuotes(query).toLowerCase().replace(/\s+/g, " ").replace(/\s+\?$/, "?").trim();

const campusDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: siteConfig.timezone });
const eventDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: siteConfig.timezone, weekday: "long", month: "long", day: "numeric" });
// The next events in a series, soonest first
const nextInSeries = (series: string, count: number, now: Date) =>
  events
    .filter((e) => e.id.startsWith(`${series}-`) && !hasEnded(e, now))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, count);

// Each slot is a whole sentence, so the text reads right whatever the dates are
export const SLOTS: Record<string, (now: Date) => string> = {
  tours: (now) => {
    const next = nextInSeries("campus-tour", 2, now);
    if (!next.length) return "There are no campus tours on the calendar right now.";
    const month = (iso: string) => campusDay(iso).slice(0, 7);
    const lead = next.every((e) => month(e.start) === month(now.toISOString())) ? "This month's campus tours are on" : "The next campus tours are on";
    return `${lead} ${next.map((e) => `${eventDay(e.start)} (${e.campus})`).join(" and ")}.`;
  },
  fafsa: (now) => {
    const today = campusDay(now.toISOString());
    const next = calendar.filter((e) => e.key === "fafsa-priority" && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    return next
      ? `File the FAFSA or WASFA by ${longDay(next.date).replace(/^\w+, /, "")} to be considered for the most grants and scholarships.`
      : "The priority date has passed, but file the FAFSA or WASFA as soon as you can: aid is still available.";
  },
  fafsa_help: (now) => {
    const [night] = nextInSeries("fafsa-and-wasfa-completion-night", 1, now);
    return night ? `Financial Aid & Scholarships can help you file, including at FAFSA and WASFA Completion Night on ${eventDay(night.start)}.` : "Financial Aid & Scholarships can help you file.";
  },
};

export const fillSlots = (text: string, now: Date) => text.replace(/\{(\w+)\}/g, (_, slot: string) => SLOTS[slot](now));

// The summary for a suggested search, with its sources as live titles and
// links, or undefined for any other search
export function suggestedSummary(query: string, base: string, now = new Date()) {
  const summary = suggestedSummaries.find((s) => key(s.query) === key(query));
  if (!summary) return undefined;
  const refs = summary.sources.flatMap((s) => ("series" in s ? nextInSeries(s.series, s.count ?? 1, now).map((e) => ({ kind: "event" as Kind, ref: e.id })) : [s]));
  const sources = refs.flatMap(({ kind, ref }) => {
    const result = resultFor(kind, ref, base, now);
    return result ? [{ title: result.title, url: result.url }] : [];
  });
  return { text: fillSlots(summary.text, now), sources };
}
