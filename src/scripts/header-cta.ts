// The header button for the next step (src/components/Header.astro): the
// application journey (Explore programs, Request information, Schedule a
// visit, Apply, then Tuition and aid), or Your Path's next step once it has a
// plan. The page ships with the first step; this updates it.

export {};

const buttons = document.querySelectorAll<HTMLAnchorElement>("[data-header-cta]");

if (buttons.length) {
  // Loaded only when the button is there, because personalize.ts records page views
  const [{ loadSession, markPersonalized }, { nextAction }] = await Promise.all([import("./personalize.ts"), import("./next-step.ts")]);
  type Session = ReturnType<typeof loadSession>;

  // The journey's next step, or Your Path's once it has a plan (see next-step.ts)
  const render = (session: Session) => {
    const action = nextAction(session);
    buttons.forEach((button) => {
      button.href = action.href;
      button.textContent = action.short;
      button.toggleAttribute("data-journey-apply", action.isApply);
      markPersonalized(button, action.reason && `Header button: “${action.short}”, because ${action.reason}.`);
    });
  };
  render(loadSession());
  // Wait until the current click is over: clicking Apply changes the next step,
  // and swapping the link right away would change where the click goes.
  window.addEventListener("personalization:change", (e) => setTimeout(() => render((e as CustomEvent<Session>).detail)));
}
