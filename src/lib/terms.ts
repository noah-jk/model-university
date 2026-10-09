// Start terms people can choose from, worked out when the site is built:
// the next five terms, e.g. "Winter 2027".

const termStarts: [term: string, month: number][] = [
  ["Winter", 0],
  ["Spring", 3],
  ["Summer", 5],
  ["Fall", 8],
];

export function upcomingTerms(count = 5, from = new Date()) {
  const terms: string[] = [];
  for (let year = from.getFullYear(); terms.length < count; year++) {
    for (const [term, month] of termStarts) {
      if (new Date(year, month, 1) > from && terms.length < count) terms.push(`${term} ${year}`);
    }
  }
  return terms;
}

// "2026-10-10": the day after `from`, for a date picker's earliest choice
export const tomorrow = (from = new Date()) => new Date(from.getTime() + 86_400_000).toISOString().slice(0, 10);
