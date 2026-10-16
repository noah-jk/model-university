// Save to Your Path toggles and the header's count, on every page. Toggles
// can arrive later (search results), so clicks are handled for the whole
// document, and toggles are brought up to date whenever the workbench
// changes, in this tab or another one, or new content is rendered.

import { announce } from "../enhance.ts";
import { workbench } from "../../lib/workbench/store.ts";
import { SAVE_LABELS } from "../../lib/workbench/toggle.ts";
import { MAX_ITEMS, WORKBENCH_LABEL, type ContentKind, type Workbench } from "../../lib/workbench/types.ts";
import { loadSession } from "../personalize.ts";
import { afterSave } from "./handoffs.ts";
import { pathState } from "./path-state.ts";

export function syncToggles(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>("button[data-save-ref]").forEach((button) => {
    const saved = workbench.has(button.dataset.saveKind as ContentKind, button.dataset.saveRef!);
    const labels = "saveCompact" in button.dataset ? SAVE_LABELS.compact : SAVE_LABELS.full;
    button.setAttribute("aria-pressed", String(saved));
    button.querySelector(".save-label")!.textContent = saved ? labels.on : labels.off;
  });
}

// What the badge says: steps to do once there's a plan, saved items before
export const badgeText = ({ count, counting }: NonNullable<Workbench["badge"]>) =>
  count === 0 ? "" : counting === "steps" ? `, ${count} ${count === 1 ? "step" : "steps"} to do` : `, ${count} saved`;

export function syncCount() {
  const state = pathState(loadSession());
  const badge = state.steps ? { count: state.toDo, counting: "steps" as const } : { count: state.saved, counting: "saved" as const };
  document.querySelectorAll("[data-workbench-count]").forEach((el) => {
    el.textContent = String(badge.count);
    (el as HTMLElement).hidden = badge.count === 0;
  });
  document.querySelectorAll("[data-workbench-count-text]").forEach((el) => (el.textContent = badgeText(badge)));
  // Remember it, so the next page can draw it before its scripts run
  workbench.setBadge(badge);
}

// Without localStorage, say once that saving lasts only as long as the page
let warned = false;
function warnIfNotSaved() {
  if (workbench.persistent || warned) return;
  warned = true;
  const note = document.createElement("div");
  note.className = "workbench-notice";
  note.setAttribute("role", "status");
  note.innerHTML = `<p>${WORKBENCH_LABEL} won't be saved after you close this tab.</p><button type="button" class="button secondary">OK</button>`;
  note.querySelector("button")!.addEventListener("click", () => note.remove());
  document.body.append(note);
}

const parse = (json?: string) => {
  try {
    return json ? JSON.parse(json) : undefined;
  } catch {
    return undefined;
  }
};

document.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button[data-save-ref]");
  if (!button) return;
  const { saveKind, saveRef, saveName, saveInterest, saveWatch } = button.dataset;
  const kind = saveKind as ContentKind;
  const existing = workbench.find(kind, saveRef!);
  if (existing) {
    workbench.remove(existing.id);
    announce(`Removed ${saveName} from ${WORKBENCH_LABEL}.`);
    return;
  }
  const result = workbench.add(kind, saveRef!, { interest: parse(saveInterest), watch: parse(saveWatch) });
  if (!result.ok && result.reason === "full") {
    announce(`${WORKBENCH_LABEL} is full (${MAX_ITEMS} items). Remove something to save more.`);
    return;
  }
  announce(afterSave(button, kind, saveRef!) ?? `Saved ${saveName} to ${WORKBENCH_LABEL}.`);
  warnIfNotSaved();
});

window.addEventListener("workbench:change", () => {
  syncToggles();
  syncCount();
});
// Journey steps (sent forms, apply clicks) change the steps left
window.addEventListener("personalization:change", () => syncCount());
// Other scripts fire this after adding content that may have toggles
window.addEventListener("content:rendered", () => syncToggles());

syncToggles();
syncCount();
