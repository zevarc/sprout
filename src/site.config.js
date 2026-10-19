/**
 * sprout — 站点配置
 *
 * 这是你唯一需要改的「身份」文件：把它改成你自己的，整个平台就属于你了。
 * 保持纯 JavaScript（只用 JSDoc 标注类型），这样应用和 CLI 脚本都能直接 import，
 * 不需要维护两份真相。
 *
 * 分工约定：
 *   · 本文件 = 「我是谁」：站名、域名、作者、首页/分享用的品牌文案、SEO
 *   · src/lib/i18n/*.js = 其余站点文案与界面词汇（按钮、标签、区块标题…）
 *
 * @typedef {{ code: string, label: string }} Locale
 * @typedef {{
 *   claim: string,
 *   claimSource: string,
 *   creed: string[],
 *   ogTagline: string,
 *   seoTitle: string,
 *   seoDescription: string,
 *   feedDescription: string
 * }} Brand
 * @typedef {{
 *   name: string,
 *   url: string,
 *   author: string,
 *   locales: Locale[],
 *   defaultLocale: string,
 *   contact: { email: string, github: string },
 *   brand: Record<string, Brand>,
 *   features: { moments: boolean, comments: boolean, analytics: boolean, projects: boolean }
 * }} SiteConfig
 */

/** @type {SiteConfig} */
export const site = {
	/** 站点名：用于 title、导航、页脚、JSON-LD */
	name: 'sprout',

	/** 站点地址，结尾不带 `/`。所有 canonical / hreflang / sitemap / OG / RSS 都由它推导 */
	url: 'https://example.com',

	/** 作者名：用于文章结构化数据（SEO） */
	author: 'Your Name',

	/** 支持的语言。当前实现支持 en/zh 两种，加语言需要新增一套路由（见 README「Known limitations」） */
	locales: [
		{ code: 'en', label: 'English' },
		{ code: 'zh', label: '中文' }
	],

	defaultLocale: 'en',

	/** 联系方式：显示在 About 页与页脚 */
	contact: {
		email: 'hello@example.com',
		github: 'https://github.com/yourname'
	},

	/** 首页与分享卡片上的品牌文案（按语言） */
	brand: {
		en: {
			claim: 'Start small, grow in public.',
			claimSource: '',
			creed: ['Write', 'Keep', 'Export'],
			ogTagline: 'Write · Keep · Export',
			seoTitle: 'sprout — a personal content platform',
			seoDescription:
				'A data-portable personal site: posts, notes, moments and comments, running on Cloudflare Workers and SQLite.',
			feedDescription: 'Posts, notes and moments from a personal site built with sprout.'
		},
		zh: {
			claim: '从一点开始，公开地生长。',
			claimSource: '',
			creed: ['写', '存', '带走'],
			ogTagline: '写 · 存 · 带走',
			seoTitle: 'sprout — 可迁移的个人内容平台',
			seoDescription:
				'一个数据可迁移的个人站点：文章、笔记、动态与评论，运行在 Cloudflare Workers 与 SQLite 上。',
			feedDescription: '来自 sprout 个人站点的文章、笔记与动态。'
		}
	},

	/** 功能开关：关掉后对应路由与入口会隐藏 */
	features: {
		moments: true,
		comments: true,
		analytics: true,
		projects: true
	}
};

export default site;
