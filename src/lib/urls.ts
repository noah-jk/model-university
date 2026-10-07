// The one place page URLs are built. Pages, feeds, and MCP results all use it.

export type PageType = "programs" | "courses" | "services" | "faculty" | "events" | "news";

export const pagePath = (type: PageType, id: string) => `/${type}/${id}/`;
export const markdownPath = (type: PageType, id: string) => `${pagePath(type, id)}index.md`;
export const subjectPath = (departmentId: string) => `/courses/subjects/${departmentId}/`;

export const absoluteUrl = (path: string, base: string | URL) => new URL(path, base).toString();
