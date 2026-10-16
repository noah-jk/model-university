// The Your Path page (/your-path/): the profile bar, the plan (steps,
// offices, suggested events), and the Items, Compare, and Timeline tabs. It
// fills them from the workbench store, this tab's session,
// /data/enrollment.json, and /data/workbench-index.json, and re-renders
// whenever any of them changes (here or in another tab). Re-rendering keeps
// focus where it was: elements that can hold focus carry a data-focus-key,
// and the one that had focus gets it back.

import siteConfig from "../../../site.config.ts";
import { announce } from "../enhance.ts";
import { listText } from "../../lib/format.ts";
import { longDay } from "../../lib/dates.ts";
import { rulesFrom, type Rules, type RulesLookup } from "../../lib/enrollment-rules.ts";
import { upcomingTerms } from "../../lib/terms.ts";
import { ALL_STUDENT_TYPES, STUDENT_LEVELS, STUDENT_TYPES } from "../../lib/vocab.ts";
import { workbench } from "../../lib/workbench/store.ts";
import { saveToggle } from "../../lib/workbench/toggle.ts";
import { changesSinceSaved, compareTable, factsFor, fingerprint, lookup, MAX_COMPARE, nameOf, termOptions } from "../../lib/workbench/derive.ts";
import { pathIcs, pathTimeline, planFor, programsByPlan, type PathEntry, type Plan, type PlanStep } from "../../lib/workbench/plan.ts";
import { describeStudents, resolveProfile, validType, type ResolvedProfile } from "../../lib/workbench/profile.ts";
import { CONTENT_KINDS, GROUPS, MAX_NOTE, WORKBENCH_LABEL, type ContentKind, type PlanChoices, type Workbench, type WorkbenchIndex, type WorkbenchItem } from "../../lib/workbench/types.ts";
import { loadSession, recentPages } from "../personalize.ts";
import { renderNext } from "../next-step.ts";
import { signalsFrom } from "./path-state.ts";

const personalization = siteConfig.features.personalization;
const root = document.querySelector<HTMLElement>("[data-workbench]")!;
const panels = {
  items: root.querySelector<HTMLElement>("#panel-items")!,
  compare: root.querySelector<HTMLElement>("#panel-compare")!,
  timeline: root.querySelector<HTMLElement>("#panel-timeline")!,
};
const selects = {
  studentType: root.querySelector<HTMLSelectElement>("#pf-type")!,
  level: root.querySelector<HTMLSelectElement>("#pf-level")!,
  startTerm: root.querySelector<HTMLSelectElement>("#pf-term")!,
};

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
const hidden = (text: string) => `<span class="visually-hidden">${esc(text)}</span>`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

let index: WorkbenchIndex | undefined;
let rules: RulesLookup | undefined;
// Items whose note field is open but still empty
const editing = new Set<string>();
// Programs chosen for Compare when more than MAX_COMPARE are saved
let compareChoice: string[] | undefined;
// Where focus should go after the next render
let pendingFocus: string | undefined;
let showDismissed = false;
// The saved item whose More actions list is open, if any (one at a time)
let openMore: string | undefined;
let pruned = false;

// Profile -----------------------------------------------------------------------

const terms = () => rules?.upcomingCalendarTerms() ?? upcomingTerms();

function currentProfile(w: Workbench): ResolvedProfile {
  const session = personalization ? loadSession() : undefined;
  const { views, requestInfo } = signalsFrom(session);
  return resolveProfile(w.profile, { views, requestInfo, items: w.items }, terms());
}

