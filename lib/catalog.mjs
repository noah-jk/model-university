// Query logic for the catalog. Plain functions over the JSON data,
// so the MCP function (and anything else) can share them.

import programsData from "../data/programs.json" with { type: "json" };
import coursesData from "../data/courses.json" with { type: "json" };
import servicesData from "../data/services.json" with { type: "json" };

export const programs = programsData.programs;
export const courses = coursesData.courses;
export const services = servicesData.services;
export const departments = programsData.departments;
export const TIMEZONE = servicesData.timezone;

const norm = (s) => String(s ?? "").toLowerCase();
const tokens = (q) => norm(q).split(/[^a-z0-9']+/).filter((t) => t.length > 1);

// Simple weighted keyword scoring. Good enough for a demo; swap for a real
// search index (Pagefind, Orama, Algolia) if you want fuzzy matching.
function score(query, fields) {
  const qs = tokens(query);
  if (!qs.length) return 1;
  let total = 0;
  for (const q of qs) {
    let hit = 0;
    for (const [text, weight] of fields) {
      const t = norm(text);
      if (t.includes(q)) hit = Math.max(hit, weight);
    }
    if (!hit) return 0; // every word must match somewhere
    total += hit;
  }
  return total;
}

const eq = (a, b) => !b || norm(a) === norm(b);
const has = (arr, v) => !v || arr.some((x) => norm(x) === norm(v));

// Courses have no page of their own, so link to their field's section on /courses/
// (matches the heading ids written by scripts/build.mjs).
const courseUrl = (c, base) => absoluteUrl(`/courses/#f-${c.field.replace(/\W+/g, "-")}`, base);

export function absoluteUrl(path, base) {
  return base ? new URL(path, base).toString() : path;
}

const programSummary = (p, base) => ({
  id: p.id,
  name: p.name,
  level: p.level,
  college: p.college,
  modality: p.modality,
  start_terms: p.start_terms,
  estimated_total_tuition_usd: p.estimated_total_tuition_usd,
  url: absoluteUrl(p.url_path, base),
});

export function searchPrograms({ query, level, modality, college, start_term, max_total_tuition_usd, limit = 5 } = {}, base) {
  const results = programs
    .filter((p) => eq(p.level, level) && eq(p.modality, modality) && (!college || norm(p.college).includes(norm(college))) && has(p.start_terms, start_term))
    .filter((p) => !max_total_tuition_usd || p.estimated_total_tuition_usd <= max_total_tuition_usd)
    .map((p) => ({ p, s: score(query, [[p.name, 5], [p.field, 5], [p.keywords.join(" "), 3], [p.careers.join(" "), 3], [p.college, 2], [p.description, 1]]) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name));
  const shown = results.slice(0, limit);
  const out = { total_matches: results.length, results: shown.map((r) => programSummary(r.p, base)) };
  if (results.length > shown.length) out.note = `Showing the top ${shown.length} of ${results.length} matches. Refine filters to narrow.`;
  return out;
}

export function getProgram(id, base) {
  const p = programs.find((x) => x.id === id) ?? programs.find((x) => norm(x.name) === norm(id));
  if (!p) return null;
  const relatedCourses = courses.filter((c) => c.field === p.field && (p.level === "Bachelor's" || p.level === "Minor" ? !c.level.startsWith("Graduate") : c.level === "Graduate" || c.level === "Upper division"));
  return {
    ...p,
    url: absoluteUrl(p.url_path, base),
    sample_courses: relatedCourses.slice(0, 8).map((c) => ({ code: c.code, title: c.title, credits: c.credits })),
    related_programs: programs.filter((x) => x.field === p.field && x.id !== p.id).map((x) => ({ id: x.id, name: x.name })),
  };
}

export function comparePrograms(ids, base) {
  return ids.map((id) => {
    const p = getProgram(id, base);
    if (!p) return { id, error: "No program with this id. Use search_programs to find valid ids." };
    const { id: pid, name, level, credential, modality, campus, credits, duration, start_terms, estimated_total_tuition_usd, tuition_per_credit_usd, requirements, careers, url } = p;
    return { id: pid, name, level, credential, modality, campus, credits, duration, start_terms, estimated_total_tuition_usd, tuition_per_credit_usd, requirements, careers, url };
  });
}

export function listColleges() {
  return Object.entries(departments).map(([college, depts]) => ({
    college,
    program_count: programs.filter((p) => p.college === college).length,
    departments: depts,
  }));
}

export function searchCourses({ query, field, level, term, modality, limit = 20 } = {}, base) {
  const results = courses
    .filter((c) => (!field || norm(c.field).includes(norm(field))) && eq(c.level, level) && has(c.terms_offered, term) && eq(c.modality, modality))
    .map((c) => ({ c, s: score(query, [[c.code, 6], [c.title, 5], [c.field, 3], [c.description, 1], [c.instructor, 2]]) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.c.code.localeCompare(b.c.code, undefined, { numeric: true }));
  return {
    total_matches: results.length,
    results: results.slice(0, limit).map(({ c }) => ({ code: c.code, title: c.title, credits: c.credits, level: c.level, terms_offered: c.terms_offered, modality: c.modality, url: courseUrl(c, base) })),
  };
}

export function getCourse(code, base) {
  const c = courses.find((x) => norm(x.code) === norm(code) || x.id === norm(code));
  if (!c) return null;
  return { ...c, url: courseUrl(c, base), required_by_programs_in_field: programs.filter((p) => p.field === c.field).map((p) => p.name) };
}

const serviceSummary = (s, base) => ({ id: s.id, name: s.name, category: s.category, description: s.description, url: absoluteUrl(s.url_path, base) });

export function findServices({ query, category } = {}, base) {
  const results = services
    .filter((s) => eq(s.category, category))
    .map((s) => ({ s, sc: score(query, [[s.name, 5], [s.tags.join(" "), 4], [s.description, 2], [s.category, 2]]) }))
    .filter((r) => r.sc > 0)
    .sort((a, b) => b.sc - a.sc || a.s.name.localeCompare(b.s.name));
  return { total_matches: results.length, results: results.map((r) => serviceSummary(r.s, base)) };
}

export function getService(id, base) {
  const s = services.find((x) => x.id === id) ?? services.find((x) => norm(x.name) === norm(id));
  return s ? { ...s, url: absoluteUrl(s.url_path, base), open_now: isOpen(s, new Date()) } : null;
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function localParts(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return { day: parts.weekday.toLowerCase().slice(0, 3), time: `${parts.hour}:${parts.minute}` };
}

export function isOpen(service, date) {
  const { day, time } = localParts(date);
  const h = service.hours[day];
  return Boolean(h && time >= h[0] && time < h[1]);
}

export function servicesOpenAt(at, base) {
  const date = at ? new Date(at) : new Date();
  if (Number.isNaN(date.getTime())) return { error: "Could not read that date. Use ISO 8601, for example 2026-10-05T14:30:00-07:00." };
  const { day, time } = localParts(date);
  return {
    checked_at_campus_time: `${day} ${time} (${TIMEZONE})`,
    open: services.filter((s) => isOpen(s, date)).map((s) => ({ ...serviceSummary(s, base), closes_at: s.hours[day][1] })),
  };
}

export { DAYS };
