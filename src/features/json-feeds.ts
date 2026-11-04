// Feature: jsonFeeds. The full catalog as JSON at /data/programs.json,
// /data/courses.json, /data/services.json, and /data/careers.json, with an
// absolute url per entry.

import type { APIRoute, GetStaticPaths } from "astro";
import siteConfig from "../../site.config.ts";
import { careers, collegeOf, courses, departmentOf, departmentsForCareer, instructorOf, programs, programsForCareer, services } from "../lib/catalog.ts";
import { absoluteUrl, pagePath, type PageType } from "../lib/urls.ts";

const feeds = {
  programs: () => programs.map((p) => ({ ...p, field: departmentOf(p).field, college: collegeOf(p).name })),
  courses: () => courses.map((c) => ({ ...c, field: departmentOf(c).field, instructor: instructorOf(c).name })),
  services: () => services,
  // Labor market numbers are for Washington; programs are the ids that lead there
  careers: () => careers.map((c) => ({ ...c, fields: departmentsForCareer(c).map((d) => d.field), programs: programsForCareer(c).map((p) => p.id) })),
} satisfies Partial<Record<PageType, () => { id: string }[]>>;

export const getStaticPaths = (() => Object.keys(feeds).map((feed) => ({ params: { feed } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params, site }) => {
  const feed = params.feed as keyof typeof feeds;
  const entries = feeds[feed]().map((entry) => ({ ...entry, url: absoluteUrl(pagePath(feed, entry.id), site!) }));
  const body = { university: siteConfig.name, note: "Fictional demo data", count: entries.length, [feed]: entries };
  return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json" } });
};
