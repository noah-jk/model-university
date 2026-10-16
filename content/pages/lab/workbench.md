---
slug: lab/workbench
title: Your Path
description: Answer two questions and get your plan for Cascadia State, with every step, deadline, and office for your start term, next to the programs, courses, people, and events you've saved.
---

## The idea

Applying to college is a list of steps that depends on who you are. A transfer student sends transcripts and gets a credit evaluation, an international student needs an I-20, and a graduate student applies through the Graduate School. Most university sites make you work that out from a dozen pages. Your Path works it out for you, and keeps what you've chosen to come back to beside it.

## Profile, rules, plan

Your Path is built in three layers, and only the first is about you.

1. **Profile:** your student type, level, and start term. You choose them in the sentence at the top of the page. Until you do, the site may suggest a value, but only from a strong signal: an answer you gave in the request-info form, a program or office you saved, or two or more visits to pages for one kind of student. Each suggestion is marked "Suggested" and says why. With no strong signal, the field stays blank. If your saved programs are both undergraduate and graduate, it asks instead of guessing.
2. **Rules:** the university's enrollment steps, academic calendar, and offices, kept as content in `content/enrollment/`. Each step and date says which students it applies to. The same rules build the admissions pages, so Your Path and those pages always agree.
3. **Plan:** worked out fresh on every visit from your profile and the rules. It lists your steps in order, with due dates for your start term, the offices that can help, and events meant for students like you. A step that depends on your program's application deadline uses the earliest deadline among the programs you've saved. Change your start term and every date changes with it.

Nothing in the plan is stored. What's stored is what you chose: your answers, the steps you've checked off, the items you dismissed, and what you saved. Checked-off steps stay done when you change your start term.

## Saved items

You can still save programs, courses, people, events, and services as you browse. Saved items store which item you saved, not a copy, so they always show the catalog's latest details, and say so when a program's tuition or deadlines change after you save it.

- **Compare** puts up to four saved programs side by side. Costs are never added up, because the programs are alternatives.
- **Timeline** lists every date in your plan in order: your steps, the academic calendar, your saved programs' deadlines, and saved events. Each date appears once, with where it comes from, and you can add any of them to your calendar.

## One next step

When the site knows enough for a plan, the header button and the next-step box on other pages show your plan's next step, so the site never suggests two different things. Steps in the application journey (request information, visit, apply) are checked off when you send those forms.

## Help where you need it

A few pages point to Your Path at the moment it's useful: the homepage, the admissions page (choose your student type and level, and Your Path opens filled in), tuition and aid (your next aid deadline), each program page (what saving it adds to your plan), and the pages for transfer, international, and graduate students. They're short, never pop up, and each has a "Hide this tip" button. Hidden tips stay hidden.

## Where your data lives

Everything is in this browser's localStorage, under one key. Nothing is sent to the site or anyone else, and it stays until you remove it or clear your browser's data. Suggestions come from the personalization experiment's record of this tab, which is in sessionStorage and is forgotten when the tab closes; only your own choices are kept. If you send the visit form, its date is kept too, so your visit shows on your timeline; you can remove it there.

If your browser blocks localStorage (some private modes do), Your Path still works for the page you're on and tells you it won't be kept.

## Coming next

- Hand your plan to an advisor or admissions, or copy it for your own AI assistant.
- Ask the university's MCP server for the plan for any kind of student.
