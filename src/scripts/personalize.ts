// Personalization experiment: records page views, form answers, and the
// application journey in sessionStorage, and derives an interest profile from
// them. Nothing is sent anywhere; closing the tab clears it.
//
// Importing this module records the current page view (once per page load,
// because modules run once), so anything that imports it sees an up-to-date
// profile. It also marks the "apply" step when any [data-journey-apply]
// button or link is clicked.

import { JOURNEY, MAX_VIEWS, PROFILE_KEY, type JourneyStep, type PageMeta } from "../lib/personalization-settings.ts";

export type PageView = PageMeta & { url: string; at: string };

// What each form stores. Program details come along with the program so the
// profile can count its department, level, and format.
export type RequestInfoAnswers = {
  firstName: string;
  lastName: string;
  email: string;
  level: string;
  program?: { id: string; name: string; department: string; college: string; level: string; modality: string };
  startTerm: string;
  at: string;
};
export type VisitAnswers = {
  date: string;
  guests: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  at: string;
};
export type Forms = { requestInfo?: RequestInfoAnswers; visit?: VisitAnswers };

type Counts = Record<string, number>;
export type Profile = {
  views: number;
  department: Counts;
  college: Counts;
  level: Counts;
  modality: Counts;
  // When each journey step was done, if it has been
  journey: Partial<Record<JourneyStep, string>>;
  // What the person told us in forms (the latest answer wins)
  // Form answers are canonical: where one exists, it overrides the page-view
  // counts above (see preferred). department, college, and modality come from
  // the program picked in the request-info form.
  stated: {
    level?: string;
    program?: string;
    department?: string;
    college?: string;
    modality?: string;
    startTerm?: string;
    visitDate?: string;
    guests?: number;
  };
  contact: { firstName?: string; lastName?: string; email?: string; phone?: string };
};
export type Session = { views: PageView[]; forms: Forms; applied?: string; profile: Profile };

const emptySession = (): Session => ({ views: [], forms: {}, profile: deriveProfile([], {}) });

// sessionStorage can be missing or blocked (some private modes), so every
// access is guarded. Without it the experiment simply does nothing.
export function loadSession(): Session {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PROFILE_KEY) ?? "null");
    if (!saved?.views) return emptySession();
    const forms: Forms = saved.forms ?? {};
    // The visit form used to ask for a date of birth; drop any saved before it was removed
    if (forms.visit) delete (forms.visit as Record<string, unknown>).dob;
    return { views: saved.views, forms, applied: saved.applied, profile: deriveProfile(saved.views, forms, saved.applied) };
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

function save(views: PageView[], forms: Forms, applied?: string) {
  const session: Session = { views, forms, applied, profile: deriveProfile(views, forms, applied) };
  try {
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(session));
  } catch {
    // Storage full or blocked: keep going without saving
  }
  window.dispatchEvent(new CustomEvent("personalization:change", { detail: session }));
  return session;
}

// Counts by department, college, level, and format across page views, plus
// the program named in the request-info form; the journey; and form answers.
export function deriveProfile(views: PageView[], forms: Forms, applied?: string): Profile {
  const profile: Profile = { views: views.length, department: {}, college: {}, level: {}, modality: {}, journey: {}, stated: {}, contact: {} };
  const signals: Partial<Record<"department" | "college" | "level" | "modality", string>>[] = [...views];
  if (forms.requestInfo?.program) signals.push(forms.requestInfo.program);
  for (const signal of signals) {
    for (const key of ["department", "college", "level", "modality"] as const) {
      const value = signal[key];
      if (value) profile[key][value] = (profile[key][value] ?? 0) + 1;
    }
  }

  const firstProgramView = views.find((v) => v.type === "program");
  if (firstProgramView) profile.journey.explore = firstProgramView.at;
  if (forms.requestInfo) profile.journey.requestInfo = forms.requestInfo.at;
  if (forms.visit) profile.journey.visit = forms.visit.at;
  if (applied) profile.journey.apply = applied;

  const { requestInfo: info, visit } = forms;
  profile.stated = {
    ...(info && { level: info.level, startTerm: info.startTerm }),
    ...(info?.program && {
      program: info.program.name,
      department: info.program.department,
      college: info.program.college,
      modality: info.program.modality,
    }),
    ...(visit && { visitDate: visit.date, guests: visit.guests }),
  };
  // Contact details from whichever form was sent most recently
  const latest = [info, visit].filter(Boolean).sort((a, b) => a!.at.localeCompare(b!.at)).at(-1);
  if (latest) {
    profile.contact = { firstName: latest.firstName, lastName: latest.lastName, email: latest.email };
    if (visit?.phone) profile.contact.phone = visit.phone;
  }
  return profile;
}

// The first journey step not done yet, or undefined when all are done
export const nextStep = (profile: Profile) => JOURNEY.find(({ step }) => !profile.journey[step]);

// The most common value for one signal, e.g. top(profile.department) → ["Nursing", 4]
export function top(counts: Counts): [string, number] | undefined {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
}

// What a visitor is most interested in, for one signal: what they said in a
// form if they did (e.g. the college of the program they asked about),
// otherwise the one they've viewed most. Views never outvote a form answer.
export function preferred(profile: Profile, signal: "department" | "college" | "level" | "modality") {
  return profile.stated[signal] ?? top(profile[signal])?.[0];
}

// The program to point someone toward: the one they named in a form, else
// the one they viewed last in their top-interest department, else the last
// program they viewed at all.
export function focusProgram(session: Session): { id: string; name: string } | undefined {
  const named = session.forms.requestInfo?.program;
  if (named) return named;
  const programViews = session.views.filter((v) => v.type === "program");
  const department = preferred(session.profile, "department");
  return programViews.filter((v) => v.department === department).at(-1) ?? programViews.at(-1);
}

// Plain-language reasons for picks based on a department or college, for
// "Why" notes and the Under the hood panel's "What changed on this page"
export function interestReason(session: Session, signal: "department" | "college") {
  const { profile } = session;
  const value = preferred(profile, signal);
  if (!value) return undefined;
  if (profile.stated[signal]) return `because you asked about ${profile.stated.program} in the request-info form`;
  const count = profile[signal][value] ?? 0;
  return `because ${value} is the ${signal} you've looked at most (${count} of ${profile.views} page views)`;
}

// Mark an element as personalized, with a plain-language reason, or clear the
// mark (no reason). The Under the hood panel lists every marked element that's
// visible on the page, and refreshes when this fires the "personalized" event.
export function markPersonalized(element: Element | null | undefined, reason?: string) {
  if (!element) return;
  if (reason) element.setAttribute("data-personalized", reason);
  else element.removeAttribute("data-personalized");
  window.dispatchEvent(new Event("personalized"));
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

export function recordForm<K extends keyof Forms>(kind: K, answers: Forms[K]) {
  const session = loadSession();
  return save(session.views, { ...session.forms, [kind]: answers }, session.applied);
}

export function recordApply() {
  const session = loadSession();
  if (!session.applied) save(session.views, session.forms, new Date().toISOString());
}

export function resetSession() {
  try {
    sessionStorage.removeItem(PROFILE_KEY);
  } catch {
    // Nothing to clear
  }
  save([], {});
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
  save([...session.views, view].slice(-MAX_VIEWS), session.forms, session.applied);
}

recordPageView();

// Any apply button or link, anywhere on the site, completes the "apply" step
document.addEventListener("click", (e) => {
  if ((e.target as Element).closest?.("[data-journey-apply]")) recordApply();
});
