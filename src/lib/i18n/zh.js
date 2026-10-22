// 中文字典 —— 站点文案与界面词汇。
// 品牌身份（站名、首页文案、SEO）在 src/site.config.js 里。
export const zh = {
  language: 'English',
  common: {
    empty: '还没有内容。',
  },
  feed: {
    // 频道标题后缀 + 该语言的 RSS <language> 标签。
    label: '博客',
    language: 'zh-cn',
  },
  nav: {
    home: '首页',
    posts: '博客',
    notes: '笔记',
    projects: '项目',
    moments: '动态',
    about: '关于',
    tags: '标签',
    timeline: '时间线',
  },
  home: {
    selectedWriting: '最新文章',
    allWriting: '全部文章 →',
    selectedProjects: '精选项目',
    allProjects: '全部项目 →',
  },
  posts: {
    station: '第一站',
    title: '知识的港湾',
    subtitle: '想法在这里停靠，思维在这里沉淀',
    blogTitle: '博客',
    blogSubtitle: '一个话题从本质，到拆解，直至解决的完整记录',
    noteTitle: '笔记',
    noteSubtitle: '所见，所思，所想的片段',
    readMore: '阅读全文 →',
    readTime: '分钟阅读',
    toc: '目录',
    related: '相关文章',
    latest: '最新文章',
    next: '前往码头',
  },
  search: {
    title: '搜索',
    placeholder: '搜索这个类别…',
    category: '类别',
    empty: '没有找到结果',
  },
  comments: {
    title: '评论',
    count: '条评论',
    empty: '还没有评论，来做第一个吧。',
    name: '昵称',
    email: '邮箱（可选，不会公开）',
    body: '写下你的想法…',
    submit: '发表评论',
    submitting: '提交中…',
    posted: '已发布，感谢！',
    pending: '感谢！评论已提交，等待审核。',
    postError: '提交失败，请稍后再试。',
    loadError: '评论加载失败。',
    ownerBadge: '作者',
    githubSignIn: '用 GitHub 登录',
    githubHint: '可选，登录后不用每次填昵称',
    actingAs: '以 {name} 身份评论',
    signOut: '退出',
  },
  moments: {
    title: '动态',
    subtitle: '随手记下的片段与瞬间',
    empty: '还没有动态。',
  },
  projects: {
    station: '第二站',
    title: '成果的码头',
    subtitle: '在这里装载，出发远方',
    next: '回航',
    status: { active: '活跃', maintained: '维护中', archived: '已归档' },
    stageLabel: '阶段',
    websiteLabel: '官网（新窗口打开）',
    githubLabel: 'GitHub 仓库（新窗口打开）',
  },
  tags: {
    title: '标签',
    kicker: '标签',
    subtitle: '按主题归档的所有内容。',
    count: '篇',
    empty: '这个标签下还没有内容。',
    all: '← 全部标签',
  },
  about: {
    title: '关于',
    kicker: '关于',
    name: {
      pronunciation: '/spraʊt/',
      meaning: '一个可以生长的模板',
    },
    who: {
      title: '我是谁',
      paragraphs: [
        '把这里换成两句自我介绍：你在做什么，以及你喜欢做什么。',
        '这一页就是词典文案，直接改 src/lib/i18n/zh.js 与 src/lib/i18n/en.js。',
      ],
      projectsLink: '看项目',
    },
    why: {
      title: '为什么建这个站',
      paragraphs: [
        '说说你为什么要写：想留下什么，写给谁看。',
        '这个模板的重点是"写的东西始终归你"——内容存在你自己的 SQLite 库里，随时可以完整导出。',
      ],
    },
    writes: {
      title: '这里写什么',
      paragraphs: ['列出你覆盖的主题。文章和笔记自带标签，这一节可以很短。'],
    },
    brands: {
      title: '换过的名字',
      items: [
        { date: '2026.01', name: 'first-domain.example', note: '第一个域名' },
        { date: '2026.06', name: 'your-domain.example', note: '现在的名字' },
      ],
    },
    contact: {
      title: '联系',
      body: '有问题、想指正，或者只是想打个招呼：',
      githubLabel: 'GitHub',
      rssLabel: 'RSS',
    },
  },
  seo: {
    about: {
      label: '关于',
      description: '谁在写、为什么建这个站，以及它换过的名字。'
    },
    posts: {
      label: '博客',
      description: '关于 Android、C++、Python、前端开发等技术文章和见解。'
    },
    projects: {
      label: '项目',
      description: '各种项目'
    }
  }
};

export default zh;
