// Home page by audience: the hero headline and photo, and news and events.
//
// The headline follows the college a visitor has looked at most in this tab
// (see COLLEGE_HEADLINES). With no college activity it stays as written.
//
// The hero photo changes with it. Only the default photo is in the page; the
// one for the visitor's college is fetched when it's needed (the list of
// photos is the #hero-images JSON) and fades in over the default.
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

type HeroImage = { alt: string; avif: string; webp: string; jpeg: string };
const heroImages: Record<string, HeroImage> = JSON.parse(document.getElementById("hero-images")?.textContent ?? "{}");
const heroPicture = document.getElementById("hero-picture");
const defaultPicture = heroPicture?.cloneNode(true) as HTMLElement | undefined;
let shown: HTMLElement | null = heroPicture; // what's on screen now
let pending: HTMLElement | null = null; // loading, not yet visible
let shownCollege: string | undefined;

// A <picture> for one college's photo (or a copy of the default) that's invisible until it loads
function incomingPicture(photo?: HeroImage) {
  if (!photo) {
    const copy = defaultPicture!.cloneNode(true) as HTMLElement;
    copy.removeAttribute("id");
    return copy;
  }
  const picture = document.createElement("picture");
  for (const [type, srcset] of [["image/avif", photo.avif], ["image/webp", photo.webp]]) {
    const source = document.createElement("source");
    source.type = type;
    source.srcset = srcset;
    source.sizes = "100vw";
    picture.append(source);
  }
  const img = document.createElement("img");
  img.srcset = photo.jpeg;
  img.sizes = "100vw";
  img.src = photo.jpeg.split(" ")[0];
  img.alt = photo.alt;
  img.loading = "eager";
  img.decoding = "async";
  picture.append(img);
  return picture;
}

function renderHero(college?: string) {
  const key = college && heroImages[college] ? college : undefined;
  if (!shown || key === shownCollege) return;
  shownCollege = key;
  pending?.remove();
  const picture = incomingPicture(key ? heroImages[key] : undefined);
  picture.classList.add("incoming");
  const img = picture.querySelector("img")!;
  img.removeAttribute("fetchpriority");
  pending = picture;
  shown.after(picture);
  const reveal = () => {
    if (pending !== picture) return;
    pending = null;
    const old = shown;
    shown = picture;
    picture.classList.add("in");
    // Once it's fully in, the old photo is no longer needed
    setTimeout(() => old?.remove(), 800);
  };
  if (img.complete && img.naturalWidth) reveal();
  else img.addEventListener("load", reveal, { once: true });
}

const onApplicationTrack = (session: Session) => Object.keys(session.profile.journey).length > 0;

function renderHeadline(session: Session) {
  const college = top(session.profile.college)?.[0];
  headline!.textContent = (college && COLLEGE_HEADLINES[college]) || defaultHeadline;
  renderHero(college);
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
