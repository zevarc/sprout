---
title: "你好，sprout"
description: "一篇示例文章，展示 frontmatter、标题、链接与代码块。"
date: "2026-01-01"
updated: "2026-01-01"
tags: ["指南", "欢迎"]
draft: false
---

## 这是什么

这是一篇**示例文章**，用来让你在写自己的内容之前先看到渲染效果。
你可以把它替换掉（或删掉），文件在 `src/content/posts/`。

## Frontmatter

上面的字段就是导入脚本会读取的内容：

- `title`、`description` —— 列表、RSS 与分享卡片会用
- `date`、`updated` —— 用于排序与 `<lastmod>`
- `tags` —— 用于"相关文章"
- `draft: true` —— 草稿不会出现在任何公开列表里

## 代码块

代码高亮在浏览器里完成，服务端不跑重型高亮器：

```ts
export function greet(name: string): string {
  return `你好，${name}`;
}
```

## 标题会自动成为目录

任何 `##`/`###`/`####` 标题都会被收集到本页侧边目录。

### 图片与链接

普通 Markdown 都能用：[一个链接](https://svelte.dev)、行内代码、列表、引用。

> 你写的所有内容都以 Markdown 存在数据库里，`pnpm content:export` 会再导出成 Markdown。
