---
slug: lab/personalization
title: Session-based personalization
description: The site follows your progress from exploring programs to applying, in one browser tab, without cookies, accounts, or sending anything to a server. Open the panel to watch it work.
---

## What it does

The site keeps track of where you are in the application journey that most students follow:

1. **Explore programs**: done when you view any program page.
2. **Request information**: done when you send the request-information form.
3. **Schedule a visit**: done when you send the visit form.
4. **Apply**: done when you click any Apply button or link.

**Recents**, in the header, shows the last four pages you viewed and your next step, with a button that takes you there. If you skip ahead, say by scheduling a visit first, the next step is the earliest one you haven't done.

Along the way, the site adds up a simple interest profile: which departments, colleges, program levels, and formats come up most in what you view and in the program you name on the request-information form. The program list uses it to put your most-viewed department first, only as the page loads and never while you're reading. The forms use it too: after you've filled in one, the other fills in your name and email.

Each of these has a "Why am I seeing this?" note that names the reason, such as "You've looked at 3 programs, mostly in Nursing."

## What's stored

- **Pages you view**: for each program, course, faculty, service, event, and news page, its type, name, address, and time, plus its department, college, level, and format when it has them.
- **Your form answers**: name and email from both forms; degree level, program of interest, and start term from the request-information form; and visit date, number of guests, phone number, and date of birth from the visit form, if you give them.
- **When you clicked Apply**, if you did.

There's no tracking of searches, scrolling, or anything else.

## Where it's stored

Only in your browser's **sessionStorage**, which belongs to this one tab. The page log keeps the last 50 views. Nothing is sent to Cascadia State or anyone else, the forms aren't connected to any system, no cookies are set, and there are no third-party scripts. Closing the tab erases everything, and **Reset session** in the Under the hood panel erases it immediately.

## Why this is privacy-friendly

Most personalization builds a profile on a server and follows you across visits and devices. This experiment does the opposite: the profile never leaves the tab, lasts only as long as the tab does, and everything in it, including your form answers, is visible to you in the Under the hood panel. A real site would send form answers to its admissions team, but it wouldn't need to keep a browsing profile anywhere but your own browser.

## Limits

Because nothing is stored on a server, the site forgets you when you close the tab, and your journey doesn't carry over to other tabs or devices. That's the trade-off, and for a public university website it's usually the right one.