const options = (values: readonly string[], selected: string | undefined, blank?: string) =>
  (blank ? `<option value="">${esc(blank)}</option>` : "") + values.map((v) => `<option${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");

const FIELD_NAMES: Record<keyof PlanChoices, string> = { studentType: "student type", level: "level", startTerm: "start term" };

function renderProfile(profile: ResolvedProfile, w: Workbench) {
  const level = profile.level.value;
  const types = level ? STUDENT_TYPES[level as keyof typeof STUDENT_TYPES] : ALL_STUDENT_TYPES;
  selects.studentType.innerHTML = options(types, profile.studentType.value, "Choose…");
  selects.level.innerHTML = options(STUDENT_LEVELS, level, "Choose…");
  selects.startTerm.innerHTML = options(termOptions(profile.startTerm.value).filter((t) => terms().includes(t) || t === profile.startTerm.value), profile.startTerm.value);

  const notes: string[] = [];
  for (const field of ["studentType", "level", "startTerm"] as const) {
    const value = profile[field];
    root.querySelector<HTMLElement>(`[data-tag="${field}"]`)!.hidden = value.source !== "inferred";
    if (value.source === "inferred" && value.why) {
      notes.push(`<details class="note-row" data-focus-key="why:${field}"><summary>Why “${esc(value.value)}”?</summary><p>${esc(value.why)}</p></details>`);
    }
    if (w.profile[field]) {
      notes.push(`<p class="note-row"><button type="button" class="link-button" data-reset="${field}" data-focus-key="reset:${field}">Reset ${FIELD_NAMES[field]} to suggested</button></p>`);
    }
  }
  if (profile.level.mixed) notes.unshift(`<p class="ask">${esc(profile.level.why)}</p>`);
  else if (!profile.ready) notes.unshift(`<p class="ask">Choose your student type and level to see your steps, dates, and offices.</p>`);
  root.querySelector("[data-profile-notes]")!.innerHTML = notes.join("");
}

function choose(field: keyof PlanChoices, value: string) {
  const w = workbench.get();
  const before = currentProfile(w);
  if (field === "studentType" && value && !validType(before.level.value, value)) {
    // A type that only fits the other level brings its level with it
    const fits = STUDENT_LEVELS.filter((l) => (STUDENT_TYPES[l] as readonly string[]).includes(value));
    if (fits.length === 1) workbench.setChoice("level", fits[0]);
  }
  if (field === "level" && value && before.studentType.value && !validType(value, before.studentType.value)) {
    // The type doesn't exist at the new level: switch it to that level's first type, and say so
    const replacement = STUDENT_TYPES[value as keyof typeof STUDENT_TYPES][0];
    workbench.setChoice("studentType", replacement);
    announce(`${before.studentType.value} isn't a ${value.toLowerCase()} option, so student type is now ${replacement}.`);
  }
  workbench.setChoice(field, value || undefined);
  announcePlan();
}

function announcePlan() {
  const profile = currentProfile(workbench.get());
  if (!profile.ready || !rules) return;
  const count = rules.stepsFor(profile.level.value!, profile.studentType.value!).length;
  // After any other announcement (like a type change) has been read
  setTimeout(() => announce(`Your plan was updated: ${plural(count, "step")} for ${describeStudents(profile.level.value!, profile.studentType.value!)} starting ${profile.startTerm.value}.`), 120);
}

// Steps and offices ----------------------------------------------------------------

const JOURNEY_DONE: Record<string, string> = {
  explore: "Done when you looked at a program",
  requestInfo: "Done when you sent the request-information form",
  visit: "Done when you sent the visit form",
  apply: "Done when you started your application",
};

function stepStatus(s: PlanStep) {
  if (s.status === "done") return s.doneByJourney ? JOURNEY_DONE[s.step.journey!] : "Done";
  const due = s.date ? `${s.status === "overdue" ? '<span class="overdue">Overdue:</span> was due' : "Due"} ${esc(longDay(s.date))}${s.dateSource ? ` (${esc(s.dateSource)})` : ""}` : "";
  return `${s.next ? '<span class="next">Next</span>' : ""}${due || (s.next ? "Your next step" : "")}`;
}

