// English dictionary — site copy & UI vocabulary.
// Brand identity (name, homepage copy, SEO) lives in src/site.config.js.
export const en = {
  language: '中文',
  common: {
    empty: 'Nothing here yet.',
  },
  feed: {
    // Channel-title suffix and the RSS <language> tag for this locale.
    label: 'Blog',
    language: 'en',
  },
  nav: {
    home: 'Home',
    posts: 'Posts',
    projects: 'Projects',
    moments: 'Moments',
    about: 'About',
    tags: 'Tags',
    timeline: 'Timeline',
  },
  home: {
    selectedWriting: 'Latest writing',
    allWriting: 'All writing →',
    selectedProjects: 'Selected projects',
    allProjects: 'All projects →',
  },
  posts: {
    station: 'First Station',
    title: 'Harbor of Knowledge',
    subtitle: 'Where ideas anchor and thoughts settle',
    blogTitle: 'Posts',
    blogSubtitle: 'A complete record of a topic—from its essence, through its analysis, to its resolution',
    noteTitle: 'Notes',
    noteSubtitle: 'Fragments of what I see, think, and reflect on',
    readMore: 'Read More →',
    readTime: 'min read',
    toc: 'Contents',
    related: 'Related Posts',
    latest: 'Latest Writing',
    next: 'Head to the Dock',
  },
  search: {
    title: 'Search',
    placeholder: 'Search this category…',
    category: 'Category',
    empty: 'No results found',
  },
  comments: {
    title: 'Comments',
    count: 'comments',
    empty: 'No comments yet — be the first.',
    name: 'Name',
    email: 'Email (optional, never shown)',
    body: 'Share your thoughts…',
    submit: 'Post comment',
    submitting: 'Posting…',
    posted: 'Posted. Thanks!',
    pending: 'Thanks! Your comment is awaiting moderation.',
    postError: 'Something went wrong. Please try again.',
    loadError: 'Comments could not be loaded.',
    ownerBadge: 'Author',
    githubSignIn: 'Sign in with GitHub',
    githubHint: 'optional — no need to retype your name',
    actingAs: 'Commenting as {name}',
    signOut: 'Sign out',
  },
  moments: {
    title: 'Moments',
    subtitle: 'Small fragments and instants, jotted down',
    empty: 'No moments yet.',
  },
  projects: {
    station: 'Second Station',
    title: 'Dock of Creations',
    subtitle: 'Load up here, then set sail for the horizon',
    next: 'Go home',
    status: { active: 'Active', maintained: 'Maintained', archived: 'Archived' },
    stageLabel: 'Stage',
    websiteLabel: 'Website (opens in a new tab)',
    githubLabel: 'GitHub repository (opens in a new tab)',
  },
  tags: {
    title: 'Tags',
    kicker: 'Tags',
    subtitle: 'Everything filed under one topic.',
    count: 'posts',
    empty: 'Nothing filed under this tag yet.',
    all: '← All tags',
  },
  about: {
    title: 'About',
    kicker: 'About',
    name: {
      pronunciation: '/spraʊt/',
      meaning: 'a template you can grow',
    },
    who: {
      title: 'Who I am',
      paragraphs: [
        'Replace this with a couple of sentences about yourself: what you work on, and what you like doing.',
        'This page is plain dictionary copy — edit it in src/lib/i18n/en.js and src/lib/i18n/zh.js.',
      ],
      projectsLink: 'Projects',
    },
    why: {
      title: 'Why this site',
      paragraphs: [
        'Say why you write: what you want to keep, and who you are writing for.',
        'The point of this template is that the writing stays yours — content lives in your own SQLite database and can be exported in full at any time.',
      ],
    },
    writes: {
      title: 'What I write about',
      paragraphs: [
        'List the topics you cover. Posts and notes carry tags, so this section can stay short.',
      ],
    },
    brands: {
      title: 'Names it has had',
      items: [
        { date: '2026.01', name: 'first-domain.example', note: 'the first domain' },
        { date: '2026.06', name: 'your-domain.example', note: 'the current name' },
      ],
    },
    contact: {
      title: 'Contact',
      body: 'Questions, corrections, or just want to say hello:',
      githubLabel: 'GitHub',
      rssLabel: 'RSS',
    },
  },
  seo: {
    about: {
      label: 'About',
      description: 'Who writes here, why the site exists, and the names it has had.'
    },
    posts: {
      label: 'Posts',
      description: 'Technical articles and insights on Android, C++, Python, and frontend development.'
    },
    projects: {
      label: 'Projects',
      description: 'A collection of projects'
    }
  }
};

export default en;
