// The header's Search buttons (in the utility row, and in the Menu on small
// screens) open the search overlay (src/components/SearchOverlay.astro).
// Closing it, with Close, Escape, or a click outside, returns focus to the
// button that opened it.

const dialog = document.getElementById("search-dialog") as HTMLDialogElement | null;
const openers = [...document.querySelectorAll<HTMLButtonElement>("[data-search-open]")];

if (dialog && openers.length) {
  const input = dialog.querySelector("input")!;
  let opener: HTMLElement | undefined;

  openers.forEach((button) =>
    button.addEventListener("click", () => {
      opener = button;
      dialog.showModal();
      // The page behind doesn't scroll while the overlay is open
      document.documentElement.classList.add("search-open");
      openers.forEach((b) => b.setAttribute("aria-expanded", "true"));
      input.focus();
    })
  );
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("search-open");
    openers.forEach((b) => b.setAttribute("aria-expanded", "false"));
    // The Menu may have closed meanwhile; fall back to the visible button
    const target = opener?.offsetParent ? opener : openers.find((b) => b.offsetParent);
    target?.focus();
  });
  dialog.querySelector("[data-search-close]")!.addEventListener("click", () => dialog.close());
  // A click on the backdrop (the dialog itself, outside its content) closes it
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.querySelector("form")!.addEventListener("submit", (e) => {
    if (!input.value.trim()) {
      e.preventDefault();
      input.focus();
    }
  });
}
