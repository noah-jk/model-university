// The MCP endpoint, served at /mcp by Netlify Functions.
// Stateless Streamable HTTP: each request gets a fresh server, which suits
// serverless. Read-only tools over the generated content in content/generated/.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import siteConfig from "../../site.config.ts";
import * as catalog from "../../src/lib/catalog.ts";
import { COURSE_LEVELS, MODALITIES, PROGRAM_LEVELS, SERVICE_CATEGORIES, TERMS } from "../../src/lib/vocab.ts";

const UNIVERSITY = siteConfig.name;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
};

// Headers on every response. Static files get X-Robots-Tag from dist/_headers;
// functions have to send it themselves.
const BASE_HEADERS = siteConfig.indexing ? CORS : { ...CORS, "X-Robots-Tag": "noindex" };

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const notFound = (what: string, hint: string) => ({ content: [{ type: "text" as const, text: `No ${what} found. ${hint}` }], isError: true });
const readOnly = { readOnlyHint: true, openWorldHint: false };

const level = z.enum(PROGRAM_LEVELS);
const modality = z.enum(MODALITIES);
const term = z.enum(TERMS);

function buildServer(base: string) {
  const server = new McpServer(
    { name: "cascadia-state-catalog", version: "1.0.0" },
    {
      instructions: `Official academic program, course, and student services information for ${UNIVERSITY}, a fictional university used for demos. Use search tools to find ids, then get_* tools for details. When the person states preferences (field, level, format, start term, budget), apply them as search filters and recommend the 1–3 best matches, each with a one-line reason. Don't re-list options they've ruled out. If the person hasn't stated any preference, ask one short clarifying question. Once they've stated any preference, stop asking and recommend, even if details are missing; offer to refine afterward. Always include the page url for every program, course, or service you mention, as a link. Tuition and deadlines are estimates; suggest confirming on the linked page.`,
    }
  );

  server.registerTool(
    "search_programs",
    {
      title: "Search academic programs",
      description: "Find degree programs, minors, and certificates by topic, career interest, level, format, college, start term, or budget. Apply every preference the person has stated as a filter. Returns ranked matches with page urls.",
      inputSchema: {
        query: z.string().optional().describe("Topic, field, or career, e.g. 'nursing', 'data', 'become a teacher'"),
        level: level.optional(),
        modality: modality.optional(),
        college: z.string().optional().describe("Full or partial college name, e.g. 'Business'"),
        start_term: term.optional(),
        max_total_tuition_usd: z.number().optional().describe("Upper limit on estimated total tuition"),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: readOnly,
    },
    async (args) => json(catalog.searchPrograms(args, base))
  );

  server.registerTool(
    "get_program",
    {
      title: "Get program details",
      description: "Full details for one program: description, requirements, deadlines, tuition, outcomes, careers, sample courses, and related programs. Cite the url in your answer.",
      inputSchema: { id: z.string().describe("Program id from search_programs, e.g. 'nursing-bs'") },
      annotations: readOnly,
    },
    async ({ id }) => {
      const p = catalog.getProgram(id, base);
      return p ? json(p) : notFound("program with that id", "Use search_programs to find valid ids.");
    }
  );

  server.registerTool(
    "compare_programs",
    {
      title: "Compare programs",
      description: "Side-by-side comparison of 2–5 programs: cost, length, format, start terms, requirements, and careers.",
      inputSchema: { ids: z.array(z.string()).min(2).max(5) },
      annotations: readOnly,
    },
    async ({ ids }) => json(catalog.comparePrograms(ids, base))
  );

  server.registerTool(
    "list_colleges",
    {
      title: "List colleges and departments",
      description: "All colleges, their departments, and how many programs each offers.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => json(catalog.listColleges())
  );

  server.registerTool(
    "search_courses",
    {
      title: "Search courses",
      description: "Search the course catalog by keyword, course code, field, level, term offered, or format.",
      inputSchema: {
        query: z.string().optional().describe("Keyword or course code, e.g. 'ethics' or 'CS 248'"),
        field: z.string().optional().describe("Field of study, e.g. 'Biology'"),
        level: z.enum(COURSE_LEVELS).optional(),
        term: term.optional(),
        modality: modality.optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: readOnly,
    },
    async (args) => json(catalog.searchCourses(args, base))
  );

  server.registerTool(
    "get_course",
    {
      title: "Get course details",
      description: "Full details for one course, including prerequisites, instructor, and terms offered. Cite the url in your answer.",
      inputSchema: { code: z.string().describe("Course code, e.g. 'CS 248'") },
      annotations: readOnly,
    },
    async ({ code }) => {
      const c = catalog.getCourse(code, base);
      return c ? json(c) : notFound("course with that code", "Use search_courses to find valid codes.");
    }
  );

  server.registerTool(
    "find_services",
    {
      title: "Find student services",
      description: "Find campus offices and support services by need, e.g. 'tutoring', 'pay my bill', 'food', 'accommodations'. Cite the url in your answer.",
      inputSchema: {
        query: z.string().optional(),
        category: z.enum(SERVICE_CATEGORIES).optional(),
      },
      annotations: readOnly,
    },
    async (args) => json(catalog.findServices(args, base))
  );

  server.registerTool(
    "get_service",
    {
      title: "Get service details",
      description: "Hours, location, contact info, eligibility, and whether a service is open right now. Cite the url in your answer.",
      inputSchema: { id: z.string().describe("Service id from find_services, e.g. 'writing-center'") },
      annotations: readOnly,
    },
    async ({ id }) => {
      const s = catalog.getService(id, base);
      return s ? json(s) : notFound("service with that id", "Use find_services to find valid ids.");
    }
  );

  server.registerTool(
    "services_open_now",
    {
      title: "Services open now",
      description: "Which student services are open right now, or at a given time, in campus local time.",
      inputSchema: { at: z.string().optional().describe("Optional ISO 8601 date and time; defaults to now") },
      annotations: readOnly,
    },
    async ({ at }) => json(catalog.servicesOpenAt(at, base))
  );

  const userText = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

  server.registerPrompt(
    "recommend-program",
    {
      title: "Recommend a program",
      description: "Share your interests and preferences, and get the top 3 matching programs with links.",
      argsSchema: {
        interest: z.string().optional().describe("Field or career interest, e.g. 'nursing'"),
        level: z.string().optional().describe("Bachelor's, Master's, Doctorate, Certificate, or Minor"),
        format: z.string().optional().describe("In person, Online, or Hybrid"),
        budget: z.string().optional().describe("Maximum total tuition, e.g. '$40,000'"),
      },
    },
    ({ interest, level, format, budget }) => {
      const stated = Object.entries({ interest, level, format, budget }).filter(([, v]) => v);
      const prefs = stated.length ? stated.map(([k, v]) => `${k}: ${v}`).join("; ") : "none stated yet";
      return userText(`Recommend academic programs at ${UNIVERSITY}. My preferences: ${prefs}. Use search_programs and apply every preference as a filter. Give me the top 3 matches, each with a one-line reason and a link to its page. Don't ask follow-up questions.`);
    }
  );

  server.registerPrompt(
    "find-help",
    {
      title: "Find student help",
      description: "Describe what you need and get the right service, whether it's open now, and its link.",
      argsSchema: { need: z.string().optional().describe("What you need help with, e.g. 'tutoring' or 'pay my bill'") },
    },
    ({ need }) => userText(`I need help with: ${need || "something at the university"}. Use find_services to pick the best service at ${UNIVERSITY}, then get_service to check whether it's open right now. Tell me which service to use, whether it's open now, and give me its link.`)
  );

  return server;
}

export default async (req: Request) => {
  if (!siteConfig.features.mcp) return new Response("Not found", { status: 404 });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: BASE_HEADERS });

  // Stateless server: no server-initiated streams or sessions to close.
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Send MCP requests as POST." }, id: null }), {
      status: 405,
      headers: { ...BASE_HEADERS, "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    });
  }

  const base = new URL(req.url).origin;
  const server = buildServer(base);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);

  const res = await transport.handleRequest(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(BASE_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
};

export const config = { path: "/mcp" };
