// Query logic over the generated content. Plain functions over the JSON data,
// shared by the site's pages and the MCP endpoint.
// Functions that return page links take a `base` URL, so results carry
// absolute urls for wherever the site is running.

import collegesData from "../../content/generated/colleges.json" with { type: "json" };
import departmentsData from "../../content/generated/departments.json" with { type: "json" };
import programsData from "../../content/generated/programs.json" with { type: "json" };
import coursesData from "../../content/generated/courses.json" with { type: "json" };
import servicesData from "../../content/generated/services.json" with { type: "json" };
import facultyData from "../../content/generated/faculty.json" with { type: "json" };
import eventsData from "../../content/generated/events.json" with { type: "json" };
import newsData from "../../content/generated/news.json" with { type: "json" };
import siteConfig from "../../site.config.ts";
import type { College, Course, Department, Event, FacultyMember, NewsIndexEntry, Program, Related, Service } from "./schemas.ts";
import { eventWhen } from "./dates.ts";
import { campusTime, isOpen } from "./hours.ts";
import { absoluteUrl, pagePath } from "./urls.ts";

export const colleges = collegesData as College[];
export const departments = departmentsData as Department[];
export const programs = programsData as Program[];
export const courses = coursesData as Course[];
export const services = servicesData as Service[];
export const faculty = facultyData as FacultyMember[];
export const events = eventsData as Event[];
// News stories, newest first (an index of content/news/; see scripts/index-news.ts)
export const news = newsData as NewsIndexEntry[];

type Base = string | URL;

const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
const collegeById = byId(colleges);
const departmentById = byId(departments);
const courseById = byId(courses);
const facultyById = byId(faculty);

// Lookups -------------------------------------------------------------------

export const departmentOf = (entry: { department: string }) => departmentById.get(entry.department)!;
// Works for departments, and for anything that belongs to one (programs, courses).
export const collegeOf = (entry: { college: string } | { department: string }) =>
  collegeById.get("college" in entry ? entry.college : departmentOf(entry).college)!;

export function prerequisitesOf(course: Course) {
  return course.prerequisites.map((id) => courseById.get(id)!);
}

// Courses that suit a program: undergraduate courses for bachelor's and
// minors, upper-division and graduate courses for everything else.
export function relatedCourses(program: Program) {
  const undergrad = program.level === "Bachelor's" || program.level === "Minor";
  return courses.filter(
    (c) => c.department === program.department && (undergrad ? c.level !== "Graduate" : c.level !== "Lower division")
  );
}

// Other programs in the same college at the same degree level, so a bachelor's
// suggests bachelor's programs and never the same subject at another level.
// Each department has one program per level, so related programs come from the
// college's other departments. They start with the program after this one in
// the catalog, and wrap around, so neighboring pages suggest different programs.
export function relatedPrograms(program: Program, limit = 5) {
  const college = collegeOf(program).id;
  const peers = programs.filter((p) => p.level === program.level && collegeOf(p).id === college);
  const at = peers.findIndex((p) => p.id === program.id);
  return [...peers.slice(at + 1), ...peers.slice(0, at)].slice(0, limit);
}

export const programsInDepartment = (departmentId: string) => programs.filter((p) => p.department === departmentId);
export const coursesInDepartment = (departmentId: string) => courses.filter((c) => c.department === departmentId);

// Faculty -------------------------------------------------------------------

export const instructorOf = (course: Course) => facultyById.get(course.instructor)!;
export const coursesTaughtBy = (facultyId: string) => courses.filter((c) => c.instructor === facultyId);

// Chair first, then everyone else by last name
export function facultyInDepartment(departmentId: string) {
  const lastName = (f: FacultyMember) => f.name.split(" ").at(-1)!;
  return faculty
    .filter((f) => f.department === departmentId)
    .sort((a, b) => Number(Boolean(b.role)) - Number(Boolean(a.role)) || lastName(a).localeCompare(lastName(b)));
}

// Events --------------------------------------------------------------------

// Events linked to an entry, e.g. eventsAbout("services", "career-center")
export const eventsAbout = (type: keyof Related, id: string) => events.filter((e) => e.related[type]?.includes(id));

// Events for a program: linked to the program itself or to its department
export const eventsForProgram = (program: Program) =>
  events.filter((e) => e.related.programs?.includes(program.id) || e.related.departments?.includes(program.department));

