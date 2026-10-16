# Model University: Cascadia State

A model university website for showing what an AI-ready higher-ed site looks like. "Cascadia State University" is fictional, and so is every program, course, person, event, and story on it.

What's included today:

- **The site**: programs (a single filterable list, plus a page for each program), a course catalog (a page for every subject and every course), admissions (apply, tuition and aid, visit), student services, a faculty directory, events, news, about, and a "Connect your AI" page
- **An MCP server** at `/mcp` with read-only tools: `search_programs`, `get_program`, `compare_programs`, `list_colleges`, `search_courses`, `get_course`, `find_services`, `get_service`, `services_open_now`, `search_faculty`, `get_faculty`, `search_events` (upcoming by default, or a date range), and `list_news`, plus the prompts `recommend-program` and `find-help`. Every result carries an absolute page url.
- **AI-readable files**: `/llms.txt`, JSON feeds at `/data/*.json`, and a Markdown copy of every detail page at `…/index.md`
- **Lab** at `/lab/`: experiments, each with a page explaining it: session-based personalization with an "Under the hood" panel (`/lab/personalization/`), and natural-language search (`/search/`, explained at `/lab/search/`), and Your Path (`/your-path/`, explained at `/lab/workbench/`).

Search engines are asked not to index the site (`X-Robots-Tag: noindex`) until `indexing` is switched on in `site.config.ts`.

## How it fits together

One content layer feeds every page and every AI feature.

```
site.config.ts              Site name, URL, timezone, indexing, and AI feature switches
content/
  generated/                Catalog, faculty, and events as JSON, written by scripts/generate-data.mjs (don't edit by hand)
  enrollment/               Your Path's rules: academic calendar, enrollment steps, offices by student type (edited by hand)
  news/                     News stories, one Markdown file each
  pages/                    About and admissions pages in Markdown
src/
  content.config.ts         Astro content collections, one per generated file
  lib/
    schemas.ts              The content schemas (Zod)
    vocab.ts                Shared lists: levels, formats, terms, campuses, service categories
    catalog.ts              Lookups and search, used by pages and the MCP server
    urls.ts                 The one place page URLs are built
    hours.ts, format.ts, markdown.ts
    tools.ts                The catalog tools (names, descriptions, schemas), shared by the MCP server and search
    search/                 Natural-language search: plans, results, and the results HTML
    llm/                    The model behind search, behind a small interface
    workbench/              Your Path: data model, store, profile, plan, views (compare, timeline), and its catalog index
  features/                 Features with their own routes (llms.txt, JSON feeds, Markdown pages, /search/, /your-path/)
  layouts/, components/, pages/, scripts/, styles/
netlify/functions/mcp.mts   The MCP endpoint
netlify/functions/search.mts  The search endpoint, /api/search (the only code that reads the Gemini key)
scripts/
  generate-data.mjs         Deterministic synthetic data (same seed, same data)
  generate-enrollment.mjs   The first version of content/enrollment/ (run once; the files are edited by hand after that)
  check-content.ts          Validates content against the schemas and checks cross-references
  test-mcp.ts               Calls every MCP tool and prompt without Netlify
  test-search.ts            Runs /api/search with a fake model
  test-workbench.ts         The workbench's store, views, and index
  test-your-path.ts         Your Path's profile, plan, and timeline
  test-enrollment.ts        The enrollment rules, their lookups, and targeted events
```

### Content model

| Collection | What it holds | Points to |
| --- | --- | --- |
| `colleges` | 7 colleges | |
| `departments` | 45 departments, each one field of study with a course prefix | `college` |
| `programs` | 142 degrees, minors, and certificates | `department` |
| `courses` | 1,330 courses | `department`, `prerequisites` (courses) |
| `services` | 36 student services with weekly hours | |
| `faculty` | 318 faculty, 6 to 8 per department | `department` |
| `events` | 76 events across the 2026–27 academic year, some for particular students (`levels`, `student_types`) | `related` programs, departments, services, faculty |
| `news` | News stories (Markdown) | `related` programs, departments, services, faculty |
| `pages` | About and admissions pages (Markdown) | |

Courses also point to their `instructor` (a faculty id).

News stories are Markdown, which the MCP function can't read, so `scripts/index-news.ts` writes an index of them to `content/generated/news.json`. The build regenerates it, and the content check fails if the committed copy is out of date.

Content is checked twice: `npm run check:content` validates every generated entry and reference before each build, and Astro validates every collection again during the build, including the related links in news stories. Either failure stops the deploy.

Pages are built ahead of time, so event lists decide in the browser which events have already happened (`src/scripts/past-events.ts`). Without JavaScript, lists show what was upcoming when the site was built.

### AI features

Each feature is a switch in `site.config.ts`. When a switch is off, its routes aren't built (see `src/features/integration.ts`), and its links disappear from pages.

