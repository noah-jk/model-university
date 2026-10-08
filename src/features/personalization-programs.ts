// Feature: personalization. A compact list of programs that the browser uses
// to pick "Recommended for you" programs from someone's session profile.

import type { APIRoute } from "astro";
import { collegeOf, departmentOf, programs } from "../lib/catalog.ts";
import { pagePath } from "../lib/urls.ts";

export const GET: APIRoute = () => {
  const list = programs.map((p) => ({
    id: p.id,
    name: p.name,
    url: pagePath("programs", p.id),
    department: departmentOf(p).field,
    college: collegeOf(p).name,
    level: p.level,
    modality: p.modality,
  }));
  return new Response(JSON.stringify(list), { headers: { "Content-Type": "application/json" } });
};
