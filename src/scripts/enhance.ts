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

// "Ask AI" disclosure menus: a button that opens and closes a list.
// The .open class shows the list (see AskAiMenu.astro).
document.querySelectorAll<HTMLElement>(".ai-menu").forEach((menu) => {
  const button = menu.querySelector<HTMLButtonElement>(".ai-menu-toggle")!;
  const isOpen = () => menu.classList.contains("open");
  const setOpen = (open: boolean) => {
    menu.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
  };
  button.addEventListener("click", () => setOpen(!isOpen()));
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      setOpen(false);
      button.focus();
    }
  });
  menu.addEventListener("focusout", (e) => {
    if (!menu.contains(e.relatedTarget as Node)) setOpen(false);
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target as Node)) setOpen(false);
  });
});

// Copy buttons: data-copy="text to copy"
document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
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
