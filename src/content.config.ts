// Content collections. The schemas live in src/lib/schemas.ts so that
// scripts outside Astro (scripts/check-content.ts) can validate the same data.

import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { college, course, department, program, service } from "./lib/schemas.ts";

export const collections = {
  colleges: defineCollection({ loader: file("content/generated/colleges.json"), schema: college }),
  departments: defineCollection({ loader: file("content/generated/departments.json"), schema: department }),
  programs: defineCollection({ loader: file("content/generated/programs.json"), schema: program }),
  courses: defineCollection({ loader: file("content/generated/courses.json"), schema: course }),
  services: defineCollection({ loader: file("content/generated/services.json"), schema: service }),
};