function renderSteps(plan: Plan | undefined) {
  const section = root.querySelector<HTMLElement>("[data-steps]")!;
  section.hidden = !plan;
  if (!plan) return;
  root.querySelector("[data-progress]")!.textContent = `${plan.done} of ${plan.steps.length} done. ${plan.reason}.`;
  root.querySelector("[data-steps-list]")!.innerHTML = plan.steps
    .map((s) => {
      const { step } = s;
      const id = `step-${step.id}`;
      const office = step.office && index?.service[step.office];
      const links = [
        step.url && `<a href="${esc(step.url)}">Go${hidden(`: ${step.title}`)}</a>`,
        office && `<span>Help: <a href="${esc(office.url)}">${esc(office.name)}</a></span>`,
      ].filter(Boolean);
      const status = stepStatus(s);
      return `<li class="${s.next ? "is-next" : ""}${s.status === "done" ? " is-done" : ""}">
        <div class="check">
          <input type="checkbox" id="${id}" data-step-check="${esc(step.id)}" data-focus-key="step:${esc(step.id)}"${s.status === "done" ? " checked" : ""}${s.doneByJourney ? ' aria-disabled="true"' : ""} aria-describedby="${id}-status" />
          <label for="${id}">${esc(step.title)}</label>
        </div>
        ${status ? `<p class="status" id="${id}-status">${status}</p>` : `<p class="status visually-hidden" id="${id}-status">Not done</p>`}
        <p>${esc(step.description)}</p>
        ${s.note ? `<p class="step-note">${esc(s.note)}</p>` : ""}
        ${links.length ? `<p class="links">${links.join("")}</p>` : ""}
      </li>`;
    })
    .join("");
}

function renderOffices(plan: Plan | undefined) {
  const section = root.querySelector<HTMLElement>("[data-offices]")!;
  section.hidden = !plan || !plan.offices.length;
  if (!plan) return;
  root.querySelector("[data-offices-list]")!.innerHTML = plan.offices
    .map(
      (o) => `<li data-office="${esc(o.id)}">
        <span class="for-you">For you</span>
        <a href="${esc(o.url)}" data-focus-key="office:${esc(o.id)}:link">${esc(o.name)}</a>
        <p>${esc(o.reason)}</p>
        <button type="button" data-dismiss="office:${esc(o.id)}" data-focus-key="office:${esc(o.id)}:dismiss">Dismiss${hidden(` ${o.name}`)}</button>
      </li>`
    )
    .join("");
}

// Items ----------------------------------------------------------------------

const isContent = (item: WorkbenchItem) => (CONTENT_KINDS as readonly string[]).includes(item.kind);

function nameFor(item: WorkbenchItem, w: Workbench) {
  if (item.kind === "note") return `Note ${w.items.filter((i) => i.kind === "note").indexOf(item) + 1}`;
  const entry = index && lookup(index, item);
  return entry ? nameOf(item.kind as ContentKind, entry) : (item.ref ?? "Item");
}

function renderItem(item: WorkbenchItem, w: Workbench, group: WorkbenchItem[], outsidePlan: Set<string>, planLevel?: string) {
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
    const flags = [
      missing && `<p class="wb-flag">No longer available.</p>`,
      changed.length && `<p class="wb-flag">Updated since you saved: ${esc(listText(changed))}. <button type="button" data-action="ack" data-focus-key="${key("ack")}">Got it${hidden(`, ${name}`)}</button></p>`,
      outsidePlan.has(item.id) && `<p class="wb-flag">Not part of this plan: it isn't a ${esc(planLevel?.toLowerCase())} program.</p>`,
    ].filter(Boolean);
    const noteOpen = Boolean(item.note) || editing.has(item.id);
    const note = noteOpen
      ? `<div class="wb-note">
          <label for="note-${item.id}">Your note on ${esc(name)}</label>
          <textarea id="note-${item.id}" data-note-for="${item.id}" maxlength="${MAX_NOTE}" data-focus-key="${key("note-field")}">${esc(item.note)}</textarea>
        </div>`
      : "";
    body = `<h3 tabindex="-1" data-focus-key="${key("heading")}">${title}</h3>${facts}${flags.join("")}${note}`;
  }

  const button = (action: string, text: string, disabled = false) =>
    `<button type="button" data-action="${action}" data-focus-key="${key(action)}"${disabled ? ' aria-disabled="true"' : ""}>${esc(text)}${hidden(` ${name}`)}</button>`;
  // Add note stays in view; the rest are behind a More actions disclosure
  const open = openMore === item.id;
  const more = `<div class="more" data-more-for="${item.id}">
    <button type="button" class="more-toggle" aria-expanded="${open}" aria-controls="more-${item.id}" data-more="${item.id}" data-focus-key="${key("more")}">More actions${hidden(` for ${name}`)}</button>
    <ul class="more-list" id="more-${item.id}"${open ? "" : " hidden"}>
      <li>${button("up", "Move up", at === 0)}</li>
      <li>${button("down", "Move down", at === group.length - 1)}</li>
      <li>${button("remove", "Remove")}</li>
    </ul>
  </div>`;
  const actions = [isContent(item) && !missing && button("note", item.note ? "Edit note" : "Add note"), more].filter(Boolean);

  return `<li class="wb-item" data-item-id="${item.id}" tabindex="-1" data-focus-key="${key("item")}">${body}<div class="wb-actions">${actions.join("")}</div></li>`;
}

