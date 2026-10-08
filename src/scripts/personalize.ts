// Personalization experiment: records page views in sessionStorage and keeps a
// small interest profile. Nothing is sent anywhere; closing the tab clears it.
//
// Importing this module records the current page view (once per page load,
// because modules run once), so anything that imports it sees an up-to-date
// profile.

import { MAX_VIEWS, PROFILE_KEY, type PageMeta } from "../lib/personalization-settings.ts";

export type PageView = PageMeta & { url: string; at: string };

type Counts = Record<string, number>;
export type Profile = {
  views: number;
  department: Counts;
  college: Counts;
  level: Counts;
  modality: Counts;
};
export type Session = { views: PageView[]; profile: Profile };

const emptySession = (): Session => ({ views: [], profile: deriveProfile([]) });

// sessionStorage can be missing or blocked (some private modes), so every
// access is guarded. Without it the experiment simply does nothing.
export function loadSession(): Session {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PROFILE_KEY) ?? "null");
    return saved?.views ? saved : emptySession();
  } catch {
    return emptySession();
  }
}

export const storageAvailable = (() => {
  try {
    sessionStorage.setItem(`${PROFILE_KEY}:test`, "1");
    sessionStorage.removeItem(`${PROFILE_KEY}:test`);
    return true;
  } catch {
    return false;
  }
})();

function save(session: Session) {
  try {
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(session));
  } catch {
    // Storage full or blocked: keep going without saving
  }
  window.dispatchEvent(new CustomEvent("personalization:change", { detail: session }));
}

// Counts by department, college, level, and format across the stored views
export function deriveProfile(views: PageView[]): Profile {
  const profile: Profile = { views: views.length, department: {}, college: {}, level: {}, modality: {} };
  for (const view of views) {
    for (const key of ["department", "college", "level", "modality"] as const) {
      const value = view[key];
      if (value) profile[key][value] = (profile[key][value] ?? 0) + 1;
    }
  }
  return profile;
}

// The most common value for one signal, e.g. top(profile.department) → ["Nursing", 4]
export function top(counts: Counts): [string, number] | undefined {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
}

// Last few distinct pages, newest first
export function recentPages(session: Session, count: number) {
  const seen = new Set<string>();
  const recent: PageView[] = [];
  for (const view of [...session.views].reverse()) {
    const key = `${view.type}:${view.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(view);
    if (recent.length === count) break;
  }
  return recent;
}

export function resetSession() {
  try {
    sessionStorage.removeItem(PROFILE_KEY);
  } catch {
    // Nothing to clear
  }
  save(emptySession());
}

// Read this page's metadata from <main data-page-*> and add it to the log.
// A reload of the same page isn't counted twice in a row.
function recordPageView() {
  const main = document.querySelector<HTMLElement>("main[data-page-type]");
  if (!main || !storageAvailable) return;
  const d = main.dataset;
  const view: PageView = {
    type: d.pageType as PageView["type"],
    id: d.pageId!,
    name: d.pageName!,
    url: window.location.pathname,
    ...(d.department && { department: d.department }),
    ...(d.college && { college: d.college }),
    ...(d.level && { level: d.level }),
    ...(d.modality && { modality: d.modality }),
    at: new Date().toISOString(),
  };
  const session = loadSession();
  const last = session.views.at(-1);
  if (last && last.type === view.type && last.id === view.id) return;
  const views = [...session.views, view].slice(-MAX_VIEWS);
  save({ views, profile: deriveProfile(views) });
}

recordPageView();
