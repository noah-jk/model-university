// Home page by audience: the hero headline, and news and events.
//
// The headline follows the college a visitor has looked at most in this tab
// (see COLLEGE_HEADLINES). With no college activity it stays as written.
//
// News and events: visitors with no application activity in this tab see
// upcoming events and news. Once someone is on the
// application track (they've viewed a program, sent a form, or clicked
// Apply), news is replaced by a full-width list of admissions events.

import { COLLEGE_HEADLINES } from "../lib/personalization-settings.ts";
import { loadSession, top, type Session } from "./personalize.ts";

const standard = document.getElementById("home-news-events");
const admissions = document.getElementById("home-admissions-events");

const headline = document.getElementById("hero-title");
const defaultHeadline = headline?.textContent ?? "";

const onApplicationTrack = (session: Session) => Object.keys(session.profile.journey).length > 0;

function renderHeadline(session: Session) {
  const college = top(session.profile.college)?.[0];
  headline!.textContent = (college && COLLEGE_HEADLINES[college]) || defaultHeadline;
}

function render(session: Session) {
  if (headline) renderHeadline(session);
  if (!standard || !admissions) return;
  const track = onApplicationTrack(session);
  standard.hidden = track;
  admissions.hidden = !track;
}

render(loadSession());
window.addEventListener("personalization:change", (e) => render((e as CustomEvent<Session>).detail));
