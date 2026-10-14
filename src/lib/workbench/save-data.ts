// Build-time half of the save toggles: what each catalog item saves with it.
// The interest signals come from the same page metadata personalization
// uses, and the fingerprints let the workbench spot changes later.

import * as catalog from "../catalog.ts";
import { pageMeta } from "../personalization.ts";
import { fingerprint } from "./derive.ts";
import type { ContentKind, Interest } from "./types.ts";
import type { SaveData } from "./toggle.ts";

const find = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id);

export function saveData(kind: ContentKind, ref: string): SaveData | undefined {
  const meta = (() => {
    switch (kind) {
      case "program": { const p = find(catalog.programs, ref); return p && { meta: pageMeta.program(p), record: p }; }
      case "course": { const c = find(catalog.courses, ref); return c && { meta: pageMeta.course(c), record: c }; }
      case "faculty": { const f = find(catalog.faculty, ref); return f && { meta: pageMeta.faculty(f), record: f }; }
      case "event": { const e = find(catalog.events, ref); return e && { meta: pageMeta.event(e), record: e }; }
      case "service": { const s = find(catalog.services, ref); return s && { meta: pageMeta.service(s), record: s }; }
      case "news": { const n = find(catalog.news, ref); return n && { meta: pageMeta.news(n.id, n.title, n.related), record: n }; }
    }
  })();
  if (!meta) return undefined;
  const { department, college, level, modality } = meta.meta;
  const interest: Interest = Object.fromEntries(Object.entries({ department, college, level, modality }).filter(([, v]) => v));
  return {
    kind,
    ref,
    name: meta.meta.name,
    ...(Object.keys(interest).length && { interest }),
    ...(fingerprint(kind, meta.record) && { watch: fingerprint(kind, meta.record) }),
  };
}
