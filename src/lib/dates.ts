// Dates and times, always shown in campus local time.

import siteConfig from "../../site.config.ts";
import type { Event } from "./schemas.ts";

const timeZone = siteConfig.timezone;
const dayAndTimeFormat = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
const rangeFormat = new Intl.DateTimeFormat("en-US", { timeZone, month: "long", day: "numeric", year: "numeric" });

const campusDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone });

// "Friday, October 16, 2026, 10:00 – 11:30 AM", or for a multi-day event
// "May 3 – 21, 2027, 10:00 AM – 5:00 PM daily"
export function eventWhen(event: Event) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (campusDay(start) === campusDay(end)) return dayAndTimeFormat.formatRange(start, end);
  return `${rangeFormat.formatRange(start, end)}, ${timeFormat.formatRange(start, end)} daily`;
}

// Parts for a calendar-style date badge: { month: "Oct", day: "16" }
export function eventBadge(event: Event) {
  const start = new Date(event.start);
  return {
    month: start.toLocaleDateString("en-US", { timeZone, month: "short" }),
    day: start.toLocaleDateString("en-US", { timeZone, day: "numeric" }),
  };
}

// News dates come from frontmatter as dates without a time ("2026-09-14"),
// which JavaScript reads as midnight UTC, so format them in UTC.
export const storyDate = (date: Date) => date.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });

