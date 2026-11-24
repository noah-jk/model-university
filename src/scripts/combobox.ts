// A text field with suggestions: the ARIA 1.2 combobox pattern with a listbox.
// Used by Compare's program search (workbench/page.ts) and the home page's
// Career field (discover.ts).
//
// The input needs role="combobox", aria-expanded, aria-controls (the list's
// id), and aria-autocomplete="list"; the list needs role="listbox" and an id.
// Up and Down move through suggestions, Enter picks, Escape closes the list
// (or clears the field when it's already closed). Focus stays in the input,
// and the number of matches is announced once typing pauses.

import { announce } from "./enhance.ts";

export type Suggestion = { id: string; label: string; meta?: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function combobox(
  input: HTMLInputElement,
  list: HTMLElement,
  options: {
    // Suggestions for what's typed (none for an empty field)
    suggest: (query: string) => Suggestion[];
    // Called with the picked suggestion's id; focus stays in the input
    pick: (id: string) => void;
    // How to count matches, e.g. ["program matches", "programs match"]
    counts: [string, string];
  },
) {
  let matches: Suggestion[] = [];
  let active = -1;
  let countTimer: ReturnType<typeof setTimeout> | undefined;

  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  };
  const show = () => {
    matches = options.suggest(input.value);
    active = -1;
    input.removeAttribute("aria-activedescendant");
    list.innerHTML = matches
      .map((m, i) => `<li role="option" id="${list.id}-${i}" data-option="${esc(m.id)}" aria-selected="false">${esc(m.label)}${m.meta ? `<span class="option-meta">${esc(m.meta)}</span>` : ""}</li>`)
      .join("");
    const open = matches.length > 0;
    list.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
    clearTimeout(countTimer);
    const [one, many] = options.counts;
    if (input.value.trim()) countTimer = setTimeout(() => announce(matches.length ? `${matches.length} ${matches.length === 1 ? one : many}. Use the arrow keys to choose.` : `No ${many.split(" ")[0]} match.`), 600);
  };
  const highlight = (i: number) => {
    active = i;
    list.querySelectorAll<HTMLElement>("[role=option]").forEach((o, j) => o.setAttribute("aria-selected", String(j === i)));
    const option = document.getElementById(`${list.id}-${i}`);
    if (option) {
      input.setAttribute("aria-activedescendant", option.id);
      option.scrollIntoView({ block: "nearest" });
    }
  };
  const choose = (id: string) => {
    clearTimeout(countTimer);
    close();
    options.pick(id);
    input.focus();
  };

  input.addEventListener("input", show);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (list.hidden) show();
      if (matches.length) highlight((active + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (matches.length) highlight(active <= 0 ? matches.length - 1 : active - 1);
    } else if (e.key === "Enter") {
      if (active >= 0 && !list.hidden) {
        e.preventDefault();
        choose(matches[active].id);
      }
    } else if (e.key === "Escape") {
      if (!list.hidden) close();
      else input.value = "";
    }
  });
  // mousedown, so the click lands before the input loses focus
  list.addEventListener("mousedown", (e) => {
    const option = (e.target as Element).closest<HTMLElement>("[data-option]");
    if (!option) return;
    e.preventDefault();
    choose(option.dataset.option!);
  });
  input.addEventListener("blur", () => setTimeout(close, 100));
  return { close };
}
