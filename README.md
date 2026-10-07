# Model University: Cascadia State

A model university website for showing what an AI-ready higher-ed site looks like. "Cascadia State University" is fictional, and so is every program, course, and service on it.

What's included today:

- **The site**: programs (a single filterable list, plus a page for each program), a course catalog (a page for every subject and every course), student services, and a "Connect your AI" page
- **An MCP server** at `/mcp` with read-only tools: `search_programs`, `get_program`, `compare_programs`, `list_colleges`, `search_courses`, `get_course`, `find_services`, `get_service`, `services_open_now`, plus the prompts `recommend-program` and `find-help`. Every result carries an absolute page url.
- **AI-readable files**: `/llms.txt`, JSON feeds at `/data/*.json`, and a Markdown copy of every detail page at `…/index.md`

Search engines are asked not to index the site (`X-Robots-Tag: noindex`) until `indexing` is switched on in `site.config.ts`.

## How it fits together

One content layer feeds every page and every AI feature.

```
site.config.ts              Site name, URL, timezone, indexing, and AI feature switches
content/generated/          The catalog as JSON, written by scripts/generate-data.mjs (don't edit by hand)
src/
  content.config.ts         Astro content collections, one per generated file
  lib/
    schemas.ts              The content schemas (Zod)
    vocab.ts                Shared lists: levels, formats, terms, campuses, service categories
    catalog.ts              Lookups and search, used by pages and the MCP server
    urls.ts                 The one place page URLs are built
    hours.ts, format.ts, markdown.ts
  features/                 AI features that publish files (llms.txt, JSON feeds, Markdown pages)
  layouts/, components/, pages/, scripts/, styles/
netlify/functions/mcp.mts   The MCP endpoint
scripts/
  generate-data.mjs         Deterministic synthetic data (same seed, same data)
  check-content.ts          Validates content against the schemas and checks cross-references
  test-mcp.ts               Calls every MCP tool and prompt without Netlify
```

### Content model

| Collection | What it holds | Points to |
| --- | --- | --- |
| `colleges` | 7 colleges | |
| `departments` | 45 departments, each one field of study with a course prefix | `college` |
| `programs` | 142 degrees, minors, and certificates | `department` |
| `courses` | 1,330 courses | `department`, `prerequisites` (courses) |
| `services` | 36 student services with weekly hours | |

Content is checked twice: `npm run check:content` validates every entry and reference before each build, and Astro validates the collections again during the build. Either failure stops the deploy.

### AI features

Each feature is a switch in `site.config.ts`. When a switch is off, its routes aren't built (see `src/features/integration.ts`), and its links disappear from pages.

| Switch | What it controls |
| --- | --- |
| `mcp` | The `/mcp` endpoint |
| `llmsTxt` | `/llms.txt` |
| `jsonFeeds` | `/data/programs.json`, `/data/courses.json`, `/data/services.json` |
| `markdownPages` | `…/index.md` copies of program, course, and service pages |
| `askAi` | "Ask AI" menus on pages, with a label suited to each page |

## Working on it

Needs Node 22.18 or newer.

```sh
npm install
npm run dev            # local site at http://localhost:4321
npm test               # MCP smoke test and content check
npm run check          # type check
npm run build          # content check, then build into dist/
npm run generate       # regenerate content/generated/ from the seed
```

To run the site and the MCP function together locally, use the Netlify CLI: `netlify dev`.

- **More data:** in `scripts/generate-data.mjs`, add fields of study to `colleges`, raise the `p` probabilities in `levelTemplates`, or add course templates. Run `npm run generate` and commit the JSON.
- **New MCP tools:** add a function in `src/lib/catalog.ts` and register it in `netlify/functions/mcp.mts` with `server.registerTool`.
- **New fields:** add them to the generator and to `src/lib/schemas.ts`. The build fails until both agree.

## Deploy

Netlify builds from `netlify.toml`: `npm run build`, publishing `dist/`, with functions from `netlify/functions/`. Netlify's `URL` variable sets the address used in absolute links. Without it, the build falls back to `url` in `site.config.ts`.

## Connect an AI

The MCP address is `https://YOUR-SITE.netlify.app/mcp`.

- **Claude:** Settings > Connectors > Add custom connector, then paste the address.
- **ChatGPT:** Settings > Apps and Connectors. Custom connectors may need developer mode or a specific plan.
- **Cursor or VS Code:** use the buttons on the site's `/connect/` page.

Good test prompts:

- "Which online master's programs at Cascadia State cost under $30,000?"
- "Compare the Computer Science BS and Data Science BS."
- "I need help paying my tuition bill. Who do I talk to, and are they open right now?"
- "What upper-division ethics courses are offered in spring?"

To call tools directly and see raw responses, run `npx @modelcontextprotocol/inspector` and point it at your `/mcp` URL with transport "Streamable HTTP".

## Notes

- The "Ask Claude / ChatGPT" links only work once the site is public, because the AI has to fetch your pages. They also depend on the assistant having web access turned on.
- The endpoint is public and unauthenticated, which is fine for fake data. A real deployment would want rate limiting, and auth for anything that isn't public.
