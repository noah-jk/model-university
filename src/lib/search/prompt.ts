// What the model is told: how to turn a question into catalog searches, and
// the names it needs to fill in filters exactly (fields, colleges, service
// ids). The tools' own descriptions come from src/lib/tools.ts.

import { z } from "zod";
import siteConfig from "../../../site.config.ts";
import * as catalog from "../catalog.ts";
import { toolNamed } from "../tools.ts";
import type { ToolSpec } from "../llm/types.ts";
import { SEARCH_TOOLS } from "./plan.ts";
import type { InterestProfile } from "./types.ts";

export function systemPrompt(now = new Date()) {
  const today = now.toLocaleDateString("en-US", { timeZone: siteConfig.timezone, weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return `You turn a visitor's search into searches of the ${siteConfig.name} catalog. ${siteConfig.name} is a fictional university used for demos. Respond only by calling tools.

Rules:
- Call 1 to 4 tools that together answer the search. Usually one is enough.
- Apply every preference the visitor states as a filter argument: level, format (modality), start term, budget, college, field, dates, category, campus, or audience. Don't repeat those words in query.
- Put only the topic in query, in a word or two, e.g. "health", "marine biology", or "parents". Leave out words that name the kind of thing (programs, courses, services, events), question words, and filler like "offer" or "options". Fewer, more distinctive words find more. Leave query out when the filters say it all.
- People ("who teaches", "professor", "expert in") → search_faculty. Classes → search_courses. Degrees, majors, minors, certificates → search_programs. Help, offices, support → find_services. Things happening, tours, visits, lectures → search_events. Stories and announcements → list_news.
- To answer whether a particular service is open, call get_service with its id from the list below.
- Today is ${today}, campus time. Turn "this weekend", "next month", and similar into from and to dates.
- Use the field, department, and college names below exactly as written.
- If the search isn't about the university, call the one search that fits best, using its key words as query.

Colleges: ${catalog.colleges.map((c) => c.name).join("; ")}
Fields of study (departments): ${catalog.departments.map((d) => d.field).join("; ")}
Student services (id: name): ${catalog.services.map((s) => `${s.id}: ${s.name}`).join("; ")}`;
}

// The browsing profile, as a hint the model may use but must not filter by
export function profileContext(profile?: InterestProfile) {
  if (!profile) return undefined;
  const interests = [profile.department, profile.college, profile.level, profile.modality].filter(Boolean);
  if (!interests.length) return undefined;
  return `Context, not a filter: on this site the visitor has mostly looked at ${interests.join(", ")}. Use it only to break ties in an unclear search.`;
}

// The search tools as JSON Schema, which is what model APIs take. The page
// decides how many results to show, so the model isn't offered `limit`.
export const toolSpecs: ToolSpec[] = Object.keys(SEARCH_TOOLS).map((name) => {
  const tool = toolNamed(name)!;
  const { limit, ...input } = tool.input;
  const { $schema, additionalProperties, ...parameters } = z.toJSONSchema(z.object(input)) as Record<string, unknown>;
  return { name, description: tool.description, parameters };
});
