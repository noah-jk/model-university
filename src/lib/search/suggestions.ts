// Common searches offered as pills in the search overlay
// (src/components/SearchOverlay.astro). Fixed, not personalized. Each is a
// plain link to /search/, and scripts/test-search.ts checks that each one
// finds results, even through keyword search.

export const SEARCH_SUGGESTIONS = [
  "How do I apply as an undergrad?",
  "What science programs do you offer?",
  "When are campus tours this month?",
  "What are financial aid deadlines?",
];

export const suggestionHref = (query: string) => `/search/?q=${encodeURIComponent(query)}`;
