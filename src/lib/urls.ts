// The one place page URLs are built. Pages, feeds, and MCP results all use it.

export type PageType = "programs" | "courses" | "services" | "faculty" | "events" | "news";

// Where each page type lives in the site's navigation.
export const SECTION_PATH: Record<PageType, string> = {
  programs: "/academics/programs",
  courses: "/academics/courses",
  services: "/services",
  faculty: "/about/faculty",
  events: "/about/events",
  news: "/about/news",
};

export const pagePath = (type: PageType, id: string) => `${SECTION_PATH[type]}/${id}/`;
export const markdownPath = (type: PageType, id: string) => `${pagePath(type, id)}index.md`;
export const subjectPath = (departmentId: string) => `${SECTION_PATH.courses}/subjects/${departmentId}/`;

export const absoluteUrl = (path: string, base: string | URL) => new URL(path, base).toString();
