// A path link: Your Path in one URL, so a student can keep it (bookmark it,
// send it to themselves) or share it with a parent, counselor, or AI. The
// path goes after the #, which browsers never send to a server, so no log
// sees it. No DOM code: the page and the MCP server (#52) share it.
//
// What's in it: the student's choices (type, level, start term), the steps
// they've checked off, their visit date, and what they've saved, as
// references (kind + id), never copies. Their notes only when they ask.
// Never their name, email, or phone (those aren't kept on Your Path).

import siteConfig from "../../../site.config.ts";
import { longDay } from "../dates.ts";
import { ALL_STUDENT_TYPES, STUDENT_LEVELS } from "../vocab.ts";
import type { PlanStep } from "./plan.ts";
import { CONTENT_KINDS, MAX_ITEMS, MAX_NOTE, WORKBENCH_LABEL, WORKBENCH_PATH, type ItemKind, type PlanChoices, type Workbench, type WorkbenchItem } from "./types.ts";

export const LINK_KEY = "path";

// Version 1 (the first share format) had only the start term and items
type Compact = {
  v: 1 | 2;
  t?: string; // start term
  l?: string; // level
  y?: string; // student type
  c?: string[]; // steps checked off
  d?: string; // visit date
  i: [kind: ItemKind, refOrText: string, note?: string][];
};

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromBase64Url = (text: string) => {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
};

// The code for a workbench: URL-safe text
export function encodePath(workbench: Workbench, { notes = false } = {}) {
  const { profile, completed, visit } = workbench;
  const items = workbench.items.filter((item) => (CONTENT_KINDS as readonly string[]).includes(item.kind) || (notes && item.kind === "note"));
  const compact: Compact = {
    v: 2,
    ...(profile.startTerm && { t: profile.startTerm }),
    ...(profile.level && { l: profile.level }),
    ...(profile.studentType && { y: profile.studentType }),
    ...(completed.length && { c: completed }),
    ...(visit && { d: visit.date }),
    i: items.map((item) => {
      const main = item.ref ?? item.text ?? "";
      return notes && item.note ? [item.kind, main, item.note] : [item.kind, main];
    }),
  };
  return toBase64Url(JSON.stringify(compact));
}

export const pathLink = (code: string, origin: string) => `${origin}${WORKBENCH_PATH}#${LINK_KEY}=${code}`;

// The code in a link, or a bare code
export function codeFrom(text: string) {
  const trimmed = text.trim();
  const at = trimmed.indexOf(`${LINK_KEY}=`);
  return at >= 0 ? trimmed.slice(at + LINK_KEY.length + 1).split("&")[0] : trimmed;
}

// What's checked on the way in: anything could be in a link, so each part
// must look like what we wrote, or it's left out. A code that isn't ours at
// all gives undefined.
const isId = (x: unknown): x is string => typeof x === "string" && x.length <= 120 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(x);
const isTerm = (x: unknown): x is string => typeof x === "string" && /^(Fall|Winter|Spring|Summer) \d{4}$/.test(x);
const isDay = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
const oneOf = (list: readonly string[], x: unknown): x is string => typeof x === "string" && list.includes(x);

export type SharedPath = Pick<Workbench, "items" | "profile" | "completed" | "visit">;

export function decodePath(code: string, { newId = (): string => crypto.randomUUID(), now = new Date() } = {}): SharedPath | undefined {
  let compact: Compact;
  try {
    compact = JSON.parse(fromBase64Url(code));
  } catch {
    return undefined;
  }
  if (!compact || (compact.v !== 1 && compact.v !== 2) || !Array.isArray(compact.i)) return undefined;
  const addedAt = now.toISOString();
  const seen = new Set<string>();
  const items = compact.i.slice(0, MAX_ITEMS).flatMap((entry): WorkbenchItem[] => {
    if (!Array.isArray(entry)) return [];
    const [kind, main, note] = entry;
    const extra = typeof note === "string" && note.trim() ? { note: note.slice(0, MAX_NOTE) } : {};
    if (kind === "note") return typeof main === "string" && main.trim() ? [{ id: newId(), kind, text: main.slice(0, MAX_NOTE), source: "shared", addedAt }] : [];
    if (!oneOf(CONTENT_KINDS, kind) || !isId(main) || seen.has(`${kind}:${main}`)) return [];
    seen.add(`${kind}:${main}`);
    return [{ id: newId(), kind, ref: main, ...extra, source: "shared", addedAt }];
  });
  const profile: PlanChoices = {
    ...(isTerm(compact.t) && { startTerm: compact.t }),
    ...(oneOf(STUDENT_LEVELS, compact.l) && { level: compact.l }),
    ...(oneOf(ALL_STUDENT_TYPES, compact.y) && { studentType: compact.y }),
  };
  const completed = Array.isArray(compact.c) ? [...new Set(compact.c.filter(isId))] : [];
  return { items, profile, completed, ...(isDay(compact.d) && { visit: { date: compact.d } }) };
}

