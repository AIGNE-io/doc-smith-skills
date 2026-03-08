# CSS Font Loading Optimization

## Problem

DocSmith 生成的页面中，`docsmith.css` 内部通过 `@import` 加载 Google Fonts，造成串行瀑布链：

```
HTML → docsmith.css(下载+解析) → @import Google Fonts(下载+解析) → 字体文件
```

每一步都必须等上一步完成，额外增加 200-400ms 延迟。

## Solution

将 Google Fonts 的加载从 CSS `@import` 提升到 HTML `<head>` 中的 `<link>` 标签，使浏览器可以并行加载：

```
HTML → docsmith.css ─────────┐
HTML → Google Fonts CSS ─────┤ (并行)
HTML → theme.css ────────────┘
```

## Changes

### 1. `skills/doc-smith-build/assets/docsmith.css`

删除第 20 行的 `@import` 语句。

### 2. `skills/doc-smith-build/scripts/build.mjs`

在 `renderTemplate()` 函数的 `<head>` 中，在 `<link rel="stylesheet" href="docsmith.css">` 之前添加：

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
```

## Impact

- 2 files changed, ~4 lines modified
- No visual changes
- Eliminates serial waterfall for font loading