export const hasEnded = (event: Event, now = new Date()) => new Date(event.end) < now;

// Department names (e.g. "Nursing") an event or story is about: its related
// departments, plus the departments of related programs and faculty. Used to
// prefer items in someone's top-interest department.
export function relatedDepartmentNames(related: Related) {
  const ids = new Set([
    ...(related.departments ?? []),
    ...(related.programs ?? []).map((id) => programs.find((p) => p.id === id)?.department),
    ...(related.faculty ?? []).map((id) => facultyById.get(id)?.department),
  ]);
  return [...ids].filter((id): id is string => Boolean(id)).map((id) => departmentById.get(id)!.field);
}

// Search ---------------------------------------------------------------------

const norm = (s: unknown) => String(s ?? "").toLowerCase();
const tokens = (q?: string) => norm(q).split(/[^a-z0-9']+/).filter((t) => t.length > 1);

// Simple weighted keyword scoring: every word must match somewhere, and
// matches in more important fields score higher. Good enough for a demo.
function score(query: string | undefined, fields: [string, number][]) {
  const words = tokens(query);
  if (!words.length) return 1;
  let total = 0;
  for (const word of words) {
    let hit = 0;
    for (const [text, weight] of fields) if (norm(text).includes(word)) hit = Math.max(hit, weight);
    if (!hit) return 0;
    total += hit;
  }
  return total;
}

const eq = (a: string, b?: string) => !b || norm(a) === norm(b);
const has = (arr: readonly string[], v?: string) => !v || arr.some((x) => norm(x) === norm(v));

// Programs -------------------------------------------------------------------

const programSummary = (p: Program, base: Base) => ({
  id: p.id,
  name: p.name,
  level: p.level,
  college: collegeOf(p).name,
  modality: p.modality,
  start_terms: p.start_terms,
  estimated_total_tuition_usd: p.estimated_total_tuition_usd,
  url: absoluteUrl(pagePath("programs", p.id), base),
});

type ProgramQuery = {
  query?: string;
  level?: string;
  modality?: string;
  college?: string;
  start_term?: string;
  max_total_tuition_usd?: number;
  limit?: number;
};

export function searchPrograms({ query, level, modality, college, start_term, max_total_tuition_usd, limit = 5 }: ProgramQuery, base: Base) {
  const results = programs
    .filter((p) => eq(p.level, level) && eq(p.modality, modality) && has(p.start_terms, start_term))
    .filter((p) => !college || norm(collegeOf(p).name).includes(norm(college)))
    .filter((p) => !max_total_tuition_usd || p.estimated_total_tuition_usd <= max_total_tuition_usd)
    .map((p) => {
      const field = departmentOf(p).field;
      const s = score(query, [[p.name, 5], [field, 5], [p.keywords.join(" "), 3], [p.careers.join(" "), 3], [collegeOf(p).name, 2], [p.description, 1]]);
      return { p, s };
    })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name));
  const shown = results.slice(0, limit);
  return {
    total_matches: results.length,
    results: shown.map((r) => programSummary(r.p, base)),
    ...(results.length > shown.length && { note: `Showing the top ${shown.length} of ${results.length} matches. Refine filters to narrow.` }),
  };
}

const findProgram = (id: string) => programs.find((p) => p.id === id) ?? programs.find((p) => norm(p.name) === norm(id));

export function getProgram(id: string, base: Base) {
  const p = findProgram(id);
  if (!p) return null;
  const department = departmentOf(p);
  return {
    ...p,
    field: department.field,
    department: department.name,
    college: collegeOf(p).name,
    url: absoluteUrl(pagePath("programs", p.id), base),
    sample_courses: relatedCourses(p)
      .slice(0, 8)
      .map((c) => ({ code: c.code, title: c.title, credits: c.credits, url: absoluteUrl(pagePath("courses", c.id), base) })),
    related_programs: relatedPrograms(p).map((x) => ({ id: x.id, name: x.name, url: absoluteUrl(pagePath("programs", x.id), base) })),
  };
}

