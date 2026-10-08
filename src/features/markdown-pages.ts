// Feature: markdownPages. A Markdown copy of every program, course, and
// service page at …/index.md, next to the HTML page.

import type { APIRoute, GetStaticPaths } from "astro";
import { courses, programs, services } from "../lib/catalog.ts";
import { pagePath } from "../lib/urls.ts";
import { courseMarkdown, programMarkdown, serviceMarkdown } from "../lib/markdown.ts";

const builders = {
  programs: (id: string, site: URL) => programMarkdown(programs.find((p) => p.id === id)!, site),
  courses: (id: string, site: URL) => courseMarkdown(courses.find((c) => c.id === id)!, site),
  services: (id: string, site: URL) => serviceMarkdown(services.find((s) => s.id === id)!, site),
};

// The route is /[...path]/index.md, where path is the page's own URL path
// (e.g. academics/programs/cs-bs), so the copies sit next to the pages.
const entry = (type: keyof typeof builders, id: string) => ({
  params: { path: pagePath(type, id).slice(1, -1) },
  props: { type, id },
});

export const getStaticPaths = (() => [
  ...programs.map((p) => entry("programs", p.id)),
  ...courses.map((c) => entry("courses", c.id)),
  ...services.map((s) => entry("services", s.id)),
]) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props, site }) => {
  const markdown = builders[props.type as keyof typeof builders](props.id, site!);
  return new Response(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
};
