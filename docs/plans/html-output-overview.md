# Doc-Smith HTML 输出

> 文档产物生成器 + AI 可调样式，不是网站框架

## 核心思想

把复杂度交给 AI（写 CSS），把程序逻辑压缩到最小（只做渲染 + 文件拼装）。

## 为什么？

Discuss Kit 太重。静态 HTML 可以部署到任何地方（GitHub Pages、OSS、CDN）。

## 核心体验

```
/doc-smith-create          # 不变，生成 MD
        ↓
/doc-smith-build           # 新增
        ↓
AI: "需要自定义主题吗？"
用户: "用 Stripe 文档的风格"
AI: "好的" → 生成 theme.css → 构建
        ↓
dist/
├── zh/docs/*.html
├── en/docs/*.html
└── assets/
    ├── docsmith.css       # 内置（稳定）
    └── theme.css          # AI 生成（可改）
        ↓
用户自行选择部署方式:
- 浏览器直接打开
- npx serve dist/
- GitHub Pages / Vercel / ...
```

## 架构

```
┌─────────────────────────────────────────────────────────┐
│  渲染器职责（极简、确定性）                               │
│  1. Markdown → HTML                                     │
│  2. 套固定 HTML 骨架                                    │
│  3. 拼接静态资源                                        │
│                                                         │
│  渲染器不做: 主题继承 / schema / 模板系统 / 运行时       │
└─────────────────────────────────────────────────────────┘
```

## HTML 结构契约

```html
<body>
  <header data-ds="header"></header>
  <div data-ds="layout">
    <aside data-ds="sidebar"></aside>
    <main data-ds="content"></main>
    <nav data-ds="toc"></nav>
  </div>
  <footer data-ds="footer"></footer>
</body>
```

**约束只有一条**：`data-ds` 锚点不变，其他都不保证。

## 主题机制

```
.aigne/doc-smith/theme.css    ← 唯一的主题文件
```

- 存在 → 自动引入
- 不存在 → 使用默认
- AI 只改这一个文件

**这是唯一的"主题系统"。**

## 关键决策

| 问题 | 决策 | 原因 |
|------|------|------|
| 渲染器职责？ | 极简 | 复杂度交给 AI |
| 构建脚本？ | 单文件 build.mjs | MVP 足够，膨胀后再拆 |
| HTML 标记？ | `data-ds` 属性 | 稳定锚点，不与内容冲突 |
| 主题机制？ | 单文件 theme.css | AI 直接改，无需主题系统 |
| 样式分层？ | docsmith.css + theme.css | 基础稳定，主题可改 |
| AI 职责？ | 只改 theme.css | 输出落点固定 |
| 部署方式？ | 用户自选 | 不限制托管平台 |

## 为什么这么设计

### AI-first

- AI 擅长：写 CSS
- AI 不擅长：理解复杂 schema
- 让 AI 改一个文件，比维护主题 DSL 稳定

### 程序复杂度最小

只有：MD 渲染 + HTML 拼装 + 资源复制

没有：主题系统 bug / 配置合并 / schema 演进

### 不会重蹈覆辙

- 没有运行时
- 没有服务
- 发布永远是：render → dist/ → 静态托管

### 不封顶

- 复杂主题？→ AI 写 CSS
- 完全重构布局？→ CSS grid/flex
- 改坏了？→ 删除 theme.css

## 范围

**包含**
- `/doc-smith-build` Skill
- 单文件 build.mjs 渲染器
- 内置 docsmith.css + 单文件 theme.css
- AI 创建/修改主题
- 多语言独立路径

**延后**
- 可选注入点（head.html + body-end.html）
- --preview 本地预览
- --static 静态发布

**不包含**
- 主题继承/扩展
- schema 校验
- 站内搜索

## 下一步

1. 创建 `/doc-smith-build` Skill
2. 实现单文件 build.mjs 渲染器
3. 设计 docsmith.css 基础样式