// Events the plan suggests: Save makes one an ordinary saved item
function renderSuggested(plan: Plan | undefined) {
  if (!plan?.events.length || !index) return "";
  return `<section class="wb-group" aria-labelledby="group-suggested">
    <h2 id="group-suggested" tabindex="-1" data-focus-key="group:suggested">Suggested events</h2>
    <ol class="wb-items">${plan.events
      .map(({ id, event, reason }) => {
        const facts = factsFor("event", event).map((f) => `<span>${esc(f)}</span>`).join("");
        return `<li class="wb-item" data-suggested="${esc(id)}">
          <p class="for-you">Added for you · <details><summary>Why?</summary><p>${esc(reason)}</p></details></p>
          <h3><a href="${esc(event.url)}" data-focus-key="suggested:${esc(id)}:link">${esc(event.title)}</a></h3>
          <p class="facts">${facts}</p>
          <div class="wb-actions">
            <button type="button" data-save-suggested="${esc(id)}" data-focus-key="suggested:${esc(id)}:save">Save${hidden(` ${event.title}`)}</button>
            <button type="button" data-dismiss="event:${esc(id)}" data-focus-key="suggested:${esc(id)}:dismiss">Dismiss${hidden(` ${event.title}`)}</button>
          </div>
        </li>`;
      })
      .join("")}</ol>
  </section>`;
}

const addNoteForm = (first: boolean) => `<form class="add-note" data-add-note>
  <label for="new-note">${first ? "Start with a note" : "Add a note"}</label>
  <textarea id="new-note" maxlength="${MAX_NOTE}" data-focus-key="new-note" placeholder="A question to ask, something to remember…"></textarea>
  <div class="row"><button type="submit" class="button" data-focus-key="new-note-submit">Add note</button></div>
</form>`;

// Nothing saved yet: what saving is for, and recently viewed pages to save
function renderEmpty() {
  const recent = personalization ? recentPages(loadSession(), 4).filter((v) => v.type !== "page").slice(0, 3) : [];
  const pickup = recent.length
    ? `<h3>Pick up where you left off</h3>
       <ul class="pickup">${recent
         .map((view) => {
           const kind = view.type as ContentKind;
           const entry = index?.[kind]?.[view.id];
           const { department, college, level, modality } = view;
           const interest = Object.fromEntries(Object.entries({ department, college, level, modality }).filter(([, v]) => v));
           const toggle = saveToggle({ kind, ref: view.id, name: view.name, interest, ...(entry && { watch: fingerprint(kind, entry) }) }, { compact: true });
           return `<li><a href="${esc(view.url)}">${esc(view.name)}</a>${toggle.replace("<button ", `<button data-focus-key="pickup:${esc(view.type)}:${esc(view.id)}" `)}</li>`;
         })
         .join("")}</ul>`
    : "";
  return `<div class="empty">
    <h2 tabindex="-1" data-focus-key="empty-heading">Nothing saved yet</h2>
    <p>You can also save programs, courses, events, and people as you browse: use <strong>Save to ${esc(WORKBENCH_LABEL)}</strong> on their pages, in the program list, or in search results.</p>
    ${pickup}
  </div>`;
}

