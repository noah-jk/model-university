// Build-time half of the personalization experiment: the metadata each detail
// page exposes for the tracker (src/scripts/personalize.ts).

import type { Course, Event, FacultyMember, Program, Related, Service } from "./schemas.ts";
import type { PageMeta } from "./personalization-settings.ts";
import { collegeOf, departmentOf, departments } from "./catalog.ts";

const departmentFields = (departmentId: string) => {
  const department = departments.find((d) => d.id === departmentId)!;
  return { department: department.field, college: collegeOf(department).name };
};

// Events and stories count toward a department only when they're about exactly one
const singleDepartment = (related: Related) => (related.departments?.length === 1 ? departmentFields(related.departments[0]) : {});

export const pageMeta = {
  program: (p: Program): PageMeta => ({ type: "program", id: p.id, name: p.name, ...departmentFields(p.department), level: p.level, modality: p.modality }),
  course: (c: Course): PageMeta => ({ type: "course", id: c.id, name: `${c.code}: ${c.title}`, ...departmentFields(c.department), level: c.level, modality: c.modality }),
  faculty: (f: FacultyMember): PageMeta => ({ type: "faculty", id: f.id, name: f.name, ...departmentFields(departmentOf(f).id) }),
  service: (s: Service): PageMeta => ({ type: "service", id: s.id, name: s.name }),
  event: (e: Event): PageMeta => ({ type: "event", id: e.id, name: e.title, ...singleDepartment(e.related) }),
  news: (id: string, title: string, related: Related): PageMeta => ({ type: "news", id, name: title, ...singleDepartment(related) }),
};

// <main data-page-type="program" data-page-id="…" …>
export const pageDataAttributes = (meta?: PageMeta) =>
  meta
    ? {
        "data-page-type": meta.type,
        "data-page-id": meta.id,
        "data-page-name": meta.name,
        "data-department": meta.department,
        "data-college": meta.college,
        "data-level": meta.level,
        "data-modality": meta.modality,
      }
    : {};
