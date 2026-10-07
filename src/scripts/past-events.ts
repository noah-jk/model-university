// Pages are built ahead of time, so the browser decides which events have
// already happened. Any element with data-ends="<ISO date>" gets
// data-when="past" or "upcoming".
//
// - Lists marked data-upcoming-only hide past items, show at most
//   data-limit of the rest, and reveal their [data-none-upcoming] message if
//   nothing is left.
// - [data-past-notice] elements appear once their event has ended.
// - Filter forms (see filter-list.ts) re-run so a "When" filter applies.

const now = new Date();
document.querySelectorAll<HTMLElement>("[data-ends]").forEach((el) => {
  el.dataset.when = new Date(el.dataset.ends!) < now ? "past" : "upcoming";
});

document.querySelectorAll<HTMLElement>("[data-upcoming-only]").forEach((list) => {
  const limit = Number(list.dataset.limit ?? Infinity);
  let shown = 0;
  for (const item of list.querySelectorAll<HTMLElement>(":scope > li")) {
    item.hidden = item.dataset.when === "past" || shown >= limit;
    if (!item.hidden) shown++;
  }
  const none = list.parentElement?.querySelector<HTMLElement>("[data-none-upcoming]");
  if (none) none.hidden = shown > 0;
  list.hidden = shown === 0;
});

document.querySelectorAll<HTMLElement>("[data-past-notice]").forEach((el) => {
  el.hidden = el.dataset.when !== "past";
});

document.querySelectorAll("[data-filter-form]").forEach((form) => form.dispatchEvent(new Event("input")));
