// Turns the feature switches in site.config.ts into routes.
// Each AI feature that publishes files lives in this folder, and its routes
// only exist in the build when the feature is switched on.
// The MCP endpoint is a Netlify Function and checks its own switch.

import { writeFileSync } from "node:fs";
import type { AstroIntegration } from "astro";
import siteConfig, { type Feature } from "../../site.config.ts";

const routes: Partial<Record<Feature, { pattern: string; entrypoint: string }[]>> = {
  llmsTxt: [{ pattern: "/llms.txt", entrypoint: "./src/features/llms-txt.ts" }],
  jsonFeeds: [{ pattern: "/data/[feed].json", entrypoint: "./src/features/json-feeds.ts" }],
  markdownPages: [{ pattern: "/[type]/[id]/index.md", entrypoint: "./src/features/markdown-pages.ts" }],
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
