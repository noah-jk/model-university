// Content collections. The schemas live in src/lib/schemas.ts so that
// scripts outside Astro (scripts/check-content.ts) can validate the same data.

import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import type { z } from "astro/zod";
import { college, course, department, event, facultyMember, newsStory, page, program, service, type Related } from "./lib/schemas.ts";
import { departments, faculty, programs, services } from "./lib/catalog.ts";

// News stories are Markdown, so check-content.ts doesn't see them. Check their
// related links here instead, so a typo in an id fails the build.
const knownIds = {
  programs: new Set(programs.map((p) => p.id)),
  departments: new Set(departments.map((d) => d.id)),
  services: new Set(services.map((s) => s.id)),
  faculty: new Set(faculty.map((f) => f.id)),
};
function checkRelated({ related }: { related: Related }, ctx: z.RefinementCtx) {
  for (const [type, ids] of Object.entries(related) as [keyof Related, string[]][]) {
    for (const id of ids) {
      if (!knownIds[type].has(id)) ctx.addIssue({ code: "custom", path: ["related", type], message: `"${id}" is not a ${type} id` });
    }
  }
}

export const collections = {
  colleges: defineCollection({ loader: file("content/generated/colleges.json"), schema: college }),
  departments: defineCollection({ loader: file("content/generated/departments.json"), schema: department }),
  programs: defineCollection({ loader: file("content/generated/programs.json"), schema: program }),
  courses: defineCollection({ loader: file("content/generated/courses.json"), schema: course }),
  services: defineCollection({ loader: file("content/generated/services.json"), schema: service }),
  faculty: defineCollection({ loader: file("content/generated/faculty.json"), schema: facultyMember }),
  events: defineCollection({ loader: file("content/generated/events.json"), schema: event }),
  news: defineCollection({ loader: glob({ pattern: "*.md", base: "content/news" }), schema: newsStory.superRefine(checkRelated) }),
  pages: defineCollection({ loader: glob({ pattern: "**/*.md", base: "content/pages" }), schema: page }),
};
