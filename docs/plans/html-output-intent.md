# Doc-Smith HTML 输出规格

::: locked {reason="核心架构"}
## 1. 概述

### 产品定位
DocSmith 的 HTML 输出不是"网站框架"，而是**文档产物生成器 + AI 可调样式**。

### 核心思想
把复杂度交给 AI（写 CSS），把程序逻辑压缩到最小（只做渲染 + 文件拼装）。

### 核心概念
- **MD → HTML 构建**：保持现有 MD 生成流程不变，新增构建步骤编译为 HTML
- **极简渲染器**：只做 Markdown 转换 + HTML 拼装 + 资源复制
- **单文件主题**：`theme.css` 是唯一的主题文件，AI 直接生成和迭代
- **纯静态输出**：可本地直接打开，可部署到任何静态托管

### 优先级
高 - 解决当前发布平台（Discuss Kit）过重的问题

### 目标用户
使用 doc-smith 生成技术文档的开发者

### 项目范围
- **不改造** `doc-smith-create`（继续生成 MD）
- **新增** `/doc-smith-build` Skill（MD → HTML 构建，输出 dist/）
- **不改造** `doc-smith-publish`（用户可自行选择部署方式）
- 渐进迁移，保留 Discuss Kit 发布能力
:::

::: reviewed {by="lban" date="2026-02-05"}
## 2. 架构

### 整体流程

```
┌─────────────────────────────────────────────────────────────────┐
│  doc-smith-create（保持不变）                                    │
│                                                                 │
│  数据源分析 → 结构规划 → AI 生成 MD 内容                          │
│                              ↓                                  │
│                 .aigne/doc-smith/docs/*.md                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  doc-smith-build（新增 Skill）                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 渲染器职责（极简、确定性）                                │   │
│  │ 1. Markdown → HTML（统一、可预测）                       │   │
│  │ 2. 套一个固定 HTML 骨架                                  │   │
│  │ 3. 拼接静态资源（CSS / 可选注入）                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  渲染器不做：                                                    │
│  - 主题继承                                                     │
│  - schema 校验                                                  │
│  - 模板系统                                                     │
│  - 运行时服务                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  输出: 纯静态 HTML 站点                                          │
│                                                                 │
│  .aigne/doc-smith/dist/                                        │
│  ├── index.html                                                 │
│  ├── zh/                                                        │
│  │   └── docs/*.html                                           │
│  ├── en/                                                        │
│  │   └── docs/*.html                                           │
│  └── assets/                                                    │
│      ├── docsmith.css      # 内置基础样式（稳定、很少改）        │
│      └── theme.css         # 用户/AI 生成的主题样式             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  部署（用户自行选择）                                            │
│                                                                 │
│  ├── 浏览器直接打开 file://dist/index.html                      │
│  ├── npx serve dist/  本地预览                                  │
│  ├── GitHub Pages / Vercel / Netlify 等静态托管                 │
│  └── doc-smith-publish --url 发布到 Discuss Kit（保留）         │
└─────────────────────────────────────────────────────────────────┘
```

### 构建脚本架构

```
skills/doc-smith-build/
├── SKILL.md                    # Skill 定义
├── scripts/
│   ├── build.mjs               # 构建脚本（单文件实现）
│   └── package.json
└── assets/
    └── docsmith.css            # 内置基础样式
```

> 注：MVP 阶段使用单文件实现，代码膨胀后再按需拆分模块。

### HTML 结构契约

HTML 里只固定极少量语义锚点，供 CSS 使用：

```html
<!DOCTYPE html>
<html lang="{{lang}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} - {{siteName}}</title>
  <meta name="description" content="{{description}}">
  <meta property="og:title" content="{{title}}">
  <meta property="og:description" content="{{description}}">
  <link rel="stylesheet" href="{{assetPath}}/docsmith.css">
  <link rel="stylesheet" href="{{assetPath}}/theme.css">
</head>
<body>
  <header data-ds="header">{{header}}</header>
  <div data-ds="layout">
    <aside data-ds="sidebar">{{navigation}}</aside>
    <main data-ds="content">{{content}}</main>
    <nav data-ds="toc">{{toc}}</nav>
  </div>
  <footer data-ds="footer">{{footer}}</footer>
</body>
</html>
```

