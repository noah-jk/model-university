// The home page's Discover band (#74): the careers its "Career" field
// suggests as people type, and the services its "I need help with" list
// offers. Shared by the page and its tests. No DOM code.

import { SERVICE_CATEGORIES } from "./vocab.ts";
import { pagePath } from "./urls.ts";

// What the page embeds for each career: just enough to match on
export type CareerOption = { id: string; name: string; titles: string[] };
// A suggestion; `via` is the job title that matched when the name didn't
export type CareerMatch = { id: string; name: string; via?: string };

export const careerOptions = (careers: { id: string; name: string; titles: string[] }[]): CareerOption[] =>
  careers.map(({ id, name, titles }) => ({ id, name, titles })).sort((a, b) => a.name.localeCompare(b.name));

const hasAll = (text: string, words: string[]) => words.every((w) => text.toLowerCase().includes(w));

// Careers whose name, or one of whose other job titles, has every word typed.
// Names that start with what was typed come first, then other name matches,
// then title matches, each in alphabetical order.
export function matchCareers(options: CareerOption[], query: string, limit = 8): CareerMatch[] {
  const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!words.length) return [];
  const start = query.trim().toLowerCase();
  const rank = (m: CareerMatch) => (m.via ? 2 : m.name.toLowerCase().startsWith(start) ? 0 : 1);
  return options
    .flatMap((c): CareerMatch[] => {
      if (hasAll(c.name, words)) return [{ id: c.id, name: c.name }];
      const via = c.titles.find((t) => hasAll(t, words));
      return via ? [{ id: c.id, name: c.name, via }] : [];
    })
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// Services by category, in the vocabulary's order, for the <select>'s <optgroup>s
export function serviceGroups(services: { id: string; name: string; category: string }[]) {
  return SERVICE_CATEGORIES.map((category) => ({
    category,
    services: services
      .filter((s) => s.category === category)
      .map((s) => ({ id: s.id, name: s.name, url: pagePath("services", s.id) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.services.length);
}
