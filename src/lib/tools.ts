// The catalog and enrollment tools: names, descriptions, input schemas, and
// what each one runs. The MCP server (netlify/functions/mcp.mts) registers all of them, and
// natural-language search (src/lib/search/) offers a subset to the model, so
// both describe the catalog in the same words and answer from the same code.

import { z } from "zod";
import * as catalog from "./catalog.ts";
import * as enrollment from "./enrollment.ts";
import { listText } from "./format.ts";
import { ALL_STUDENT_TYPES, AUDIENCES, CAMPUSES, COURSE_LEVELS, EVENT_CATEGORIES, LEVEL_OF_PROGRAM, MODALITIES, PROGRAM_LEVELS, SERVICE_CATEGORIES, STUDENT_LEVELS, STUDENT_TYPES, TERMS } from "./vocab.ts";

type StudentLevel = (typeof STUDENT_LEVELS)[number];

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

// A tool's run() throws this when the input can't be answered, with a message
// that says how to fix it. The MCP server returns it as an error result.
export class ToolError extends Error {}

// Keeps each tool's run() typed by its own input schema
const tool = <Shape extends z.ZodRawShape>(t: Tool<Shape>) => t as unknown as Tool;

const level = z.enum(PROGRAM_LEVELS);
const modality = z.enum(MODALITIES);
const term = z.enum(TERMS);
const limit = z.number().int().min(1).max(50).optional();
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// Enrollment steps and the academic calendar: a student type, a level, and a
// start term like "Winter 2027" that the calendar covers
const studentType = z.enum(ALL_STUDENT_TYPES);
const studentLevel = z.enum(STUDENT_LEVELS);
const startTerm = z.string().regex(/^(Winter|Spring|Summer|Fall) \d{4}$/, 'Use a term like "Winter 2027"');

function checkTerm(term: string) {
  if (!enrollment.calendarTerms.includes(term)) throw new ToolError(`The academic calendar covers ${enrollment.calendarTerms[0]} to ${enrollment.calendarTerms.at(-1)}. Use one of: ${enrollment.calendarTerms.join(", ")}.`);
}
// The levels a student type belongs to, checked against a level if one is given
function levelsFor(type: string | undefined, level: StudentLevel | undefined): StudentLevel[] | undefined {
  if (type && level && !enrollment.isStudentType(level, type)) {
    throw new ToolError(`${type} isn't a ${level.toLowerCase()} student type. For ${level}, use ${listText([...STUDENT_TYPES[level]], "or")}.`);
  }
  if (level) return [level];
  return type ? STUDENT_LEVELS.filter((l) => enrollment.isStudentType(l, type)) : undefined;
}

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
  tool({
    name: "get_enrollment_steps",
    title: "Get enrollment steps",
    description:
      "Everything one kind of student does to enroll, in order, with due dates for their start term, the office that helps with each step, and page urls; plus the offices for them, each with why. Prospective students start with the application journey (explore programs, request information, visit, apply). Each step's phase says whether it comes before an admission decision ('apply') or after ('admitted'). Pass program_id to fill in that program's application deadline; otherwise the apply step's deadline depends on the program. Ask the person's student type and level if you don't know them.",
    input: {
      student_type: studentType,
      level: studentLevel,
      term: startTerm.describe('Start term, e.g. "Winter 2027"'),
      program_id: z.string().optional().describe("Program id from search_programs, e.g. 'nursing-bs', for its application deadline"),
    },
    run: ({ student_type, level, term, program_id }, base) => {
      levelsFor(student_type, level);
      checkTerm(term);
      const program = program_id ? catalog.findProgram(program_id) : undefined;
      if (program_id && !program) throw new ToolError("No program with that id found. Use search_programs to find valid ids.");
      if (program && LEVEL_OF_PROGRAM[program.level] !== level) {
        throw new ToolError(`${program.name} is ${LEVEL_OF_PROGRAM[program.level] === "Graduate" ? "a graduate" : "an undergraduate"} program. Use level ${LEVEL_OF_PROGRAM[program.level]}, or a program at the ${level.toLowerCase()} level.`);
      }
      return enrollment.enrollmentSteps({ level, type: student_type, term, program }, base);
    },
  }),
  tool({
    name: "get_academic_calendar",
    title: "Get the academic calendar",
    description:
      "Institution-wide dates for a term and its academic year, in date order: orientation, registration, classes begin, tuition due, finals, the FAFSA priority date, and more. Give a student type or level to get only their dates. Application deadlines aren't here; each program has its own (get_program).",
    input: {
      term: startTerm.describe('Term, e.g. "Winter 2027"'),
      student_type: studentType.optional(),
      level: studentLevel.optional(),
    },
    run: ({ term, student_type, level }, base) => {
      const levels = levelsFor(student_type, level);
      checkTerm(term);
      return enrollment.academicCalendar({ term, type: student_type, levels }, base);
    },
  }),
];

export const toolNamed = (name: string) => tools.find((t) => t.name === name);
