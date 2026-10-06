# Cascadia State: MCP demo site

A static university website plus an MCP endpoint, deployable to Netlify. Everything is fictional: 142 programs, 1,330 courses, and 36 student services for "Cascadia State University."

What's included:

- **Static site** with program, course, and service pages, a program finder, and a "Use with your AI" menu (Ask Claude, Ask ChatGPT, Ask Perplexity, Copy page as Markdown, Copy MCP URL)
- **MCP server** at `/mcp` with 9 read-only tools: `search_programs`, `get_program`, `compare_programs`, `list_colleges`, `search_courses`, `get_course`, `find_services`, `get_service`, `services_open_now`
- **AI-friendly extras**: `/llms.txt`, JSON feeds at `/data/*.json`, and a Markdown copy of every program and service page
- **Connect page** at `/connect/` with setup steps and one-click Cursor and VS Code install links

## Deploy (no terminal needed)

1. **Put it on GitHub.** Unzip this folder. In GitHub Desktop, choose File > Add Local Repository, pick the folder, and create a repository when prompted. Commit, then click Publish repository. Private is fine.
2. **Connect Netlify.** In Netlify, choose Add new project > Import an existing project > GitHub, and pick the repo. Build settings come from `netlify.toml`, so just click Deploy.
3. **Try the site.** Open your `*.netlify.app` URL. Every later push from GitHub Desktop redeploys automatically.

## Connect an AI

Your MCP address is `https://YOUR-SITE.netlify.app/mcp`.

- **Claude:** Settings > Connectors > Add custom connector, then paste the address.
- **ChatGPT:** Settings > Apps and Connectors. Custom connectors may need developer mode or a specific plan.
- **Cursor or VS Code:** use the buttons on the site's `/connect/` page.

Good test prompts:

- "Which online master's programs at Cascadia State cost under $30,000?"
- "Compare the Computer Science BS and Data Science BS."
- "I need help paying my tuition bill. Who do I talk to, and are they open right now?"
- "What upper-division ethics courses are offered in spring?"

To call tools directly and see raw responses, the MCP Inspector is a browser-based UI. It launches with one terminal command, `npx @modelcontextprotocol/inspector`. Point it at your `/mcp` URL with transport "Streamable HTTP".

## How it fits together

| File | What it does |
| --- | --- |
| `data/*.json` | The catalog. Edit these directly or regenerate them. |
| `scripts/generate-data.mjs` | Generates the synthetic catalog. It's deterministic, so the same seed gives the same data. |
| `lib/catalog.mjs` | Search and lookup logic shared by the MCP tools. |
| `netlify/functions/mcp.mjs` | The MCP endpoint: tool definitions and the HTTP handler. |
| `scripts/build.mjs` | Builds the static site into `dist/`. Plain template strings, no framework. |
| `src/styles.css`, `src/app.js` | Site styles and progressive enhancements: menus, copy buttons, filters. |
| `scripts/test-mcp.mjs` | Smoke test that calls every main tool without Netlify. |

## Making changes

- **More data:** in `generate-data.mjs`, add fields of study to `colleges`, raise the `p` probabilities in `levelTemplates`, or add course templates. Run `npm run generate` and commit the new JSON.
- **New tools:** add a function in `lib/catalog.mjs` and register it in `netlify/functions/mcp.mjs` with `server.registerTool`.
- **Local testing (optional):** `npm install`, then `npm test` for the MCP smoke test, or `npm run build` to build the site into `dist/`. To run the site and function together locally, use the Netlify CLI's `netlify dev`.

## Notes

- The "Ask Claude / ChatGPT" links only work once the site is public, because the AI has to be able to fetch your pages. They also depend on the assistant having web access turned on.
- Cursor and VS Code install-link formats are still evolving, so check their docs if a button stops working.
- The endpoint is public and unauthenticated, which is fine for fake data. A real client deployment would want rate limiting, and auth if any data isn't public.
