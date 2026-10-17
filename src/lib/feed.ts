import type { PostView } from '$lib/content/view';
import { site } from '$lib/site';

const SITE_URL = site.url;
const MAX_ITEMS = 20;

function rfc822(date: string): string {
  return new Date(date).toUTCString();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Generates an RSS 2.0 feed for the given language from pre-loaded views. */
export function generateRss(lang: 'en' | 'zh', views: PostView[]): string {
  const feedUrl = lang === 'zh' ? `${SITE_URL}/zh/feed.xml` : `${SITE_URL}/feed.xml`;
  const brand = site.brand[lang] ?? site.brand[site.defaultLocale];
  const title = lang === 'zh' ? `${site.name} - 博客` : `${site.name} - Blog`;
  const description = brand.feedDescription;
  const language = lang === 'zh' ? 'zh-cn' : 'en';

  const posts: PostView[] = views
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, MAX_ITEMS);

  const items = posts
    .map((p) => {
      const link = `${SITE_URL}/${p.url}`;
      return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${escapeXml(p.excerpt ?? p.description)}</description>
    </item>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(title)}</title>
  <link>${SITE_URL}/${lang === 'zh' ? 'zh' : ''}</link>
  <description>${escapeXml(description)}</description>
  <language>${language}</language>
  <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>`;
}
