<script>
  import { page } from '$app/stores';

  let { overrideHref = undefined } = $props();

  // 获取当前语言
  let currentLang = $derived($page.url.pathname.startsWith('/zh') ? 'zh' : 'en');
  
  // 获取切换后的路径
  /**
   * @param {string} currentPath
   * @param {string} targetLang
   */
  function getSwitchPath(currentPath, targetLang) {
    if (targetLang === 'zh') {
      // 首页 '/' 直接切到 '/zh'（避免尾斜杠，对应静态产物 zh.html）
      return currentPath === '/' ? '/zh' : '/zh' + currentPath;
    } else {
      // 切换到英文 - 移除 /zh 前缀
      if (currentPath.startsWith('/zh')) {
        return currentPath.replace('/zh', '') || '/';
      }
      return currentPath;
    }
  }
  
  let switchPath = $derived(overrideHref ?? getSwitchPath($page.url.pathname, currentLang === 'en' ? 'zh' : 'en'));
</script>

<a href={switchPath} class="lang-switch">
  {currentLang === 'en' ? '中文' : 'English'}
</a>

<style>
  .lang-switch {
    position: fixed;
    top: 20px;
    right: 24px;
    z-index: 1000;
    padding: 6px 14px;
    background: var(--color-surface);
    border: 1px solid var(--color-paper-line);
    border-radius: 999px;
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    text-decoration: none;
    transition: color 0.2s, border-color 0.2s, box-shadow 0.2s;
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 10px rgba(41, 55, 47, 0.08);
  }
  
  .lang-switch:hover {
    border-color: var(--color-bud);
    color: var(--color-bud);
  }
</style>
