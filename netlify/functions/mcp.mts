// The MCP endpoint, served at /mcp by Netlify Functions.
// Stateless Streamable HTTP: each request gets a fresh server, which suits
// serverless. Read-only tools over the generated content in content/generated/
// (programs, courses, student services, faculty, events, and news) and the
// enrollment rules in content/enrollment/ (steps and the academic calendar).
// The tools themselves are defined in src/lib/tools.ts, shared with on-site search.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import siteConfig from "../../site.config.ts";
import { ToolError, tools } from "../../src/lib/tools.ts";

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
const notFound = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });
const readOnly = { readOnlyHint: true, openWorldHint: false };

function buildServer(base: string) {
  const server = new McpServer(
    { name: "cascadia-state-catalog", version: "1.0.0" },
    {
      instructions: `Official academic program, course, student services, faculty, event, and news information for ${UNIVERSITY}, a fictional university used for demos. Use search tools to find ids, then get_* tools for details. When the person states preferences (field, level, format, start term, budget), apply them as search filters and recommend the 1–3 best matches, each with a one-line reason. Don't re-list options they've ruled out. If the person hasn't stated any preference, ask one short clarifying question. Once they've stated any preference, stop asking and recommend, even if details are missing; offer to refine afterward. Always include the page url for every program, course, service, faculty member, event, or news story you mention, as a link. Event times are in campus local time (Pacific). Tuition and deadlines are estimates; suggest confirming on the linked page. When someone asks what to do next, what's due, or how to apply or enroll, ask their student type (first-year, transfer, returning adult, international, new graduate, or current student) and level if you don't know them, then use get_enrollment_steps (with program_id if they've named a program) and get_academic_calendar for other dates. Application deadlines come from each program (get_program), not the calendar.`,
    }
  );

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.input, annotations: readOnly },
      async (args) => {
        try {
          const result = tool.run(args, base);
          return result == null ? notFound(tool.notFound!) : json(result);
        } catch (error) {
          // Input the tool can't answer, with how to fix it
          if (error instanceof ToolError) return notFound(error.message);
          throw error;
        }
      }
    );
  }

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

  server.registerPrompt(
    "plan-my-path",
    {
      title: "Plan my path",
      description: "Say what kind of student you are and when you'd start, and get a checklist of every step and deadline, with links.",
      argsSchema: {
        student_type: z.string().optional().describe("First-year, Transfer, Returning adult, International, New graduate student, or Current student"),
        level: z.string().optional().describe("Undergraduate or Graduate"),
        start_term: z.string().optional().describe('When you\'d start, e.g. "Winter 2027"'),
        program: z.string().optional().describe("A program name or id, for its application deadline"),
      },
    },
    ({ student_type, level, start_term, program }) => {
      const stated = Object.entries({ "student type": student_type, level, "start term": start_term }).filter(([, v]) => v);
      const missing = ["student type", "level", "start term"].filter((k) => !stated.some(([s]) => s === k));
      const about = stated.length ? stated.map(([k, v]) => `${k}: ${v}`).join("; ") : "nothing yet";
      const ask = missing.length ? ` First ask me my ${missing.join(" and ")} in one short question.` : "";
      const programStep = program ? ` I'm interested in "${program}": find its id with search_programs if needed, and pass it as program_id so the apply step has its deadline.` : "";
      return userText(
        `Help me plan my path to ${UNIVERSITY}. About me: ${about}.${ask}${programStep} Then use get_enrollment_steps and give me a plain checklist in order: each step with its due date (say if it has passed), the office that helps, and a link. End with the key dates from get_academic_calendar for my start term that aren't already in the list.`
      );
    }
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
