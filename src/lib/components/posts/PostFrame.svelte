<script>
  import BlogList from './PostList.svelte';

  const { title, description, posts, readMoreLabel, readTimeLabel } = $props();
</script>

<div class="blog-frame card">
  <h2 class="blog-title">{title}</h2>
  <p class="blog-description">{description}</p>
  <BlogList {posts} {readMoreLabel} {readTimeLabel} />
</div>

<style>
  /* surface + border + radius come from the shared .card class */
  .blog-frame {
    padding: 24px 28px;
    margin-bottom: 36px;
  }

  .blog-title {
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: 1.4rem;
    color: var(--color-ink);
    margin: 0;
  }

  .blog-description {
    font-size: 0.95rem;
    line-height: 1.6;
    color: var(--color-ink-soft);
    margin: 8px 0 20px;
  }

  @media (max-width: 767px) {
    .blog-frame {
      padding: 20px;
    }
  }
</style>
