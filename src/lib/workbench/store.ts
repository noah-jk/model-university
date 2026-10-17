// The one place the workbench is read and written. It's kept in localStorage
// (saving is on purpose, so it outlasts the tab) under STORAGE_KEY. After
// every write it fires `workbench:change` on window, and it listens for the
// `storage` event so other open tabs stay in sync.
//
// If localStorage isn't available (some private modes), the workbench lives
// in memory for this page only, and `persistent` is false so the page can
// say so.
//
// The browser uses the shared `workbench` store below. Tests make their own
// with createStore(), passing a fake storage.

import { MAX_ITEMS, MAX_NOTE, STORAGE_KEY, type Interest, type ItemKind, type PlanChoices, type Workbench, type WorkbenchItem } from "./types.ts";

type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

const empty = (): Workbench => ({ version: 2, items: [], profile: {}, dismissed: [], completed: [], hiddenHandoffs: [], updatedAt: new Date().toISOString() });

const isItem = (x: unknown): x is WorkbenchItem => {
  const i = x as WorkbenchItem;
  return Boolean(i) && typeof i.id === "string" && typeof i.kind === "string" && typeof i.addedAt === "string";
};

// Any stored version in, the current version out. Version 1 had a start term
// at the top level; version 2 keeps it with the student's other choices.
// Unknown or broken data becomes an empty workbench, with a warning, never an
// error. Items of kinds this version doesn't show (like "answer") are kept.
const strings = (list: unknown) => (Array.isArray(list) ? [...new Set(list.filter((x): x is string => typeof x === "string"))] : []);
const choices = (profile: unknown): PlanChoices => {
  const p = (profile ?? {}) as Record<string, unknown>;
  return Object.fromEntries((["startTerm", "level", "studentType"] as const).filter((k) => typeof p[k] === "string").map((k) => [k, p[k]]));
};

export function migrate(stored: unknown): Workbench {
  const data = stored as (Partial<Omit<Workbench, "version">> & { version?: number; startTerm?: string }) | null;
  if ((data?.version === 1 || data?.version === 2) && Array.isArray(data.items)) {
    const items = data.items.filter(isItem).map((item) => ({ ...item, source: item.source ?? "saved" }));
    if (items.length < data.items.length) console.warn(`Workbench: dropped ${data.items.length - items.length} unreadable items`);
    const profile = data.version === 1 ? (typeof data.startTerm === "string" ? { startTerm: data.startTerm } : {}) : choices(data.profile);
    const badge = data.badge && typeof data.badge.count === "number" ? { badge: data.badge } : {};
    const visit = typeof data.visit?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.visit.date) ? { visit: { date: data.visit.date } } : {};
    return {
      version: 2,
      items,
      profile,
      dismissed: strings(data.dismissed),
      completed: strings(data.completed),
      hiddenHandoffs: strings(data.hiddenHandoffs),
      ...badge,
      ...visit,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };
  }
  if (stored != null) console.warn("Workbench: saved data wasn't readable, so it was reset");
  return empty();
}

// Compact, URL-safe text for a workbench: the base for phase 3's share link.
// Only what the items are and the notes on them; ids and dates are new on the
// other end.
type Compact = { v: 1; t?: string; i: [kind: ItemKind, refOrText: string, note?: string][] };

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromBase64Url = (text: string) => {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
};

export function serialize(workbench: Workbench) {
  const compact: Compact = {
    v: 1,
    ...(workbench.profile.startTerm && { t: workbench.profile.startTerm }),
    i: workbench.items.map((item) => {
      const main = item.ref ?? item.text ?? "";
      return item.note ? [item.kind, main, item.note] : [item.kind, main];
    }),
  };
  return toBase64Url(JSON.stringify(compact));
}

export function deserialize(text: string, newId: () => string = () => crypto.randomUUID()): Workbench {
  try {
    const compact = JSON.parse(fromBase64Url(text)) as Compact;
    if (compact.v !== 1 || !Array.isArray(compact.i)) throw new Error("unknown format");
    const addedAt = new Date().toISOString();
    const items = compact.i.slice(0, MAX_ITEMS).map(([kind, main, note]): WorkbenchItem => ({
      id: newId(),
      kind,
      ...(kind === "note" || kind === "answer" ? { text: main.slice(0, MAX_NOTE) } : { ref: main }),
      ...(note && { note: note.slice(0, MAX_NOTE) }),
      source: "shared",
      addedAt,
    }));
    return { ...empty(), items, profile: compact.t ? { startTerm: compact.t } : {}, updatedAt: addedAt };
  } catch {
    console.warn("Workbench: couldn't read that shared workbench");
    return empty();
  }
}

