// What a program page says beyond the program's own fields: the next
// application deadline, the curriculum map, FAQs, and the structured data.
// All from catalog data, the same for every program. No DOM code, so the
// page and tests share it.

import siteConfig from "../../site.config.ts";
import { careersForProgram, departmentOf, relatedCourses, type Career } from "./catalog.ts";
import { usd, listText } from "./format.ts";
import type { Course, Program } from "./schemas.ts";
import { upcomingTerms } from "./terms.ts";
import { absoluteUrl, pagePath } from "./urls.ts";
import { deadlineDate, termName } from "./workbench/derive.ts";

const GRADUATE_LEVELS = ["Master's", "Doctorate", "Certificate"];
export const isGraduate = (p: Program) => GRADUATE_LEVELS.includes(p.level);

// The soonest application deadline that hasn't passed, with its start term
export function nextDeadline(program: Program, now = new Date()) {
  const today = now.toLocaleDateString("en-CA", { timeZone: siteConfig.timezone });
  for (const term of upcomingTerms(8, now)) {
    const deadline = program.application_deadlines.find((d) => d.term === termName(term));
    const date = deadline && deadlineDate(deadline.deadline, term);
    if (date && date >= today) return { term, date };
  }
  return undefined;
}

// Courses in the order students meet them: lower then upper division for
// undergraduates, 500-level then 600-level for graduate students
export function curriculum(program: Program, perStage = 4) {
  const courses = relatedCourses(program);
  const stage = (label: string, note: string, match: (c: Course) => boolean) => ({ label, note, courses: courses.filter(match).slice(0, perStage) });
  const stages = isGraduate(program)
    ? [stage("Foundations", "Core methods and theory", (c) => c.code.split(" ")[1].startsWith("5")), stage("Advanced study", "Specialized seminars and research", (c) => c.code.split(" ")[1].startsWith("6"))]
    : [stage("Years 1–2", "Foundations of the field", (c) => c.level === "Lower division"), stage("Years 3–4", "Advanced courses and a capstone", (c) => c.level === "Upper division")];
  return stages.filter((s) => s.courses.length);
}

// Questions people ask about every program, answered from its data
export function programFaqs(program: Program) {
  const field = departmentOf(program).field;
  const terms = listText(program.start_terms);
  const format =
    program.modality === "Online"
      ? `Yes. The ${program.name} program is fully online, with the same faculty and support as on campus.`
      : program.modality === "Hybrid"
        ? `Partly. The program is hybrid: some courses are online and some meet on the ${program.campus}.`
        : `Classes meet in person on the ${program.campus}. Some electives may be offered online.`;
  const faqs = [
    { question: "Can I study online?", answer: format },
    {
      question: "When can I start?",
      answer: program.application_deadlines.length
        ? `You can start in ${terms}. Apply by ${listText(program.application_deadlines.map((d) => `${d.deadline} for ${d.term}`))}.`
        : `You can add the minor in ${terms}, once you've declared a bachelor's major.`,
    },
    {
      question: "How long does it take?",
      answer: program.level === "Minor" ? `The minor is ${program.credits} credits, taken alongside your bachelor's degree.` : `Most students finish in ${program.duration} (${program.credits} credits). Part-time students take longer.`,
    },
    { question: "What does it cost?", answer: `Tuition is ${usd(program.tuition_per_credit_usd)} per credit, about ${usd(program.estimated_total_tuition_usd)} in total. Grants, scholarships, and loans can lower what you pay.` },
    {
      question: "Will my transfer credits count?",
      answer: program.accepts_transfer_credit
        ? "Yes. The program accepts transfer credit, and the Transfer Center shows how your credits apply."
        : `This program doesn't accept transfer credit toward its requirements, but you may still bring credit toward other ${field} coursework.`,
    },
  ];
  return faqs;
}

// "4 years" → "P4Y", "9–12 months" → "P12M": the longest time, for schema.org
export function timeToComplete(duration: string) {
  const match = duration.match(/(\d+)(?:–(\d+))?\s+(year|month)/);
  if (!match) return undefined;
  return `P${match[2] ?? match[1]}${match[3] === "year" ? "Y" : "M"}`;
}

// schema.org EducationalOccupationalProgram, for search engines and AI. The
// occupations carry their SOC codes; made-up salaries stay out of it.
export function programJsonLd(program: Program, base: string | URL, careers: Career[] = careersForProgram(program)) {
  const deadline = nextDeadline(program);
  const duration = timeToComplete(program.duration);
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOccupationalProgram",
    name: program.name,
    description: program.description,
    url: absoluteUrl(pagePath("programs", program.id), base),
    provider: { "@type": "CollegeOrUniversity", name: siteConfig.name, url: absoluteUrl("/", base) },
    educationalCredentialAwarded: program.credential,
    ...(duration && { timeToComplete: duration }),
    numberOfCredits: program.credits,
    educationalProgramMode: program.modality.toLowerCase(),
    programPrerequisites: program.requirements,
    ...(deadline && { applicationDeadline: deadline.date }),
    offers: { "@type": "Offer", category: "Tuition", price: program.estimated_total_tuition_usd, priceCurrency: "USD" },
    occupationalCategory: careers.map((c) => ({ "@type": "CategoryCode", codeValue: c.soc, name: c.title, inCodeSet: { "@type": "CategoryCodeSet", name: "SOC 2018" } })),
  };
}
