// Feature: llmsTxt. A plain-text guide to the site for AI tools (llmstxt.org).

import type { APIRoute } from "astro";
import siteConfig from "../../site.config.ts";
import { colleges, collegeOf, courses, departments, programs, services } from "../lib/catalog.ts";
import { usd } from "../lib/format.ts";
import { absoluteUrl, markdownPath, pagePath, subjectPath } from "../lib/urls.ts";

export const GET: APIRoute = ({ site }) => {
  const url = (path: string) => absoluteUrl(path, site!);
  const { features } = siteConfig;
  // Link to the Markdown copy when it exists, otherwise the page itself.
  const page = (type: "programs" | "services", id: string) => url(features.markdownPages ? markdownPath(type, id) : pagePath(type, id));

  const sections = [
    `# ${siteConfig.name}`,
    `> A fictional public university in the Pacific Northwest, used to demo AI-ready websites. Offers ${programs.length} programs, ${courses.length} courses, and ${services.length} student services. All data is synthetic.`,
  ];
  if (features.mcp) {
    sections.push(
      `For live, structured answers, connect to the MCP server at ${url("/mcp")} (Streamable HTTP, read-only, no auth). Tools: search_programs, get_program, compare_programs, list_colleges, search_courses, get_course, find_services, get_service, services_open_now.`
    );
  }
  if (features.jsonFeeds) {
    sections.push(`## Data feeds

- [All programs (JSON)](${url("/data/programs.json")}): every program with tuition, deadlines, requirements, and careers
- [All courses (JSON)](${url("/data/courses.json")}): the full course catalog
- [All student services (JSON)](${url("/data/services.json")}): offices with hours, locations, and contacts`);
  }
  sections.push(`## Student services\n\n${services.map((s) => `- [${s.name}](${page("services", s.id)}): ${s.description}`).join("\n")}`);
  sections.push(`## Course subjects\n\n${departments.map((d) => `- [${d.field} (${d.course_prefix})](${url(subjectPath(d.id))})`).join("\n")}`);
  for (const college of colleges) {
    const list = programs.filter((p) => collegeOf(p).id === college.id);
    sections.push(
      `## ${college.name}\n\n${list.map((p) => `- [${p.name}](${page("programs", p.id)}): ${p.modality}, starts ${p.start_terms.join("/")}, about ${usd(p.estimated_total_tuition_usd)}`).join("\n")}`
    );
  }

  return new Response(sections.join("\n\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