| Switch | What it controls |
| --- | --- |
| `mcp` | The `/mcp` endpoint |
| `llmsTxt` | `/llms.txt` |
| `jsonFeeds` | `/data/programs.json`, `/data/courses.json`, `/data/services.json` |
| `markdownPages` | `…/index.md` copies of program, course, and service pages |
| `askAi` | "Ask AI" menus on the home page and section overview pages (academics, programs, courses, admissions, services, faculty, events, news) |
| `personalization` | Session-based personalization: the application journey and the "For me" panel in the header, the program list's order, the journey forms' prefilling, and the "Under the hood" panel. Uses sessionStorage only. |
| `workbench` | Your Path: `/your-path/` (and a redirect from `/workbench/`), `/data/workbench-index.json`, `/data/enrollment.json`, Save to Your Path toggles, and the header link with its count. Uses localStorage only. |
| `aiSearch` | Natural-language search: `/search/`, `/api/search`, and Search in the header. The model and tier are set under `aiSearch` in `site.config.ts`. |

### Personalization (Lab)

Detail pages describe themselves with `data-page-*` attributes on `<main>` (built in `src/lib/personalization.ts`). `src/scripts/personalize.ts` records each view in sessionStorage (the last 50) and derives an interest profile; nothing leaves the browser.

- Application journey: explore programs (any program page view) → request information (form sent) → schedule a visit (form sent) → apply (any `[data-journey-apply]` click). Steps are defined in `src/lib/personalization-settings.ts`.
- `src/components/forms/`: `RequestInfoForm.astro` and `VisitForm.astro`, portable forms that can go on any page (give each copy its own `id`). They aren't connected to anything; answers are saved to the session and shown in Under the hood. Pages: `/admissions/request-info/` and `/admissions/visit/schedule/`.
- `src/components/JourneyActions.astro`: Request information, Schedule a visit, and Apply buttons (on program pages and the admissions overview)
- `src/components/Recents.astro`: the Recents panel, opened from the header's utility row (or the Menu on small screens), with "Recently viewed" and "Your next step"
- `src/pages/academics/programs/index.astro`: lists the most-viewed department's programs first
- `src/components/UnderTheHood.astro`: the panel, opened from the footer or with `?demo` in the address

Picks based on interest use `preferred()` in `personalize.ts`: a form answer wins, otherwise the most-viewed department or college. That covers the home page hero, the events and news shown on the home page, the program the next step points to, and the program list's order.

Anything a script personalizes is marked with `markPersonalized(element, reason)`, which sets `data-personalized` to a plain-language reason and fires a `personalized` event. Under the hood's "What changed on this page" lists every marked element that's showing, anywhere in the document, and refreshes on that event.

Full-bleed sections (like the home page hero) size from `--page-width` rather than `100vw`; the panel narrows it while it's docked open.

To avoid layout shift, the program list is reordered by a small inline script before the page is first painted, and the "For me" panel only appears when someone opens it. Controls that need JavaScript use the `needs-js` class, which works because BaseLayout adds `.js` to `<html>` before first paint.

### Natural-language search (Lab)

`/search/` is the one page built on demand (by the Netlify adapter); every other page is static. On its own it shows keyword results for `?q=`, so search works without JavaScript. With JavaScript, `src/scripts/search.ts` asks `/api/search` and shows its results instead.

- One model call per search. The model (Gemini, set in `site.config.ts`) is offered the search tools from `src/lib/tools.ts` and answers only with calls to them: the plan. It never writes results.
- `src/lib/search/plan.ts` checks the plan against the tools' schemas (at most 4 calls), runs it, and turns its filters into chips. Removing a chip sends the plan back with `drop`, and it runs again without the model.
- Every result is built from the catalog record by `resultFor(kind, ref)` in `results.ts`. `kind` (program, course, faculty, event, service, news) and `ref` (the catalog id) match Your Path's saved items.
- `src/lib/search/render.ts` renders results for both the server and the browser. Each result has its Save to Your Path toggle there.
- Keyword search (`keywordPlan`) takes over when there's no key, the visitor is over 10 searches a minute, the model takes over 8 seconds or fails, plans nothing usable, or its plan finds nothing. The response then has `fallback: true`.
- The key is `GEMINI_API_KEY` in Netlify's environment variables, read only in `netlify/functions/search.mts`. See `CLAUDE.md`.

### Enrollment rules

`content/enrollment/` holds what applies to whom, for Your Path (#14) and the admissions pages for transfer, international, and graduate students. It's written to be owned by an admissions office: plain JSON, edited by hand, validated by `npm run check:content`.

- `calendar.json`: institution-wide dates (orientation, registration, tuition due, classes begin, finals, the FAFSA priority date) for 2026–27 and 2027–28. Each entry is for a term or an academic year, and its id is the term (or year) plus its `key`, like `winter-2027-classes-begin`. Application deadlines aren't here: each program has its own.
- `steps.json`: what each kind of student does, in order. Prospective students start with the application journey (explore, request information, visit, apply). A step's date is a calendar `key` (for the student's start term), a number of days before classes begin, or the program's deadline.
- `offices.json`: two to four offices for each student type and level, each with a reason.
- Student types and levels are in `src/lib/vocab.ts`. Lookups are in `src/lib/enrollment-rules.ts`, which takes the rules as data so the build, the browser (from `/data/enrollment.json`), and MCP share it; `src/lib/enrollment.ts` applies them to the files.
- The calendar is fixed for 2026–27 and 2027–28, so start terms after Summer 2028 have no dates until it's extended.

