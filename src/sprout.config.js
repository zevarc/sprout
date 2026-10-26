/**
 * sprout — 站点装配（assembly）
 *
 * 分工：
 *   · `site.config.js` = 「我是谁」：站名、域名、作者、语言、品牌文案。
 *   · 本文件         = 「我由什么构成」：内容类型、能力开关、首页区块、主题、扩展模块。
 *
 * 三条规则（见 docs/ARCHITECTURE.md）：
 *   1. 类型即能力——这里声明一个 type，它就拥有通用列表/详情路由。
 *   2. 跨领域能力（comments/members/analytics/timeline）写进 `features`，全仓只经 `hasFeature` 判定。
 *   3. 配置在启动期校验（单段路由、语言不撞类型段、能力 id 已注册…）。
 */

/**
 * 内容类型注册表——站点声明「我有哪些类型」。引擎据此组装路由与展现。
 *
 * @typedef {{ en?: string, zh?: string }} Label
 * @typedef {{ value: string, label: Label }} FieldOption
 * @typedef {{
 *   key: string,
 *   label: Label,
 *   type: 'text'|'textarea'|'markdown'|'tags'|'url'|'number'|'date'|'boolean'|'select',
 *   required?: boolean,
 *   options?: FieldOption[]
 * }} FieldDef
 * @typedef {{
 *   type: string,
 *   route: string,
 *   label: Label,
 *   public?: boolean,
 *   feed?: boolean,
 *   comments?: boolean,
 *   listRenderer?: 'list' | 'cards' | 'feed',
 *   detailRenderer?: 'article' | 'compact',
 *   fields: FieldDef[]
 * }} ContentTypeDef
 */

/** @type {Record<string, ContentTypeDef>} */
export const contentTypes = {
	post: {
		type: 'post',
		route: '/posts',
		label: { en: 'Posts', zh: '文章' },
		public: true,
		feed: true,
		comments: true,
		// 摘要用 assets.summary；标签与封面是关联表（不是字段），所以文章本身没有类型专属字段。
		fields: []
	},
	// 单段路由：通用 `[type]` 列表页与详情页直接可用，sitemap 也会自动收录。
	note: {
		type: 'note',
		route: '/notes',
		label: { en: 'Notes', zh: '笔记' },
		public: true,
		feed: true,
		comments: true,
		fields: []
	},
	moment: {
		type: 'moment',
		route: '/moments',
		label: { en: 'Moments', zh: '动态' },
		public: true,
		feed: true,
		comments: true,
		listRenderer: 'feed',
		detailRenderer: 'compact',
		fields: []
	},
	project: {
		type: 'project',
		route: '/projects',
		label: { en: 'Projects', zh: '项目' },
		public: true,
		feed: false,
		comments: false,
		fields: [
			{ key: 'year', label: { en: 'Year', zh: '年份' }, type: 'text' },
			{
				key: 'stage',
				label: { en: 'Stage', zh: '阶段' },
				type: 'select',
				options: [
					{ value: 'active', label: { en: 'Active', zh: '活跃' } },
					{ value: 'maintained', label: { en: 'Maintained', zh: '维护中' } },
					{ value: 'archived', label: { en: 'Archived', zh: '已归档' } }
				]
			},
			{ key: 'website', label: { en: 'Website', zh: '网站' }, type: 'url' },
			{ key: 'repo_url', label: { en: 'Repository', zh: '仓库' }, type: 'url' },
			{ key: 'order_index', label: { en: 'Order', zh: '排序' }, type: 'number' }
		]
	}
};

/**
 * 跨领域能力清单。类型不走这里（类型即能力）。
 * 已注册的 id：comments · members · analytics · timeline。
 * @type {string[]}
 */
export const features = ['comments', 'analytics', 'timeline', 'members'];

/**
 * 首页区块。每块挑一组类型，用某个布局呈现。
 * `morePath` 指向该区块的列表页（由类型路由承载）。
 * @type {{ sections: Array<{
 *   types: string[],
 *   layout: 'list' | 'cards',
 *   title: string,
 *   more: string,
 *   morePath: string,
 *   limit: number,
 *   fields?: string[],
 *   sort?: { field: string, numeric?: boolean, direction?: 'asc' | 'desc' }
 * }> }}
 */
export const home = {
	sections: [
		{
			types: ['post', 'note'],
			layout: 'list',
			title: 'home.selectedWriting',
			more: 'home.allWriting',
			morePath: 'posts',
			limit: 5
		},
		{
			types: ['project'],
			layout: 'cards',
			title: 'home.selectedProjects',
			more: 'home.allProjects',
			morePath: 'projects',
			limit: 4,
			fields: ['year', 'stage', 'website', 'repo_url'],
			sort: { field: 'order_index', numeric: true, direction: 'asc' }
		}
	]
};

/**
 * 主题：`name` 选预设（`classic` | `mono` | `warm`），`tokens` 覆盖任意 CSS 变量。
 * 组件只读 token（`var(--color-*)`），换风格不需要 fork 组件。
 * @type {{ name: string, tokens: Record<string, string> }}
 */
export const theme = {
	name: 'classic',
	tokens: {}
};

/**
 * 扩展模块（贡献）。每个模块可贡献 contentTypes / features / home.sections / theme.tokens / i18n；
 * 不能注入路由（路由来自类型声明）。形状见 `src/lib/content/schema.ts` 的 `Mod`，
 * 合并逻辑见 `src/lib/engine/assembly.ts`，启动期由 `validate` 校验。
 * @type {import('./lib/content/schema').Mod[]}
 */
export const mods = [];

/**
 * 需要登录（owner/member）的非类型路径。内容类型自身的路由由 registry 的 `public` 决定。
 * @type {string[]}
 */
export const privateRoutes = [];

/**
 * 接受评论的静态页面（`path` + 各语言的锚点标题）。页面不是内容：不进列表、搜索、
 * feed、sitemap；数据库里只多一条锚点资产，评论依旧挂在 `assets.id` 上。
 * 锚点在第一条评论出现时才创建，id 由路由与语言决定（`page:about:zh`）。
 * @type {import('./lib/content/pages').CommentablePage[]}
 */
export const commentablePages = [{ path: '/about', title: { en: 'About', zh: '关于' } }];

/** 内容默认值。 @type {{ defaultVisibility: 'public' | 'private', timelineOrder: 'published' | 'occurred' }} */
export const content = {
	/** 新记录的默认可见性：'private' 表示默认只给登录成员看 */
	defaultVisibility: 'public',
	/** 时间线按「发生时间」而非「发布时间」排序 */
	timelineOrder: 'published'
};

export default {
	contentTypes,
	features,
	home,
	theme,
	mods,
	privateRoutes,
	content,
	commentablePages
};
