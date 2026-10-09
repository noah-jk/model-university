// The "Your next step" tile on the home page: filled in from this tab's
// session, and refreshed when the session changes.

import { loadSession, type Session } from "./personalize.ts";
import { renderNext } from "./next-step.ts";

const section = document.getElementById("home-next-step");
if (section) {
  renderNext(section, loadSession(), "Next-step tile on the home page");
  // Wait until the current click is over, so a clicked tile's link isn't swapped before the browser follows it.
  window.addEventListener("personalization:change", (e) => setTimeout(() => renderNext(section, (e as CustomEvent<Session>).detail, "Next-step tile on the home page")));
}
