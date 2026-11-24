// Tests for the home page's Discover band (#74): the Career field's
// suggestions, the service list, and the size of what the page embeds.
// Run with: npm test

import { careers, services } from "../src/lib/catalog.ts";
import { careerOptions, matchCareers, serviceGroups } from "../src/lib/discover.ts";
import { SERVICE_CATEGORIES } from "../src/lib/vocab.ts";

const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
  console.log(`✓ ${message}`);
};

const options = careerOptions(careers);
check(options.length === careers.length && options.every((o, i) => i === 0 || options[i - 1].name.localeCompare(o.name) <= 0), "careerOptions: every career, by name");

check(matchCareers(options, "").length === 0 && matchCareers(options, "   ").length === 0, "matchCareers: nothing for an empty field");
const nurse = matchCareers(options, "nurse");
check(nurse.length > 0 && nurse.every((m) => /nurse/i.test(m.name) || /nurse/i.test(m.via ?? "")), "matchCareers: every suggestion has the word in its name or a job title");
const nameFirst = matchCareers(options, "data");
const firstTitleMatch = nameFirst.findIndex((m) => m.via);
check(firstTitleMatch === -1 || nameFirst.slice(firstTitleMatch).every((m) => m.via), "matchCareers: name matches come before job-title matches");
const starts = matchCareers(options, "soft");
check(starts[0]?.name.toLowerCase().startsWith("soft"), `matchCareers: names that start with what's typed come first ("soft" → ${starts[0]?.name})`);
const viaTitle = matchCareers(options, "software engineer");
check(viaTitle.some((m) => m.id === "software-developer" && m.via === "Software engineer"), "matchCareers: an other job title finds the career and says which title matched");
check(matchCareers(options, "a", 5).length === 5, "matchCareers: at most the limit");
check(matchCareers(options, "zzzz").length === 0, "matchCareers: no matches, no suggestions");

const groups = serviceGroups(services);
check(groups.reduce((n, g) => n + g.services.length, 0) === services.length, `serviceGroups: all ${services.length} services`);
check(groups.every((g, i) => i === 0 || SERVICE_CATEGORIES.indexOf(g.category) > SERVICE_CATEGORIES.indexOf(groups[i - 1].category)), "serviceGroups: categories in the vocabulary's order, none empty");
check(groups.every((g) => g.services.every((s) => s.url.startsWith("/services/") && s.url.endsWith("/"))), "serviceGroups: each service links to its page");

// The career list is embedded in the home page
const BUDGET_KB = 16;
const size = JSON.stringify(options).length;
check(size <= BUDGET_KB * 1024, `career suggestions: ${(size / 1024).toFixed(1)} KB embedded in the home page, under the ${BUDGET_KB} KB budget`);

console.log("\nHome page checks passed.");
