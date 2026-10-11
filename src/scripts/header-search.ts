// The header's Search button opens a search field in its place; Close or
// Escape puts the button back and returns focus to it.

const toggle = document.querySelector<HTMLButtonElement>("[data-search-toggle]");
const form = document.getElementById("header-search-form") as HTMLFormElement | null;

if (toggle && form) {
  const input = form.querySelector("input")!;
  const setOpen = (open: boolean) => {
    toggle.hidden = open;
    form.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) input.focus();
    else toggle.focus();
  };
  toggle.addEventListener("click", () => setOpen(true));
  form.querySelector("[data-search-close]")!.addEventListener("click", () => setOpen(false));
  form.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
  form.addEventListener("submit", (e) => {
    if (!input.value.trim()) {
      e.preventDefault();
      input.focus();
    }
  });
}
