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

// Home page headline for the college a visitor has looked at most, keyed by
// college name (as counted in the profile). Anyone else sees the default
// headline written in the page.
export const COLLEGE_HEADLINES: Record<string, string> = {
  "College of Science": "Build a Future in Science",
  "Carver College of Business": "Build a Future as an Entrepreneur",
  "College of Social & Behavioral Sciences": "Build a Future Helping People",
  "College of Engineering & Computing": "Build a Future in Technology",
  "College of Education": "Build a Future Educating",
  "College of Arts & Letters": "Build a Future in the Arts",
  "College of Health & Human Services": "Build a Future in Healthcare",
};
