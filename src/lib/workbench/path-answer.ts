// Your Path for a student's own AI (the get_your_path MCP tool, #52): the
// plan behind a path link, worked out with the same code as the page
// (planFor, pathTimeline), with absolute URLs. The link is read here and
// never stored or logged. No DOM code.

import { rules } from "../enrollment.ts";
import { absoluteUrl } from "../urls.ts";
import { lookup, nameOf } from "./derive.ts";
import { buildIndex } from "./index-data.ts";
import { pathTimeline, planFor } from "./plan.ts";
import { resolveProfile } from "./profile.ts";
import { codeFrom, decodePath, pathLink } from "./share.ts";
import { CONTENT_KINDS, type ContentKind, type Workbench, type WorkbenchIndex } from "./types.ts";

let index: WorkbenchIndex | undefined;
const url = (path: string | undefined, base: string) => (path ? (path.startsWith("/") ? absoluteUrl(path, base) : path) : undefined);

// undefined when the link isn't a path link
export function yourPath(link: string, base: string, now = new Date()) {
  const code = codeFrom(link);
  const shared = decodePath(code, { newId: () => "", now });
  if (!shared) return undefined;
  index ??= buildIndex();
  const workbench: Workbench = { version: 2, ...shared, dismissed: [], hiddenHandoffs: [], updatedAt: now.toISOString() };
  const profile = resolveProfile(shared.profile, { views: [], items: shared.items }, rules.upcomingCalendarTerms(now));
  const plan = planFor(profile, rules, index, workbench, [], now);
  const term = profile.startTerm.value;
  const entries = pathTimeline(plan, rules, index, workbench, term, plan ? profile.level.value : undefined, now);

  type Saved = { kind: string; id?: string; name?: string; url?: string; text?: string; student_note?: string; note?: string };
  const saved = shared.items.flatMap((item): Saved[] => {
    if (item.kind === "note") return [{ kind: "note", text: item.text }];
    if (!(CONTENT_KINDS as readonly string[]).includes(item.kind)) return [];
    const entry = lookup(index!, item);
    if (!entry) return [{ kind: item.kind, id: item.ref, note: "No longer on the site." }];
    return [{ kind: item.kind, id: item.ref, name: nameOf(item.kind as ContentKind, entry), url: url((entry as { url: string }).url, base), ...(item.note && { student_note: item.note }) }];
  });

  return {
    ...(plan
      ? { for: plan.reason.replace(/^For /, ""), student_type: profile.studentType.value, level: profile.level.value }
      : { note: "This path doesn't say the student's type and level yet. Ask them, then use get_enrollment_steps, or have them choose on Your Path and share a new link." }),
    term,
    term_source: profile.startTerm.source === "chosen" ? "chosen by the student" : "the next term (the student hasn't chosen one)",
    ...(plan && {
      steps: plan.steps.map((s, i) => ({
        order: i + 1,
        id: s.step.id,
        title: s.step.title,
        phase: s.step.phase,
        status: s.status,
        ...(s.next && { next: true }),
        due_date: s.date ?? null,
        ...(s.dateSource && { date_source: s.dateSource }),
        ...(s.note && { note: s.note }),
        ...((s.step.url || s.step.office) && { url: url(s.step.url ?? index!.service[s.step.office!]?.url, base) }),
      })),
      offices: plan.offices.map((o) => ({ id: o.id, name: o.name, reason: o.reason, url: url(o.url, base) })),
    }),
    // Dates that aren't steps: the calendar, saved programs' deadlines, saved events, the visit
    dates: entries
      .filter((e) => !e.id.startsWith("step:"))
      .map((e) => ({ date: e.date, ...(e.end && { end: e.end }), title: e.title, kind: e.kind, source: e.source, passed: e.past, ...(e.url && { url: url(e.url, base) }) })),
    saved,
    your_path_url: pathLink(code, new URL(base).origin),
  };
}
