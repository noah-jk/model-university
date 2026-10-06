// Opening hours in campus local time.

import siteConfig from "../../site.config.ts";
import { DAYS, type Day } from "./vocab.ts";
import type { Service } from "./schemas.ts";

export function campusTime(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: siteConfig.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return { day: parts.weekday.toLowerCase().slice(0, 3) as Day, time: `${parts.hour}:${parts.minute}` };
}

export function isOpen(service: Service, date: Date) {
  const { day, time } = campusTime(date);
  const hours = service.hours[day];
  return Boolean(hours && time >= hours[0] && time < hours[1]);
}

// "08:00" → "8 am", "13:30" → "1:30 pm", "24:00" → "midnight"
export function formatTime(t: string) {
  if (t === "24:00") return "midnight";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h >= 12 ? "pm" : "am"}`;
}

export function formatHours(hours: [string, string] | null) {
  if (!hours) return "Closed";
  if (hours[0] === "00:00" && hours[1] === "24:00") return "Open 24 hours";
  return `${formatTime(hours[0])} to ${formatTime(hours[1])}`;
}

export { DAYS };
