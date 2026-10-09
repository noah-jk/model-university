// Feature: llmsTxt. A plain-text guide to the site for AI tools (llmstxt.org).

import type { APIRoute } from "astro";
import siteConfig from "../../site.config.ts";
import { colleges, collegeOf, courses, departments, events, faculty, facultyInDepartment, hasEnded, news, programs, services } from "../lib/catalog.ts";
import { eventWhen } from "../lib/dates.ts";
import { usd } from "../lib/format.ts";
import { absoluteUrl, markdownPath, pagePath, subjectPath } from "../lib/urls.ts";

export const GET: APIRoute = ({ site }) => {
  const url = (path: string) => absoluteUrl(path, site!);
  const { features } = siteConfig;
  // Link to the Markdown copy when it exists, otherwise the page itself.
  const page = (type: "programs" | "services", id: string) => url(features.markdownPages ? markdownPath(type, id) : pagePath(type, id));

  const sections = [
    `# ${siteConfig.name}`,
    `> A fictional public university in the Pacific Northwest, used to demo AI-ready websites. Offers ${programs.length} programs, ${courses.length} courses, and ${services.length} student services, with ${faculty.length} faculty. All data is synthetic.`,
  ];
  if (features.mcp) {
    sections.push(
      `For live, structured answers, connect to the MCP server at ${url("/mcp")} (Streamable HTTP, read-only, no auth). Tools: search_programs, get_program, compare_programs, list_colleges, search_courses, get_course, find_services, get_service, services_open_now, search_faculty, get_faculty, search_events, list_news.`
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

  sections.push(
    `## Faculty\n\nBy department; each name links to a profile with research interests, courses, and contact details. [Faculty directory](${url("/about/faculty/")})\n\n${departments
      .map((d) => `- ${d.field}: ${facultyInDepartment(d.id).map((f) => `[${f.name}](${url(pagePath("faculty", f.id))})`).join(", ")}`)
      .join("\n")}`
  );
  // Upcoming as of when the site was built; search_events has live results
  const upcoming = events.filter((e) => !hasEnded(e));
  sections.push(
    `## Upcoming events\n\nTimes are Pacific. [All events](${url("/about/events/")})\n\n${upcoming
      .map((e) => `- [${e.title}](${url(pagePath("events", e.id))}): ${eventWhen(e)}, ${e.campus === "Online" ? "online" : `${e.location}, ${e.campus}`}`)
      .join("\n")}`
  );
  sections.push(`## News\n\n${news.map((n) => `- [${n.title}](${url(pagePath("news", n.id))}) (${n.date}): ${n.summary}`).join("\n")}`);

  return new Response(sections.join("\n\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
