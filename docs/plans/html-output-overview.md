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
/doc-smith-publish --preview   # 本地预览
/doc-smith-publish --static    # 静态托管
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

## 可选注入点

```
head.html       → 字体、analytics
body-end.html   → highlight.js、mermaid
```

有就拼，没有就跳过。

## 关键决策

| 问题 | 决策 | 原因 |
|------|------|------|
| 渲染器职责？ | 极简 | 复杂度交给 AI |
| HTML 标记？ | `data-ds` 属性 | 稳定锚点，不与内容冲突 |
| 主题机制？ | 单文件 theme.css | AI 直接改，无需主题系统 |
| 样式分层？ | docsmith.css + theme.css | 基础稳定，主题可改 |
| AI 职责？ | 只改 theme.css | 输出落点固定 |
| 扩展？ | 可选注入点 | 不需要就不加载 |

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
- 极简渲染器
- 内置 docsmith.css + 单文件 theme.css
- AI 生成/迭代主题
- 可选注入点
- 多语言、本地预览、静态发布

**不包含**
- 主题继承/扩展
- schema 校验
- 站内搜索

## 下一步

1. 创建 `/doc-smith-build` Skill
2. 实现极简渲染器
3. 设计 docsmith.css 基础样式
4. 添加 --preview 和 --static
