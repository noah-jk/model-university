// Tests for the workbench's store, views, and catalog index. No browser
// needed: the store gets a fake localStorage. Run with: npm test

import * as catalog from "../src/lib/catalog.ts";
import { buildIndex } from "../src/lib/workbench/index-data.ts";
import { createStore, deserialize, migrate } from "../src/lib/workbench/store.ts";
import { changesSinceSaved, compareTable, deadlineDate, fingerprint } from "../src/lib/workbench/derive.ts";
import { MAX_ITEMS, MAX_NOTE, STORAGE_KEY } from "../src/lib/workbench/types.ts";

const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
  console.log(`✓ ${message}`);
};

function fakeStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
}
let n = 0;
const newStore = (storage: ReturnType<typeof fakeStorage> | null = fakeStorage()) => createStore(storage, { newId: () => `id-${++n}` });
const quietly = <T>(fn: () => T) => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = warn;
  }
};

// Store ------------------------------------------------------------------------

const storage = fakeStorage();
const store = newStore(storage);
check(store.persistent, "store: uses the storage it's given");
const nursing = store.add("program", "nursing-msn");
store.add("program", "data-science-ms");
store.add("program", "computer-science-bs");
check(nursing.ok && store.has("program", "nursing-msn") && JSON.parse(storage.data.get(STORAGE_KEY)!).items.length === 3, "store: add saves to storage");
check(!store.add("program", "nursing-msn").ok, "store: an item can't be saved twice");

const [first, second, third] = store.get().items;
check(store.move(first.id, "up") === undefined, "store: can't move the first item up");
check(store.move(third.id, "down") === undefined, "store: can't move the last item down");
const moved = store.move(first.id, "down");
check(moved?.position === 2 && moved.of === 3 && store.get().items[1].id === first.id, "store: move down swaps with the next item of its kind");
store.add("course", "cs-144");
check(store.move(third.id, "down") === undefined, "store: moves stay within an item's kind");

const removed = store.remove(second.id)!;
check(!store.has("program", "data-science-ms"), "store: remove");
store.restore(removed.item, removed.index);
check(store.get().items[removed.index].id === second.id, "store: restore puts an item back where it was");

store.setNote(first.id, "  Ask about clinical placements  ");
check(store.get().items.find((i) => i.id === first.id)?.note === "Ask about clinical placements", "store: notes are trimmed and saved");
store.setNote(first.id, "x".repeat(MAX_NOTE + 50));
check(store.get().items.find((i) => i.id === first.id)?.note?.length === MAX_NOTE, `store: notes are capped at ${MAX_NOTE} characters`);
store.setNote(first.id, "");
check(!("note" in store.get().items.find((i) => i.id === first.id)!), "store: an empty note removes it");
const note = store.addNote("Visit in spring?");
check(note.ok && store.get().items.at(-1)?.kind === "note" && store.get().items.at(-1)?.text === "Visit in spring?", "store: free-standing notes");
store.setStartTerm("Fall 2027");
check(store.get().profile.startTerm === "Fall 2027", "store: start term");
store.setChoice("studentType", "Transfer");
store.setChoice("level", "Undergraduate");
store.setChoice("level", undefined);
check(store.get().profile.studentType === "Transfer" && !("level" in store.get().profile), "store: choices, and removing one");
store.setCompleted("apply", true);
store.setCompleted("fafsa", true);
store.setCompleted("fafsa", false);
check(store.get().completed.join() === "apply", "store: check a step off and back on");
check(store.completeAll(["apply", "visit"]) && !store.completeAll(["visit"]) && store.get().completed.join() === "apply,visit", "store: completeAll writes only new steps");
store.setDismissed("office:transfer-center", true);
store.setDismissed("event:gone", true);
check(store.get().dismissed.length === 2, "store: dismiss");
store.setDismissed("event:gone", false);
check(store.get().dismissed.join() === "office:transfer-center", "store: restore a dismissed item");
store.setDismissed("event:gone", true);
const pruned = store.prune({ step: (id) => id === "apply", dismissed: (key) => key !== "event:gone" });
check(pruned && store.get().completed.join() === "apply" && store.get().dismissed.join() === "office:transfer-center", "store: prune drops ids that no longer exist");
check(!store.prune({ step: () => true, dismissed: () => true }), "store: prune writes nothing when all ids exist");
const writes = storage.data.get(STORAGE_KEY);
store.setBadge({ count: 3, counting: "steps" });
const afterBadge = storage.data.get(STORAGE_KEY);
store.setBadge({ count: 3, counting: "steps" });
check(afterBadge !== writes && storage.data.get(STORAGE_KEY) === afterBadge && store.get().badge?.count === 3, "store: badge writes only when it changes");

const full = newStore();
for (let i = 0; i < MAX_ITEMS; i++) full.add("course", `course-${i}`);
check(!full.add("course", "one-more").ok && full.get().items.length === MAX_ITEMS, `store: at most ${MAX_ITEMS} items`);
store.clear();
check(store.get().items.length === 0 && !store.get().profile.startTerm && store.get().completed.length === 0 && store.get().dismissed.length === 0, "store: clear");

// Without storage, the workbench lives in memory and says so
const memory = newStore(null);
memory.add("program", "nursing-msn");
check(!memory.persistent && memory.has("program", "nursing-msn"), "store: works in memory without storage");

// Migrate ----------------------------------------------------------------------

