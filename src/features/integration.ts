// Turns the feature switches in site.config.ts into routes.
// Each AI feature that publishes files lives in this folder, and its routes
// only exist in the build when the feature is switched on.
// The MCP and search endpoints are Netlify Functions and check their own switches.

import { writeFileSync } from "node:fs";
import type { AstroIntegration } from "astro";
import siteConfig, { type Feature } from "../../site.config.ts";

const routes: Partial<Record<Feature, { pattern: string; entrypoint: string }[]>> = {
  llmsTxt: [{ pattern: "/llms.txt", entrypoint: "./src/features/llms-txt.ts" }],
  jsonFeeds: [{ pattern: "/data/[feed].json", entrypoint: "./src/features/json-feeds.ts" }],
  markdownPages: [{ pattern: "/[...path]/index.md", entrypoint: "./src/features/markdown-pages.ts" }],
  // Rendered on demand (it sets prerender = false); the API is netlify/functions/search.mts
  aiSearch: [{ pattern: "/search", entrypoint: "./src/features/search/index.astro" }],
  workbench: [
    { pattern: "/data/workbench-index.json", entrypoint: "./src/features/workbench-index.ts" },
    { pattern: "/data/enrollment.json", entrypoint: "./src/features/enrollment-data.ts" },
    { pattern: "/workbench", entrypoint: "./src/features/workbench/index.astro" },
  ],
};

export default function aiFeatures(): AstroIntegration {
  return {
    name: "ai-features",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
        for (const [feature, featureRoutes] of Object.entries(routes)) {
          if (siteConfig.features[feature as Feature]) featureRoutes.forEach((route) => injectRoute(route));
        }
      },
      // Netlify reads dist/_headers. Until indexing is switched on, ask
      // search engines to stay away from every page and file.
      "astro:build:done": ({ dir }) => {
        if (!siteConfig.indexing) writeFileSync(new URL("_headers", dir), "/*\n  X-Robots-Tag: noindex\n");
      },
    },
  };
}