export function comparePrograms(ids: string[], base: Base) {
  return ids.map((id) => {
    const p = getProgram(id, base);
    if (!p) return { id, error: "No program with this id. Use search_programs to find valid ids." };
    const { name, level, credential, modality, campus, credits, duration, start_terms, estimated_total_tuition_usd, tuition_per_credit_usd, requirements, careers, url } = p;
    return { id: p.id, name, level, credential, modality, campus, credits, duration, start_terms, estimated_total_tuition_usd, tuition_per_credit_usd, requirements, careers, url };
  });
}

export function listColleges() {
  return colleges.map((college) => {
    const depts = departments.filter((d) => d.college === college.id);
    return {
      college: college.name,
      description: college.description,
      program_count: programs.filter((p) => collegeOf(p).id === college.id).length,
      departments: depts.map((d) => d.name),
    };
  });
}

// Courses --------------------------------------------------------------------

type CourseQuery = { query?: string; field?: string; level?: string; term?: string; modality?: string; limit?: number };

export function searchCourses({ query, field, level, term, modality, limit = 20 }: CourseQuery, base: Base) {
  const results = courses
    .filter((c) => !field || norm(departmentOf(c).field).includes(norm(field)))
    .filter((c) => eq(c.level, level) && has(c.terms_offered, term) && eq(c.modality, modality))
    .map((c) => ({ c, s: score(query, [[c.code, 6], [c.title, 5], [departmentOf(c).field, 3], [c.description, 1], [instructorOf(c).name, 2]]) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.c.code.localeCompare(b.c.code, undefined, { numeric: true }));
  return {
    total_matches: results.length,
    results: results.slice(0, limit).map(({ c }) => ({
      code: c.code,
      title: c.title,
      credits: c.credits,
      level: c.level,
      terms_offered: c.terms_offered,
      modality: c.modality,
      url: absoluteUrl(pagePath("courses", c.id), base),
    })),
  };
}

export function getCourse(code: string, base: Base) {
  const c = courses.find((x) => norm(x.code) === norm(code) || x.id === norm(code));
  if (!c) return null;
  const department = departmentOf(c);
  const instructor = instructorOf(c);
  return {
    ...c,
    field: department.field,
    department: department.name,
    college: collegeOf(c).name,
    instructor: { name: instructor.name, title: instructor.title, url: absoluteUrl(pagePath("faculty", instructor.id), base) },
    prerequisites: prerequisitesOf(c).map((p) => ({ code: p.code, title: p.title, url: absoluteUrl(pagePath("courses", p.id), base) })),
    url: absoluteUrl(pagePath("courses", c.id), base),
    programs_in_field: programsInDepartment(c.department).map((p) => ({ name: p.name, url: absoluteUrl(pagePath("programs", p.id), base) })),
  };
}

// Services -------------------------------------------------------------------

const serviceSummary = (s: Service, base: Base) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  description: s.description,
  url: absoluteUrl(pagePath("services", s.id), base),
});

export function findServices({ query, category }: { query?: string; category?: string }, base: Base) {
  const results = services
    .filter((s) => eq(s.category, category))
    .map((s) => ({ s, sc: score(query, [[s.name, 5], [s.tags.join(" "), 4], [s.description, 2], [s.category, 2]]) }))
    .filter((r) => r.sc > 0)
    .sort((a, b) => b.sc - a.sc || a.s.name.localeCompare(b.s.name));
  return { total_matches: results.length, results: results.map((r) => serviceSummary(r.s, base)) };
}

export function getService(id: string, base: Base) {
  const s = services.find((x) => x.id === id) ?? services.find((x) => norm(x.name) === norm(id));
  return s ? { ...s, url: absoluteUrl(pagePath("services", s.id), base), open_now: isOpen(s, new Date()) } : null;
}

export function servicesOpenAt(at: string | undefined, base: Base) {
  const date = at ? new Date(at) : new Date();
  if (Number.isNaN(date.getTime())) return { error: "Could not read that date. Use ISO 8601, for example 2026-10-05T14:30:00-07:00." };
  const { day, time } = campusTime(date);
  return {
    checked_at_campus_time: `${day} ${time} (${siteConfig.timezone})`,
    open: services.filter((s) => isOpen(s, date)).map((s) => ({ ...serviceSummary(s, base), closes_at: s.hours[day]![1] })),
  };
}

// Faculty --------------------------------------------------------------------

