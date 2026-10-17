<script>
  /**
   * Arc — 签名图形：一条从地平线扬起的弧线。
   * 寓意：从零出发，沿弧线曲折演进、向上生长。
   * @prop {number} size - 宽度 px（高度按 viewBox 比例）
   * @prop {string} class - 额外类名
   */
  let { size = 72, class: className = '' } = $props();
</script>

<svg
  class={`arc ${className}`}
  style={`width: ${size}px; height: ${Math.round((size * 40) / 120)}px`}
  viewBox="0 0 120 40"
  fill="none"
  aria-hidden="true"
>
  <path
    d="M6 34 C 44 34 58 26 70 16 C 82 6 92 8 96 10"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <circle cx="104" cy="7" r="3.5" fill="currentColor" />
</svg>