function renderItems(w: Workbench, plan: Plan | undefined, profile: ResolvedProfile) {
  const planLevel = plan ? profile.level.value : undefined;
  const outside = new Set(index && planLevel ? programsByPlan(w, index, planLevel).outside.map((i) => i.id) : []);
  const groups = GROUPS.map((g) => ({ ...g, items: w.items.filter((i) => i.kind === g.kind) })).filter((g) => g.items.length);
  const saved = groups
    .map(
      (g) => `<section class="wb-group" aria-labelledby="group-${g.kind}">
      <h2 id="group-${g.kind}" tabindex="-1" data-focus-key="group:${g.kind}">${g.title}</h2>
      <ol class="wb-items">${g.items.map((item) => renderItem(item, w, g.items, outside, planLevel)).join("")}</ol>
    </section>`
    )
    .join("");
  panels.items.innerHTML = (groups.length ? saved : renderEmpty()) + renderSuggested(plan) + addNoteForm(!groups.length);
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
  panels.compare.innerHTML = `${picker}
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
  return saved.length;
}

// Timeline -------------------------------------------------------------------

let entries: PathEntry[] = [];
const KIND_LABEL = { deadline: "Deadline", milestone: "Milestone", event: "Event" };
const eventTime = (e: PathEntry) => new Intl.DateTimeFormat("en-US", { timeZone: siteConfig.timezone, hour: "numeric", minute: "2-digit" }).formatRange(new Date(e.start!), new Date(e.finish!));

function renderTimeline(w: Workbench, plan: Plan | undefined, profile: ResolvedProfile) {
  const term = profile.startTerm.value;
  entries = pathTimeline(plan, rules!, index!, w, term, plan ? profile.level.value : undefined);
  if (!entries.length) {
    panels.timeline.innerHTML = `<p>Choose your student type and level to see every date for ${esc(term)}, or save programs and events to see their dates here, in order.</p>`;
    return 0;
  }
  panels.timeline.innerHTML = `<ol class="timeline">${entries
    .map((e, i) => {
      const badge = e.done ? ' <span class="badge done">Done</span>' : e.next ? ' <span class="badge next">Next</span>' : e.past ? ' <span class="badge passed">Passed</span>' : "";
      const when = e.start ? eventTime(e) : e.end ? `Through ${longDay(e.end)}` : "";
      const title = e.url ? `<a href="${esc(e.url)}">${esc(e.title)}</a>` : esc(e.title);
      const calendar = e.past || e.done ? "" : `<button type="button" class="small-button" data-ics="${i}" data-focus-key="ics:${esc(e.id)}">Add to calendar${hidden(`: ${e.title}`)}</button>`;
      const remove = e.id === "visit" ? `<button type="button" class="small-button" data-remove-visit data-focus-key="remove-visit">Remove${hidden(` ${e.title}`)}</button>` : "";
      return `<li class="${e.past || e.done ? "past" : ""}">
        <time datetime="${e.date}">${esc(longDay(e.date))}</time>
        <div class="what">
          <p><strong>${title}</strong>${badge}</p>
          <p class="kind">${KIND_LABEL[e.kind]} · ${esc(e.source)}${when ? ` · ${esc(when)}` : ""}</p>
          ${calendar}${remove}
        </div>
      </li>`;
    })
    .join("")}</ol>`;
  return entries.length;
}

function download(entry: PathEntry) {
  const blob = new Blob([pathIcs(entry, siteConfig.name, location.origin)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${entry.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  announce("Calendar file downloaded.");
}

// Dismissed ------------------------------------------------------------------------

function dismissedName(key: string) {
  const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  return kind === "office" ? index?.service[id]?.name : kind === "event" ? index?.event[id]?.title : undefined;
}

function renderDismissed(w: Workbench) {
  const box = root.querySelector<HTMLElement>("[data-dismissed]")!;
  const list = w.dismissed.filter((k) => dismissedName(k));
  box.hidden = !list.length;
  if (!list.length) return;
  box.innerHTML = `<button type="button" class="link-button" aria-expanded="${showDismissed}" aria-controls="dismissed-list" data-toggle-dismissed data-focus-key="dismissed-toggle">${showDismissed ? "Hide" : "Show"} dismissed items (${list.length})</button>
    <ul id="dismissed-list"${showDismissed ? "" : " hidden"}>${list
      .map((k) => `<li><span>${esc(dismissedName(k))}</span><button type="button" data-restore="${esc(k)}" data-focus-key="restore:${esc(k)}">Restore${hidden(` ${dismissedName(k)}`)}</button></li>`)
      .join("")}</ul>`;
}

// Next step (before there's a plan; with one, the steps list marks it) ------------

function renderNextStep(plan: Plan | undefined) {
  const section = root.querySelector<HTMLElement>("[data-wb-next]");
  if (!section) return;
  section.hidden = Boolean(plan);
  if (!plan) renderNext(section, loadSession(), `Next-step tile on ${WORKBENCH_LABEL}`);
}

// Rendering ------------------------------------------------------------------

function render() {
  const w = workbench.get();
  const profile = currentProfile(w);
  renderProfile(profile, w);
  if (!index || !rules) return;

  // Remember what had focus (and a note being typed) so it survives the re-render
  const active = document.activeElement as HTMLElement | null;
  const activeKey = pendingFocus ?? (root.contains(active) ? active?.dataset.focusKey : undefined);
  const typing = active instanceof HTMLTextAreaElement && !pendingFocus ? { value: active.value, start: active.selectionStart, end: active.selectionEnd } : undefined;
  const openWhy = [...root.querySelectorAll<HTMLDetailsElement>("details[open][data-focus-key]")].map((d) => d.dataset.focusKey);
  pendingFocus = undefined;

  const journeyDone = signalsFrom(personalization ? loadSession() : undefined).journeyDone;
  const plan = planFor(profile, rules, index, w, journeyDone);
  renderSteps(plan);
  renderOffices(plan);
  const counts = { items: renderItems(w, plan, profile), compare: renderCompare(w, profile.startTerm.value), timeline: renderTimeline(w, plan, profile) };
  for (const [id, n] of Object.entries(counts)) root.querySelector(`[data-tab-count="${id}"]`)!.textContent = n ? String(n) : "";
  renderDismissed(w);
  renderNextStep(plan);

  for (const key of openWhy) root.querySelector<HTMLDetailsElement>(`details[data-focus-key="${key}"]`)?.setAttribute("open", "");
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
  announce(`Removed ${name} from ${WORKBENCH_LABEL}. Undo is at the bottom of the page.`);
}

// More actions: a disclosure (a button and a list of ordinary buttons), not
// a menu. Opening one closes any other. It stays open after a Move, with
// focus on the same Move button, so moving an item several places is quick.
// Escape, or focus leaving it, closes it.
function setMore(id: string | undefined, { focusToggle = false } = {}) {
  const closing = openMore;
  openMore = id;
  for (const box of root.querySelectorAll<HTMLElement>("[data-more-for]")) {
    const open = box.dataset.moreFor === id;
    box.querySelector("[data-more]")!.setAttribute("aria-expanded", String(open));
    box.querySelector<HTMLElement>(".more-list")!.hidden = !open;
  }
  if (focusToggle && closing) root.querySelector<HTMLElement>(`[data-more="${CSS.escape(closing)}"]`)?.focus();
}

root.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !openMore) return;
  if (!(event.target as Element).closest(`[data-more-for="${CSS.escape(openMore)}"]`)) return;
  event.preventDefault();
  setMore(undefined, { focusToggle: true });
});

root.addEventListener("focusout", (event) => {
  const box = (event.target as Element).closest<HTMLElement>("[data-more-for]");
  if (!box || box.dataset.moreFor !== openMore) return;
  const to = event.relatedTarget as Node | null;
  // Re-renders replace the list; only close when focus really went somewhere else
  setTimeout(() => {
    const current = root.querySelector(`[data-more-for="${CSS.escape(box.dataset.moreFor!)}"]`);
    if (openMore === box.dataset.moreFor && !current?.contains(document.activeElement) && (!to || !current?.contains(to))) setMore(undefined);
  });
});

// Dismissing a pulled-in office or event moves focus to the next one in its
// group, or the group's heading if it was the last
function dismiss(key: string) {
  const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  const name = dismissedName(key) ?? "item";
  const siblings = [...root.querySelectorAll<HTMLElement>(kind === "office" ? "[data-office]" : "[data-suggested]")].map((el) => el.dataset.office ?? el.dataset.suggested!);
  const next = siblings[siblings.indexOf(id) + 1] ?? siblings[siblings.indexOf(id) - 1];
  pendingFocus = next ? (kind === "office" ? `office:${next}:link` : `suggested:${next}:link`) : kind === "office" ? "offices-heading" : "group:suggested";
  if (!next && kind === "event") pendingFocus = "dismissed-toggle";
  workbench.setDismissed(key, true);
  announce(`Dismissed ${name}. Show dismissed items, at the bottom of the page, to bring it back.`);
}

root.addEventListener("click", (event) => {
  const target = event.target as Element;
  const ics = target.closest<HTMLButtonElement>("[data-ics]");
  if (ics) return download(entries[Number(ics.dataset.ics)]);

  // A step done through the journey stays checked
  const locked = target.closest<HTMLInputElement>('input[data-step-check][aria-disabled="true"]');
  if (locked) {
    event.preventDefault();
    announce(`${locked.labels?.[0]?.textContent ?? "This step"} was done through your application journey.`);
    return;
  }

  // The visit from the visit form: removing it moves focus to the timeline panel
  if (target.closest("[data-remove-visit]")) {
    workbench.setVisit(undefined);
    panels.timeline.focus();
    announce(`Removed your campus visit from ${WORKBENCH_LABEL}.`);
    return;
  }

  const dismissButton = target.closest<HTMLButtonElement>("[data-dismiss]");
  if (dismissButton) return dismiss(dismissButton.dataset.dismiss!);

  const restore = target.closest<HTMLButtonElement>("[data-restore]");
  if (restore) {
    const key = restore.dataset.restore!;
    const name = dismissedName(key);
    const rest = workbench.get().dismissed.filter((k) => k !== key && dismissedName(k));
    pendingFocus = rest.length ? `restore:${rest[0]}` : key.startsWith("office:") ? `office:${key.slice(7)}:link` : `suggested:${key.slice(6)}:link`;
    workbench.setDismissed(key, false);
    announce(`Restored ${name}.`);
    return;
  }
  if (target.closest("[data-toggle-dismissed]")) {
    showDismissed = !showDismissed;
    pendingFocus = "dismissed-toggle";
    return render();
  }

  const saveSuggested = target.closest<HTMLButtonElement>("[data-save-suggested]");
  if (saveSuggested && index) {
    const id = saveSuggested.dataset.saveSuggested!;
    const result = workbench.add("event", id, { watch: fingerprint("event", index.event[id]) });
    if (result.ok) {
      // The write re-rendered before the new item's id was known; render again to focus it
      pendingFocus = `item:${result.item.id}:link`;
      render();
      announce(`Saved ${index.event[id].title} to ${WORKBENCH_LABEL}.`);
    }
    return;
  }

  const reset = target.closest<HTMLButtonElement>("[data-reset]");
  if (reset) {
    const field = reset.dataset.reset as keyof PlanChoices;
    // The reset button goes away on re-render; focus moves to its select
    workbench.setChoice(field, undefined);
    selects[field].focus();
    announce(`Your ${FIELD_NAMES[field]} is back to the suggested value.`);
    announcePlan();
    return;
  }

  const moreToggle = target.closest<HTMLButtonElement>("[data-more]");
  if (moreToggle) return setMore(openMore === moreToggle.dataset.more ? undefined : moreToggle.dataset.more);

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
      openMore = undefined;
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
  event.preventDefault();
  const form = (event.target as Element).closest("[data-add-note]");
  if (!form) return;
  const field = form.querySelector("textarea")!;
  if (!field.value.trim()) return field.focus();
  pendingFocus = "new-note";
  const result = workbench.addNote(field.value);
  announce(result.ok ? "Note added." : `${WORKBENCH_LABEL} is full. Remove something to add more.`);
});

root.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement | HTMLSelectElement;

  // Profile bar
  const field = input.dataset.field as keyof PlanChoices | undefined;
  if (field) return choose(field, input.value);

  // Step checkboxes
  const stepId = input.dataset.stepCheck;
  if (stepId && input instanceof HTMLInputElement) {
    pendingFocus = `step:${stepId}`;
    // Read the label first: the write re-renders the list
    const title = input.labels?.[0]?.textContent ?? "Step";
    workbench.setCompleted(stepId, input.checked);
    const plan = rules && index && planFor(currentProfile(workbench.get()), rules, index, workbench.get(), signalsFrom(personalization ? loadSession() : undefined).journeyDone);
    if (plan) announce(`${input.checked ? "Marked done" : "Marked not done"}: ${title}. ${plan.done} of ${plan.steps.length} done.`);
    return;
  }

  // Compare picker
  if (input.dataset.comparePick && compareChoice && input instanceof HTMLInputElement) {
    const id = input.dataset.comparePick;
    compareChoice = input.checked ? [...compareChoice, id].slice(0, MAX_COMPARE) : compareChoice.filter((x) => x !== id);
    pendingFocus = `pick:${id}`;
    render();
  }
});

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

// Links from elsewhere --------------------------------------------------------------

// Handoffs link here with the student's answers after the #, like
// #plan&type=Transfer&level=Undergraduate (see pathLink in handoffs.ts). The
// part after # never reaches the server, so no log records an answer. The
// values are saved as the student's choices, then cleared from the address.
// Returns whether the link changed the plan, so it can be announced.
function applyLink() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has("plan")) return false;
  history.replaceState(history.state, "", location.pathname);
  const before = workbench.get().profile;
  const level = params.get("level") ?? undefined;
  const type = params.get("type") ?? undefined;
  if (level && (STUDENT_LEVELS as readonly string[]).includes(level)) workbench.setChoice("level", level);
  if (type && ALL_STUDENT_TYPES.includes(type)) {
    // A type that only fits one level brings its level (Transfer → Undergraduate)
    const fits = STUDENT_LEVELS.filter((l) => (STUDENT_TYPES[l] as readonly string[]).includes(type));
    if (!validType(workbench.get().profile.level, type) || (!level && fits.length === 1)) {
      if (fits.length === 1) workbench.setChoice("level", fits[0]);
      else workbench.setChoice("level", undefined);
    }
    workbench.setChoice("studentType", type);
  }
  const after = workbench.get().profile;
  return before.level !== after.level || before.studentType !== after.studentType;
}

// After arriving from a link, a field still to answer gets focus, so the
// student can finish their plan straight away
function focusMissing() {
  const profile = currentProfile(workbench.get());
  if (!profile.studentType.value) selects.studentType.focus();
  else if (!profile.level.value) selects.level.focus();
}

// Loading ------------------------------------------------------------------------

const fromLink = location.hash.startsWith("#plan");
const linkChanged = applyLink();

window.addEventListener("workbench:change", render);
window.addEventListener("personalization:change", render);

render(); // the profile bar, before the data arrives

const getJson = <T>(url: string) => fetch(url).then((res) => (res.ok ? (res.json() as Promise<T>) : Promise.reject(new Error(String(res.status)))));
Promise.all([getJson<WorkbenchIndex>("/data/workbench-index.json"), getJson<Rules>("/data/enrollment.json")])
  .then(([indexData, rulesData]) => {
    index = indexData;
    rules = rulesFrom(rulesData);
    // Forget completed and dismissed ids that no longer exist (once per visit)
    if (!pruned) {
      pruned = true;
      const stepIds = new Set(rules.steps.map((s) => s.id));
      workbench.prune({
        step: (id) => stepIds.has(id),
        dismissed: (key) => Boolean(dismissedName(key)),
      });
    }
    render();
    if (fromLink) focusMissing();
    if (linkChanged) announcePlan();
  })
  .catch(() => {
    for (const panel of Object.values(panels)) panel.innerHTML = `<p>${WORKBENCH_LABEL} couldn't load. Reload the page to try again.</p>`;
  });
