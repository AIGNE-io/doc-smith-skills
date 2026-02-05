# Doc-Smith HTML 输出规格

## 1. 概述

### 产品定位
新增构建步骤，将 doc-smith 生成的 Markdown 文档编译为静态 HTML 站点，实现更轻量的发布。

### 核心概念
- **MD → HTML 构建**：保持现有 MD 生成流程不变，新增构建步骤编译为 HTML
- **程序 + AI 混合**：AI 负责交互和主题决策，程序负责确定性的转换执行
- **多页面静态站点**：生成完整的文档站点，含导航、多语言、深色模式

### 优先级
高 - 解决当前发布平台（Discuss Kit）过重的问题

### 目标用户
使用 doc-smith 生成技术文档的开发者

### 项目范围
- **不改造** `doc-smith-create`（继续生成 MD）
- **新增** `/doc-smith-build` Skill（MD → HTML 构建）
- **改造** `doc-smith-publish` 支持静态托管
- 渐进迁移，保留 Discuss Kit 发布能力

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
│  │ AI 职责                                                  │   │
│  │ 1. 分析 workspace，检查主题配置                          │   │
│  │ 2. 与用户沟通确认模板和主题偏好                           │   │
│  │ 3. 将配置写入 config.yaml                               │   │
│  │ 4. 调用构建脚本                                          │   │
│  │ 5. 报告构建结果                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 程序职责（Node 脚本）                                    │   │
│  │ - 读取 docs/*.md 文件                                   │   │
│  │ - markdown-it 解析转换                                  │   │
│  │ - 注入 HTML 模板                                        │   │
│  │ - 生成导航                                              │   │
│  │ - 复制资源                                              │   │
│  │ - 输出 HTML 文件                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  输出: 静态 HTML 站点                                            │
│                                                                 │
│  .aigne/doc-smith/site/                                        │
│  ├── index.html                                                 │
│  ├── zh/                    # 中文版本                          │
│  │   ├── index.html                                            │
│  │   └── guide/intro.html                                      │
│  ├── en/                    # 英文版本                          │
│  │   └── ...                                                   │
│  └── assets/                                                    │
│      ├── css/theme.css                                         │
│      ├── js/highlight.min.js                                   │
│      └── images/                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  doc-smith-publish                                              │
│                                                                 │
│  ├── --static    : 上传 site/ 到静态托管（新）                   │
│  ├── --preview   : 本地预览服务器（新）                          │
│  └── --url       : 发布到 Discuss Kit（保留）                   │
└─────────────────────────────────────────────────────────────────┘
```

### 构建脚本架构

```
skills/doc-smith-build/
├── SKILL.md                    # Skill 定义（AI 交互逻辑）
├── scripts/
│   ├── build.mjs               # 构建入口
│   ├── lib/
│   │   ├── markdown.mjs        # MD 解析（markdown-it）
│   │   ├── template.mjs        # 模板渲染
│   │   ├── navigation.mjs      # 导航生成
│   │   └── assets.mjs          # 资源处理
│   └── package.json
└── templates/
    ├── shell.html              # 页面模板
    └── themes/
        └── docs-default/
            ├── theme.css       # 默认主题
            └── variables.css   # CSS 变量（用户可覆盖）
```

### CSS 类名系统

构建脚本在 MD→HTML 转换时自动添加 CSS 类名：

```
┌─────────────────────────────────────────────────────────────────┐
│  Layout Classes                                                 │
│  ├── .ds-layout          # 整体布局容器                          │
│  ├── .ds-sidebar         # 侧边栏导航                           │
│  ├── .ds-content         # 内容区域                             │
│  └── .ds-toc             # 目录（Table of Contents）            │
├─────────────────────────────────────────────────────────────────┤
│  Content Classes（由 markdown-it 渲染器添加）                    │
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
│  └── .ds-theme-toggle    # 深色/浅色切换                         │
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
│  CSS 变量（用户可通过自然语言让 AI 调整）                         │
│  ├── --ds-color-primary                                        │
│  ├── --ds-color-bg / --ds-color-bg-dark                        │
│  ├── --ds-color-text / --ds-color-text-dark                    │
│  ├── --ds-font-sans / --ds-font-mono                           │
│  └── --ds-sidebar-width                                        │
└─────────────────────────────────────────────────────────────────┘
```

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
│  Phase 2: 确认主题配置                                           │
│  - 读取 config.yaml 中的 theme 配置                             │
│  - 如果没有配置，询问用户主题偏好                                 │
│  - 如果用户有自定义要求，AI 调整 CSS 变量                        │
│  - 将配置写入 config.yaml                                       │
└─────────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: 执行构建                                               │
│  调用: node scripts/build.mjs                                   │
│  参数:                                                          │
│    --workspace .aigne/doc-smith                                │
│    --output .aigne/doc-smith/site                              │
│    --theme docs-default                                        │
│    --variables config.yaml#theme.variables                     │
└─────────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: 报告结果                                               │
│  - 构建成功：展示输出路径和文件数量                               │
│  - 提示：可使用 /doc-smith-publish --preview 预览               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 构建脚本执行流程

```javascript
// scripts/build.mjs 伪代码

async function build(options) {
  const { workspace, output, theme, variables } = options;

  // 1. 读取文档结构
  const structure = await readYaml(`${workspace}/planning/document-structure.yaml`);

  // 2. 读取主题
  const themeCSS = await loadTheme(theme, variables);

  // 3. 生成导航数据
  const navigation = generateNavigation(structure);

  // 4. 遍历每个语言版本
  for (const lang of structure.languages) {

    // 5. 遍历每个文档
    for (const doc of structure.documents) {
      const mdPath = `${workspace}/docs/${doc.path}/${lang}.md`;
      const mdContent = await readFile(mdPath);

      // 6. MD → HTML 转换
      const htmlContent = markdownIt.render(mdContent, {
        // 自定义渲染器，添加 CSS 类名
      });

      // 7. 注入模板
      const fullPage = renderTemplate('shell.html', {
        lang,
        title: doc.title,
        content: htmlContent,
        navigation: renderNavigation(navigation, doc.path, lang),
        toc: generateTOC(htmlContent),
      });

      // 8. 写入文件
      await writeFile(`${output}/${lang}/${doc.path}.html`, fullPage);
    }
  }

  // 9. 复制资源
  await copyAssets(workspace, output);

  // 10. 写入主题 CSS
  await writeFile(`${output}/assets/css/theme.css`, themeCSS);
}
```

### 3.3 导航生成

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

### 3.4 多语言处理

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
site/
├── index.html        # 重定向到主语言
├── zh/
│   ├── index.html
│   ├── overview.html
│   └── guide/
│       └── intro.html
└── en/
    ├── index.html
    ├── overview.html
    └── guide/
        └── intro.html
```

### 3.5 深色模式

```html
<!-- 在 shell.html 模板中 -->
<script>
  // 自动检测系统偏好
  if (matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
  }
  // 监听变化
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    document.documentElement.classList.toggle('dark', e.matches);
  });
</script>
```

```css
/* theme.css */
:root {
  --ds-color-bg: #ffffff;
  --ds-color-text: #1a1a1a;
}
:root.dark {
  --ds-color-bg: #1a1a1a;
  --ds-color-text: #e5e5e5;
}
```

### 3.6 代码高亮

使用 highlight.js via CDN：

```html
<!-- 在 shell.html 模板中 -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script>hljs.highlightAll();</script>
```

## 4. 用户体验

### 4.1 完整工作流

```bash
# Step 1: 生成文档（现有流程不变）
/doc-smith-create
# → 输出: .aigne/doc-smith/docs/*.md

