// Progressive enhancement. Everything works as plain links without this file;
// with it, menus collapse, copy buttons work, and lists filter in place.
document.documentElement.classList.add("js");

const origin = window.location.origin;
// Also matches the URL-encoded form, which is how {origin} appears inside the AI links.
const fill = (s) => s.replaceAll("{origin}", origin).replaceAll("%7Borigin%7D", encodeURIComponent(origin));
const announcer = document.getElementById("announcer");
const announce = (msg) => {
  announcer.textContent = "";
  setTimeout(() => (announcer.textContent = msg), 50);
};

// Rewrite build-time URLs to wherever the site is actually running
// (localhost, deploy previews, or production).
document.querySelectorAll("[data-href]").forEach((a) => (a.href = fill(a.dataset.href)));
document.querySelectorAll("[data-origin-text]").forEach((el) => (el.textContent = fill(el.dataset.originText)));

// "Use with your AI" disclosure menus
document.querySelectorAll(".ai-menu").forEach((menu) => {
  const button = menu.querySelector(".ai-menu-toggle");
  const list = menu.querySelector(".ai-menu-list");
  button.hidden = false;
  list.hidden = true;
  const close = (focus) => {
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (focus) button.focus();
  };
  button.addEventListener("click", () => {
    const open = list.hidden;
    list.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  });
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !list.hidden) close(true);
  });
  menu.addEventListener("focusout", (e) => {
    if (!menu.contains(e.relatedTarget)) close(false);
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) close(false);
  });
});

// Copy buttons: data-copy="literal text" or data-copy-from="/path/to/file.md"
document.querySelectorAll("[data-copy], [data-copy-from]").forEach((btn) => {
  btn.hidden = false;
  btn.addEventListener("click", async () => {
    try {
      const text = btn.dataset.copy ? fill(btn.dataset.copy) : await (await fetch(btn.dataset.copyFrom)).text();
      await navigator.clipboard.writeText(text);
      announce(btn.dataset.copied || "Copied to clipboard.");
    } catch {
      announce("Copy didn't work in this browser. Select the text and copy it manually.");
    }
  });
});

// Connect page: one-click install links for clients that support them
const mcpUrl = `${origin}/mcp`;
const cursorLink = document.getElementById("cursor-install");
if (cursorLink) {
  cursorLink.href = `cursor://anysphere.cursor-deeplink/mcp/install?name=cascadia-state&config=${btoa(JSON.stringify({ url: mcpUrl }))}`;
}
const vscodeLink = document.getElementById("vscode-install");
if (vscodeLink) {
  vscodeLink.href = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: "cascadia-state", type: "http", url: mcpUrl }))}`;
}

// Program finder
const finder = document.getElementById("program-finder");
if (finder) {
  const rows = [...document.querySelectorAll("#program-list > li")];
  const count = document.getElementById("results-count");
  const apply = () => {
    const f = Object.fromEntries(new FormData(finder));
    const words = (f.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const row of rows) {
      const d = row.dataset;
      const ok =
        words.every((w) => d.search.includes(w)) &&
        (!f.level || d.level === f.level) &&
        (!f.modality || d.modality === f.modality) &&
        (!f.term || d.terms.split(",").includes(f.term));
      row.hidden = !ok;
      if (ok) shown++;
    }
    count.textContent = `${shown} ${shown === 1 ? "program" : "programs"}`;
  };
  let t;
  finder.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(apply, 150);
  });
  finder.addEventListener("submit", (e) => {
    e.preventDefault();
    apply();
  });
}

// Course filter
const courseFilter = document.getElementById("course-filter");
if (courseFilter) {
  const groups = [...document.querySelectorAll(".course-group")];
  const count = document.getElementById("results-count");
  let t;
  courseFilter.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const words = courseFilter.value.toLowerCase().split(/\s+/).filter(Boolean);
      let total = 0;
      for (const g of groups) {
        let shown = 0;
        for (const row of g.querySelectorAll("tbody tr")) {
          const ok = words.every((w) => row.dataset.search.includes(w));
          row.hidden = !ok;
          if (ok) shown++;
        }
        g.hidden = shown === 0;
        total += shown;
      }
      count.textContent = `${total} ${total === 1 ? "course" : "courses"}`;
    }, 150);
  });
  document.getElementById("course-search").addEventListener("submit", (e) => e.preventDefault());
}
