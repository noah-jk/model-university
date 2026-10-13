// The workbench page (/workbench/): fills the Items, Compare, and Timeline
// tabs from the workbench store and the catalog index, and re-renders
// whenever the workbench changes (here or in another tab). Re-rendering keeps
// focus where it was: elements that can hold focus carry a data-focus-key,
// and the one that had focus gets it back.

import siteConfig from "../../../site.config.ts";
import { announce } from "../enhance.ts";
import { listText } from "../../lib/format.ts";
import { workbench } from "../../lib/workbench/store.ts";
import { saveToggle } from "../../lib/workbench/toggle.ts";
import {
  changesSinceSaved,
  compareTable,
  factsFor,
  fingerprint,
  icsFor,
  longDate,
  lookup,
  MAX_COMPARE,
  nameOf,
  startTermFor,
  termOptions,
  timeline,
  type TimelineEntry,
} from "../../lib/workbench/derive.ts";
import { GROUPS, MAX_NOTE, WORKBENCH_LABEL, type ContentKind, type Workbench, type WorkbenchIndex, type WorkbenchItem } from "../../lib/workbench/types.ts";
import { loadSession, recentPages } from "../personalize.ts";
import { renderNext } from "../next-step.ts";

const personalization = siteConfig.features.personalization;
const label = WORKBENCH_LABEL.toLowerCase();
const root = document.querySelector<HTMLElement>("[data-workbench]")!;
const panels = {
  items: root.querySelector<HTMLElement>("#panel-items")!,
  compare: root.querySelector<HTMLElement>("#panel-compare")!,
  timeline: root.querySelector<HTMLElement>("#panel-timeline")!,
};
const termSelect = root.querySelector<HTMLSelectElement>("#wb-term")!;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
const hidden = (text: string) => `<span class="visually-hidden">${esc(text)}</span>`;

let index: WorkbenchIndex | undefined;
// Items whose note field is open but still empty
const editing = new Set<string>();
// Programs chosen for Compare when more than MAX_COMPARE are saved
let compareChoice: string[] | undefined;
// Where focus should go after the next render
let pendingFocus: string | undefined;

// Names --------------------------------------------------------------------

const isContent = (item: WorkbenchItem) => item.kind !== "note" && item.kind !== "answer";

function nameFor(item: WorkbenchItem, w: Workbench) {
  if (item.kind === "note") return `Note ${w.items.filter((i) => i.kind === "note").indexOf(item) + 1}`;
  const entry = index && lookup(index, item);
  return entry ? nameOf(item.kind as ContentKind, entry) : (item.ref ?? "Item");
}

// Tabs (the ARIA tabs pattern, with the tab in the address) -------------------

const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

function selectTab(tab: HTMLButtonElement, { focus = false } = {}) {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute("aria-selected", String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")!)!.hidden = !selected;
  }
  if (focus) tab.focus();
  const id = tab.id.replace("tab-", "");
  history.replaceState(history.state, "", id === "items" ? location.pathname : `#${id}`);
}

tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (e) => {
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    selectTab(tabs[(to + tabs.length) % tabs.length], { focus: true });
  });
});
// #compare or #timeline in the address opens that tab, on arrival or from a link
const tabFromHash = () => {
  const tab = tabs.find((t) => t.id === `tab-${location.hash.slice(1)}`);
  if (tab) selectTab(tab);
};
tabFromHash();
window.addEventListener("hashchange", tabFromHash);

// Items ----------------------------------------------------------------------

