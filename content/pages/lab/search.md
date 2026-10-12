---
slug: lab/search
title: Natural-language search
description: Search the catalog the way you'd ask a person. A language model reads your search and picks the right catalog searches, and every result comes from the catalog itself.
---

## How it works

1. You type a search in your own words, like "online health master's programs that start in spring."
2. The site sends it to Gemini, Google's language model, along with descriptions of the catalog's search tools. They're the same tools the site's MCP server offers to AI assistants, so on-site search and bring-your-own-AI answers come from one source.
3. Gemini answers with the searches to run, such as programs at the master's level, online, starting in spring, about health. It doesn't write any results.
4. The site checks those searches, runs them on the catalog, and builds every result from the catalog's own records. A program, person, or link the catalog doesn't have can't appear.
5. The filters it used appear as chips. Removing one runs the same searches again without it, without asking the model.

That takes one request to the model per search. For a question like "is the writing center open right now?", the quick answer is written from the service's opening hours, not by the model.

## What's sent to the model

- Your search.
- Instructions, the search tools, and the names of the university's colleges, fields of study, and student services.
- Only if you tick **Use what I've browsed**: the department, college, level, and format you've looked at most in this tab (from the [personalization experiment](/lab/personalization/)), as a hint for unclear searches, never a filter. It's off by default, and the search page shows exactly what it would send.

Nothing else goes to the model, including your IP address. To limit searches to 10 a minute per visitor, the site keeps a count under a scrambled (hashed) version of your IP address. Its logs record how long searches take and how many results they find, never what you searched for.

## When the model isn't used

Keyword search answers instead, and the page says "Showing keyword results," when:

- no API key is set up,
- you've searched more than 10 times in a minute,
- the model takes more than 8 seconds, or returns an error (including going over the free tier's limits), or
- the model plans nothing usable, or its searches find nothing that keyword search can find.

Keyword search spots common filters (level, format, start term, budget, and "is it open" questions), ignores filler like "what do you offer," and searches everything for the words that are left, allowing for word endings ("parents" finds "parent"). If nothing matches every word, it shows what matches most of them. The search page works without JavaScript too: it shows keyword results, and the chips still work.