check(quietly(() => migrate("not json at all")).items.length === 0, "migrate: unreadable data resets");
check(quietly(() => migrate({ version: 99, items: [{ id: "a" }] })).items.length === 0, "migrate: unknown versions reset");
check(migrate(null).version === 2, "migrate: nothing saved gives an empty workbench");
const v1 = migrate({ version: 1, startTerm: "Spring 2027", updatedAt: "2026-10-01T00:00:00Z", items: [{ id: "b", kind: "program", ref: "nursing-msn", source: "saved", addedAt: "2026-10-01T00:00:00Z" }] });
check(v1.version === 2 && v1.profile.startTerm === "Spring 2027" && v1.items.length === 1 && v1.completed.length === 0 && v1.dismissed.length === 0, "migrate: version 1 keeps its items and start term");
const messy = migrate({ version: 2, items: [], profile: { level: "Graduate", studentType: 4 }, completed: ["apply", 7], dismissed: "nope" });
check(messy.profile.level === "Graduate" && !("studentType" in messy.profile) && messy.completed.join() === "apply" && messy.dismissed.length === 0, "migrate: bad choices and ids are dropped");
const withAnswer = quietly(() => migrate({
  version: 1,
  updatedAt: "2026-10-01T00:00:00Z",
  items: [
    { id: "a", kind: "answer", text: "Phase 2 answer", source: "suggested", addedAt: "2026-10-01T00:00:00Z" },
    { id: "b", kind: "program", ref: "nursing-msn", source: "saved", addedAt: "2026-10-01T00:00:00Z" },
    { nonsense: true },
  ],
}));
check(withAnswer.items.length === 2 && withAnswer.items[0].kind === "answer", "migrate: unknown kinds are kept, broken items dropped");
const corrupt = fakeStorage();
corrupt.setItem(STORAGE_KEY, "{oops");
check(quietly(() => newStore(corrupt).get()).items.length === 0, "migrate: corrupt storage gives an empty workbench, not an error");

// Serialize ----------------------------------------------------------------------

const shared = newStore();
shared.add("program", "nursing-msn");
shared.add("event", catalog.events[0].id);
shared.setNote(shared.get().items[0].id, "Top choice — ask about cost?");
shared.addNote("Talk to Maya's counselor");
shared.setStartTerm("Winter 2027");
const text = shared.serialize();
const back = deserialize(text, () => `copy-${++n}`);
check(/^[A-Za-z0-9_-]+$/.test(text), "serialize: URL-safe text");
check(
  back.profile.startTerm === "Winter 2027" &&
    JSON.stringify(back.items.map((i) => [i.kind, i.ref ?? i.text, i.note])) === JSON.stringify(shared.get().items.map((i) => [i.kind, i.ref ?? i.text, i.note])) &&
    back.items.every((i) => i.source === "shared"),
  "serialize → deserialize: same items, notes, and start term"
);
check(quietly(() => deserialize("garbage!")).items.length === 0, "deserialize: bad text gives an empty workbench");

// Derive ----------------------------------------------------------------------

const index = buildIndex();
const program = (id: string) => ({ id, program: index.program[id] });
check(deadlineDate("October 15", "Winter 2027") === "2026-10-15" && deadlineDate("March 1", "Fall 2027") === "2027-03-01", "deadlines: the last date before the term starts");

const offeredIn = (term: string) => catalog.programs.filter((p) => (p.start_terms as string[]).includes(term)).map((p) => p.id);
const fallOnly = catalog.programs.find((p) => p.start_terms.length === 1 && p.start_terms[0] === "Fall")!;
const one = compareTable([program(fallOnly.id)], "Spring 2027");
check(one.programs.length === 1 && one.rows.at(-1)!.cells[0].notOffered, "compare: one program, with Not offered for a term it doesn't start in");
const two = compareTable([program(offeredIn("Spring")[0]), program(offeredIn("Spring")[1])], "Spring 2027");
check(two.programs.length === 2 && two.rows.every((r) => r.cells.length === 2) && !two.rows.at(-1)!.cells.some((c) => c.notOffered), "compare: two programs side by side");
check(!two.rows.some((r) => /total of|combined|sum/i.test(r.label)), "compare: costs aren't added up");
const five = compareTable(catalog.programs.slice(0, 5).map((p) => program(p.id)), "Fall 2027");
check(five.programs.length === 4, "compare: at most four programs");

const entry = index.program["nursing-msn"];
const saved = { id: "s", kind: "program" as const, ref: "nursing-msn", source: "saved" as const, addedAt: "", watch: fingerprint("program", entry) };
check(changesSinceSaved(saved, entry).length === 0, "changes: none when nothing changed");
check(changesSinceSaved(saved, { ...entry, estimated_total_tuition_usd: entry.estimated_total_tuition_usd + 1000 }).join() === "tuition", "changes: a tuition change is spotted");
const record = catalog.programs.find((p) => p.id === "nursing-msn")!;
check(JSON.stringify(fingerprint("program", record)) === JSON.stringify(fingerprint("program", entry)), "changes: catalog record and index give the same fingerprint");

// Index ------------------------------------------------------------------------

const counts: [keyof typeof index, { id: string }[]][] = [
  ["program", catalog.programs],
  ["course", catalog.courses],
  ["faculty", catalog.faculty],
  ["event", catalog.events],
  ["service", catalog.services],
  ["news", catalog.news],
];
for (const [kind, rows] of counts) check(rows.every((r) => index[kind][r.id]), `index: every ${kind} is present (${rows.length})`);
const size = JSON.stringify(index).length;
check(size < 400 * 1024, `index: ${(size / 1024).toFixed(0)} KB, under the 400 KB budget`);

console.log("\nWorkbench checks passed.");
