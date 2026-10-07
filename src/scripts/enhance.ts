// Progressive enhancement, loaded on every page. Everything works as plain
// links without it; with it, menus collapse and copy buttons work.

document.documentElement.classList.add("js");

// Links and text are built with the production address. Rewrite them to
// wherever the site is actually running (localhost, deploy previews).
const origin = window.location.origin;
export const fill = (s: string) => s.replaceAll("{origin}", origin).replaceAll("%7Borigin%7D", encodeURIComponent(origin));
document.querySelectorAll<HTMLAnchorElement>("[data-href]").forEach((a) => (a.href = fill(a.dataset.href!)));
document.querySelectorAll<HTMLElement>("[data-origin-text]").forEach((el) => (el.textContent = fill(el.dataset.originText!)));

// Screen reader announcements through the live region in BaseLayout
const announcer = document.getElementById("announcer")!;
export function announce(message: string) {
  announcer.textContent = "";
  setTimeout(() => (announcer.textContent = message), 50);
}

// "Ask AI" disclosure menus: a button that shows and hides a list
document.querySelectorAll<HTMLElement>(".ai-menu").forEach((menu) => {
  const button = menu.querySelector<HTMLButtonElement>(".ai-menu-toggle")!;
  const list = menu.querySelector<HTMLElement>(".ai-menu-list")!;
  button.hidden = false;
  list.hidden = true;
  const close = (returnFocus: boolean) => {
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) button.focus();
  };
  button.addEventListener("click", () => {
    const opening = list.hidden;
    list.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
  });
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !list.hidden) close(true);
  });
  menu.addEventListener("focusout", (e) => {
    if (!menu.contains(e.relatedTarget as Node)) close(false);
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target as Node)) close(false);
  });
});

// Copy buttons: data-copy="text to copy"
document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
  button.hidden = false;
  button.addEventListener("click", async () => {
    try {
      const { copy, copied } = button.dataset;
      await navigator.clipboard.writeText(fill(copy!));
      announce(copied || "Copied to clipboard.");
    } catch {
      announce("Copy didn't work in this browser. Select the text and copy it manually.");
    }
  });
});
