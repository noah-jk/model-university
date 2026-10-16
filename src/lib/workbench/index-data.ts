// Builds /data/workbench-index.json: the slice of the catalog the workbench
// page needs to show saved items with live data. Links are site-relative to
// keep the file small.

import * as catalog from "../catalog.ts";
import { pagePath } from "../urls.ts";
import type { WorkbenchIndex } from "./types.ts";

const keyed = <T extends { id: string }, R>(rows: T[], pick: (row: T) => R) => Object.fromEntries(rows.map((row) => [row.id, pick(row)]));

export function buildIndex(): WorkbenchIndex {
  return {
    program: keyed(catalog.programs, (p) => ({
      name: p.name,
      url: pagePath("programs", p.id),
      level: p.level,
      credential: p.credential,
      college: catalog.collegeOf(p).name,
      department: catalog.departmentOf(p).field,
      modality: p.modality,
      campus: p.campus,
      start_terms: p.start_terms,
      application_deadlines: p.application_deadlines,
      duration: p.duration,
      credits: p.credits,
      tuition_per_credit_usd: p.tuition_per_credit_usd,
      estimated_total_tuition_usd: p.estimated_total_tuition_usd,
    })),
    course: keyed(catalog.courses, (c) => ({ code: c.code, title: c.title, url: pagePath("courses", c.id), credits: c.credits, terms_offered: c.terms_offered, modality: c.modality })),
    faculty: keyed(catalog.faculty, (f) => ({ name: f.name, title: f.role ?? f.title, department: catalog.departmentOf(f).field, url: pagePath("faculty", f.id) })),
    event: keyed(catalog.events, (e) => ({
      title: e.title,
      url: pagePath("events", e.id),
      start: e.start,
      end: e.end,
      location: e.location,
      campus: e.campus,
      // Who the event is for, when it's for particular students (Your Path suggests these)
      ...(e.levels && { levels: e.levels }),
      ...(e.student_types && { student_types: e.student_types }),
    })),
    service: keyed(catalog.services, (s) => ({ name: s.name, url: pagePath("services", s.id), category: s.category, location: s.location })),
    news: keyed(catalog.news, (n) => ({ title: n.title, url: pagePath("news", n.id), date: n.date })),
  };
}
