// Feature: jsonFeeds. The full catalog as JSON at /data/programs.json,
// /data/courses.json, and /data/services.json, with an absolute url per entry.

import type { APIRoute, GetStaticPaths } from "astro";
import siteConfig from "../../site.config.ts";
import { collegeOf, courses, departmentOf, programs, services } from "../lib/catalog.ts";
import { absoluteUrl, pagePath, type PageType } from "../lib/urls.ts";

const feeds = {
  programs: () => programs.map((p) => ({ ...p, field: departmentOf(p).field, college: collegeOf(p).name })),
  courses: () => courses.map((c) => ({ ...c, field: departmentOf(c).field })),
  services: () => services,
} satisfies Record<PageType, () => { id: string }[]>;

export const getStaticPaths = (() => Object.keys(feeds).map((feed) => ({ params: { feed } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params, site }) => {
  const feed = params.feed as PageType;
  const entries = feeds[feed]().map((entry) => ({ ...entry, url: absoluteUrl(pagePath(feed, entry.id), site!) }));
  const body = { university: siteConfig.name, note: "Fictional demo data", count: entries.length, [feed]: entries };
  return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json" } });
};