# Step 2: 构建 HTML（新增）
/doc-smith-build
# → AI: "检测到 15 篇文档，使用默认主题？或者你有什么偏好？"
# → 用户: "主色调用蓝色"
# → AI: "好的，使用蓝色主题构建中..."
# → 输出: .aigne/doc-smith/site/

# Step 3: 预览（新增）
/doc-smith-publish --preview
# → 启动本地服务器 http://localhost:3000

# Step 4: 发布
/doc-smith-publish --static
# → 上传到静态托管服务
```

### 4.2 主题定制流程

```
用户: /doc-smith-build

AI: 检测到 workspace，准备构建 HTML 站点。
    当前使用默认主题 (docs-default)。
    你有什么样式偏好吗？比如：
    - 主色调
    - 字体偏好
    - 布局调整

用户: 主色调用绿色，代码块背景深一点

AI: 好的，我来调整主题配置：
    - 主色调: #22c55e (绿色)
    - 代码块背景: #1e293b (深色)

    开始构建...

    ✓ 构建完成
    - 输出路径: .aigne/doc-smith/site/
    - 中文页面: 15 个
    - 英文页面: 15 个

    使用 `/doc-smith-publish --preview` 预览效果。
```

### 4.3 config.yaml 主题配置

```yaml
# config.yaml
projectName: My Project
locale: zh
translateLanguages: [en]

# 新增主题配置
theme:
  name: docs-default
  variables:
    primary: "#22c55e"
    code-bg: "#1e293b"
