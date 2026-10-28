// Word handling for keyword search, shared by the catalog's search functions
// and on-site search's keyword fallback.

// Words that say nothing about what someone is looking for: "what science
// programs do you offer?" is a search for "science".
// Curly quotes and apostrophes (which phones type) as straight ones, so
// "master’s" matches like "master's"
export const straightQuotes = (text: string) => text.replace(/[\u2018\u2019\u02bc\u2032]/g, "'").replace(/[\u201c\u201d\u2033]/g, '"');

export const STOP_WORDS = new Set(
  ("a about an and any anything are at available be can choices did do does find for from get has have how i in is it kind kinds me my of offer offered " +
    "offering offers on options or our provide provided provides show some something that the there to type types us we what when where which who with you your")
    .split(" ")
);

// A rough stem, so "parents" finds "parent" and "nursing" finds "nurse":
// matching checks whether a field contains the stem.
export function stem(word: string) {
  if (word.length <= 4) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ing") && word.length > 6) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 5) return word.slice(0, -2);
  if (/[^su]s$/.test(word)) return word.slice(0, -1);
  return word;
}
