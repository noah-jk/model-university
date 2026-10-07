// Loads a Markdown page from content/pages/ by its slug (set in each file's
// frontmatter), and fails with a clear message if it's missing.

import { getCollection, getEntry, render } from "astro:content";

export async function getPage(slug: string) {
  const entry = await getEntry("pages", slug);
  if (!entry) {
    const known = (await getCollection("pages")).map((p) => p.id).join(", ");
    throw new Error(`No page with slug "${slug}" in content/pages/. Pages found: ${known || "none"}.`);
  }
  const { Content } = await render(entry);
  return { ...entry.data, Content };
}
