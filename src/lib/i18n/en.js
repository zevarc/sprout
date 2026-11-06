// English dictionary — site copy & UI vocabulary.
// Brand identity (name, homepage copy, SEO) lives in `$site/config`.
export const en = {
  language: '中文',
  common: {
    switchLanguage: 'Switch to {name}',
    skipToContent: 'Skip to content',
    private: 'Private',
    empty: 'Nothing here yet.',
  },
  // Copy for `+error.svelte`. Four buckets cover every status the engine
  // raises; an instance rewrites these through `mods[].i18n`, no route fork.
  error: {
    kicker: 'Error record',
    code: 'HTTP {status}',
    title: {
      notFound: 'This page drifted off',
      denied: 'Not yours to open',
      broken: 'Something broke on our end',
      other: 'Something went sideways',
    },
    body: {
      notFound:
        'The address may be stale, or it never existed. Nothing is lost — everything published is still listed.',
      denied:
        'This address exists but is not public. If that is unexpected, the link may have been revoked.',
      broken:
        'The page failed while rendering. Trying again in a moment usually works; if it does not, the log has it.',
      other: 'The request could not be completed.',
    },
    home: 'Back to the index',
    search: 'Search the archive',
    latest: 'Read the latest',
  },
  feed: {
    // Channel-title suffix and the RSS <language> tag for this locale.
    label: 'Blog',
    language: 'en',
  },
  nav: {
    home: 'Home',
    posts: 'Posts',
    notes: 'Notes',
    projects: 'Projects',
    moments: 'Moments',
    about: 'About',
    tags: 'Tags',
    timeline: 'Timeline',
    friends: 'Friends',
    siteMap: 'Site map',
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
    copyCode: 'Copy code',
    copiedCode: 'Copied!',
    tocExpand: 'Show all sections',
    tocCollapse: 'Show fewer sections',
    backToTop: 'Back to top',
    related: 'Related Posts',
    latest: 'Latest Writing',
    next: 'Head to the Dock',
  },
  search: {
    title: 'Search',
    placeholder: 'Search this category…',
    category: 'Category',
    empty: 'No results found',
    loading: 'Searching…',
    resultCount: '{count} results',
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
    requiredHint: 'A name and a comment are required.',
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
  friends: {
    title: 'Friends',
    subtitle: 'Blogs I read — and the people writing them.',
    empty: 'No friend links yet.',
    feedLabel: 'RSS feed',
    profileLabel: 'Link details',
    visit: 'Visit site',
    since: 'since',
    apply: {
      title: 'Apply for a link',
      intro:
        'Swap a link with this site. Add this site to your own links page first, then send the form below — requests are reviewed by hand.',
      rules: [
        'Personal blogs and independent sites only — no content farms or link directories.',
        'Link back to this site first; requests without a link back are usually declined.',
        'Reviews are manual. If a site goes offline, the link may be removed.',
      ],
      ownInfo: 'This site',
      name: 'Site name',
      url: 'Site URL',
      description: 'One-line description',
      avatar: 'Avatar / icon URL (optional)',
      feed: 'RSS / Atom URL (optional)',
      linksPage: 'Your links page (optional)',
      email: 'Email (optional, never published)',
      message: 'Anything else (optional)',
      submit: 'Send request',
      submitting: 'Sending…',
      success: 'Thanks! Your request is queued for review.',
      duplicate: 'This site already has a request waiting for review.',
      rateLimited: 'Too many requests from this address. Please try again tomorrow.',
      invalidUrl: 'Please enter a full http(s) URL.',
      failed: 'Something went wrong. Please try again.',
      required: 'Site name and URL are required.',
    },
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
  lightbox: {
    close: 'Close',
    preview: 'Image preview',
  },
  login: {
    title: 'Sign in',
    heading: 'Enter {name}',
    hint: 'This area requires signing in.',
    token: 'Access token',
    submit: 'Sign in',
    submitting: 'Signing in…',
    failed: 'Sign-in failed. Check the token.',
    failedLater: 'Sign-in failed. Try again later.',
  },
  seo: {
    note: {
      label: 'Notes',
      description: 'Short notes: fragments of what I see, think and reflect on.'
    },
    moment: {
      label: 'Moments',
      description: 'Short updates — what I am doing, reading or thinking about right now.'
    },
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
