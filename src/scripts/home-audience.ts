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
// Either way, items about the person's top-interest department come first
// (a form answer beats page views; see preferred in personalize.ts).
//
// Everything personalized here is marked for the Under the hood panel.

// past-events.ts marks events as past or upcoming; it has to run first
import "./past-events.ts";
import { COLLEGE_HEADLINES } from "../lib/personalization-settings.ts";
import { interestReason, loadSession, markPersonalized, preferred, type Session } from "./personalize.ts";

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
  const college = preferred(session.profile, "college");
  const personal = college && COLLEGE_HEADLINES[college];
  headline!.textContent = personal || defaultHeadline;
  renderHero(college);
  const reason = interestReason(session, "college");
  markPersonalized(headline, personal ? `Hero headline: “${personal}”, ${reason}.` : undefined);
  markPersonalized(
    headline!.closest(".hero"),
    college && heroImages[college] ? `Hero photo: a ${college} photo, ${reason}.` : undefined
  );
}

// Show `limit` items from a list, preferring ones about `department`, and
// keep them in their original (date) order. Past events never count.
// Returns how many of the shown items are about the department.
function pickForDepartment(list: HTMLElement | null, department: string | undefined, limit: number) {
  if (!list) return 0;
  const items = [...list.querySelectorAll<HTMLElement>(":scope > li")].filter((li) => li.dataset.when !== "past");
  const about = (li: HTMLElement) => Boolean(department) && (li.dataset.departments ?? "").split("|").includes(department!);
  const chosen = new Set([...items.filter(about), ...items.filter((li) => !about(li))].slice(0, limit));
  list.querySelectorAll<HTMLElement>(":scope > li").forEach((li) => (li.hidden = !chosen.has(li)));
  return [...chosen].filter(about).length;
}

function renderSelection(session: Session, track: boolean) {
  const department = preferred(session.profile, "department");
  const reason = interestReason(session, "department");
  const lists = track
    ? [{ list: admissions!.querySelector<HTMLElement>(".event-list"), label: "Admissions events", noun: "event" }]
    : [
        { list: standard!.querySelector<HTMLElement>(".event-list"), label: "Upcoming events", noun: "event" },
        { list: standard!.querySelector<HTMLElement>(".news-list"), label: "News", noun: "story" },
      ];
  for (const { list, label, noun } of lists) {
    const matched = pickForDepartment(list, department, 3);
    const nouns = matched === 1 ? noun : noun === "story" ? "stories" : `${noun}s`;
    markPersonalized(list, matched ? `${label}: ${matched} ${department} ${nouns} picked first, ${reason}.` : undefined);
  }
}

function render(session: Session) {
  if (headline) renderHeadline(session);
  if (!standard || !admissions) return;
  const track = onApplicationTrack(session);
  standard.hidden = track;
  admissions.hidden = !track;
  markPersonalized(admissions, track ? "News and events: admissions events instead of news, because you've started the application journey." : undefined);
  renderSelection(session, track);
}

render(loadSession());
window.addEventListener("personalization:change", (e) => render((e as CustomEvent<Session>).detail));