export type AddResult = { ok: true; item: WorkbenchItem } | { ok: false; reason: "full" | "exists" };

export function createStore(storage: Storage | null, { newId = (): string => crypto.randomUUID(), now = () => new Date() } = {}) {
  let memory: Workbench | undefined;
  const persistent = (() => {
    if (!storage) return false;
    try {
      storage.setItem(`${STORAGE_KEY}:test`, "1");
      storage.removeItem(`${STORAGE_KEY}:test`);
      return true;
    } catch {
      return false;
    }
  })();

  function get(): Workbench {
    if (!persistent) return structuredClone((memory ??= empty()));
    try {
      const raw = storage!.getItem(STORAGE_KEY);
      return migrate(raw == null ? null : JSON.parse(raw));
    } catch {
      return migrate(undefined);
    }
  }

  const listeners = new Set<(w: Workbench) => void>();
  const notify = (w: Workbench) => {
    listeners.forEach((fn) => fn(w));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("workbench:change", { detail: w }));
  };

  function write(change: (w: Workbench) => void) {
    const w = get();
    change(w);
    w.updatedAt = now().toISOString();
    if (persistent) {
      try {
        storage!.setItem(STORAGE_KEY, JSON.stringify(w));
      } catch {
        // Storage full: this change lasts until the page closes
        memory = w;
      }
    } else {
      memory = w;
    }
    notify(w);
    return w;
  }

  const trimNote = (text: string) => text.trim().slice(0, MAX_NOTE);
  const find = (kind: ItemKind, ref: string) => get().items.find((i) => i.kind === kind && i.ref === ref);

  // Another tab changed the workbench
  if (typeof window !== "undefined" && persistent) {
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY || e.key === null) notify(get());
    });
  }

  return {
    persistent,
    get,
    find,
    has: (kind: ItemKind, ref: string) => Boolean(find(kind, ref)),
    subscribe(fn: (w: Workbench) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    add(kind: ItemKind, ref: string, extra: { watch?: Record<string, string>; interest?: Interest } = {}): AddResult {
      const current = get();
      if (current.items.some((i) => i.kind === kind && i.ref === ref)) return { ok: false, reason: "exists" };
      if (current.items.length >= MAX_ITEMS) return { ok: false, reason: "full" };
      const item: WorkbenchItem = { id: newId(), kind, ref, source: "saved", addedAt: now().toISOString(), ...extra };
      write((w) => w.items.push(item));
      return { ok: true, item };
    },

    addNote(text: string): AddResult {
      if (get().items.length >= MAX_ITEMS) return { ok: false, reason: "full" };
      const item: WorkbenchItem = { id: newId(), kind: "note", text: trimNote(text), source: "saved", addedAt: now().toISOString() };
      write((w) => w.items.push(item));
      return { ok: true, item };
    },

    // Returns the removed item and where it was, for restore()
    remove(id: string) {
      const items = get().items;
      const index = items.findIndex((i) => i.id === id);
      if (index < 0) return undefined;
      write((w) => w.items.splice(index, 1));
      return { item: items[index], index };
    },

    // Undo a remove: put the item back where it was
    restore(item: WorkbenchItem, index = Infinity) {
      write((w) => {
        if (w.items.some((i) => i.id === item.id)) return;
        w.items.splice(Math.min(index, w.items.length), 0, item);
      });
    },

    // Move an item up or down among the items of its kind. Returns its new
    // position within the group (1-based) and the group size, or undefined
    // at the ends.
    move(id: string, direction: "up" | "down") {
      const items = get().items;
      const item = items.find((i) => i.id === id);
      if (!item) return undefined;
      const group = items.filter((i) => i.kind === item.kind);
      const at = group.indexOf(item);
      const swapWith = group[direction === "up" ? at - 1 : at + 1];
      if (!swapWith) return undefined;
      write((w) => {
        const a = w.items.findIndex((i) => i.id === item.id);
        const b = w.items.findIndex((i) => i.id === swapWith.id);
        [w.items[a], w.items[b]] = [w.items[b], w.items[a]];
      });
      return { position: (direction === "up" ? at - 1 : at + 1) + 1, of: group.length };
    },

    // The student's note on an item, or a free-standing note's text. Empty removes it.
    setNote(id: string, text: string) {
      write((w) => {
        const item = w.items.find((i) => i.id === id);
        if (!item) return;
        const note = trimNote(text);
        if (item.kind === "note") item.text = note;
        else if (note) item.note = note;
        else delete item.note;
      });
    },

    // "Got it" on "Updated since you saved": remember the current values
    setWatch(id: string, watch: Record<string, string>) {
      write((w) => {
        const item = w.items.find((i) => i.id === id);
        if (item) item.watch = watch;
      });
    },

    // A choice about the student (start term, level, or type). Undefined
    // removes the choice, so the suggested value is used again.
    setChoice(field: keyof PlanChoices, value: string | undefined) {
      write((w) => {
        if (value) w.profile[field] = value;
        else delete w.profile[field];
      });
    },
    setStartTerm(term: string | undefined) {
      write((w) => {
        if (term) w.profile.startTerm = term;
        else delete w.profile.startTerm;
      });
    },

    // Check a step off, or un-check it
    setCompleted(stepId: string, done: boolean) {
      write((w) => {
        w.completed = done ? [...new Set([...w.completed, stepId])] : w.completed.filter((id) => id !== stepId);
      });
    },
    // Steps finished elsewhere (the application journey). Writes only if something's new.
    completeAll(stepIds: string[]) {
      const current = new Set(get().completed);
      const fresh = stepIds.filter((id) => !current.has(id));
      if (fresh.length) write((w) => (w.completed = [...w.completed, ...fresh]));
      return fresh.length > 0;
    },

    // Hide a pulled-in item ("office:transfer-center"), or bring it back
    setDismissed(key: string, dismissed: boolean) {
      write((w) => {
        w.dismissed = dismissed ? [...new Set([...w.dismissed, key])] : w.dismissed.filter((k) => k !== key);
      });
    },

    // The visit form's date (YYYY-MM-DD), shown on the timeline. Undefined removes it.
    setVisit(date: string | undefined) {
      if (get().visit?.date === date) return;
      write((w) => {
        if (date) w.visit = { date };
        else delete w.visit;
      });
    },

    hideHandoff(id: string) {
      write((w) => (w.hiddenHandoffs = [...new Set([...w.hiddenHandoffs, id])]));
    },

    // What the header badge shows. Writes only when it changes.
    setBadge(badge: NonNullable<Workbench["badge"]>) {
      const current = get().badge;
      if (current?.count === badge.count && current.counting === badge.counting) return;
      write((w) => (w.badge = badge));
    },

    // Drop completed and dismissed ids that no longer exist in the rules or
    // the catalog. `known` says whether a step id or a "kind:id" is real.
    prune(known: { step: (id: string) => boolean; dismissed: (key: string) => boolean }) {
      const w = get();
      const completed = w.completed.filter(known.step);
      const dismissed = w.dismissed.filter(known.dismissed);
      if (completed.length === w.completed.length && dismissed.length === w.dismissed.length) return false;
      write((next) => {
        next.completed = completed;
        next.dismissed = dismissed;
      });
      return true;
    },

    // Start the plan over: the student's choices, checked steps, dismissals,
    // hidden tips, and visit date. Saved items stay: they're kept on purpose.
    resetPlan() {
      write((w) => {
        Object.assign(w, { ...empty(), items: w.items, updatedAt: w.updatedAt });
        delete w.visit;
      });
    },

    clear() {
      write((w) => {
        Object.assign(w, { ...empty(), updatedAt: w.updatedAt });
        delete w.visit;
        delete w.badge;
      });
    },

    serialize: () => serialize(get()),
  };
}

export type WorkbenchStore = ReturnType<typeof createStore>;

// The browser's store
export const workbench = createStore(typeof localStorage === "undefined" ? null : (() => {
  try {
    return localStorage;
  } catch {
    return null;
  }
})());
