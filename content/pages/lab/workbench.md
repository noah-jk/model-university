---
slug: lab/workbench
title: Workbench
description: A place to keep the programs, courses, people, events, and services you're weighing, with your own notes, a side-by-side comparison, and your deadlines in order.
---

## The idea

Choosing a school takes weeks, and it happens across devices and with family and counselors. The workbench is where a prospective student keeps what they've chosen to come back to. It's the opposite of **For me**: For me is what the site noticed in this tab; the workbench is what you chose to keep.

From what you save, the site works out two views:

- **Compare** puts up to four saved programs side by side: credential, format, campus, start terms, length, cost per credit, estimated total tuition, and the application deadline for the start term you pick. Costs are never added up, because the programs are alternatives.
- **Timeline** lists the application deadlines for your start term and the dates of saved events, in order, with the next one marked and a calendar file for each.

## Always up to date

The workbench stores which items you saved, not copies of them, so it always shows the catalog's latest details. When a program's tuition, deadlines, or start terms change after you save it (or an event's date or location), the item says so until you mark it as seen. If something is removed from the catalog, it shows as no longer available.

## Where your data lives

Everything is in this browser's localStorage, under one key. Nothing is sent to the site or anyone else, and it stays until you remove it or clear your browser's data. That's different from the personalization experiment, which keeps its profile in sessionStorage and forgets it when the tab closes. Saved items do feed that profile, as a stronger signal than a page view.

If your browser blocks localStorage (some private modes do), the workbench still works for the page you're on and tells you it won't be kept.

## Coming next

- **Phase 2:** start a workbench from a question in plain language. The AI suggests items to save, and short answers with their sources.
- **Phase 3:** share a link to your workbench, send it to admissions instead of filling in the request-information form, and copy it for your own AI assistant.
