// Site-wide settings. Each AI feature is a module you can switch off here.

const siteConfig = {
  name: "Cascadia State University",
  shortName: "Cascadia State",
  // Used for absolute links when the build doesn't know its own address.
  // On Netlify, the URL environment variable takes precedence.
  url: "https://cascadia-state.netlify.app",
  timezone: "America/Los_Angeles",

  // While false, every response carries X-Robots-Tag: noindex.
  indexing: false,

  features: {
    // MCP endpoint at /mcp for AI assistants
    mcp: true,
    // /llms.txt site guide
    llmsTxt: true,
    // JSON feeds at /data/*.json
    jsonFeeds: true,
    // Markdown copy of each detail page at …/index.md
    markdownPages: true,
    // "Ask AI" menus on the home page and section overview pages
    askAi: true,
    // Lab experiment: session-based personalization and the "Under the hood"
    // panel. Uses sessionStorage only; nothing leaves the browser.
    personalization: true,
  },
} as const;

export default siteConfig;
export type Feature = keyof typeof siteConfig.features;
