import { defineConfig } from "astro/config";
import siteConfig from "./site.config.ts";
import aiFeatures from "./src/features/integration.ts";

export default defineConfig({
  // Netlify sets URL during builds, including deploy previews.
  site: process.env.URL || siteConfig.url,
  trailingSlash: "always",
  integrations: [aiFeatures()],
});