function renderItem(item: WorkbenchItem, w: Workbench, group: WorkbenchItem[]) {
  const key = (part: string) => `item:${item.id}:${part}`;
  const name = nameFor(item, w);
  const at = group.indexOf(item);
  const entry = index && isContent(item) ? lookup(index, item) : undefined;
  const missing = isContent(item) && !entry;

  let body = "";
  if (item.kind === "note") {
    body = `<div class="wb-note">
      <label for="note-${item.id}">${esc(name)}</label>
      <textarea id="note-${item.id}" data-note-for="${item.id}" maxlength="${MAX_NOTE}" data-focus-key="${key("note-field")}">${esc(item.text)}</textarea>
    </div>`;
  } else {
    const title = missing
      ? `<span class="wb-missing">${esc(name)}</span>`
      : `<a href="${esc((entry as { url: string }).url)}" data-focus-key="${key("link")}">${esc(name)}</a>`;
    const facts = entry ? `<p class="facts">${factsFor(item.kind as ContentKind, entry).map((f) => `<span>${esc(f)}</span>`).join("")}</p>` : "";
    const changed = entry ? changesSinceSaved(item, entry) : [];
    const flag = missing
      ? `<p class="wb-flag">No longer available.</p>`
      : changed.length
        ? `<p class="wb-flag">Updated since you saved: ${esc(listText(changed))}. <button type="button" data-action="ack" data-focus-key="${key("ack")}">Got it${hidden(`, ${name}`)}</button></p>`
        : "";
    const noteOpen = Boolean(item.note) || editing.has(item.id);
    const note = noteOpen
      ? `<div class="wb-note">
          <label for="note-${item.id}">Your note on ${esc(name)}</label>
          <textarea id="note-${item.id}" data-note-for="${item.id}" maxlength="${MAX_NOTE}" data-focus-key="${key("note-field")}">${esc(item.note)}</textarea>
        </div>`
      : "";
    body = `<h3 tabindex="-1" data-focus-key="${key("heading")}">${title}</h3>${facts}${flag}${note}`;
  }

  const button = (action: string, text: string, disabled = false) =>
    `<button type="button" data-action="${action}" data-focus-key="${key(action)}"${disabled ? ' aria-disabled="true"' : ""}>${esc(text)}${hidden(` ${name}`)}</button>`;
  const actions = [
    isContent(item) && !missing && button("note", item.note ? "Edit note" : "Add note"),
    button("up", "Move up", at === 0),
    button("down", "Move down", at === group.length - 1),
    button("remove", "Remove"),
  ].filter(Boolean);

  return `<li class="wb-item" data-item-id="${item.id}" tabindex="-1" data-focus-key="${key("item")}">${body}<div class="wb-actions">${actions.join("")}</div></li>`;
}

const addNoteForm = (first: boolean) => `<form class="add-note" data-add-note>
  <label for="new-note">${first ? "Start with a note" : "Add a note"}</label>
  <textarea id="new-note" maxlength="${MAX_NOTE}" data-focus-key="new-note" placeholder="A question to ask, something to remember…"></textarea>
  <div class="row"><button type="submit" class="button" data-focus-key="new-note-submit">Add note</button></div>
</form>`;

// Nothing saved yet: what the workbench is for, and recently viewed pages to save
function renderEmpty() {
  const recent = personalization ? recentPages(loadSession(), 3) : [];
  const pickup = recent.length
    ? `<h2>Pick up where you left off</h2>
       <ul class="pickup">${recent
         .map((view) => {
           const entry = index?.[view.type]?.[view.id];
           const { department, college, level, modality } = view;
           const interest = Object.fromEntries(Object.entries({ department, college, level, modality }).filter(([, v]) => v));
           const toggle = saveToggle({ kind: view.type, ref: view.id, name: view.name, interest, ...(entry && { watch: fingerprint(view.type, entry) }) }, { compact: true });
           return `<li><a href="${esc(view.url)}">${esc(view.name)}</a>${toggle.replace("<button ", `<button data-focus-key="pickup:${esc(view.type)}:${esc(view.id)}" `)}</li>`;
         })
         .join("")}</ul>`
    : "";
  return `<div class="empty">
    <h2 tabindex="-1" data-focus-key="empty-heading">Nothing saved yet</h2>
    <p>Use <strong>Save to ${esc(WORKBENCH_LABEL)}</strong> on any program, course, faculty, event, service, or news page, or in the program list and search results. Saved items show up here with their latest details.</p>
    ${pickup}
  </div>${addNoteForm(true)}`;
}

function renderItems(w: Workbench) {
  const groups = GROUPS.map((g) => ({ ...g, items: w.items.filter((i) => i.kind === g.kind) })).filter((g) => g.items.length);
  if (!groups.length) {
    panels.items.innerHTML = renderEmpty();
    return 0;
  }
  panels.items.innerHTML =
    groups
      .map(
        (g) => `<section class="wb-group" aria-labelledby="group-${g.kind}">
      <h2 id="group-${g.kind}" tabindex="-1" data-focus-key="group:${g.kind}">${g.title}</h2>
      <ol class="wb-items">${g.items.map((item) => renderItem(item, w, g.items)).join("")}</ol>
    </section>`
      )
      .join("") + addNoteForm(false);
  return groups.reduce((n, g) => n + g.items.length, 0);
}

// Compare --------------------------------------------------------------------

