// Tests for career data (#58): the generated numbers hang together, adding
// them changed nothing else, and the queries pages and MCP share do what
// they say. Run with: npm test

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as catalog from "../src/lib/catalog.ts";

const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
  console.log(`✓ ${message}`);
};

// Careers have their own random stream, so the rest of the catalog is exactly
// what it was before them. If you change other generated data on purpose,
// update these hashes.
const BEFORE_CAREERS: Record<string, string> = {
  colleges: "16ceb2d63edfc5a1",
  departments: "be2f70a0b0c15d4a",
  programs: "4265fa7bce779856",
  courses: "733fcdc778a0d312",
  services: "5181a262a82e0ecc",
  faculty: "b543a0e72533269e",
  events: "15a7198082be8d30",
};
const hashOf = (name: string) => createHash("sha256").update(readFileSync(new URL(`../content/generated/${name}.json`, import.meta.url))).digest("hex").slice(0, 16);
check(Object.entries(BEFORE_CAREERS).every(([name, hash]) => hashOf(name) === hash), "adding careers changed no other generated data");

// The numbers ---------------------------------------------------------------------

const { careers } = catalog;
check(careers.length > 100 && careers.every((c) => c.wages && c.postings.length === 12), `${careers.length} careers, each with its numbers`);
check(careers.every((c) => c.wages.national.median < c.wages.washington.median), "Washington pays more than the national median, as it does for most jobs");
const median = (id: string) => catalog.findCareer(id)!.wages.washington.median;
check(median("nurse-practitioner") > median("registered-nurse") && median("registered-nurse") > median("fitness-trainer"), "wages are believable relative to each other");
check(careers.every((c) => c.annual_openings < c.employment), "openings are a share of employment");
check(careers.every((c) => c.skills.some((s) => s.type === "specialized") && c.skills.some((s) => s.type === "common")), "every career has specialized and common skills");

// Queries --------------------------------------------------------------------------

check(catalog.findCareer("15-1252")?.id === "software-developer" && catalog.findCareer("Software Developers")?.id === "software-developer" && catalog.findCareer("software developer")?.id === "software-developer", "findCareer: by id, SOC code, official title, or name");
const nursingBachelors = catalog.programs.find((p) => p.department === "nursing" && p.level === "Bachelor's")!;
const nursingMasters = catalog.programs.find((p) => p.department === "nursing" && p.level === "Master's");
check(catalog.careersForProgram(nursingBachelors)[0].id === "registered-nurse", "careersForProgram: a nursing bachelor's leads with registered nurse");
if (nursingMasters) check(catalog.careersForProgram(nursingMasters)[0].education === "Master's degree", "careersForProgram: a nursing master's leads with a career that asks for one");
check(catalog.programs.every((p) => catalog.careersForProgram(p).length > 0), "careersForProgram: every program has careers");
const shared = catalog.findCareer("it-manager")!;
const itProgram = catalog.programs.find((p) => p.department === "information-technology")!;
check(catalog.careersForProgram(itProgram)[0].cips[0] === "11.0103", "careersForProgram: a field's own occupations come before shared ones");
const forManager = catalog.programsForCareer(shared);
check(forManager.length > 0 && new Set(forManager.map((p) => p.department)).size > 1, "programsForCareer: programs from every field the career matches");
check(careers.every((c) => catalog.programsForCareer(c).length > 0), "programsForCareer: every career has programs");

const names = (list: catalog.Career[]) => list.map((c) => c.id);
check(names(catalog.searchCareers({ query: "nurse" })).slice(0, 2).every((id) => /nurs/.test(id)), "searchCareers: by name");
check(names(catalog.searchCareers({ query: "UX designer" })).includes("digital-interface-designer"), "searchCareers: by other titles");
check(names(catalog.searchCareers({ query: "AutoCAD" })).length > 0, "searchCareers: by skill");
const bachelorsOrLess = catalog.searchCareers({ education: "Bachelor's degree" });
check(bachelorsOrLess.length > 0 && bachelorsOrLess.every((c) => !["Master's degree", "Doctoral or professional degree"].includes(c.education)), "searchCareers: education is the most someone wants to need");
check(catalog.searchCareers({ min_wage: 120000 }).every((c) => c.wages.washington.median >= 120000) && catalog.searchCareers({ min_growth: 20 }).every((c) => c.growth_percent >= 20), "searchCareers: minimum wage and growth");
check(catalog.searchCareers({ field: "nursing" }).every((c) => c.cips.includes("51.3801")) && catalog.searchCareers({ field: "Nursing" }).length === catalog.searchCareers({ field: "nursing" }).length, "searchCareers: by field, id or name");
check(catalog.searchCareers({ field: "not-a-field" }).length === 0, "searchCareers: an unknown field matches nothing");
check(catalog.departmentsForCareer(catalog.findCareer("registered-nurse")!).map((d) => d.id).join() === "nursing", "departmentsForCareer: for the interest profile");

console.log("\nCareer checks passed.");
