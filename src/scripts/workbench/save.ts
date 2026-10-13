// Save to Workbench toggles and the header's item count, on every page.
// Toggles can arrive later (search results), so clicks are handled for the
// whole document, and toggles are brought up to date whenever the workbench
// changes, in this tab or another one, or new content is rendered.

import { announce } from "../enhance.ts";
import { workbench } from "../../lib/workbench/store.ts";
import { SAVE_LABELS } from "../../lib/workbench/toggle.ts";
import { MAX_ITEMS, WORKBENCH_LABEL, type ContentKind } from "../../lib/workbench/types.ts";

const plural = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

export function syncToggles(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>("button[data-save-ref]").forEach((button) => {
    const saved = workbench.has(button.dataset.saveKind as ContentKind, button.dataset.saveRef!);
    const labels = "saveCompact" in button.dataset ? SAVE_LABELS.compact : SAVE_LABELS.full;
    button.setAttribute("aria-pressed", String(saved));
    button.querySelector(".save-label")!.textContent = saved ? labels.on : labels.off;
  });
}

export function syncCount() {
  const count = workbench.get().items.length;
  document.querySelectorAll("[data-workbench-count]").forEach((el) => {
    el.textContent = String(count);
    (el as HTMLElement).hidden = count === 0;
  });
  document.querySelectorAll("[data-workbench-count-text]").forEach((el) => (el.textContent = `, ${count ? plural(count) : "no items"}`));
}

// Without localStorage, say once that saving lasts only as long as the page
let warned = false;
function warnIfNotSaved() {
  if (workbench.persistent || warned) return;
  warned = true;
  const note = document.createElement("div");
  note.className = "workbench-notice";
  note.setAttribute("role", "status");
  note.innerHTML = `<p>Your ${WORKBENCH_LABEL.toLowerCase()} won't be saved after you close this tab.</p><button type="button" class="button secondary">OK</button>`;
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
    announce(`Removed ${saveName} from your ${WORKBENCH_LABEL.toLowerCase()}.`);
    return;
  }
  const result = workbench.add(kind, saveRef!, { interest: parse(saveInterest), watch: parse(saveWatch) });
  if (!result.ok && result.reason === "full") {
    announce(`Your ${WORKBENCH_LABEL.toLowerCase()} is full (${MAX_ITEMS} items). Remove something to save more.`);
    return;
  }
  announce(`Saved ${saveName} to your ${WORKBENCH_LABEL.toLowerCase()}.`);
  warnIfNotSaved();
});

window.addEventListener("workbench:change", () => {
  syncToggles();
  syncCount();
});
// Other scripts fire this after adding content that may have toggles
window.addEventListener("content:rendered", () => syncToggles());

syncToggles();
syncCount();