const facultySummary = (f: FacultyMember, base: Base) => ({
  id: f.id,
  name: f.name,
  title: f.title,
  ...(f.role && { role: f.role }),
  department: departmentOf(f).field,
  research_interests: f.research_interests,
  url: absoluteUrl(pagePath("faculty", f.id), base),
});

type FacultyQuery = { query?: string; department?: string; limit?: number };

// By name or expertise (research interests), optionally within a department
export function searchFaculty({ query, department, limit = 10 }: FacultyQuery, base: Base) {
  const results = faculty
    .filter((f) => !department || norm(departmentOf(f).field).includes(norm(department)) || f.department === norm(department))
    .map((f) => ({ f, s: score(query, [[f.name, 6], [f.research_interests.join(" "), 5], [departmentOf(f).field, 3], [f.title, 2], [f.bio, 1]]) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.f.name.localeCompare(b.f.name));
  const shown = results.slice(0, limit);
  return {
    total_matches: results.length,
    results: shown.map((r) => facultySummary(r.f, base)),
    ...(results.length > shown.length && { note: `Showing ${shown.length} of ${results.length} matches. Narrow by department or expertise.` }),
  };
}

export function getFaculty(id: string, base: Base) {
  const f = faculty.find((x) => x.id === id) ?? faculty.find((x) => norm(x.name) === norm(id));
  if (!f) return null;
  return {
    ...facultySummary(f, base),
    college: collegeOf(f).name,
    email: f.email,
    office: f.office,
    bio: f.bio,
    courses: coursesTaughtBy(f.id).map((c) => ({ code: c.code, title: c.title, url: absoluteUrl(pagePath("courses", c.id), base) })),
    upcoming_events: eventsAbout("faculty", f.id)
      .filter((e) => !hasEnded(e))
      .map((e) => ({ title: e.title, when: eventWhen(e), url: absoluteUrl(pagePath("events", e.id), base) })),
  };
}

// Events ---------------------------------------------------------------------

type EventQuery = { query?: string; from?: string; to?: string; category?: string; campus?: string; audience?: string; upcoming?: boolean; limit?: number };

// Events by date range (YYYY-MM-DD, campus time), category, campus, or
// audience. With no date range, only events that haven't ended yet, unless
// upcoming is false.
export function searchEvents({ query, from, to, category, campus, audience, upcoming = true, limit = 10 }: EventQuery, base: Base) {
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: siteConfig.timezone });
  const now = new Date();
  const results = events
    .filter((e) => (from || to ? (!from || day(e.end) >= from) && (!to || day(e.start) <= to) : !upcoming || !hasEnded(e, now)))
    .filter((e) => eq(e.category, category) && eq(e.campus, campus) && has(e.audience, audience))
    .filter((e) => score(query, [[e.title, 5], [e.description, 2], [e.location, 2]]) > 0)
    .sort((a, b) => a.start.localeCompare(b.start));
  const shown = results.slice(0, limit);
  return {
    total_matches: results.length,
    results: shown.map((e) => ({
      id: e.id,
      title: e.title,
      when: eventWhen(e),
      start: e.start,
      end: e.end,
      category: e.category,
      campus: e.campus,
      location: e.location,
      audience: e.audience,
      registration_required: e.registration_required,
      url: absoluteUrl(pagePath("events", e.id), base),
    })),
    ...(results.length > shown.length && { note: `Showing the first ${shown.length} of ${results.length} events by date.` }),
  };
}

// News -----------------------------------------------------------------------

type NewsQuery = { query?: string; tag?: string; department?: string; limit?: number };

// Stories, newest first, optionally by keyword, tag, or department
export function listNews({ query, tag, department, limit = 10 }: NewsQuery, base: Base) {
  const results = news
    .filter((n) => has(n.tags, tag))
    .filter((n) => !department || relatedDepartmentNames(n.related).some((d) => norm(d).includes(norm(department))))
    .filter((n) => score(query, [[n.title, 5], [n.summary, 3], [n.tags.join(" "), 3]]) > 0);
  return {
    total_matches: results.length,
    results: results.slice(0, limit).map((n) => ({
      title: n.title,
      date: n.date,
      summary: n.summary,
      author: n.author,
      tags: n.tags,
      departments: relatedDepartmentNames(n.related),
      url: absoluteUrl(pagePath("news", n.id), base),
    })),
  };
}
