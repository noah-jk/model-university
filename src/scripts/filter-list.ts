// Filters a list in place as people type or pick options. Used by the
// program finder and the course subject list.
//
// Markup: a <form data-filter-form="LIST_ID" data-noun="program"> and a list
// with id LIST_ID whose items carry data-search="lowercase words" plus one
// data-* attribute per <select> name (comma-separated when an item has several values).
// A <p id="LIST_ID-count"> shows the number of matches.

document.querySelectorAll<HTMLFormElement>("[data-filter-form]").forEach((form) => {
  const listId = form.dataset.filterForm!;
  const items = [...document.querySelectorAll<HTMLElement>(`#${listId} > li`)];
  const count = document.getElementById(`${listId}-count`)!;
  const noun = form.dataset.noun!;

  const apply = () => {
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const words = (values.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const item of items) {
      const matches =
        words.every((w) => item.dataset.search!.includes(w)) &&
        Object.entries(values).every(([name, value]) => name === "q" || !value || item.dataset[name]!.split(",").includes(value));
      item.hidden = !matches;
      if (matches) shown++;
    }
    count.textContent = `${shown} ${shown === 1 ? noun : `${noun}s`}`;
  };

  let timer: ReturnType<typeof setTimeout>;
  form.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 150);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    apply();
  });
});
