// Settings shared by the personalization experiment's build-time code and the
// scripts that run in the browser. No imports, so it's safe on both sides.

// sessionStorage keys
export const PROFILE_KEY = "cascadia:personalization";
export const PANEL_KEY = "cascadia:under-the-hood";

// Keep at most this many page views
export const MAX_VIEWS = 50;
// "Recommended for you" appears after this many views
export const RECOMMEND_AFTER = 3;
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
