// 中文字典 —— 站点文案与界面词汇。
// 品牌身份（站名、首页文案、SEO）在 src/site.config.js 里。
export const zh = {
  language: 'English',
  nav: {
    home: '首页',
    posts: '博客',
    projects: '项目',
    moments: '动态',
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
    placeholder: '搜索文章与笔记…',
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
  },
  seo: {
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
