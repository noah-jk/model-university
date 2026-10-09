// The header button for the next step in the application journey
// (src/components/Header.astro): Explore programs, Request information,
// Schedule a visit, Apply, then Tuition and aid. The page ships with the
// first step; this updates it from this tab's session.

export {};

const buttons = document.querySelectorAll<HTMLAnchorElement>("[data-header-cta]");

if (buttons.length) {
  // Loaded only when the button is there, because personalize.ts records page views
  const [{ loadSession, markPersonalized }, { nextAction, nextStepReason }] = await Promise.all([import("./personalize.ts"), import("./next-step.ts")]);
  type Session = ReturnType<typeof loadSession>;

  const render = (session: Session) => {
    const { next, href, isApply } = nextAction(session);
    buttons.forEach((button) => {
      button.href = href;
      button.textContent = next ? next.label : "Tuition and aid";
      button.toggleAttribute("data-journey-apply", isApply);
      const reason = nextStepReason(session);
      markPersonalized(button, reason && `Header button: “${button.textContent}”, because ${reason}.`);
    });
  };
  render(loadSession());
  // Wait until the current click is over: clicking Apply changes the next step,
  // and swapping the link right away would change where the click goes.
  window.addEventListener("personalization:change", (e) => setTimeout(() => render((e as CustomEvent<Session>).detail)));
}
