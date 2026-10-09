// Home page news and events, by audience. Visitors with no application
// activity in this tab see upcoming events and news. Once someone is on the
// application track (they've viewed a program, sent a form, or clicked
// Apply), news is replaced by a full-width list of admissions events.

import { loadSession, type Session } from "./personalize.ts";

const standard = document.getElementById("home-news-events");
const admissions = document.getElementById("home-admissions-events");

const onApplicationTrack = (session: Session) => Object.keys(session.profile.journey).length > 0;

function render(session: Session) {
  const track = onApplicationTrack(session);
  standard!.hidden = track;
  admissions!.hidden = !track;
}

if (standard && admissions) {
  render(loadSession());
  window.addEventListener("personalization:change", (e) => render((e as CustomEvent<Session>).detail));
}
