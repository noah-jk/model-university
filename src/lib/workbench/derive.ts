// Views the site works out from a workbench and the catalog index: the
// program comparison, the deadline timeline, key facts for each item, and
// what changed since an item was saved. No DOM code, so phase 2 (AI
// suggestions) and the MCP server can use these too.

import siteConfig from "../../../site.config.ts";
import { upcomingTerms } from "../terms.ts";
import { usd } from "../format.ts";
import { WATCHED, WATCHED_LABELS, type ContentKind, type IndexProgram, type Workbench, type WorkbenchIndex, type WorkbenchItem } from "./types.ts";

type Entry = WorkbenchIndex[ContentKind][string];
export const lookup = (index: WorkbenchIndex, item: WorkbenchItem): Entry | undefined =>
  item.ref && item.kind in index ? index[item.kind as ContentKind][item.ref] : undefined;

// Change detection -----------------------------------------------------------

// A short, stable hash of a value, so the workbench stores fingerprints
// rather than copies of catalog data
function hash(value: unknown) {
  const text = JSON.stringify(value);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function fingerprint(kind: ContentKind, entry: Entry | Record<string, unknown>): Record<string, string> | undefined {
  const fields = WATCHED[kind];
  if (!fields) return undefined;
  return Object.fromEntries(fields.map((f) => [f, hash((entry as Record<string, unknown>)[f])]));
}

// Labels of watched fields that differ from when the item was saved, e.g. ["tuition"]
export function changesSinceSaved(item: WorkbenchItem, entry: Entry): string[] {
  if (!item.watch) return [];
  const now = fingerprint(item.kind as ContentKind, entry);
  if (!now) return [];
  return Object.keys(item.watch)
    .filter((field) => field in now && now[field] !== item.watch![field])
    .map((field) => WATCHED_LABELS[field] ?? field);
}

// Terms and dates -------------------------------------------------------------

const TERM_START_MONTH: Record<string, number> = { Winter: 0, Spring: 3, Summer: 5, Fall: 8 };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export const termName = (startTerm: string) => startTerm.split(" ")[0];

// "Fall 2027" → "2027-09-01"
export function termStart(startTerm: string) {
  const [name, year] = startTerm.split(" ");
  const month = TERM_START_MONTH[name];
  if (month === undefined || !/^\d{4}$/.test(year)) return undefined;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

// The date of a deadline like "March 1" for a start term: the last time that
// day comes round before the term starts. "October 15" for Winter 2027 is
// 2026-10-15; "March 1" for Fall 2027 is 2027-03-01.
export function deadlineDate(deadline: string, startTerm: string) {
  const start = termStart(startTerm);
  const [monthName, day] = deadline.trim().toLowerCase().split(/\s+/);
  const month = MONTHS.indexOf(monthName);
  if (!start || month < 0 || !/^\d{1,2}$/.test(day)) return undefined;
  let year = Number(start.slice(0, 4));
  const iso = (y: number) => `${y}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (iso(year) >= start) year -= 1;
  return iso(year);
}

// The start term to use: the one chosen on the workbench, else the one from
// the request-info form, else the next term to start
export function startTermFor(workbench: Workbench, requestInfoTerm?: string, now = new Date()) {
  return workbench.startTerm ?? (requestInfoTerm && termStart(requestInfoTerm) ? requestInfoTerm : upcomingTerms(1, now)[0]);
}

// Terms to choose from: the next five, plus the chosen one if it has passed
export function termOptions(chosen: string | undefined, now = new Date()) {
  const terms = upcomingTerms(5, now);
  return chosen && !terms.includes(chosen) ? [chosen, ...terms] : terms;
}

// Compare ---------------------------------------------------------------------

export const MAX_COMPARE = 4;

type Cell = { text: string; notOffered?: boolean };
export type CompareTable = {
  programs: { id: string; name: string; url: string }[];
  rows: { label: string; cells: Cell[] }[];
};

export function deadlineFor(program: IndexProgram, startTerm: string): Cell {
  const term = termName(startTerm);
  const deadline = program.application_deadlines.find((d) => d.term === term);
  if (!program.start_terms.includes(term) || !deadline) return { text: `Not offered for ${startTerm}`, notOffered: true };
  const date = deadlineDate(deadline.deadline, startTerm);
  return { text: date ? longDate(date) : deadline.deadline };
}

// Side by side, one column per program (at most MAX_COMPARE). Costs are never
// added up: the programs are alternatives.
export function compareTable(programs: { id: string; program: IndexProgram }[], startTerm: string): CompareTable {
  const shown = programs.slice(0, MAX_COMPARE);
  const row = (label: string, value: (p: IndexProgram) => string | Cell) => ({
    label,
    cells: shown.map(({ program }) => {
      const v = value(program);
      return typeof v === "string" ? { text: v } : v;
    }),
  });
  return {
    programs: shown.map(({ id, program }) => ({ id, name: program.name, url: program.url })),
    rows: [
      row("Credential", (p) => p.credential),
      row("Level", (p) => p.level),
      row("College", (p) => p.college),
      row("Format", (p) => p.modality),
      row("Campus", (p) => p.campus),
      row("Start terms", (p) => p.start_terms.join(", ")),
      row("Length", (p) => p.duration),
      row("Credits", (p) => String(p.credits)),
      row("Cost per credit", (p) => usd(p.tuition_per_credit_usd)),
      row("Estimated total tuition", (p) => usd(p.estimated_total_tuition_usd)),
      row(`Application deadline for ${startTerm}`, (p) => deadlineFor(p, startTerm)),
    ],
  };
}

// Timeline --------------------------------------------------------------------

export type TimelineEntry = {
  date: string; // YYYY-MM-DD (campus time)
  start?: string; // ISO date and time, for events
  end?: string;
  kind: "deadline" | "event";
  title: string;
  about: { name: string; url: string };
  itemId: string;
  past: boolean;
  next: boolean;
};

const campusDay = (iso: string, timeZone: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone });

export function longDate(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

// Application deadlines for the start term from saved programs, and saved
// events, in date order. Past entries are marked, and so is the next one.
export function timeline(workbench: Workbench, index: WorkbenchIndex, startTerm: string, { now = new Date(), timeZone = siteConfig.timezone } = {}): TimelineEntry[] {
  const today = campusDay(now.toISOString(), timeZone);
  const entries: Omit<TimelineEntry, "past" | "next">[] = [];
  for (const item of workbench.items) {
    if (item.kind === "program" && item.ref && index.program[item.ref]) {
      const program = index.program[item.ref];
      const cell = deadlineFor(program, startTerm);
      const deadline = program.application_deadlines.find((d) => d.term === termName(startTerm));
      const date = !cell.notOffered && deadline && deadlineDate(deadline.deadline, startTerm);
      if (date) entries.push({ date, kind: "deadline", title: `Application deadline for ${startTerm}`, about: { name: program.name, url: program.url }, itemId: item.id });
    }
    if (item.kind === "event" && item.ref && index.event[item.ref]) {
      const event = index.event[item.ref];
      entries.push({ date: campusDay(event.start, timeZone), start: event.start, end: event.end, kind: "event", title: event.title, about: { name: event.title, url: event.url }, itemId: item.id });
    }
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title));
  const nextAt = entries.findIndex((e) => e.date >= today);
  return entries.map((e, i) => ({ ...e, past: e.date < today, next: i === nextAt }));
}

// An .ics file for one timeline entry
export function icsFor(entry: TimelineEntry, siteName: string, origin: string) {
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = (d: string) => d.replace(/-/g, "");
  const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const summary = entry.kind === "deadline" ? `${entry.about.name}: ${entry.title}` : entry.title;
  const when =
    entry.kind === "event" && entry.start && entry.end
      ? [`DTSTART:${stamp(entry.start)}`, `DTEND:${stamp(entry.end)}`]
      : [`DTSTART;VALUE=DATE:${day(entry.date)}`, `DTEND;VALUE=DATE:${nextDay(entry.date)}`];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${esc(siteName)}//Workbench//EN`,
    "BEGIN:VEVENT",
    `UID:${entry.itemId}-${entry.kind}-${day(entry.date)}@${new URL(origin).host}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    ...when,
    `SUMMARY:${esc(summary)}`,
    `URL:${new URL(entry.about.url, origin).toString()}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

// Item cards ------------------------------------------------------------------

const eventFormat = new Intl.DateTimeFormat("en-US", { timeZone: siteConfig.timezone, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// One or two key facts for an item's card
export function factsFor(kind: ContentKind, entry: Entry): string[] {
  switch (kind) {
    case "program": {
      const p = entry as IndexProgram;
      return [`${p.level} · ${p.modality} · ${p.campus}`, `About ${usd(p.estimated_total_tuition_usd)} total · Starts ${p.start_terms.join(", ").toLowerCase()}`];
    }
    case "course": {
      const c = entry as WorkbenchIndex["course"][string];
      return [`${c.code} · ${c.credits} credits · ${c.modality}`, `Offered ${c.terms_offered.join(", ").toLowerCase()}`];
    }
    case "faculty": {
      const f = entry as WorkbenchIndex["faculty"][string];
      return [`${f.title}, ${f.department}`];
    }
    case "event": {
      const e = entry as WorkbenchIndex["event"][string];
      return [eventFormat.format(new Date(e.start)), `${e.location}, ${e.campus}`];
    }
    case "service": {
      const s = entry as WorkbenchIndex["service"][string];
      return [`${s.category} · ${s.location}`];
    }
    case "news": {
      const n = entry as WorkbenchIndex["news"][string];
      return [longDate(n.date)];
    }
  }
}

// The name an item goes by, for headings and announcements
export function nameOf(kind: ContentKind, entry: Entry) {
  const e = entry as { name?: string; title?: string; code?: string };
  return kind === "course" ? `${e.code}: ${e.title}` : (e.name ?? e.title ?? "");
}
