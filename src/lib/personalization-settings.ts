// Settings shared by the personalization experiment's build-time code and the
// scripts that run in the browser. No imports, so it's safe on both sides.

// sessionStorage keys
export const PROFILE_KEY = "cascadia:personalization";
export const PANEL_KEY = "cascadia:under-the-hood";

// Keep at most this many page views
export const MAX_VIEWS = 50;
// "Recently viewed" shows this many distinct pages
export const RECENT_COUNT = 4;

// What a detail page tells the tracker about itself, via data-* attributes on <main>
export type PageMeta = {
  type: "program" | "course" | "service" | "faculty" | "event" | "news";
  id: string;
  name: string;
  department?: string;
  college?: string;
  level?: string;
  modality?: string;
};

export const TYPE_LABELS: Record<PageMeta["type"], string> = {
  program: "Program",
  course: "Course",
  service: "Student service",
  faculty: "Faculty",
  event: "Event",
  news: "News story",
};

// The application journey, in the order most students take it. A step is
// done when: explore — any program page is viewed; requestInfo and visit —
// their forms are submitted; apply — any apply button or link is clicked.
export type JourneyStep = "explore" | "requestInfo" | "visit" | "apply";
export const JOURNEY: { step: JourneyStep; label: string; href: string }[] = [
  { step: "explore", label: "Explore programs", href: "/academics/programs/" },
  { step: "requestInfo", label: "Request information", href: "/admissions/request-info/" },
  { step: "visit", label: "Schedule a visit", href: "/admissions/visit/schedule/" },
  { step: "apply", label: "Apply", href: "/admissions/apply/" },
];