function renderCompare(w: Workbench, term: string) {
  const saved = w.items
    .filter((i) => i.kind === "program" && i.ref && index!.program[i.ref])
    .map((i) => ({ id: i.ref!, program: index!.program[i.ref!] }));
  if (!saved.length) {
    panels.compare.innerHTML = `<p>Save two or more programs to compare them side by side: format, cost, length, and your deadline.</p>
      <p><a href="/academics/programs/">Browse programs</a></p>`;
    return 0;
  }
  // With more than MAX_COMPARE saved, the visitor picks which to compare
  if (compareChoice) compareChoice = compareChoice.filter((id) => saved.some((s) => s.id === id));
  const chosen = saved.length > MAX_COMPARE ? (compareChoice ??= saved.slice(0, MAX_COMPARE).map((s) => s.id)) : saved.map((s) => s.id);
  const picker =
    saved.length > MAX_COMPARE
      ? `<fieldset class="compare-pick"><legend>Choose up to ${MAX_COMPARE} programs to compare</legend>${saved
          .map(({ id, program }) => {
            const on = chosen.includes(id);
            return `<label><input type="checkbox" data-compare-pick="${esc(id)}" data-focus-key="pick:${esc(id)}"${on ? " checked" : ""}${!on && chosen.length >= MAX_COMPARE ? " disabled" : ""} /> ${esc(program.name)}</label>`;
          })
          .join("")}</fieldset>`
      : "";
  const table = compareTable(saved.filter((s) => chosen.includes(s.id)), term);
  const caption = table.programs.length === 1 ? `${table.programs[0].name}, for a start in ${term}` : `Comparing ${table.programs.length} programs, for a start in ${term}`;
  const html = `${picker}
    ${table.programs.length > 1 ? `<p class="scroll-hint">On a small screen, scroll sideways to see every program.</p>` : ""}
    <div class="compare-wrap" role="region" aria-labelledby="compare-caption" tabindex="0">
      <table class="compare">
        <caption id="compare-caption">${esc(caption)}</caption>
        <thead><tr><td></td>${table.programs.map((p) => `<th scope="col"><a href="${esc(p.url)}">${esc(p.name)}</a></th>`).join("")}</tr></thead>
        <tbody>${table.rows
          .map((row) => `<tr><th scope="row">${esc(row.label)}</th>${row.cells.map((c) => `<td${c.notOffered ? ' class="not-offered"' : ""}>${esc(c.text)}</td>`).join("")}</tr>`)
          .join("")}</tbody>
      </table>
    </div>
    ${saved.length === 1 ? `<p>Save another program to compare it with ${esc(saved[0].program.name)}. <a href="/academics/programs/">Browse programs</a></p>` : ""}`;
  panels.compare.innerHTML = html;
  return saved.length;
}

// Timeline -------------------------------------------------------------------

let entries: TimelineEntry[] = [];

const eventTime = (entry: TimelineEntry) =>
  new Intl.DateTimeFormat("en-US", { timeZone: siteConfig.timezone, hour: "numeric", minute: "2-digit" }).formatRange(new Date(entry.start!), new Date(entry.end!));

function renderTimeline(w: Workbench, term: string) {
  entries = timeline(w, index!, term);
  const notOffered = w.items
    .filter((i) => i.kind === "program" && i.ref && index!.program[i.ref])
    .map((i) => index!.program[i.ref!])
    .filter((p) => !p.start_terms.includes(term.split(" ")[0]));
  // Semicolons, because program names have commas in them ("Nursing, MSN")
  const note = notOffered.length ? `<p class="hint">Not shown, because ${notOffered.length === 1 ? "it doesn't" : "they don't"} start in ${esc(term)}: ${esc(notOffered.map((p) => p.name).join("; "))}.</p>` : "";
  if (!entries.length) {
    panels.timeline.innerHTML = `<p>Save programs and events to see your application deadlines and event dates here, in order.</p>${note}`;
    return 0;
  }
  panels.timeline.innerHTML = `<ol class="timeline">${entries
    .map((e, i) => {
      const badge = e.next ? ' <span class="badge next">Next</span>' : e.past ? ' <span class="badge passed">Passed</span>' : "";
      const what =
        e.kind === "deadline"
          ? `<p><strong>${esc(e.title)}</strong>${badge}</p><p>For <a href="${esc(e.about.url)}">${esc(e.about.name)}</a></p>`
          : `<p><strong><a href="${esc(e.about.url)}">${esc(e.title)}</a></strong>${badge}</p><p>${esc(eventTime(e))}</p>`;
      const calendar = e.past
        ? ""
        : `<button type="button" class="small-button" data-ics="${i}" data-focus-key="ics:${e.itemId}:${e.kind}">Add to calendar${hidden(`: ${e.kind === "deadline" ? `${e.about.name}, ${e.title}` : e.title}`)}</button>`;
      return `<li class="${e.past ? "past" : ""}"><time datetime="${e.date}">${esc(longDate(e.date))}</time><div class="what">${what}${calendar}</div></li>`;
    })
    .join("")}</ol>${note}`;
  return entries.length;
}