**约束只有一条**：这些 `data-ds` 锚点不会变，其他都不保证。

这样：
- 程序逻辑稳定
- AI 写 CSS 有稳定抓手
- 不限制布局自由度

### 主题机制（核心：只有一个文件）

```
.aigne/doc-smith/theme.css    # 唯一的主题文件
```

- 如果存在 → 构建时自动引入
- 不存在 → 使用内置 `docsmith.css` 的默认样式
- AI 只修改这一文件

**这是唯一的"主题系统"。**

### 样式分层

```
┌─────────────────────────────────────────────────────────────────┐
│  docsmith.css（内置、稳定、很少改）                              │
│  ├── CSS Reset                                                  │
│  ├── 布局骨架（基于 data-ds 锚点）                               │
│  ├── 基础排版                                                   │
│  └── 响应式断点                                                 │
├─────────────────────────────────────────────────────────────────┤
│  theme.css（用户/AI 生成、可随意修改）                           │
│  ├── 颜色方案                                                   │
│  ├── 字体选择                                                   │
│  ├── 间距调整                                                   │
│  ├── 深色模式                                                   │
│  └── 任何自定义样式                                             │
└─────────────────────────────────────────────────────────────────┘
```
:::

::: reviewed {by="lban" date="2026-02-05"}
## 3. 详细行为

### 3.1 /doc-smith-build 工作流程

```
用户执行 /doc-smith-build
              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: 检测 Workspace                                        │
│  - 检查 .aigne/doc-smith/docs/ 是否存在                         │
│  - 检查 document-structure.yaml 是否有效                        │
│  - 如果不存在，提示先运行 /doc-smith-create                      │
└─────────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: 检查主题文件                                           │
│  - 检查 theme.css 是否存在                                      │
│  - 如果不存在，询问用户是否需要生成主题                           │
│    - 是 → 引导用户描述风格，AI 生成 theme.css                   │
│    - 否 → 使用默认样式                                          │
└─────────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: 执行构建                                               │
│  调用: node scripts/build.mjs                                   │
│  参数:                                                          │
│    --workspace .aigne/doc-smith                                │
│    --output .aigne/doc-smith/dist                              │
└─────────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: 报告结果                                               │
│  - 构建成功：展示输出路径和文件数量                               │
│  - 提示：可使用 /doc-smith-publish --preview 预览               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 AI 主题能力

AI 不参与 HTML 生成，只参与主题文件编辑：

```
用户自然语言 → AI 创建或修改 theme.css
```

示例：
- "生成一个 Django docs 风格的主题" → 生成 theme.css
- "标题太大、行距太松" → 修改 theme.css

**Agent 的输出落点永远固定**（只改 theme.css），不会扩散复杂度。

### 3.3 构建脚本执行流程

```javascript
// scripts/build.mjs 伪代码

async function build(options) {
  const { workspace, output } = options;

  // 1. 读取文档结构
  const structure = await readYaml(`${workspace}/planning/document-structure.yaml`);

  // 2. 生成导航数据
  const navigation = generateNavigation(structure);

  // 3. 遍历每个语言版本
  for (const lang of structure.languages) {
    for (const doc of structure.documents) {
      const mdPath = `${workspace}/docs/${doc.path}/${lang}.md`;
      const mdContent = await readFile(mdPath);

      // 4. MD → HTML 转换
      const htmlContent = markdownIt.render(mdContent);

      // 5. 套 HTML 骨架
      const fullPage = renderTemplate({
        lang,
        title: doc.title,
        content: htmlContent,
        navigation: renderNavigation(navigation, doc.path, lang),
        toc: generateTOC(htmlContent),
      });

      // 6. 写入文件
      await writeFile(`${output}/${lang}/docs/${doc.path}.html`, fullPage);
    }
  }

  // 7. 复制资源
  await copyAssets(workspace, output);

  // 8. 复制内置样式
  await copyFile('assets/docsmith.css', `${output}/assets/docsmith.css`);

  // 9. 复制主题（如果存在）
  if (await exists(`${workspace}/theme.css`)) {
    await copyFile(`${workspace}/theme.css`, `${output}/assets/theme.css`);
  }
}
```

### 3.4 导航生成

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

### 3.5 多语言处理

各语言独立构建，输出到独立路径：

```
输入:
docs/
├── overview/
│   ├── zh.md
│   └── en.md
└── guide/
    └── intro/
        ├── zh.md
        └── en.md

