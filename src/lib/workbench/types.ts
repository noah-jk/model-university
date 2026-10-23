// The workbench's data model. A workbench holds references to catalog
// content (kind + ref), never copies, so it always shows live data, plus the
// student's own notes. See src/lib/workbench/store.ts for reading and writing.

// The name people see, and where the page lives. Change them here to rename
// the feature everywhere. (Code, types, and the storage key keep the
// internal name, "workbench".)
export const WORKBENCH_LABEL = "Your Path";
export const WORKBENCH_PATH = "/your-path/";

export const STORAGE_KEY = "cascadia:workbench";
export const MAX_ITEMS = 100;
export const MAX_NOTE = 1000;

export const CONTENT_KINDS = ["program", "course", "faculty", "event", "service", "news"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export type ItemKind =
  | ContentKind
  | "note" // a free-standing note, not attached to an item
  | "answer"; // reserved for phase 2 (an AI answer with sources)

// Kinds this version shows. Anything else in storage is kept but not shown.
export const SHOWN_KINDS: readonly ItemKind[] = [...CONTENT_KINDS, "note"];

export type ItemSource = "saved" | "suggested" | "shared" | "advisor"; // so far only "saved" is used

// The interest signals of a saved item (department, college, level, format),
// as they were when it was saved. Only the personalization profile reads
// them; what's shown always comes from live data.
export type Interest = { department?: string; college?: string; level?: string; modality?: string };

export type WorkbenchItem = {
  id: string;
  kind: ItemKind;
  ref?: string; // catalog id, for content kinds
  text?: string; // for "note" (and later "answer")
  note?: string; // the student's note on a content item
  source: ItemSource;
  addedAt: string; // ISO date
  watch?: Record<string, string>; // fingerprints of watched fields when saved
  interest?: Interest;
  addedBy?: { role: "student" | "advisor"; name?: string }; // no UI yet
  section?: string; // no UI yet
};

// What the student has chosen about themselves. Only choices are stored:
// suggested values are worked out fresh on each load (src/lib/workbench/profile.ts),
// so a choice always wins and a stale guess is never kept.
export type PlanChoices = { startTerm?: string; level?: string; studentType?: string };

export type Workbench = {
  version: 2;
  items: WorkbenchItem[]; // display order within each kind's group
  profile: PlanChoices;
  // Pulled-in items the student hid, as "kind:id" ("office:transfer-center", "event:…")
  dismissed: string[];
  // Step ids the student checked off (or finished through the journey), whatever the start term
  completed: string[];
  // Handoff ids the student hid ("Don't show this again"), and one-time
  // handoffs already shown ("first-save")
  hiddenHandoffs: string[];
  // The campus visit they asked for in the visit form (only the date), for the timeline
  visit?: { date: string };
  // What the header badge last showed, so it can be drawn before scripts run
  // (saved items, and whether there was a plan; steps aren't counted, see #25)
  badge?: { count: number; plan: boolean };
  updatedAt: string;
};

export const GROUPS: { kind: ItemKind; title: string; singular: string }[] = [
  { kind: "program", title: "Programs", singular: "program" },
  { kind: "course", title: "Courses", singular: "course" },
  { kind: "faculty", title: "Faculty", singular: "faculty member" },
  { kind: "event", title: "Events", singular: "event" },
  { kind: "service", title: "Services", singular: "service" },
  { kind: "news", title: "News", singular: "story" },
  { kind: "note", title: "Notes", singular: "note" },
];

// Fields watched for changes after saving
export const WATCHED: Partial<Record<ContentKind, string[]>> = {
  program: ["estimated_total_tuition_usd", "application_deadlines", "start_terms"],
  event: ["start", "location"],
};
// How a watched field is named in "Updated since you saved: tuition"
export const WATCHED_LABELS: Record<string, string> = {
  estimated_total_tuition_usd: "tuition",
  application_deadlines: "deadlines",
  start_terms: "start terms",
  start: "date and time",
  location: "location",
};

// The browser's copy of the catalog (/data/workbench-index.json): only the
// fields cards and views need, keyed by kind, then id.
export type IndexProgram = {
  name: string;
  url: string;
  level: string;
  credential: string;
  college: string;
  department: string;
  modality: string;
  campus: string;
  start_terms: string[];
  application_deadlines: { term: string; deadline: string }[];
  duration: string;
  credits: number;
  tuition_per_credit_usd: number;
  estimated_total_tuition_usd: number;
};
export type IndexCourse = { code: string; title: string; url: string; credits: number; terms_offered: string[]; modality: string };
export type IndexFaculty = { name: string; title: string; department: string; url: string };
export type IndexEvent = { title: string; url: string; start: string; end: string; location: string; campus: string; levels?: string[]; student_types?: string[] };
export type IndexService = { name: string; url: string; category: string; location: string };
export type IndexNews = { title: string; url: string; date: string };

export type WorkbenchIndex = {
  program: Record<string, IndexProgram>;
  course: Record<string, IndexCourse>;
  faculty: Record<string, IndexFaculty>;
  event: Record<string, IndexEvent>;
  service: Record<string, IndexService>;
  news: Record<string, IndexNews>;
};