function download(entry: TimelineEntry) {
  const blob = new Blob([icsFor(entry, siteConfig.name, location.origin)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(entry.kind === "deadline" ? `${entry.about.name} deadline` : entry.title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  announce("Calendar file downloaded.");
}

// Next step ------------------------------------------------------------------

// The journey's next step (as in For me), worded for what's saved: with
// programs saved and no request yet, "Request information about these programs."
function renderNextStep(w: Workbench) {
  const section = root.querySelector<HTMLElement>("[data-wb-next]");
  if (!section) return;
  const session = loadSession();
  renderNext(section, session, `Next-step tile on the ${label}`);
  const programs = w.items.filter((i) => i.kind === "program" && i.ref && index?.program[i.ref]).map((i) => ({ id: i.ref!, name: index!.program[i.ref!].name }));
  const step = Object.keys(session.profile.journey);
  if (programs.length && !step.includes("requestInfo")) {
    const tile = section.querySelector<HTMLAnchorElement>(".next-tile")!;
    tile.href = `/admissions/request-info/?program=${encodeURIComponent(programs[0].id)}`;
    tile.querySelector(".title")!.textContent = programs.length === 1 ? "Request information about this program" : "Request information about these programs";
    // Program names have commas in them ("Nursing, MSN"), so name only the first
    const others = programs.length - 1;
    tile.querySelector(".pitch")!.textContent = `Get costs, deadlines, and what to expect for ${programs[0].name}${others ? ` and ${others} other ${others === 1 ? "program" : "programs"}` : ""}.`;
    const why = section.querySelector(".why");
    if (why) why.textContent = `You've saved ${programs.length === 1 ? "a program" : `${programs.length} programs`} to your ${label}, and requesting information is the usual next step.`;
  }
  section.hidden = false;
}

// Rendering ------------------------------------------------------------------

function render() {
  const w = workbench.get();
  if (!index) return;
  const term = startTermFor(w, personalization ? loadSession().forms.requestInfo?.startTerm : undefined);
  termSelect.innerHTML = termOptions(term).map((t) => `<option${t === term ? " selected" : ""}>${esc(t)}</option>`).join("");

  // Remember what had focus (and a note being typed) so it survives the re-render
  const active = document.activeElement as HTMLElement | null;
  const activeKey = pendingFocus ?? (root.contains(active) ? active?.dataset.focusKey : undefined);
  const typing = active instanceof HTMLTextAreaElement && !pendingFocus ? { value: active.value, start: active.selectionStart, end: active.selectionEnd } : undefined;
  pendingFocus = undefined;

  const counts = { items: renderItems(w), compare: renderCompare(w, term), timeline: renderTimeline(w, term) };
  for (const [id, n] of Object.entries(counts)) root.querySelector(`[data-tab-count="${id}"]`)!.textContent = n ? String(n) : "";
  renderNextStep(w);

  if (activeKey) {
    const target = root.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(activeKey)}"]`);
    if (target) {
      target.focus();
      if (typing && target instanceof HTMLTextAreaElement) {
        target.value = typing.value;
        target.setSelectionRange(typing.start, typing.end);
      }
    }
  }
}

// Actions --------------------------------------------------------------------

let undoTimer: ReturnType<typeof setTimeout> | undefined;
let undoing: { item: WorkbenchItem; index: number; name: string } | undefined;
const undoBar = document.querySelector<HTMLElement>("[data-undo]")!;

function hideUndo() {
  clearTimeout(undoTimer);
  undoBar.hidden = true;
  undoing = undefined;
}
// Undo stays for 8 seconds, longer while the pointer or focus is on it
function startUndoTimer() {
  clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndo, 8000);
}
undoBar.addEventListener("focusin", () => clearTimeout(undoTimer));
undoBar.addEventListener("mouseenter", () => clearTimeout(undoTimer));
undoBar.addEventListener("focusout", (e) => !undoBar.contains(e.relatedTarget as Node) && startUndoTimer());
undoBar.addEventListener("mouseleave", () => !undoBar.contains(document.activeElement) && startUndoTimer());
undoBar.querySelector("[data-undo-button]")!.addEventListener("click", () => {
  if (!undoing) return;
  const { item, index: at, name } = undoing;
  hideUndo();
  pendingFocus = isContent(item) && index && lookup(index, item) ? `item:${item.id}:link` : `item:${item.id}:item`;
  workbench.restore(item, at);
  announce(`Restored ${name}.`);
});

function removeItem(item: WorkbenchItem, w: Workbench) {
  const name = nameFor(item, w);
  const group = w.items.filter((i) => i.kind === item.kind);
  const next = group[group.indexOf(item) + 1];
  // Focus goes to the next item, or the group's heading if this was the last
  // one, or the panel if the group is now empty
  pendingFocus = next ? (isContent(next) && index && lookup(index, next) ? `item:${next.id}:link` : `item:${next.id}:item`) : group.length > 1 ? `group:${item.kind}` : undefined;
  const removed = workbench.remove(item.id);
  if (!removed) return;
  if (group.length === 1) (root.querySelector<HTMLElement>(`[data-focus-key="group:${item.kind}"]`) ?? panels.items.querySelector<HTMLElement>("h2") ?? panels.items).focus();
  undoing = { ...removed, name };
  undoBar.querySelector("[data-undo-text]")!.textContent = `Removed ${name}.`;
  undoBar.hidden = false;
  startUndoTimer();
  announce(`Removed ${name} from your ${label}. Undo is at the bottom of the page.`);
}

root.addEventListener("click", (event) => {
  const target = event.target as Element;
  const ics = target.closest<HTMLButtonElement>("[data-ics]");
  if (ics) return download(entries[Number(ics.dataset.ics)]);

  const button = target.closest<HTMLButtonElement>("button[data-action]");
  const id = button?.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
  if (!button || !id || button.getAttribute("aria-disabled") === "true") return;
  const w = workbench.get();
  const item = w.items.find((i) => i.id === id);
  if (!item) return;
  const name = nameFor(item, w);

  switch (button.dataset.action) {
    case "up":
    case "down": {
      pendingFocus = `item:${id}:${button.dataset.action}`;
      const moved = workbench.move(id, button.dataset.action);
      if (moved) announce(`Moved ${name} to position ${moved.position} of ${moved.of}.`);
      break;
    }
    case "remove":
      removeItem(item, w);
      break;
    case "note":
      editing.add(id);
      pendingFocus = `item:${id}:note-field`;
      render();
      break;
    case "ack": {
      const entry = index && lookup(index, item);
      if (!entry) break;
      pendingFocus = `item:${id}:link`;
      workbench.setWatch(id, fingerprint(item.kind as ContentKind, entry)!);
      announce(`Noted. ${name} will say so again if it changes.`);
      break;
    }
  }
});

// Notes save when the field loses focus. Wait a moment so focus has landed
// where it was going, and the re-render can keep it there.
root.addEventListener("focusout", (event) => {
  const field = event.target as HTMLTextAreaElement;
  const id = field.dataset?.noteFor;
  if (!id) return;
  setTimeout(() => {
    const item = workbench.get().items.find((i) => i.id === id);
    if (!item) return;
    const value = field.value.trim();
    if (!value) editing.delete(id);
    if (value !== ((item.kind === "note" ? item.text : item.note) ?? "")) {
      workbench.setNote(id, value);
      announce(value ? "Note saved." : "Note removed.");
    } else if (!value) {
      render();
    }
  });
});

root.addEventListener("submit", (event) => {
  const form = (event.target as Element).closest("[data-add-note]");
  if (!form) return;
  event.preventDefault();
  const field = form.querySelector("textarea")!;
  if (!field.value.trim()) return field.focus();
  pendingFocus = "new-note";
  const result = workbench.addNote(field.value);
  announce(result.ok ? "Note added." : `Your ${label} is full. Remove something to add more.`);
});

root.addEventListener("change", (event) => {
  const box = event.target as HTMLInputElement;
  if (!box.dataset.comparePick || !compareChoice) return;
  const id = box.dataset.comparePick;
  compareChoice = box.checked ? [...compareChoice, id].slice(0, MAX_COMPARE) : compareChoice.filter((x) => x !== id);
  pendingFocus = `pick:${id}`;
  render();
});

termSelect.addEventListener("change", () => {
  workbench.setStartTerm(termSelect.value);
  announce(`Showing deadlines for ${termSelect.value}.`);
});

window.addEventListener("workbench:change", render);
window.addEventListener("personalization:change", () => renderNextStep(workbench.get()));

fetch("/data/workbench-index.json")
  .then((res) => {
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  })
  .then((data: WorkbenchIndex) => {
    index = data;
    render();
  })
  .catch(() => {
    for (const panel of Object.values(panels)) panel.innerHTML = `<p>The ${label} couldn't load the catalog. Reload the page to try again.</p>`;
  });