输出:
dist/
├── index.html        # 重定向到主语言
├── zh/
│   ├── index.html
│   └── docs/
│       ├── overview.html
│       └── guide/
│           └── intro.html
└── en/
    ├── index.html
    └── docs/
        └── ...
```
:::

::: reviewed {by="lban" date="2026-02-05"}
## 4. 用户体验

### 4.1 完整工作流

```bash
# Step 1: 生成文档（现有流程不变）
/doc-smith-create
# → 输出: .aigne/doc-smith/docs/*.md

# Step 2: 构建 HTML（新增）
/doc-smith-build
# → AI: "检测到 15 篇文档。需要自定义主题吗？"
# → 用户: "用 Stripe 文档的风格"
# → AI: "好的，生成主题中..."
# → 输出: .aigne/doc-smith/dist/

# Step 3: 预览（用户自行选择方式）
# 方式 A: 浏览器直接打开
open .aigne/doc-smith/dist/index.html

# 方式 B: 本地服务器
npx serve .aigne/doc-smith/dist

# Step 4: 部署（用户自行选择平台）
# GitHub Pages / Vercel / Netlify / 自建服务器 ...
```

### 4.2 主题迭代流程

```
用户: /doc-smith-build
AI: 检测到 workspace，准备构建 HTML 站点。
    发现已有 theme.css，使用现有主题构建。

    ✓ 构建完成
    - 输出路径: .aigne/doc-smith/dist/
    - 中文页面: 15 个
    - 英文页面: 15 个

    使用 `/doc-smith-publish --preview` 预览效果。

用户: 侧边栏太窄了，代码块背景深一点

AI: 好的，我来调整 theme.css：
    - 侧边栏宽度: 240px → 280px
    - 代码块背景: #f6f8fa → #1e293b

    重新构建中...

    ✓ 构建完成，刷新预览页面查看效果。
```

### 4.3 恢复默认主题

```
用户: 主题改坏了，恢复默认

AI: 好的，删除 theme.css，重新构建。

    ✓ 已恢复默认样式
```
:::

::: reviewed {by="lban" date="2026-02-05"}
## 5. 技术实现指南

### 5.1 改动范围

| 组件 | 改动类型 | 说明 |
|------|---------|------|
| `doc-smith-create` | **不改动** | 继续生成 MD 文件 |
| `skills/doc-smith-build/` | **新增** | 新 Skill：MD → HTML 构建 |
| `doc-smith-publish` | **不改动** | 用户自行选择部署方式 |

### 5.2 Workspace 结构变化

```
.aigne/doc-smith/
├── config.yaml
├── planning/
│   └── document-structure.yaml
├── docs/                       # 保留：MD 文件
│   └── ...
├── theme.css                   # 新增：主题样式（可选，AI 生成）
├── dist/                       # 新增：HTML 站点输出
│   ├── index.html
│   ├── zh/
│   ├── en/
│   └── assets/
│       ├── docsmith.css        # 内置基础样式
│       ├── theme.css           # 主题样式（从 workspace 复制）
│       └── images/
├── assets/                     # 保留：源图片
│   └── ...
└── cache/
```

### 5.3 构建脚本依赖

```json
// skills/doc-smith-build/scripts/package.json
{
  "dependencies": {
    "markdown-it": "^14.0.0",
    "markdown-it-anchor": "^8.6.0",
    "gray-matter": "^4.0.3",
    "glob": "^10.0.0"
  }
}
```

### 5.4 docsmith.css 基础样式

```css
/* assets/docsmith.css */

/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Layout */
body { min-height: 100vh; }

[data-ds="layout"] {
  display: grid;
  grid-template-columns: auto 1fr auto;
  min-height: 100vh;
}

[data-ds="sidebar"] { width: 260px; }
[data-ds="content"] { max-width: 800px; padding: 2rem; }
[data-ds="toc"] { width: 200px; }

/* Responsive */
@media (max-width: 1024px) {
  [data-ds="toc"] { display: none; }
}

@media (max-width: 768px) {
  [data-ds="layout"] { grid-template-columns: 1fr; }
  [data-ds="sidebar"] { width: 100%; }
}

