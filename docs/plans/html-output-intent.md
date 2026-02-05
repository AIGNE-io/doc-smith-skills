# Doc-Smith HTML 输出规格

## 1. 概述

### 产品定位
将 doc-smith-create 的输出格式从 Markdown 改为静态 HTML，实现更轻量的文档发布。

### 核心概念
- **直接生成 HTML**：AI 直接输出 HTML 而非 Markdown，避免双重转换消耗
- **CSS 类名约束**：通过预定义 CSS 类名保证样式一致性
- **多页面静态站点**：生成完整的文档站点，含导航、多语言、深色模式

### 优先级
高 - 解决当前发布平台（Discuss Kit）过重的问题

### 目标用户
使用 doc-smith 生成技术文档的开发者

### 项目范围
- 改造 `doc-smith-create` 支持 HTML 输出
- 改造 `doc-smith-publish` 支持静态托管
- 渐进迁移，保留 Discuss Kit 发布能力

## 2. 架构

### 整体流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    doc-smith-create                             │
│                                                                 │
│  数据源分析 → 结构规划 → AI 生成 HTML 内容 → 组装站点           │
│                              ↓                                  │
│                      ┌──────────────────┐                       │
│                      │ CSS 类名约束系统  │                       │
│                      │ (theme.css)      │                       │
│                      └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    输出: 静态 HTML 站点                          │
│                                                                 │
│  .aigne/doc-smith/                                             │
│  └── site/                                                      │
│      ├── index.html          # 首页                             │
│      ├── guide/              # 按导航分组                        │
│      │   └── intro.html                                        │
│      ├── zh/                 # 中文版本                          │
│      │   ├── index.html                                        │
│      │   └── guide/                                            │
│      ├── en/                 # 英文版本                          │
│      │   └── ...                                               │
│      └── assets/                                                │
│          ├── css/theme.css   # 全局样式                         │
│          └── images/         # 图片资源                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    doc-smith-publish                            │
│                                                                 │
│  ├── 静态托管（新）: 上传 site/ 到任意静态服务                    │
│  └── Discuss Kit（保留）: 转换为 Discuss Kit 格式               │
└─────────────────────────────────────────────────────────────────┘
```

### CSS 类名约束系统

AI 生成 HTML 时必须使用预定义的 CSS 类名：

```
┌─────────────────────────────────────────────────────────────────┐
│  Layout Classes                                                 │
│  ├── .ds-layout          # 整体布局容器                          │
│  ├── .ds-sidebar         # 侧边栏导航                           │
│  ├── .ds-content         # 内容区域                             │
│  └── .ds-toc             # 目录（Table of Contents）            │
├─────────────────────────────────────────────────────────────────┤
│  Content Classes                                                │
│  ├── .ds-prose           # 正文容器                             │
│  ├── .ds-heading-1/2/3   # 标题层级                             │
│  ├── .ds-paragraph       # 段落                                 │
│  ├── .ds-code-block      # 代码块                               │
│  ├── .ds-code-inline     # 行内代码                             │
│  ├── .ds-list            # 列表                                 │
│  ├── .ds-table           # 表格                                 │
│  ├── .ds-blockquote      # 引用块                               │
│  ├── .ds-callout-*       # 提示框 (info/warning/error)          │
│  └── .ds-image           # 图片                                 │
├─────────────────────────────────────────────────────────────────┤
│  Navigation Classes                                             │
│  ├── .ds-nav             # 导航容器                             │
│  ├── .ds-nav-group       # 导航分组                             │
│  ├── .ds-nav-item        # 导航项                               │
│  └── .ds-nav-active      # 当前页面                             │
├─────────────────────────────────────────────────────────────────┤
│  UI Classes                                                     │
│  ├── .ds-lang-switcher   # 语言切换器                           │
│  ├── .ds-theme-toggle    # 深色/浅色切换                         │
│  └── .ds-search          # 搜索框（预留）                        │
└─────────────────────────────────────────────────────────────────┘
```

### 主题系统

```
┌─────────────────────────────────────────────────────────────────┐
│  内置主题: docs-default                                         │
│  ├── 文档风格: 侧边栏导航 + 内容区 + 右侧目录                     │
│  ├── 深色模式: 跟随系统 (prefers-color-scheme)                   │
│  └── 响应式: 移动端侧边栏折叠                                    │
├─────────────────────────────────────────────────────────────────┤
│  CSS 变量 (用户可覆盖)                                          │
│  ├── --ds-color-primary                                        │
│  ├── --ds-color-bg / --ds-color-bg-dark                        │
│  ├── --ds-color-text / --ds-color-text-dark                    │
│  ├── --ds-font-sans / --ds-font-mono                           │
│  └── --ds-sidebar-width                                        │
└─────────────────────────────────────────────────────────────────┘
```

## 3. 详细行为

### 3.1 HTML 生成流程

```
输入: document-structure.yaml + 数据源
          ↓
    ┌─────────────────┐
    │ 生成页面模板     │  ← 包含 head, nav, footer
    │ (shell.html)    │
    └────────┬────────┘
             ↓
    ┌─────────────────┐
    │ AI 生成内容区域  │  ← 使用 CSS 类名约束
    │ (per document)  │     输出 <main class="ds-content">...</main>
    └────────┬────────┘
             ↓
    ┌─────────────────┐
    │ 注入到模板      │  ← shell + content = 完整页面
    └────────┬────────┘
             ↓
    ┌─────────────────┐
    │ 生成导航数据     │  ← 从 structure.yaml 自动推断
    └────────┬────────┘
             ↓
