// The catalog tools: names, descriptions, input schemas, and what each one
// runs. The MCP server (netlify/functions/mcp.mts) registers all of them, and
// natural-language search (src/lib/search/) offers a subset to the model, so
// both describe the catalog in the same words and answer from the same code.

import { z } from "zod";
import * as catalog from "./catalog.ts";
import { AUDIENCES, CAMPUSES, COURSE_LEVELS, EVENT_CATEGORIES, MODALITIES, PROGRAM_LEVELS, SERVICE_CATEGORIES, TERMS } from "./vocab.ts";

export type Tool<Shape extends z.ZodRawShape = z.ZodRawShape> = {
  name: string;
  title: string;
  description: string;
  input: Shape;
  // Returns null when a get_* tool finds nothing
  run: (args: z.infer<z.ZodObject<Shape>>, base: string) => unknown;
  // What to tell the caller when run returns null
  notFound?: string;
};

// Keeps each tool's run() typed by its own input schema
const tool = <Shape extends z.ZodRawShape>(t: Tool<Shape>) => t as unknown as Tool;

const level = z.enum(PROGRAM_LEVELS);
const modality = z.enum(MODALITIES);
const term = z.enum(TERMS);
const limit = z.number().int().min(1).max(50).optional();
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const tools: Tool[] = [
  tool({
    name: "search_programs",
    title: "Search academic programs",
    description: "Find degree programs, minors, and certificates by topic, career interest, level, format, college, start term, or budget. Apply every preference the person has stated as a filter. Returns ranked matches with page urls.",
    input: {
      query: z.string().optional().describe("Topic, field, or career, e.g. 'nursing', 'data', 'become a teacher'"),
      level: level.optional(),
      modality: modality.optional(),
      college: z.string().optional().describe("Full or partial college name, e.g. 'Business'"),
      start_term: term.optional(),
      max_total_tuition_usd: z.number().optional().describe("Upper limit on estimated total tuition"),
      limit,
    },
    run: (args, base) => catalog.searchPrograms(args, base),
  }),
  tool({
    name: "get_program",
    title: "Get program details",
    description: "Full details for one program: description, requirements, deadlines, tuition, outcomes, careers, sample courses, and related programs. Cite the url in your answer.",
    input: { id: z.string().describe("Program id from search_programs, e.g. 'nursing-bs'") },
    run: ({ id }, base) => catalog.getProgram(id, base),
    notFound: "No program with that id found. Use search_programs to find valid ids.",
  }),
  tool({
    name: "compare_programs",
    title: "Compare programs",
    description: "Side-by-side comparison of 2–5 programs: cost, length, format, start terms, requirements, and careers.",
    input: { ids: z.array(z.string()).min(2).max(5) },
    run: ({ ids }, base) => catalog.comparePrograms(ids, base),
  }),
  tool({
    name: "list_colleges",
    title: "List colleges and departments",
    description: "All colleges, their departments, and how many programs each offers.",
    input: {},
    run: () => catalog.listColleges(),
  }),
  tool({
    name: "search_courses",
    title: "Search courses",
    description: "Search the course catalog by keyword, course code, field, level, term offered, or format.",
    input: {
      query: z.string().optional().describe("Keyword or course code, e.g. 'ethics' or 'CS 248'"),
      field: z.string().optional().describe("Field of study, e.g. 'Biology'"),
      level: z.enum(COURSE_LEVELS).optional(),
      term: term.optional(),
      modality: modality.optional(),
      limit,
    },
    run: (args, base) => catalog.searchCourses(args, base),
  }),
  tool({
    name: "get_course",
    title: "Get course details",
    description: "Full details for one course, including prerequisites, instructor, and terms offered. Cite the url in your answer.",
    input: { code: z.string().describe("Course code, e.g. 'CS 248'") },
    run: ({ code }, base) => catalog.getCourse(code, base),
    notFound: "No course with that code found. Use search_courses to find valid codes.",
  }),
  tool({
    name: "find_services",
    title: "Find student services",
    description: "Find campus offices and support services by need, e.g. 'tutoring', 'pay my bill', 'food', 'accommodations'. Cite the url in your answer.",
    input: {
      query: z.string().optional(),
      category: z.enum(SERVICE_CATEGORIES).optional(),
    },
    run: (args, base) => catalog.findServices(args, base),
  }),
  tool({
    name: "get_service",
    title: "Get service details",
    description: "Hours, location, contact info, eligibility, and whether a service is open right now. Cite the url in your answer.",
    input: { id: z.string().describe("Service id from find_services, e.g. 'writing-center'") },
    run: ({ id }, base) => catalog.getService(id, base),
    notFound: "No service with that id found. Use find_services to find valid ids.",
  }),
  tool({
    name: "services_open_now",
    title: "Services open now",
    description: "Which student services are open right now, or at a given time, in campus local time.",
    input: { at: z.string().optional().describe("Optional ISO 8601 date and time; defaults to now") },
    run: ({ at }, base) => catalog.servicesOpenAt(at, base),
  }),
  tool({
    name: "search_faculty",
    title: "Search faculty",
    description: "Find faculty by name, department, or expertise (research interests), e.g. 'machine learning' or 'Nguyen'. Returns titles, departments, interests, and page urls.",
    input: {
      query: z.string().optional().describe("Name or area of expertise, e.g. 'salmon' or 'Ana Quintero'"),
      department: z.string().optional().describe("Department or field, e.g. 'Nursing'"),
      limit,
    },
    run: (args, base) => catalog.searchFaculty(args, base),
  }),
  tool({
    name: "get_faculty",
    title: "Get faculty details",
    description: "One faculty member's bio, contact details, courses they teach, and upcoming events. Cite the url in your answer.",
    input: { id: z.string().describe("Faculty id from search_faculty, e.g. 'ingrid-duarte', or a full name") },
    run: ({ id }, base) => catalog.getFaculty(id, base),
    notFound: "No faculty member with that id or name found. Use search_faculty to find valid ids.",
  }),
  tool({
    name: "search_events",
    title: "Search events",
    description: "Find campus events: tours, open houses, information sessions, lectures, concerts, and workshops. By default only upcoming events; give from and to (campus dates) for a date range. Filter by category, campus, or audience.",
    input: {
      query: z.string().optional().describe("Keyword, e.g. 'tour' or 'financial aid'"),
      from: isoDay.optional().describe("Earliest date, YYYY-MM-DD"),
      to: isoDay.optional().describe("Latest date, YYYY-MM-DD"),
      category: z.enum(EVENT_CATEGORIES).optional(),
      campus: z.enum(CAMPUSES).optional(),
      audience: z.enum(AUDIENCES).optional(),
      upcoming: z.boolean().optional().describe("Without a date range: only events that haven't ended (default true)"),
      limit,
    },
    run: (args, base) => catalog.searchEvents(args, base),
  }),
  tool({
    name: "list_news",
    title: "List news",
    description: "News stories, newest first, optionally by keyword, tag, or department. Returns summaries and page urls.",
    input: {
      query: z.string().optional().describe("Keyword, e.g. 'grant'"),
      tag: z.string().optional().describe("Tag, e.g. 'research' or 'students'"),
      department: z.string().optional().describe("Department or field, e.g. 'Marine Biology'"),
      limit,
    },
    run: (args, base) => catalog.listNews(args, base),
  }),
];

export const toolNamed = (name: string) => tools.find((t) => t.name === name);
