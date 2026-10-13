// The "Save to Workbench" toggle, as HTML, for every place that has one:
// detail pages (full size), and program lists and search results (compact).
// src/scripts/workbench/save.ts makes them work. Safe in the browser: no
// catalog imports.

import { WORKBENCH_LABEL, type ContentKind, type Interest } from "./types.ts";

// What a toggle needs to save an item
export type SaveData = { kind: ContentKind; ref: string; name: string; interest?: Interest; watch?: Record<string, string> };

export const SAVE_LABELS = {
  full: { off: `Save to ${WORKBENCH_LABEL}`, on: "Saved" },
  compact: { off: "Save", on: "Saved" },
};

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value: unknown) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Hidden until JavaScript is running (.needs-js), so nothing appears or
// moves without it. The compact one says "Save" and adds the item's name for
// screen readers ("Save Nursing, MSN").
export function saveToggle(data: SaveData, { compact = false } = {}) {
  const labels = compact ? SAVE_LABELS.compact : SAVE_LABELS.full;
  const attrs = [
    `data-save-kind="${esc(data.kind)}"`,
    `data-save-ref="${esc(data.ref)}"`,
    `data-save-name="${esc(data.name)}"`,
    data.interest && `data-save-interest="${esc(JSON.stringify(data.interest))}"`,
    data.watch && `data-save-watch="${esc(JSON.stringify(data.watch))}"`,
    compact && "data-save-compact",
  ].filter(Boolean);
  return `<button type="button" class="save-toggle${compact ? " compact" : ""} needs-js" aria-pressed="false" ${attrs.join(" ")}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" /></svg><span class="save-label">${labels.off}</span>${compact ? `<span class="visually-hidden"> ${esc(data.name)}</span>` : ""}</button>`;
}