/* Basic Typography */
[data-ds="content"] h1 { font-size: 2rem; margin-bottom: 1rem; }
[data-ds="content"] h2 { font-size: 1.5rem; margin: 2rem 0 1rem; }
[data-ds="content"] p { line-height: 1.7; margin-bottom: 1rem; }
[data-ds="content"] pre { padding: 1rem; overflow-x: auto; }
[data-ds="content"] code { font-family: monospace; }

/* Navigation */
[data-ds="sidebar"] ul { list-style: none; }
[data-ds="sidebar"] a { display: block; padding: 0.5rem 1rem; }
```
:::

::: reviewed {by="lban" date="2026-02-05"}
## 6. 决策总结

| 决策 | 选择 | 理由 |
|------|------|------|
| 实现路径 | MD → HTML 构建 | 保持现有 MD 生成不变，改动最小 |
| 渲染器职责 | 极简（MD 转换 + 拼装 + 复制） | 复杂度交给 AI，程序逻辑最小化 |
| 构建脚本 | 单文件 build.mjs | MVP 足够，膨胀后再拆分 |
| HTML 标记 | `data-ds` 属性 | 稳定锚点，不与内容冲突，语义清晰 |
| 主题机制 | 单一 `theme.css` | AI 直接生成/修改，无需主题系统 |
| 样式分层 | `docsmith.css` + `theme.css` | 基础稳定，主题可随意改 |
| AI 职责 | 只改 `theme.css` | 输出落点固定，不扩散复杂度 |
| 多语言 | 独立路径 /zh/, /en/ | 结构清晰 |
| 部署方式 | 用户自行选择 | 不限制托管平台，保持灵活 |
:::

::: reviewed {by="lban" date="2026-02-05"}
## 7. MVP 范围

### 包含

- [x] 新增 `/doc-smith-build` Skill
- [x] 单文件构建脚本（build.mjs）
- [x] 内置基础样式（docsmith.css）
- [x] 单文件主题机制（theme.css）
- [x] AI 创建/修改主题能力
- [x] 多语言独立路径构建
- [x] 自动导航生成
- [x] 基础 SEO（title/desc/OG）

### 不包含（延后）

- [ ] 可选注入点（head.html + body-end.html）
- [ ] --preview 本地预览服务器
- [ ] --static 静态托管发布
- [ ] 构建脚本模块化拆分

### 不包含（不做）

- [ ] 主题继承/扩展系统
- [ ] schema 校验
- [ ] 模板系统
- [ ] 站内搜索
- [ ] 评论系统
- [ ] 版本切换
- [ ] PDF 导出
:::

::: reviewed {by="lban" date="2026-02-05"}
## 8. 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| AI 生成的 CSS 质量不稳定 | 样式问题 | 删除 theme.css 即恢复默认 |
| 用户需要复杂布局 | 可能超出 CSS 能力 | data-ds 锚点不限制布局自由度 |
:::

::: reviewed {by="lban" date="2026-02-05"}
## 9. 为什么这么设计

### AI-first 而不是 framework-first

- AI 擅长：写 CSS、改 CSS
- AI 不擅长：理解复杂 schema、extends、合并规则
- 让 AI 改一个文件，比维护一套主题 DSL 稳定得多

### 程序复杂度压到最小

需要维护的程序逻辑只有：
- Markdown 渲染
- HTML 拼装
- 静态资源复制

没有：
- 主题系统 bug
- 配置合并 bug
- schema 演进成本
- 版本兼容地狱

**复杂 = bug**，这个方案把复杂度"外包"给 AI，而不是代码。

### 不会重蹈 Discuss Kit 的老路

- 没有运行时
- 没有服务
- 没有"越来越重"的系统设计空间

发布永远是：`render → dist/ → 扔到静态托管`

### 不限制用户 & 不封顶

- 用户想要多复杂的主题？→ AI 写 CSS
- 用户想完全重构布局？→ CSS + position / grid / flex
- 改坏了？→ 删除 theme.css 即回到默认

工具永远不是天花板。

### 适合 Agent Skill 架构

- 输入：自然语言
- 输出：文件 patch（theme.css）
- 可审查、可回滚、可 diff
- 不需要复杂 planner / schema / 合并逻辑
:::