输出: 完整 HTML 文件
```

### 3.2 导航生成

从 `document-structure.yaml` 自动推断导航结构：

```yaml
# document-structure.yaml 示例
documents:
  - path: /overview
    title: 概述
  - path: /guide/getting-started
    title: 快速开始
  - path: /guide/installation
    title: 安装指南
  - path: /api/authentication
    title: 认证 API

# 自动推断为:
# - 概述
# - 指南
#   - 快速开始
#   - 安装指南
# - API
#   - 认证 API
```

### 3.3 多语言处理

```
输出结构:
site/
├── index.html        # 默认语言首页（重定向到主语言）
├── zh/               # 中文版本
│   ├── index.html
│   └── guide/
│       └── intro.html
└── en/               # 英文版本
    ├── index.html
    └── guide/
        └── intro.html

URL 示例:
- /zh/guide/intro.html  → 中文版
- /en/guide/intro.html  → 英文版
```

### 3.4 深色模式

```html
<!-- 自动检测系统偏好 -->
<script>
  if (matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
  }
</script>

<!-- CSS 响应 -->
<style>
  :root { --ds-color-bg: #ffffff; }
  :root.dark { --ds-color-bg: #1a1a1a; }
</style>
```

### 3.5 静态资源处理

```
源位置 → 目标位置
.aigne/doc-smith/assets/xxx/images/*.png
        ↓
site/assets/images/xxx.png

HTML 引用:
<img src="../assets/images/xxx.png" class="ds-image">
```

## 4. 用户体验

### 4.1 生成流程（改造后）

```bash
# 用户执行（与现在相同）
/doc-smith-create

# AI 执行（内部变化）
1. 检测 workspace
2. 分析数据源
3. 规划文档结构
4. 生成 HTML 内容（新：直接输出 HTML）
5. 组装静态站点（新）
6. 完成
```

### 4.2 发布流程（新增静态托管）

```bash
# 发布到静态托管
/doc-smith-publish --static

# 本地预览
/doc-smith-publish --preview
# → 启动本地 HTTP 服务器
# → 打开浏览器 http://localhost:3000

# 保留原有 Discuss Kit 发布
/doc-smith-publish --url https://xxx.com
```

### 4.3 主题配置

```yaml
# config.yaml 新增
theme:
  name: docs-default  # 内置主题
  # 或
  custom: ./my-theme.css  # 自定义主题

  # 颜色覆盖（可选）
  colors:
    primary: "#3b82f6"
```

## 5. 技术实现指南

### 5.1 改动范围

| 组件 | 改动类型 | 说明 |
|------|---------|------|
| `doc-smith-create/SKILL.md` | 修改 | 增加 HTML 生成逻辑 |
| `agents/doc-smith-content.md` | 修改 | 输出 HTML 而非 Markdown |
| `doc-smith-publish/SKILL.md` | 修改 | 增加静态托管和预览 |
| `skills/doc-smith-create/templates/` | 新增 | HTML 模板和 CSS |
| `skills/doc-smith-publish/scripts/preview.mjs` | 新增 | 本地预览服务器 |

### 5.2 Workspace 结构变化

```
.aigne/doc-smith/
├── config.yaml
├── planning/
│   └── document-structure.yaml
├── docs/                    # 保留，供 Discuss Kit 发布使用
│   └── ...
├── site/                    # 新增：静态 HTML 站点
│   ├── index.html
│   ├── zh/
│   ├── en/
│   └── assets/
│       ├── css/
│       └── images/
└── cache/
```

### 5.3 CSS 类名约束 Prompt

给 AI 的 prompt 中需要包含：

```markdown
## HTML 输出规范

你必须使用以下 CSS 类名生成 HTML，不要使用其他类名：

### 内容类名
- `.ds-prose` - 包裹所有正文内容
- `.ds-heading-1`, `.ds-heading-2`, `.ds-heading-3` - 标题
- `.ds-paragraph` - 段落
- `.ds-code-block` - 代码块，需包含 `<pre><code>`
- `.ds-code-inline` - 行内代码
- `.ds-list` - 列表（ul/ol）
- `.ds-table` - 表格
- `.ds-blockquote` - 引用
- `.ds-callout-info`, `.ds-callout-warning`, `.ds-callout-error` - 提示框
- `.ds-image` - 图片

### 示例

```html
<article class="ds-prose">
  <h1 class="ds-heading-1">标题</h1>
  <p class="ds-paragraph">这是一段文字。</p>
  <pre class="ds-code-block"><code>const x = 1;</code></pre>
  <div class="ds-callout-info">
    <p>这是一个提示。</p>
  </div>
</article>
```
```

### 5.4 模板结构

```html
<!-- templates/shell.html -->
<!DOCTYPE html>
<html lang="{{lang}}" class="{{darkClass}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} - {{siteName}}</title>
  <meta name="description" content="{{description}}">
  <meta property="og:title" content="{{title}}">
  <meta property="og:description" content="{{description}}">
  <link rel="stylesheet" href="{{assetPath}}/css/theme.css">
  <script>
    if (matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  </script>
</head>
<body class="ds-layout">
  <nav class="ds-sidebar">
    {{navigation}}
  </nav>
  <main class="ds-content">
    {{content}}
  </main>
  <aside class="ds-toc">
    {{toc}}
  </aside>
  <footer class="ds-footer">
    <div class="ds-lang-switcher">{{langSwitcher}}</div>
  </footer>
</body>
</html>
```

## 6. 决策总结

| 决策 | 选择 | 理由 |
|------|------|------|
| 输出格式 | 直接生成 HTML | 避免 MD→HTML 双重转换消耗 |
| 样式一致性 | CSS 类名约束 | 简单灵活，AI 易于遵循 |
| 主题风格 | 文档风（侧边栏导航） | 适合技术文档阅读 |
| 深色模式 | 跟随系统 | 尊重用户偏好 |
| 多语言 | 独立路径 | /zh/, /en/ 结构清晰 |
| 导航生成 | 自动推断 | 从 structure.yaml 推断，减少配置 |
| 静态资源 | 复制到输出 | 便于独立部署 |
| 预览服务 | 简单静态服务器 | 够用且简单 |
| 发布兼容 | 渐进迁移 | 保留 Discuss Kit，新增静态托管 |
| SEO | 基础支持 | title/description/OG tags |
| Skill 归属 | 改造 doc-smith-create | 保持用户习惯 |
| Workspace | 保持不变 | 兼容现有工作流 |

## 7. MVP 范围

### 包含

- [x] HTML 内容生成（AI 直接输出）
- [x] CSS 类名约束系统
- [x] 内置默认主题（docs-default）
- [x] 多语言独立路径
- [x] 深色模式（跟随系统）
- [x] 自动导航生成
- [x] 本地预览服务器
- [x] 静态文件托管发布
- [x] 基础 SEO（title/desc/OG）
- [x] 保留 Discuss Kit 发布

### 不包含

- [ ] 自定义主题上传
- [ ] 站内搜索
- [ ] 评论系统
- [ ] 版本切换
- [ ] PDF 导出
- [ ] sitemap.xml / robots.txt

## 8. 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| AI 生成 HTML 不遵循类名约束 | 样式不一致 | Prompt 明确约束 + 校验检查 |
| HTML 生成质量不稳定 | 页面结构混乱 | 提供示例 + 校验工具 |
| 渐进迁移期两套输出维护成本 | 开发负担 | 明确时间表，尽快完成迁移 |

## 9. 开放问题

- [ ] 是否需要支持用户上传自定义 CSS？
- [ ] 代码高亮使用什么方案？（纯 CSS / JS 库）
- [ ] 图片懒加载是否需要？
