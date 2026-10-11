// Turns catalog ids into search results. Every result is built from the
// catalog record itself, never from model output, so a result can't carry
// an invented name, price, or link. `resultFor(kind, ref)` is also how a saved
// Workbench item will be shown again later.

import siteConfig from "../../../site.config.ts";
import * as catalog from "../catalog.ts";
import { storyDate } from "../dates.ts";
import { usd } from "../format.ts";
import { campusTime, formatTime, isOpen } from "../hours.ts";
import { absoluteUrl, pagePath, type PageType } from "../urls.ts";
import { DAYS, DAY_NAMES } from "../vocab.ts";
import type { Service } from "../schemas.ts";
import type { Kind, SearchResult } from "./types.ts";

const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
const records = {
  program: byId(catalog.programs),
  course: byId(catalog.courses),
  faculty: byId(catalog.faculty),
  event: byId(catalog.events),
  service: byId(catalog.services),
  news: byId(catalog.news),
};

const PAGE_TYPE: Record<Kind, PageType> = { program: "programs", course: "courses", faculty: "faculty", event: "events", service: "services", news: "news" };

const seasons = (terms: readonly string[]) => terms.map((t) => t.toLowerCase()).join(", ");
const short = (text: string, max = 110) => (text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text);

const eventDay = new Intl.DateTimeFormat("en-US", { timeZone: siteConfig.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// "Open now until 5 pm" or "Closed now"
function openStatus(service: Service, now: Date) {
  if (!isOpen(service, now)) return "Closed now";
  return `Open now until ${formatTime(service.hours[campusTime(now).day]![1])}`;
}

export function resultFor(kind: Kind, ref: string, base: string, now = new Date()): SearchResult | undefined {
  const url = absoluteUrl(pagePath(PAGE_TYPE[kind], ref), base);
  switch (kind) {
    case "program": {
      const p = records.program.get(ref);
      return p && { kind, ref, url, title: p.name, detail: `${p.level} · ${p.modality} · Starts ${seasons(p.start_terms)} · About ${usd(p.estimated_total_tuition_usd)} total` };
    }
    case "course": {
      const c = records.course.get(ref);
      return c && { kind, ref, url, title: `${c.code}: ${c.title}`, detail: `${c.level} · ${c.credits} credits · ${c.modality} · Offered ${seasons(c.terms_offered)}` };
    }
    case "faculty": {
      const f = records.faculty.get(ref);
      return f && { kind, ref, url, title: f.name, detail: `${f.role ?? f.title}, ${catalog.departmentOf(f).field} · ${f.research_interests.slice(0, 3).join(", ")}` };
    }
    case "event": {
      const e = records.event.get(ref);
      return e && { kind, ref, url, title: e.title, detail: `${eventDay.format(new Date(e.start))} · ${e.campus}` };
    }
    case "service": {
      const s = records.service.get(ref);
      return s && { kind, ref, url, title: s.name, detail: `${openStatus(s, now)} · ${s.location}` };
    }
    case "news": {
      const n = records.news.get(ref);
      return n && { kind, ref, url, title: n.title, detail: `${storyDate(new Date(n.date))} · ${short(n.summary)}` };
    }
  }
}

// A plain answer to "is X open?", from the service's weekly hours
export function hoursAnswer(ref: string, base: string, now = new Date()) {
  const s = records.service.get(ref);
  if (!s) return undefined;
  const source = { title: `${s.name} hours and contact details`, url: absoluteUrl(pagePath("services", s.id), base) };
  const { day, time } = campusTime(now);
  if (isOpen(s, now)) return { text: `${s.name} is open now, until ${formatTime(s.hours[day]![1])} campus time.`, source };
  const today = DAYS.indexOf(day);
  for (let i = 0; i < 7; i++) {
    const next = DAYS[(today + i) % 7];
    const hours = s.hours[next];
    if (!hours || (i === 0 && time >= hours[0])) continue;
    const when = i === 0 ? "today" : i === 1 ? "tomorrow" : `on ${DAY_NAMES[next]}`;
    return { text: `${s.name} is closed right now. It opens ${when} at ${formatTime(hours[0])} campus time.`, source };
  }
  return { text: `${s.name} doesn't have regular opening hours.`, source };
}
