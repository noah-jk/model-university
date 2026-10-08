---
slug: lab/personalization
title: Session-based personalization
description: The site adapts to what you look at in one browser tab, without cookies, accounts, or sending anything to a server. Open the panel to watch it work.
---

## What it does

As you browse program, course, faculty, service, event, and news pages, the site keeps a short log of what you viewed and adds up a simple interest profile: which departments, colleges, program levels, and formats come up most. It uses that profile in three places:

- **Recently viewed** on the home page and section overviews shows the last four pages you opened.
- **Recommended for you** suggests three programs that match your most-viewed department, level, and format, leaving out programs you've already seen. It appears after three page views.
- **The program list** puts programs from your most-viewed department first. It only reorders when the page loads, never while you're reading.

Each of these has a "Why am I seeing this?" note that names the signal behind it, such as "4 of your 6 views were Nursing pages."

## What's tracked

For each detail page you open: its type, name, and address, plus its department, college, level, and format when it has them, and the time. Nothing else: no searches, no clicks, no scrolling, and nothing about you.

## Where it's stored

Only in your browser's **sessionStorage**, which belongs to this one tab. The log keeps the last 50 page views. Nothing is sent to Cascadia State or anyone else, no cookies are set, and there are no third-party scripts. Closing the tab erases everything, and **Reset session** in the panel erases it immediately.

## Why this is privacy-friendly

Most personalization builds a profile on a server and follows you across visits and devices. This experiment does the opposite: the profile never leaves the tab, lasts only as long as the tab does, and is fully visible to you in the Under the hood panel. A university could offer helpful shortcuts like these without collecting any personal data at all.

## Limits

Because nothing is stored on a server, the site forgets you when you close the tab, and personalization doesn't carry over to other tabs or devices. That's the trade-off, and for a public university website it's usually the right one.
