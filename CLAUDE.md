# Notes for Claude Code

Cascadia State University is a fictional university site for showing what an
AI-ready higher-ed website looks like. Read README.md for how it fits
together. These are the standing rules; an issue only needs to say where it
differs from them.

## Secrets

API keys live only in Netlify environment variables. Never write a key into any file, never create a .env file without confirming it's in .gitignore, and never use the PUBLIC_ prefix for secrets. Read keys only via process.env inside netlify/functions/.

## Writing (site copy, docs, comments, PRs)

- Plain language, active voice, sentence case. No exclamation points.
- Buttons and links say what happens ("See your path", "Save to Your Path"), never "Learn more" or "Click here".
- Name features with their constant (e.g. `WORKBENCH_LABEL`), not a literal, so renaming is one change.
- Code reads like the code around it: small plain functions, comments that explain why, no clever abstractions.

## Accessibility (WCAG 2.2 AA, every change)

- Real elements: buttons, links, checkboxes, `<table>` with `<th scope>` and a caption, forms with visible labels.
- Visible focus on everything. After an action that removes or re-renders what had focus, move focus somewhere sensible (the next item, a heading) and say where in the PR.
- Announce results of actions through the one polite live region (`announce()` in `src/scripts/enhance.ts`), not separate regions.
- Toggle buttons use `aria-pressed`; menus and tabs follow the ARIA patterns and are keyboard-complete; unavailable actions use `aria-disabled` so focus isn't lost.
- Never convey state by color alone. Respect `prefers-reduced-motion`. Use the color tokens in `global.css` so dark mode works.
- No layout shift: controls that need JavaScript use `.needs-js` (hidden before first paint without JS); anything that depends on stored state is set by a small inline script before paint, or reserves its space.
- Run axe (WCAG 2.0–2.2 A/AA) in light and dark mode on every page a change touches, plus a phone-width check.

## Features and the Lab

- Every AI or personalization feature is a switch in `site.config.ts` `features`. When it's off, its routes aren't built (inject them in `src/features/integration.ts`), its controls and links don't render, and its functions return 404.
- Each experiment has a Lab page: `content/pages/lab/<name>.md` for the words, `src/pages/lab/<name>/index.astro` for the "Try it" panel and anything read from config, and an entry on `/lab/`. The page says what it does, what data it uses and where that data lives, and shows "switched off" when the switch is off.
- Add the switch to the README's feature table.

## Privacy

- Nothing leaves the browser unless the person opts in, and the page says exactly what will be sent.
- Per-tab signals (personalization) live in sessionStorage; things people choose to keep (the workbench) live in localStorage. One module owns each storage key; nothing else reads or writes it.
- Server logs record counts and timing only: never query text, form answers, or IP addresses.
- Store references to catalog content (`kind` + id), never copies, so pages always show live data.

## Content, schemas, and URLs

- Content is JSON and Markdown in `content/`, validated by the Zod schemas in `src/lib/schemas.ts`. New content gets a schema and a check in `scripts/check-content.ts` (references resolve, ids are unique).
- `content/generated/` comes from `scripts/generate-data.mjs`; change the generator, not the JSON. Each data kind has its own random stream, so adding data must not change existing entries (test that).
- Shared vocabulary (levels, terms, categories) lives in `src/lib/vocab.ts`.
- Page URLs are built only by `src/lib/urls.ts` (`pagePath`, `SECTION_PATH`). Never hard-code a section path.
- Anything an AI or another site might read (MCP results, JSON feeds, llms.txt, search results) carries absolute URLs via `absoluteUrl()`. Site-internal data (like the workbench index) may use site-relative paths to stay small.
- Catalog queries live in `src/lib/catalog.ts` and tools in `src/lib/tools.ts`, shared by pages, search, and MCP. Logic that later features may reuse (plans, comparisons) stays free of DOM code.
- Files the browser downloads have a size budget, checked in tests and printed in the build log.

## Work and PRs

- One branch per issue, from the latest `main`. Never merge to `main`; open a PR when a batch is ready and Noah merges it.
- Before pushing to an existing branch, check whether its PR is still open. If it was merged, start a new branch from `main` and open a new PR.
- Before building an issue, compare it with the code and post a review comment on the issue: conflicts, gaps, and proposed defaults. Build after Noah answers.
- In issues, types and file paths are suggestions; fit them to the code and say where you differed.
- Before a PR: `npm test`, `npm run check`, and `npm run build` pass, new logic has tests, and browser checks cover the new interactions.
- PR description: what changed, decisions and deviations from the issue, how it was tested, and what wasn't tested. Close the issue it implements.
- Keep issues under about 10,000 characters (longer ones get cut off when posted). Split big features into a parent issue with one sub-issue per PR.
