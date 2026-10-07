// Markdown copies of detail pages, for AI tools and "Copy page as Markdown".

import siteConfig from "../../site.config.ts";
import type { Course, Program, Service } from "./schemas.ts";
import { collegeOf, departmentOf, instructorOf, prerequisitesOf } from "./catalog.ts";
import { formatHours } from "./hours.ts";
import { usd } from "./format.ts";
import { absoluteUrl, pagePath } from "./urls.ts";
import { DAYS, DAY_NAMES } from "./vocab.ts";

const bullets = (items: readonly string[]) => items.map((i) => `- ${i}`).join("\n");
const header = (title: string, path: string, site: URL) =>
  `# ${title}\n\n${siteConfig.name} (fictional demo data)\nSource: ${absoluteUrl(path, site)}`;

export function programMarkdown(p: Program, site: URL) {
  const sections = [
    header(p.name, pagePath("programs", p.id), site),
    p.description,
    `## At a glance\n\n${bullets([
      `Credential: ${p.credential}`,
      `College: ${collegeOf(p).name}`,
      `Department: ${departmentOf(p).name}`,
      `Format: ${p.modality}, ${p.campus}`,
      `Starts: ${p.start_terms.join(", ")}`,
      `Length: ${p.duration}, ${p.credits} credits`,
      `Tuition: ${usd(p.tuition_per_credit_usd)} per credit, about ${usd(p.estimated_total_tuition_usd)} total`,
    ])}`,
    `## What you'll learn\n\n${bullets(p.outcomes)}`,
    `## Careers\n\n${bullets(p.careers)}`,
    `## Admission requirements\n\n${bullets(p.requirements)}`,
  ];
  if (p.application_deadlines.length) {
    sections.push(`## Application deadlines\n\n${bullets(p.application_deadlines.map((d) => `${d.term} start: ${d.deadline}`))}`);
  }
  return sections.join("\n\n") + "\n";
}

export function courseMarkdown(c: Course, site: URL) {
  const prereqs = prerequisitesOf(c);
  return [
    header(`${c.code}: ${c.title}`, pagePath("courses", c.id), site),
    c.description,
    `## At a glance\n\n${bullets([
      `Department: ${departmentOf(c).name}`,
      `Level: ${c.level}`,
      `Credits: ${c.credits}`,
      `Offered: ${c.terms_offered.join(", ")}`,
      `Format: ${c.modality}`,
      `Instructor: ${instructorOf(c).name}`,
    ])}`,
    `## Prerequisites\n\n${prereqs.length ? bullets(prereqs.map((p) => `[${p.code}: ${p.title}](${absoluteUrl(pagePath("courses", p.id), site)})`)) : "None"}`,
  ].join("\n\n") + "\n";
}

export function serviceMarkdown(s: Service, site: URL) {
  return [
    header(s.name, pagePath("services", s.id), site),
    s.description,
    `## Hours (${siteConfig.timezone})\n\n${bullets(DAYS.map((d) => `${DAY_NAMES[d]}: ${formatHours(s.hours[d])}`))}`,
    `## Contact\n\n${bullets([`Location: ${s.location}, ${s.campus}`, `Phone: ${s.phone}`, `Email: ${s.email}`])}`,
    `## Who can use it\n\n${s.eligibility}.${s.appointment_required ? " Appointments are required." : ""}${s.virtual_option ? " Virtual appointments are available." : ""}`,
  ].join("\n\n") + "\n";
}
