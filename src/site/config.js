/**
 * 站点配置（“我是谁”）——属于**实例**，不属于引擎。
 *
 * 引擎通过 `$site` 别名读取它：本仓库里指向 `src/site/`（引擎自带的 demo 实例）；
 * 以引擎包形式被别的站点使用时，指向那个站点的 `src/site/`。见 `docs/INSTANCE.md`。
 *
 * 这是你唯一需要改的「身份」文件：把它改成你自己的，整个平台就属于你了。
 * 保持纯 JavaScript（只用 JSDoc 标注类型），这样应用和 CLI 脚本都能直接 import，
 * 不需要维护两份真相。
 *
 * 分工约定：
 *   · 本文件 = 「我是谁」：站名、域名、作者、首页/分享用的品牌文案、SEO
 *   · src/lib/i18n/*.js = 其余站点文案与界面词汇（按钮、标签、区块标题…）
 *
 * 类型契约见 `$lib/content/site.ts` 的 `SiteConfig`（引擎与所有实例共用同一份形状）。
 */

/** @type {import('$lib/content/site').SiteConfig} */
export const site = {
	/** 站点名：用于 title、导航、页脚、JSON-LD */
	name: 'sprout',

	/** 站点地址，结尾不带 `/`。所有 canonical / hreflang / sitemap / OG / RSS 都由它推导 */
	url: 'https://sprout.zevarc.com',

	/** 作者名：用于文章结构化数据（SEO） */
	author: 'Your Name',

	/**
	 * 支持的语言，任意数量：非默认语言前缀由 `src/hooks.js` 的 reroute 剥离，全部共用同一套路由文件。至少一个，且必须包含 defaultLocale。
	 * 每个语言可再声明：`short`（切换控件上的短码，如 `EN`/`中`）、`intl`（BCP-47 标签，给 Intl 用）、`dateFormat`（Intl.DateTimeFormatOptions，覆盖默认的 YYYY.MM.DD）、`dir: 'rtl'`。
	 */
	locales: [
		{ code: 'en', label: 'English', short: 'EN', intl: 'en-US' },
		{ code: 'zh', label: '中文', short: '中', intl: 'zh-CN' }
	],

	/** 社交分享卡（1200×630 PNG）。Facebook / X / LinkedIn / 微信都不吃 SVG，必须是位图。 */
	ogImage: '/og-image.png',

	/** 品牌图形：结构化数据的 image/logo，也用作 apple-touch-icon（512×512 PNG） */
	logo: '/logo.png',

	/** 结构化数据里的 knowsAbout */
	topics: ['Web', 'Content platform'],


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
	}
};

export default site;
