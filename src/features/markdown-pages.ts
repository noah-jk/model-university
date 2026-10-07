// Feature: markdownPages. A Markdown copy of every program, course, and
// service page at …/index.md, next to the HTML page.

import type { APIRoute, GetStaticPaths } from "astro";
import { courses, programs, services } from "../lib/catalog.ts";
import { courseMarkdown, programMarkdown, serviceMarkdown } from "../lib/markdown.ts";

const builders = {
  programs: (id: string, site: URL) => programMarkdown(programs.find((p) => p.id === id)!, site),
  courses: (id: string, site: URL) => courseMarkdown(courses.find((c) => c.id === id)!, site),
  services: (id: string, site: URL) => serviceMarkdown(services.find((s) => s.id === id)!, site),
};

export const getStaticPaths = (() => [
  ...programs.map((p) => ({ params: { type: "programs", id: p.id } })),
  ...courses.map((c) => ({ params: { type: "courses", id: c.id } })),
  ...services.map((s) => ({ params: { type: "services", id: s.id } })),
]) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params, site }) => {
  const markdown = builders[params.type as keyof typeof builders](params.id!, site!);
  return new Response(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
};
