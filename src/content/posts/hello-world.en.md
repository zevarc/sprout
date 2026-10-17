---
title: "Hello, sprout"
description: "A sample post that shows frontmatter, headings, links and code blocks."
date: "2026-01-01"
updated: "2026-01-01"
tags: ["Guide", "Welcome"]
draft: false
---

## What this is

This is a **sample post**. It exists so you can see how content renders before you
write your own. Replace it (or delete it) in `src/content/posts/`.

## Frontmatter

The fields above are what the importer reads:

- `title`, `description` — shown in lists, feeds and social cards
- `date`, `updated` — used for ordering and `<lastmod>`
- `tags` — used for related posts
- `draft: true` — keeps a post out of every public list

## Code blocks

Code is highlighted in the browser, so the server never runs a heavy highlighter:

```ts
export function greet(name: string): string {
  return `Hello, ${name}`;
}
```

## Headings become the table of contents

Any `##`/`###`/`####` heading is collected into the sidebar TOC on this page.

### Images and links

Normal Markdown works: [a link](https://svelte.dev), `inline code`, lists, quotes.

> Everything you write is stored as Markdown in the database — and exported back
> out as Markdown by `pnpm content:export`.