// "First-year student, Fall 2027, 3 saved, 4 steps done": for the replace prompt
export function describeShared(shared: SharedPath) {
  const { profile, items, completed } = shared;
  const who = [profile.studentType && `${profile.studentType}${profile.studentType.includes("student") ? "" : " student"}`, profile.level?.toLowerCase(), profile.startTerm && `starting ${profile.startTerm}`].filter(Boolean).join(", ");
  const saved = items.length ? `${items.length} saved ${items.length === 1 ? "item" : "items"}` : "nothing saved";
  const done = completed.length ? `${completed.length} ${completed.length === 1 ? "step" : "steps"} checked off` : "";
  return [who, saved, done].filter(Boolean).join("; ");
}

// Email ---------------------------------------------------------------------------

// Some mail apps cut mailto: links longer than this
export const MAILTO_BUDGET = 2000;
const shortDay = (day: string) => longDay(day).replace(/^\w+, /, "");

function stepLine(s: PlanStep, n: number) {
  const status = s.status === "done" ? ": done" : s.date ? `: ${s.status === "overdue" ? "was due" : "due"} ${shortDay(s.date)}` : "";
  return `${n}. ${s.step.title}${status}`;
}

// The steps, numbered, with "After I'm admitted:" before those steps
function stepLines(steps: PlanStep[]) {
  const applying = steps.some((s) => s.step.journey === "apply");
  const lines: string[] = [];
  steps.forEach((s, i) => {
    if (applying && s.step.phase === "admitted" && steps[i - 1]?.step.phase !== "admitted") lines.push("", "After I'm admitted:");
    lines.push(stepLine(s, i + 1));
  });
  return lines;
}

// A plain-text email the student sends from their own mail app: who the plan
// is for, the steps with due dates, and the link. If the link would make the
// mailto: too long (many saved items), the draft says to paste it in instead.
export function pathEmail({ reason, steps, link }: { reason: string; steps: PlanStep[]; link: string }) {
  const subject = `My path to ${siteConfig.shortName}`;
  const lines = stepLines(steps);
  const body = (end: string) => [`${reason}.`, "", ...lines, "", end].join("\n");
  const withLink = body(`See the whole plan, with dates and offices: ${link}`);
  const mailto = (text: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  const text = mailto(withLink).length <= MAILTO_BUDGET ? withLink : body(`(The link to the whole plan is too long for an email. Copy it from ${WORKBENCH_LABEL} and paste it here.)`);
  return { subject, body: text, href: mailto(text) };
}

// For your AI ----------------------------------------------------------------------

// What "Copy for your AI" copies (#52): a short request, the plan as text
// (so any AI can help, connected or not), what's saved, and the link, with
// the MCP server's address for AIs that can read the link themselves. Notes
// only when the student included them in the link.
export function aiPrompt({ reason, steps, saved, notes = [], link, mcpUrl }: { reason?: string; steps?: PlanStep[]; saved: { name: string; note?: string }[]; notes?: string[]; link: string; mcpUrl?: string }) {
  const parts = [`Help me with my plan to enroll at ${siteConfig.name}. Here's my plan from its ${WORKBENCH_LABEL} page.`];
  if (reason && steps) parts.push(`${reason}.\n\n${stepLines(steps).join("\n")}`);
  else parts.push("I haven't chosen my student type and level yet.");
  if (saved.length) parts.push(`What I've saved:\n${saved.map((s) => `- ${s.name}${s.note ? ` (my note: ${s.note})` : ""}`).join("\n")}`);
  if (notes.length) parts.push(`My notes:\n${notes.map((n) => `- ${n}`).join("\n")}`);
  parts.push(`My path link: ${link}`);
  if (mcpUrl) parts.push(`If you can connect to MCP servers, ${siteConfig.shortName}'s is at ${mcpUrl}. Its get_your_path tool reads my path link and gives every step, date, and office, with links.`);
  return parts.join("\n\n");
}
