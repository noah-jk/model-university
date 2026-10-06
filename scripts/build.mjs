// Builds the static site into /dist from the JSON in /data.
// No framework: plain template strings, so it's easy to read and change.
// Run with: npm run build

import { mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { programs, courses, services, departments, searchPrograms, DAYS } from "../lib/catalog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
// Netlify sets URL during builds. app.js swaps in the live origin at runtime anyway.
const SITE = (process.env.URL || "http://localhost:8888").replace(/\/$/, "");
const UNI = "Cascadia State University";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const usd = (n) => `$${n.toLocaleString("en-US")}`;
const write = (path, content) => {
  const full = join(dist, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
};
// Also matches the URL-encoded form, which is how {origin} appears inside the AI links.
const fill = (s) => s.replaceAll("{origin}", SITE).replaceAll("%7Borigin%7D", encodeURIComponent(SITE));

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------
const logo = `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 3 6 17h5l-6 9h22l-6-9h5z" fill="#dce5c3"/><path d="M14.5 26h3v3h-3z" fill="#dce5c3"/></svg>`;

const nav = [
  ["/programs/", "Programs"],
  ["/courses/", "Courses"],
  ["/services/", "Student services"],
  ["/connect/", "Use with your AI"],
];

function layout({ title, description, path, body }) {
  const pageTitle = path === "/" ? UNI : `${title} | ${UNI}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,600;1,400&family=Young+Serif&display=swap">
<link rel="stylesheet" href="/styles.css">
<link rel="alternate" type="text/plain" title="LLM-friendly site guide" href="/llms.txt">
<script src="/app.js" defer></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/">${logo}<span>${UNI}</span></a>
    <nav class="site-nav" aria-label="Main">
      <ul>${nav.map(([href, label]) => `<li><a href="${href}"${path.startsWith(href) ? ' aria-current="page"' : ""}>${label}</a></li>`).join("")}</ul>
    </nav>
  </div>
</header>
<div class="demo-note"><div class="wrap"><p>Demo site with fictional data, built to test connecting a university website to AI assistants.</p></div></div>
<main id="main" class="wrap">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>${UNI} is fictional. All programs, courses, and services are synthetic demo data.</p>
    <p>For AI tools: <a href="/llms.txt">llms.txt</a>, <a href="/data/programs.json">programs.json</a>, <a href="/data/courses.json">courses.json</a>, <a href="/data/services.json">services.json</a>, and an MCP server at <code data-origin-text="{origin}/mcp">${SITE}/mcp</code>.</p>
  </div>
</footer>
<div id="announcer" class="visually-hidden" aria-live="polite"></div>
</body>
</html>`;
}

const aiLinks = (prompt) => {
  const q = encodeURIComponent(prompt);
  return [
    ["Ask Claude", `https://claude.ai/new?q=${q}`],
    ["Ask ChatGPT", `https://chatgpt.com/?q=${q}`],
    ["Ask Perplexity", `https://www.perplexity.ai/search?q=${q}`],
  ];
};

let menuId = 0;
function aiMenu({ prompt, markdown }) {
  const id = `ai-menu-${++menuId}`;
  const links = aiLinks(prompt)
    .map(([label, href]) => `<li><a href="${esc(fill(href))}" data-href="${esc(href)}" target="_blank" rel="noopener">${label}<span class="visually-hidden"> (opens in a new tab)</span></a></li>`)
    .join("");
  return `<div class="ai-menu">
  <button type="button" class="button ai-menu-toggle" aria-expanded="false" aria-controls="${id}" hidden>
    <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0l1.8 5.2L15 7l-5.2 1.8L8 14l-1.8-5.2L1 7l5.2-1.8z"/></svg>
    Use with your AI
  </button>
  <ul class="ai-menu-list" id="${id}">
    ${links}
    <li class="divider" role="presentation"></li>
    ${markdown ? `<li><button type="button" data-copy-from="${markdown}" data-copied="Page copied as Markdown." hidden>Copy page as Markdown<span class="hint">Paste into any AI chat</span></button></li>` : ""}
    <li><button type="button" data-copy="{origin}/mcp" data-copied="MCP server URL copied." hidden>Copy MCP server URL<span class="hint">Connect this whole catalog to your AI</span></button></li>
    <li><a href="/connect/">More ways to connect</a></li>
  </ul>
</div>`;
}

const breadcrumb = (items) =>
  `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>${items
    .map(([label, href], i) => (i === items.length - 1 ? `<li><a href="${href}" aria-current="page">${esc(label)}</a></li>` : `<li><a href="${href}">${esc(label)}</a></li>`))
    .join("")}</ol></nav>`;

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
copyFileSync(join(root, "src/styles.css"), join(dist, "styles.css"));
copyFileSync(join(root, "src/app.js"), join(dist, "app.js"));
mkdirSync(join(dist, "images"), { recursive: true });
copyFileSync(join(root, "src/images/campus.jpg"), join(dist, "images/campus.jpg"));
mkdirSync(join(dist, "data"), { recursive: true });
for (const f of ["programs", "courses", "services"]) copyFileSync(join(root, `data/${f}.json`), join(dist, `data/${f}.json`));

const sitePrompt = `Help me find a program at ${UNI} using {origin}/llms.txt. If I haven't said what I want, ask me one short question about my interests. Once I've given any preference, recommend the top 3 matches with links and don't keep asking questions.`;

// Home ----------------------------------------------------------------------
{
  const body = `
<section class="hero" aria-labelledby="hero-title">
  <div>
    <h1 id="hero-title">Programs at Cascadia State</h1>
    <p class="lede">Our programs, courses, and student services are available to AI assistants like Claude and ChatGPT, straight from the source. Ask in your own words and get answers from official information.</p>
    <div class="page-actions">
      ${aiMenu({ prompt: sitePrompt })}
      <a class="button secondary" href="/programs/">Browse programs</a>
    </div>
  </div>
  <figure class="hero-image"><img src="/images/campus.jpg" width="1200" height="786" alt="Brick and stone campus building with a green lawn in front, on a sunny morning"></figure>
</section>

<section class="explore" aria-label="Explore the catalog">
  <a href="/programs/"><h2>Programs</h2><p>${programs.length} degrees, minors, and certificates across ${Object.keys(departments).length} colleges.</p></a>
  <a href="/courses/"><h2>Courses</h2><p>${courses.length.toLocaleString()} courses with terms, formats, and prerequisites.</p></a>
  <a href="/services/"><h2>Student services</h2><p>${services.length} offices, from tutoring to the food pantry, with live hours.</p></a>
</section>

<section class="ai-panel" aria-labelledby="connect-title">
  <h2 id="connect-title">Connect the whole catalog to your AI</h2>
  <p>Add this address as a connector in Claude, ChatGPT, Cursor, or any app that supports MCP. Your assistant can then search programs, compare costs, and check service hours for you.</p>
  <div class="mcp-url"><code data-origin-text="{origin}/mcp">${SITE}/mcp</code><button type="button" class="button secondary" data-copy="{origin}/mcp" data-copied="MCP server URL copied." hidden>Copy address</button></div>
  <p><a href="/connect/">Step-by-step setup for each app</a></p>
</section>`;
  write("index.html", layout({ title: UNI, description: `Programs, courses, and student services at ${UNI}, available to AI assistants.`, path: "/", body }));
}

// Programs hub --------------------------------------------------------------
{
  const opt = (vals) => vals.map((v) => `<option>${esc(v)}</option>`).join("");
  const sorted = [...programs].sort((a, b) => a.name.localeCompare(b.name));
  const body = `
<div class="page-intro">
  <h1>Academic programs</h1>
  <p>Find a degree, minor, or certificate, or ask your AI assistant to help you choose.</p>
  ${aiMenu({ prompt: `Help me find a program at ${UNI} using {origin}/data/programs.json as the official list. If I haven't said what I want, ask me one short question about my interests. Once I've given any preference, recommend the top 3 matches with links and don't keep asking questions.` })}
</div>
<form id="program-finder" class="finder" role="search" aria-label="Filter programs">
  <div class="field search"><label for="q">Search by topic or career</label><input id="q" name="q" type="search" placeholder="For example, nursing, data, or teaching"></div>
  <div class="field"><label for="level">Level</label><select id="level" name="level"><option value="">Any level</option>${opt(["Bachelor's", "Master's", "Doctorate", "Certificate", "Minor"])}</select></div>
  <div class="field"><label for="modality">Format</label><select id="modality" name="modality"><option value="">Any format</option>${opt(["In person", "Online", "Hybrid"])}</select></div>
  <div class="field"><label for="term">Start term</label><select id="term" name="term"><option value="">Any term</option>${opt(["Fall", "Winter", "Spring", "Summer"])}</select></div>
</form>
<p id="results-count" class="results-count" aria-live="polite">${programs.length} programs</p>
<ul id="program-list" class="program-list">
${sorted
  .map(
    (p) => `<li data-search="${esc([p.name, p.field, p.college, ...p.keywords, ...p.careers].join(" ").toLowerCase())}" data-level="${esc(p.level)}" data-modality="${esc(p.modality)}" data-terms="${p.start_terms.join(",")}">
  <div><h3><a href="${p.url_path}">${esc(p.name)}</a></h3><p>${esc(p.college)}</p></div>
  <div class="facts"><span>${esc(p.modality)}</span><span>starts ${p.start_terms.join(", ")}</span><span>about ${usd(p.estimated_total_tuition_usd)}</span></div>
</li>`
  )
  .join("\n")}
</ul>`;
  write("programs/index.html", layout({ title: "Academic programs", description: `All degree programs, minors, and certificates at ${UNI}.`, path: "/programs/", body }));
}

// Program detail ------------------------------------------------------------
for (const p of programs) {
  const related = programs.filter((x) => x.field === p.field && x.id !== p.id);
  const body = `
${breadcrumb([["Programs", "/programs/"], [p.name, p.url_path]])}
<div class="detail">
  <article>
    <h1>${esc(p.name)}</h1>
    <p class="lede">${esc(p.description)}</p>
    ${aiMenu({ prompt: `Read {origin}${p.url_path} and tell me about the ${p.name} program at ${UNI}. Include the page link.`, markdown: `${p.url_path}index.md` })}
    <h2>What you'll learn</h2>
    <ul>${p.outcomes.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
    <h2>Careers</h2>
    <p>Common careers include ${p.careers.map(esc).join(", ").replace(/, ([^,]*)$/, ", and $1")}.</p>
    <h2>Admission requirements</h2>
    <ul>${p.requirements.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
    ${p.application_deadlines.length ? `<h2>Application deadlines</h2><ul>${p.application_deadlines.map((d) => `<li>${d.term} start: ${d.deadline}</li>`).join("")}</ul>` : ""}
    ${related.length ? `<h2>Related programs</h2><ul>${related.map((r) => `<li><a href="${r.url_path}">${esc(r.name)}</a></li>`).join("")}</ul>` : ""}
  </article>
  <aside class="at-a-glance" aria-labelledby="glance-${p.id}">
    <h2 id="glance-${p.id}">At a glance</h2>
    <dl>
      <dt>Credential</dt><dd>${esc(p.credential)}</dd>
      <dt>College</dt><dd>${esc(p.college)}</dd>
      <dt>Format</dt><dd>${esc(p.modality)}</dd>
      <dt>Campus</dt><dd>${esc(p.campus)}</dd>
      <dt>Starts</dt><dd>${p.start_terms.join(", ")}</dd>
      <dt>Length</dt><dd>${esc(p.duration)}</dd>
      <dt>Credits</dt><dd>${p.credits}</dd>
      <dt>Tuition</dt><dd>${usd(p.tuition_per_credit_usd)} per credit, about ${usd(p.estimated_total_tuition_usd)} total</dd>
      <dt>Transfer credit</dt><dd>${p.accepts_transfer_credit ? "Accepted" : "Not accepted"}</dd>
    </dl>
  </aside>
</div>`;
  write(`${p.url_path}index.html`, layout({ title: p.name, description: p.description, path: "/programs/", body }));
  write(
    `${p.url_path}index.md`,
    `# ${p.name}\n\n${UNI} (fictional demo data)\nSource: ${SITE}${p.url_path}\n\n${p.description}\n\n## At a glance\n\n- Credential: ${p.credential}\n- College: ${p.college}\n- Format: ${p.modality}, ${p.campus}\n- Starts: ${p.start_terms.join(", ")}\n- Length: ${p.duration}, ${p.credits} credits\n- Tuition: ${usd(p.tuition_per_credit_usd)} per credit, about ${usd(p.estimated_total_tuition_usd)} total\n\n## What you'll learn\n\n${p.outcomes.map((o) => `- ${o}`).join("\n")}\n\n## Careers\n\n${p.careers.map((c) => `- ${c}`).join("\n")}\n\n## Admission requirements\n\n${p.requirements.map((r) => `- ${r}`).join("\n")}\n${p.application_deadlines.length ? `\n## Application deadlines\n\n${p.application_deadlines.map((d) => `- ${d.term} start: ${d.deadline}`).join("\n")}\n` : ""}`
  );
}

// Courses hub ---------------------------------------------------------------
{
  const byField = {};
  for (const c of courses) (byField[c.field] ||= []).push(c);
  const fields = Object.keys(byField).sort();
  const body = `
<div class="page-intro">
  <h1>Course catalog</h1>
  <p>${courses.length.toLocaleString()} courses across ${fields.length} fields of study.</p>
  ${aiMenu({ prompt: `Help me plan courses at ${UNI} using {origin}/data/courses.json as the official course catalog. If I haven't said what I'm studying, ask me one short question. Once I've given any preference, recommend specific courses with links and don't keep asking questions.` })}
</div>
<form id="course-search" class="finder" role="search" aria-label="Filter courses">
  <div class="field search"><label for="course-filter">Search by code, title, field, or instructor</label><input id="course-filter" type="search" placeholder="For example, CS 248, ethics, or Biology"></div>
</form>
<p id="results-count" class="results-count" aria-live="polite">${courses.length.toLocaleString()} courses</p>
${fields
  .map(
    (f) => `<section class="course-group" aria-labelledby="f-${f.replace(/\W+/g, "-")}">
  <h2 id="f-${f.replace(/\W+/g, "-")}">${esc(f)}</h2>
  <div class="table-scroll"><table>
    <thead><tr><th scope="col">Code</th><th scope="col">Title</th><th scope="col">Credits</th><th scope="col">Offered</th><th scope="col">Format</th><th scope="col">Prerequisites</th></tr></thead>
    <tbody>${byField[f]
      .map((c) => `<tr data-search="${esc([c.code, c.title, c.field, c.instructor].join(" ").toLowerCase())}"><td>${c.code}</td><td>${esc(c.title)}</td><td>${c.credits}</td><td>${c.terms_offered.join(", ")}</td><td>${c.modality}</td><td>${c.prerequisites.join(", ") || "None"}</td></tr>`)
      .join("")}</tbody>
  </table></div>
</section>`
  )
  .join("\n")}`;
  write("courses/index.html", layout({ title: "Course catalog", description: `Every course offered at ${UNI}.`, path: "/courses/", body }));
}

// Services hub --------------------------------------------------------------
{
  const cats = [...new Set(services.map((s) => s.category))].sort();
  const body = `
<div class="page-intro">
  <h1>Student services</h1>
  <p>Support for every part of student life, from tutoring to tuition.</p>
  ${aiMenu({ prompt: `I'm a student at ${UNI}. Use {origin}/data/services.json to find the right office or service for me. If I haven't said what I need, ask me one short question. Once I've said, name the best match with its link and don't keep asking questions.` })}
</div>
${cats
  .map(
    (cat) => `<section aria-labelledby="cat-${cat.replace(/\W+/g, "-")}">
  <h2 id="cat-${cat.replace(/\W+/g, "-")}">${esc(cat)}</h2>
  <ul class="service-list">${services
    .filter((s) => s.category === cat)
    .map((s) => `<li><h3><a href="${s.url_path}">${esc(s.name)}</a></h3><p>${esc(s.description)}</p></li>`)
    .join("")}</ul>
</section>`
  )
  .join("\n")}`;
  write("services/index.html", layout({ title: "Student services", description: `Student services and support offices at ${UNI}.`, path: "/services/", body }));
}

// Service detail ------------------------------------------------------------
const dayNames = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const fmt = (t) => {
  if (t === "24:00") return "midnight";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h % 12 || 12;
  return `${hr}${m ? `:${String(m).padStart(2, "0")}` : ""} ${suffix}`;
};
for (const s of services) {
  const hoursRows = DAYS.slice(1).concat("sun").map((d) => `<tr><th scope="row">${dayNames[d]}</th><td>${s.hours[d] ? (s.hours[d][0] === "00:00" && s.hours[d][1] === "24:00" ? "Open 24 hours" : `${fmt(s.hours[d][0])} to ${fmt(s.hours[d][1])}`) : "Closed"}</td></tr>`).join("");
  const body = `
${breadcrumb([["Student services", "/services/"], [s.name, s.url_path]])}
<div class="detail">
  <article>
    <h1>${esc(s.name)}</h1>
    <p>${esc(s.description)}</p>
    ${aiMenu({ prompt: `Read {origin}${s.url_path} and help me use the ${s.name} at ${UNI}.`, markdown: `${s.url_path}index.md` })}
    <h2>Hours</h2>
    <div class="table-scroll"><table><caption class="visually-hidden">Weekly hours, Pacific time</caption><tbody>${hoursRows}</tbody></table></div>
    <h2>Who can use it</h2>
    <p>${esc(s.eligibility)}.${s.appointment_required ? " Appointments are required." : " Drop in anytime during open hours."}${s.virtual_option ? " Virtual appointments are available." : ""}</p>
  </article>
  <aside class="at-a-glance" aria-labelledby="glance-${s.id}">
    <h2 id="glance-${s.id}">Contact</h2>
    <dl>
      <dt>Location</dt><dd>${esc(s.location)}, ${esc(s.campus)}</dd>
      <dt>Phone</dt><dd><a href="tel:${s.phone.replace(/\D/g, "")}">${s.phone}</a></dd>
      <dt>Email</dt><dd><a href="mailto:${s.email}">${s.email}</a></dd>
      <dt>Category</dt><dd>${esc(s.category)}</dd>
    </dl>
  </aside>
</div>`;
  write(`${s.url_path}index.html`, layout({ title: s.name, description: s.description, path: "/services/", body }));
  write(
    `${s.url_path}index.md`,
    `# ${s.name}\n\n${UNI} (fictional demo data)\nSource: ${SITE}${s.url_path}\n\n${s.description}\n\n## Hours (Pacific time)\n\n${DAYS.slice(1).concat("sun").map((d) => `- ${dayNames[d]}: ${s.hours[d] ? `${fmt(s.hours[d][0])} to ${fmt(s.hours[d][1])}` : "Closed"}`).join("\n")}\n\n## Contact\n\n- Location: ${s.location}, ${s.campus}\n- Phone: ${s.phone}\n- Email: ${s.email}\n\n## Eligibility\n\n${s.eligibility}.${s.appointment_required ? " Appointments required." : ""}\n`
  );
}

// Connect page --------------------------------------------------------------
{
  const body = `
<div class="page-intro">
  <h1>Use Cascadia State with your AI</h1>
  <p>Connect our official catalog to the assistant you already use. It can then search programs, compare costs, look up courses, and check which offices are open.</p>
</div>
<div class="ai-panel" style="margin-bottom:2rem">
  <h2>Our MCP server address</h2>
  <div class="mcp-url"><code data-origin-text="{origin}/mcp">${SITE}/mcp</code><button type="button" class="button secondary" data-copy="{origin}/mcp" data-copied="MCP server URL copied." hidden>Copy address</button></div>
  <p>No account or key is needed. The server is read-only.</p>
</div>
<div class="connect-steps">
  <section aria-labelledby="c-claude">
    <h2 id="c-claude">Claude</h2>
    <ol>
      <li>Open Claude and go to Settings, then Connectors.</li>
      <li>Choose Add custom connector.</li>
      <li>Name it Cascadia State and paste the address above.</li>
      <li>In a new chat, ask something like "What online programs does Cascadia State offer?"</li>
    </ol>
  </section>
  <section aria-labelledby="c-chatgpt">
    <h2 id="c-chatgpt">ChatGPT</h2>
    <ol>
      <li>In ChatGPT settings, open Apps and Connectors. Custom connectors may require developer mode or a specific plan.</li>
      <li>Create a connector and paste the address above.</li>
      <li>Enable it in a chat and start asking questions.</li>
    </ol>
  </section>
  <section aria-labelledby="c-cursor">
    <h2 id="c-cursor">Cursor and VS Code</h2>
    <p>These apps support one-click setup.</p>
    <div class="page-actions">
      <a class="button" id="cursor-install" href="/connect/">Add to Cursor</a>
      <a class="button" id="vscode-install" href="/connect/">Add to VS Code</a>
    </div>
  </section>
  <section aria-labelledby="c-quick">
    <h2 id="c-quick">No setup at all</h2>
    <p>Open a chat that already points your assistant at our site guide.</p>
    ${aiMenu({ prompt: sitePrompt })}
  </section>
</div>`;
  write("connect/index.html", layout({ title: "Use with your AI", description: `Connect ${UNI}'s catalog to Claude, ChatGPT, Cursor, and other AI assistants.`, path: "/connect/", body }));
}

// llms.txt --------------------------------------------------------------------
{
  const byCollege = {};
  for (const p of programs) (byCollege[p.college] ||= []).push(p);
  const txt = `# ${UNI}

> A fictional public university in the Pacific Northwest, used to demo AI-ready websites. Offers ${programs.length} programs, ${courses.length} courses, and ${services.length} student services. All data is synthetic.

For live, structured answers, connect to the MCP server at ${SITE}/mcp (Streamable HTTP, read-only, no auth). Tools: search_programs, get_program, compare_programs, list_colleges, search_courses, get_course, find_services, get_service, services_open_now.

## Data feeds

- [All programs (JSON)](${SITE}/data/programs.json): every program with tuition, deadlines, requirements, and careers
- [All courses (JSON)](${SITE}/data/courses.json): the full course catalog
- [All student services (JSON)](${SITE}/data/services.json): offices with hours, locations, and contacts

## Student services

${services.map((s) => `- [${s.name}](${SITE}${s.url_path}index.md): ${s.description}`).join("\n")}

${Object.entries(byCollege)
  .map(([college, list]) => `## ${college}\n\n${list.map((p) => `- [${p.name}](${SITE}${p.url_path}index.md): ${p.modality}, starts ${p.start_terms.join("/")}, about ${usd(p.estimated_total_tuition_usd)}`).join("\n")}`)
  .join("\n\n")}
`;
  write("llms.txt", txt);
}

console.log(`Built ${programs.length + services.length + 5} pages into dist/ for ${SITE}`);