```

## 5. 技术实现指南

### 5.1 改动范围

| 组件 | 改动类型 | 说明 |
|------|---------|------|
| `doc-smith-create` | **不改动** | 继续生成 MD 文件 |
| `skills/doc-smith-build/` | **新增** | 新 Skill：MD → HTML 构建 |
| `doc-smith-publish/SKILL.md` | 修改 | 增加 --static 和 --preview |
| `doc-smith-publish/scripts/preview.mjs` | 新增 | 本地预览服务器 |

### 5.2 Workspace 结构变化

```
.aigne/doc-smith/
├── config.yaml                 # 新增 theme 配置
├── planning/
│   └── document-structure.yaml
├── docs/                       # 保留：MD 文件
│   ├── overview/
│   │   ├── .meta.yaml
│   │   ├── zh.md
│   │   └── en.md
│   └── ...
├── site/                       # 新增：HTML 站点输出
│   ├── index.html
│   ├── zh/
│   ├── en/
│   └── assets/
│       ├── css/theme.css
│       ├── js/
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

### 5.4 模板结构

```html
<!-- templates/shell.html -->
<!DOCTYPE html>
<html lang="{{lang}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} - {{siteName}}</title>
  <meta name="description" content="{{description}}">
  <meta property="og:title" content="{{title}}">
  <meta property="og:description" content="{{description}}">
  <link rel="stylesheet" href="{{assetPath}}/css/theme.css">
  <!-- highlight.js -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
  <script>
    if (matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  </script>
</head>
<body class="ds-layout">
  <nav class="ds-sidebar">
    {{navigation}}
    <div class="ds-lang-switcher">{{langSwitcher}}</div>
  </nav>
  <main class="ds-content">
    <article class="ds-prose">
      {{content}}
    </article>
  </main>
  <aside class="ds-toc">
    {{toc}}
  </aside>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script>hljs.highlightAll();</script>
</body>
</html>
```

## 6. 决策总结

| 决策 | 选择 | 理由 |
|------|------|------|
| 实现路径 | MD → HTML 构建 | 保持现有 MD 生成不变，改动最小 |
| 构建触发 | 独立 Skill `/doc-smith-build` | 职责清晰，用户显式调用 |
| 构建方式 | 程序 + AI 混合 | AI 负责交互决策，程序负责确定性执行 |
| 转换工具 | markdown-it (Node) | 成熟稳定，可自定义渲染器 |
| 主题定制 | 自然语言修改 | 用户向 AI 描述，AI 调整 CSS 变量 |
| 主题风格 | 文档风（侧边栏导航） | 适合技术文档阅读 |
| 深色模式 | 跟随系统 | 尊重用户偏好 |
| 多语言 | 各语言独立构建到独立路径 | /zh/, /en/ 结构清晰 |
| 导航生成 | 自动推断 | 从 structure.yaml 推断，减少配置 |
| 代码高亮 | highlight.js via CDN | 无需本地打包 |
| 图片懒加载 | 不需要 | 保持简单 |
| 预览服务 | 简单静态服务器 | 够用且简单 |
| 发布兼容 | 渐进迁移 | 保留 Discuss Kit，新增静态托管 |
| SEO | 基础支持 | title/description/OG tags |

## 7. MVP 范围

### 包含

- [x] 新增 `/doc-smith-build` Skill
- [x] MD → HTML 构建脚本
- [x] 内置默认主题（docs-default）
- [x] 主题自然语言定制（AI 调整 CSS 变量）
- [x] 代码高亮（highlight.js via CDN）
- [x] 多语言独立路径构建
- [x] 深色模式（跟随系统）
- [x] 自动导航生成
- [x] 本地预览服务器（--preview）
- [x] 静态文件托管发布（--static）
- [x] 基础 SEO（title/desc/OG）
- [x] 保留 Discuss Kit 发布

### 不包含

- [ ] 站内搜索
- [ ] 评论系统
- [ ] 版本切换
- [ ] PDF 导出
- [ ] sitemap.xml / robots.txt

## 8. 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| markdown-it 自定义渲染器复杂 | 开发成本 | 参考现有开源实现 |
| 主题 CSS 变量不够灵活 | 定制受限 | 设计足够的 CSS 变量覆盖点 |
| 渐进迁移期两套输出维护成本 | 开发负担 | 明确时间表，尽快完成迁移 |

## 9. 已确认问题

| 问题 | 决策 | 说明 |
|------|------|------|
| 自定义 CSS | 不支持上传 | 用户通过自然语言向 AI 提出主题修改要求 |
| 代码高亮 | CDN JS 库 | 使用 highlight.js via CDN |
| 图片懒加载 | 不需要 | 保持简单 |
| 实现路径 | MD → HTML 构建 | 保持现有 MD 生成流程不变，新增构建步骤 |
| 构建触发 | 独立 Skill | `/doc-smith-build` 显式调用 |
| 构建分工 | AI 主导 + 程序执行 | AI 负责交互和主题决策，程序执行确定性转换 |