### Your Path (Lab)

Your Path (`/your-path/`; `/workbench/` redirects there) is the student's plan: their steps, dates, and offices for a start term, worked out from the enrollment rules, next to what they've saved. Internally it's still the workbench (files, types, and the storage key), and `WORKBENCH_LABEL` and `WORKBENCH_PATH` in `types.ts` are the name and address people see.

It's built in three layers:

- **Profile** (`src/lib/workbench/profile.ts`): student type, level, and start term. What the student chooses is stored and always wins. Otherwise `resolveProfile()` suggests a value from strong signals only (the request-info form, a saved program or office, or two views of pages for one kind of student, listed in `TYPE_SIGNALS`), worked out fresh on every page and never stored. Saved programs at both levels mean it asks instead.
- **Rules**: `content/enrollment/`, above.
- **Plan** (`src/lib/workbench/plan.ts`): `planFor()` gives the steps (with dates for the start term, status, and the next one), offices, targeted events, and calendar entries; `planSteps()` needs only the rules, for MCP; `pathTimeline()` lists every date once, with its source. Nothing in the plan is stored. No DOM code.

The rest:

- `src/lib/workbench/types.ts`: the data model (version 2). Items are references (`kind` and `ref`, the catalog id), never copies, so the page always shows live data. Alongside them: `profile` (the student's choices), `completed` (step ids, so they stay done when the term changes), `dismissed` (`kind:id`), `hiddenHandoffs` (for #18), and `badge` (what the header count last showed). `"answer"` items are reserved: kept in storage, not shown.
- `src/lib/workbench/store.ts`: the only code that reads or writes it. localStorage under `cascadia:workbench`, a `workbench:change` event after every write, `storage` events for other tabs, a memory fallback (with a notice) when storage is blocked, `migrate()` (version 1 moves its start term into `profile`), `prune()` for ids the rules or catalog no longer have, and `serialize()` / `deserialize()` for share links. At most 100 items and 1,000 characters a note.
- `src/lib/workbench/derive.ts`: the comparison, key facts, and change detection. Programs watch tuition, deadlines, and start terms; events watch their date and location.
- `src/scripts/workbench/path-state.ts`: the plan's steps and next step on every page, from the bundled steps alone, for the header count, the header button, and the next-step tile. Once a plan exists, those follow it, so the site suggests one next step. When a journey step is done (in sessionStorage), `personalize.ts` also adds it to `completed`.
- The header count is the steps still to do once there's a plan, otherwise the saved items. An inline script in BaseLayout draws the last count before the page is painted.
- `/data/workbench-index.json` (`index-data.ts`): the catalog fields the page needs, built whenever the feature is on, whatever `jsonFeeds` says. Its size is in the build log.
- Toggles come from one renderer (`toggle.ts`), used by detail pages, the program list, and search results. They're hidden without JavaScript, and an inline script in BaseLayout marks saved ones before the page is drawn.
- Saved items feed the personalization profile, each counting as three page views. Under the hood shows the plan's profile, where each value came from, and how many steps are done and items dismissed.

## Working on it

Needs Node 22.18 or newer.

```sh
npm install
npm run dev            # local site at http://localhost:4321
npm test               # MCP, search, workbench, Your Path, and enrollment tests, and content check
npm run check          # type check
npm run build          # news index, content check, then build into dist/
npm run index:news     # rebuild content/generated/news.json from content/news/
npm run generate       # regenerate content/generated/ from the seed
```

To run the site and the functions (MCP and search) together locally, use the Netlify CLI: `netlify dev`. Search needs `GEMINI_API_KEY` set in Netlify (`netlify env:set` or the dashboard), never in a file; without it, search uses keywords.

- **More data:** in `scripts/generate-data.mjs`, add fields of study to `colleges`, raise the `p` probabilities in `levelTemplates`, or add course templates. Run `npm run generate` and commit the JSON.
- **New MCP tools:** add a function in `src/lib/catalog.ts` and register it in `netlify/functions/mcp.mts` with `server.registerTool`.
- **New fields:** add them to the generator and to `src/lib/schemas.ts`. The build fails until both agree.

## Deploy

Netlify builds from `netlify.toml`: `npm run build`, publishing `dist/`, with functions from `netlify/functions/` and the on-demand `/search/` page from the Astro Netlify adapter. For natural-language search, add `GEMINI_API_KEY` in Netlify's environment variables, scoped to Functions. Netlify's `URL` variable sets the address used in absolute links. Without it, the build falls back to `url` in `site.config.ts`.

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
