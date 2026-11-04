// Words and filter data for career pages and the careers list (#61). No DOM
// code, so pages and tests share it. Career data and queries are in catalog.ts.

import { careers, departmentsForCareer, type Career } from "./catalog.ts";
import { EDUCATION_LEVELS } from "./vocab.ts";

// "Software engineer" → "software engineer" inside a sentence, but "RN" and "UX designer" keep their capitals
export const lower = (name: string) => (/^[A-Z][A-Z]/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));
// "+10%", "−5%", "0%": the sign is in the text, never only in color
export const growthText = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`;

// Where a value sits on the pay bar, which runs from the 10th to the 90th percentile
export const payPosition = (career: Career, value: number) => {
  const { p10, p90 } = career.wages.washington;
  return `${(((value - p10) / (p90 - p10)) * 100).toFixed(1)}%`;
};

// The careers list's filters. filter-list.ts matches an item when one of its
// comma-separated values equals the chosen option, so each career lists every
// option it meets: a career needing a bachelor's matches "Bachelor's degree"
// and every level above it.
export const WAGE_OPTIONS = [50000, 75000, 100000, 125000];
export const GROWTH_OPTIONS = [
  { value: "growing", label: "Growing", min: 1 },
  { value: "fast", label: "10% or more", min: 10 },
];
export function careerFilterData(career: Career) {
  const rank = EDUCATION_LEVELS.indexOf(career.education);
  const median = career.wages.washington.median;
  return {
    search: [career.name, career.title, ...career.titles, ...career.skills.map((s) => s.name), ...departmentsForCareer(career).map((d) => d.field), career.summary].join(" ").toLowerCase(),
    field: departmentsForCareer(career).map((d) => d.id).join(","),
    education: EDUCATION_LEVELS.slice(rank).join(","),
    wage: WAGE_OPTIONS.filter((w) => median >= w).join(","),
    growth: GROWTH_OPTIONS.filter((g) => career.growth_percent >= g.min).map((g) => g.value).join(","),
  };
}

// Careers that share a field with this one, most fields in common first
export function relatedCareers(career: Career, limit = 4) {
  return careers
    .filter((c) => c.id !== career.id)
    .map((c) => ({ c, shared: c.cips.filter((cip) => career.cips.includes(cip)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map(({ c }) => c);
}

// "Postings rose 14% over the year", from the first and last three months
export function postingsTrend(career: Career) {
  const sum = (list: { count: number }[]) => list.reduce((total, p) => total + p.count, 0);
  const first = sum(career.postings.slice(0, 3));
  const last = sum(career.postings.slice(-3));
  const change = Math.round(((last - first) / first) * 100);
  if (Math.abs(change) < 3) return "Job postings held steady over the year.";
  return `Job postings ${change > 0 ? "rose" : "fell"} ${Math.abs(change)}% over the year.`;
}

export const monthName = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", year: "numeric" });
