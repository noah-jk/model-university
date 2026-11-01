// Keep and share your path, on Your Path (src/components/workbench/KeepPath.astro):
// the path link (kept current as the path changes), copy, print, email,
// "Copy for your AI", the account demo, and opening a path link. page.ts calls these; the link's
// format is in src/lib/workbench/share.ts.

import siteConfig from "../../../site.config.ts";
import { announce } from "../enhance.ts";
import { longDay } from "../../lib/dates.ts";
import type { Plan } from "../../lib/workbench/plan.ts";
import { aiPrompt, codeFrom, decodePath, describeShared, LINK_KEY, pathEmail, pathLink } from "../../lib/workbench/share.ts";
import { workbench } from "../../lib/workbench/store.ts";
import { WORKBENCH_LABEL } from "../../lib/workbench/types.ts";

const section = document.querySelector<HTMLElement>("[data-keep]");
const field = section?.querySelector<HTMLInputElement>("[data-keep-url]");
const notes = section?.querySelector<HTMLInputElement>("[data-keep-notes]");
const email = section?.querySelector<HTMLAnchorElement>("[data-keep-email]");

const currentLink = () => pathLink(workbench.code({ notes: Boolean(notes?.checked) }), location.origin);

// The link and the email draft follow the path: page.ts calls this on every
// render, with the names of what's saved (for "Copy for your AI"). Without a
// plan yet, the email is just the link.
type Saved = { name: string; note?: string };
let latestPlan: Plan | undefined;
let latestSaved: Saved[] = [];
let latestNotes: string[] = [];
export function renderKeep(plan: Plan | undefined, saved: Saved[] = latestSaved, freeNotes: string[] = latestNotes) {
  latestPlan = plan;
  latestSaved = saved;
  latestNotes = freeNotes;
  if (!section) return;
  const link = currentLink();
  field!.value = link;
  email!.href = plan
    ? pathEmail({ reason: plan.reason, steps: plan.steps, link }).href
    : `mailto:?subject=${encodeURIComponent(`My path to ${siteConfig.shortName}`)}&body=${encodeURIComponent(`My path on ${WORKBENCH_LABEL}: ${link}`)}`;
}

if (section) {
  notes!.addEventListener("change", () => {
    renderKeep(latestPlan);
    announce(notes!.checked ? "Your path link now includes your notes." : "Your path link no longer includes your notes.");
  });
  field!.addEventListener("focus", () => field!.select());

  section.querySelector("[data-keep-copy]")!.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(field!.value);
      announce("Copied your path link. Paste it somewhere safe, or send it to yourself.");
    } catch {
      // No clipboard (an older browser, or permission denied): select it to copy by hand
      field!.focus();
      field!.select();
      announce("The link is selected. Copy it with your keyboard or menu.");
    }
  });

  // Your plan as text for any AI, with notes only when the link includes them
  section.querySelector("[data-keep-ai]")!.addEventListener("click", async () => {
    const withNotes = Boolean(notes!.checked);
    const text = aiPrompt({
      ...(latestPlan && { reason: latestPlan.reason, steps: latestPlan.steps }),
      saved: latestSaved.map((s) => ({ name: s.name, ...(withNotes && s.note && { note: s.note }) })),
      notes: withNotes ? latestNotes : [],
      link: currentLink(),
      ...(siteConfig.features.mcp && { mcpUrl: `${location.origin}/mcp` }),
    });
    try {
      await navigator.clipboard.writeText(text);
      announce("Copied your plan for your AI. Paste it into the assistant you use.");
    } catch {
      announce("Your browser didn't allow copying. Copy your path link instead, and paste it into your AI.");
    }
  });

  section.querySelector("[data-keep-print]")!.addEventListener("click", () => window.print());

  // Account demo: check the address, then say what production would do
  const account = section.querySelector<HTMLFormElement>("[data-keep-account]");
  account?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = account.querySelector<HTMLInputElement>("#keep-email")!;
    const error = account.querySelector<HTMLElement>("#keep-email-error")!;
    const result = account.querySelector<HTMLElement>("[data-keep-account-result]")!;
    const value = input.value.trim();
    const problem = !value ? "Enter your email address" : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? "" : "Enter an email address like name@example.com";
    error.textContent = problem;
    error.hidden = !problem;
    if (problem) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    if (problem) {
      result.hidden = true;
      input.focus();
      return;
    }
    // The address isn't kept or sent anywhere
    result.textContent = `In production, we'd now email a sign-in link to ${value}, and your path would be kept in your account. This is a demo, so nothing was sent and your path stays in this browser.`;
    result.hidden = false;
    result.focus();
    announce("Demo only: nothing was sent.");
  });
}

// Printing --------------------------------------------------------------------

// Every step shows on paper, so folded groups open while printing, and a
// note says when it was printed and where to find the plan online
const opened: HTMLDetailsElement[] = [];
window.addEventListener("beforeprint", () => {
  const plan = document.querySelector("#panel-plan");
  plan?.querySelectorAll<HTMLDetailsElement>("details:not([open])").forEach((d) => {
    d.open = true;
    opened.push(d);
  });
  const note = section?.querySelector("[data-print-note]");
  if (note) note.textContent = `Printed ${longDay(new Date().toLocaleDateString("en-CA"))}. Open this plan online: ${currentLink()}`;
});
window.addEventListener("afterprint", () => {
  opened.splice(0).forEach((d) => (d.open = false));
});

// Opening a path link -------------------------------------------------------------

// #path=<code>: with nothing kept here yet, the shared path is simply
// restored; otherwise the student is asked first. Either way the code leaves
// the address, so a reload doesn't ask again. Returns true if the path changed.
export function openPathLink(): Promise<boolean> {
  const hash = location.hash.slice(1);
  if (!section || !hash.startsWith(`${LINK_KEY}=`)) return Promise.resolve(false);
  history.replaceState(history.state, "", location.pathname);
  const shared = decodePath(codeFrom(hash));
  if (!shared) {
    announce(`That path link isn't complete, so ${WORKBENCH_LABEL} wasn't changed. Ask for the link again.`);
    return Promise.resolve(false);
  }
  const mine = workbench.get();
  const empty = !mine.items.length && !mine.completed.length && !mine.profile.level && !mine.profile.studentType && !mine.visit;
  if (empty) {
    workbench.replaceWith(shared);
    announce(`Opened the shared path: ${describeShared(shared)}.`);
    return Promise.resolve(true);
  }
  const dialog = document.querySelector<HTMLDialogElement>("[data-replace]")!;
  dialog.querySelector("[data-replace-text]")!.textContent =
    `This link has a path: ${describeShared(shared)}. Opening it replaces what's in ${WORKBENCH_LABEL} in this browser now: ${describeShared(mine)}. This can't be undone.`;
  return new Promise((resolve) => {
    const finish = (replace: boolean) => {
      dialog.close();
      if (replace) {
        workbench.replaceWith(shared);
        announce(`Replaced your path with the shared one: ${describeShared(shared)}.`);
      } else announce("Kept your path. The shared one wasn't opened.");
      (document.querySelector<HTMLElement>("#plan-title") ?? document.querySelector<HTMLElement>("#main"))?.focus();
      resolve(replace);
    };
    dialog.querySelector("[data-replace-yes]")!.addEventListener("click", () => finish(true), { once: true });
    dialog.querySelector("[data-replace-no]")!.addEventListener("click", () => finish(false), { once: true });
    // Escape counts as keeping theirs
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      finish(false);
    }, { once: true });
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-replace-no]")!.focus();
  });
}
