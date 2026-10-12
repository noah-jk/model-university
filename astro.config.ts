import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";
import siteConfig from "./site.config.ts";
import aiFeatures from "./src/features/integration.ts";

export default defineConfig({
  // Netlify sets URL during builds, including deploy previews.
  site: process.env.URL || siteConfig.url,
  trailingSlash: "always",
  // Every page is built ahead of time, except /search/ (src/features/search/),
  // which the adapter serves on demand so search works without JavaScript.
  // Images stay as Astro builds them rather than going through Netlify's image CDN.
  adapter: netlify({ imageCDN: false }),
  integrations: [aiFeatures()],
});
