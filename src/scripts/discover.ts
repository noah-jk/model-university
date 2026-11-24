// The home page's Discover band (#74). "Career" suggests careers as people
// type (combobox.ts); "I need help with" lists student services. Go opens
// the picked career's page, or else the picked service's page. Something
// typed but not picked opens the careers list filtered by it, which is also
// what the form does without JavaScript.

import { combobox } from "./combobox.ts";
import { announce } from "./enhance.ts";
import { matchCareers, type CareerOption } from "../lib/discover.ts";
import { pagePath } from "../lib/urls.ts";

const form = document.querySelector<HTMLFormElement>("[data-discover]");

if (form) {
  const careers: CareerOption[] = JSON.parse(document.getElementById("discover-career-options")?.textContent ?? "[]");
  const input = form.querySelector<HTMLInputElement>("#discover-career")!;
  const list = form.querySelector<HTMLElement>("#discover-careers")!;
  const service = form.querySelector<HTMLSelectElement>("#discover-service")!;

  combobox(input, list, {
    suggest: (query) => matchCareers(careers, query).map((m) => ({ id: m.id, label: m.name, meta: m.via && `Also called ${m.via}` })),
    pick: (id) => (input.value = careers.find((c) => c.id === id)?.name ?? input.value),
    counts: ["career matches", "careers match"],
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const typed = input.value.trim();
    // A picked suggestion fills in the career's exact name
    const career = careers.find((c) => c.name.toLowerCase() === typed.toLowerCase());
    if (career) location.href = pagePath("careers", career.id);
    else if (typed) location.href = `${form.action}?q=${encodeURIComponent(typed)}`;
    else if (service.value) location.href = service.value;
    else {
      announce("Pick a career or a service, then choose Go.");
      input.focus();
    }
  });
}
