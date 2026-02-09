# DocSmith HTML 文档迁移：从 Discuss Kit 到 MyVibe 静态托管

> 在现有 Markdown 生成流程上集成 HTML 构建，发布到 MyVibe 或 DocSmith 站点，替换 Discuss Kit。

## 为什么？

Discuss Kit 太重。我们需要纯静态 HTML 文档，托管到 MyVibe，导航可配置，版本可回退。

## 核心体验

```
/doc-smith-create
        ↓
AI 生成 Markdown（中间产物，token 消耗低、输出稳定）
        ↓
build.mjs 构建 HTML（核心逻辑复用，需适配）
├── MD → HTML（markdown-it）
├── 套 data-ds 骨架
├── 注入导航 + TOC
├── 拼接 docsmith.css + theme.css
└── 清理中间 .md 文件（新增）
        ↓
dist/
├── zh/docs/*.html
├── en/docs/*.html
└── assets/
    ├── docsmith.css       # 内置（稳定）
    └── theme.css          # AI 生成（可改）
        ↓
/myvibe-publish 或 /doc-smith-publish → 发布到 MyVibe 或 DocSmith 站点 → 线上可访问
        ↓
Blocklet 后台配置导航入口 → 站点接入完成
```

## 架构

```
┌──────────────────────────────────────────────────┐
│  doc-smith-create（改造）                           │
│  数据源 → 结构规划 → AI 生成 Markdown（中间产物）    │
│  ↓                                                 │
│  .aigne/doc-smith/docs/**/*.md（临时）              │
└────────────────────┬─────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│  build.mjs（874 行，核心复用，需适配）               │
│  MD → HTML + 骨架 + 导航 + TOC + 资源 + 清理 MD   │
│  ↓                                                 │
│  .aigne/doc-smith/dist/（最终产物，只有 HTML）       │
└────────────────────┬─────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│  发布（两种目标）                                   │
│  A: /myvibe-publish → MyVibe（版本化托管）          │
│  B: /doc-smith-publish → DocSmith 站点             │
│     （精简版 MyVibe：复用静态托管，无前端页面）        │
└──────────────────────────────────────────────────┘
```

## 关键决策

| 问题 | 决策 | 原因 |
|------|------|------|
| AI 输出什么？ | Markdown（中间产物） | token 消耗低、输出稳定，生成后转为 HTML |
| MD→HTML 谁做？ | build.mjs（适配） | 核心逻辑复用，适配新流程 |
| 托管在哪？ | MyVibe 或 DocSmith 站点 | DocSmith 站点 = 精简版 MyVibe |
| 怎么发布？ | `/myvibe-publish` 或 `/doc-smith-publish` | 都通过 Skill 发布 |
| 导航怎么接？ | Blocklet 后台配置 | 不改代码 |
| 版本管理？ | Git + 托管平台 | 不自己实现 |
| 主题一致？ | AI 修改 theme.css | 单文件主题，随时可调 |
| 生图怎么做？ | 直接调 AIGNE Hub API | AIGNE CLI 不再维护，自行处理授权 |

## 改动范围

| 文件 | 动作 | 说明 |
|------|------|------|
| `agents/doc-smith-content.md` | **改造** | 先生成 MD（中间产物），再转为 HTML |
| `skills/doc-smith-build/scripts/build.mjs` | **适配** | 适配新流程，构建后清理 .md |
| `skills/doc-smith-create/SKILL.md` | **改造** | 集成构建步骤 + 支持两种发布目标 |
| `doc-smith-publish` | **改造** | 支持发布到 DocSmith 站点 |
| MyVibe | **精简改造** | 抽取静态托管能力，支持无 UI 发布 |
| `skills/doc-smith-images/` | **改造** | 去掉 AIGNE CLI，直接调 AIGNE Hub API |
| `agents/generate-slot-image.md` | **适配** | 适配新生图接口，更新错误处理 |
| `skills/doc-smith-build/assets/docsmith.css` | 不变 | 直接复用 |
| `doc-smith-publish` | 不改 | 用 `/myvibe-publish` 替代 |

## 范围

**包含**
- doc-smith-content 改造：先生成 MD（中间产物），再转为 HTML
- build.mjs 适配：适配新流程，构建后清理 .md
- doc-smith-create 改造：集成构建步骤 + 支持两种发布目标
- doc-smith-publish 改造：支持发布到 DocSmith 站点
- MyVibe 精简改造：抽取静态托管能力，无 UI 发布
- doc-smith-images 改造：去掉 AIGNE CLI，直接调 AIGNE Hub API
- 简单前端搜索（标题级别）

**不包含**
- 全文搜索
- 主题继承/扩展系统
- 自建版本管理

## 风险 + 缓解

| 风险 | 缓解 |
|------|------|
| AI 生成 Markdown 质量波动 | 首轮不追求完美，MyVibe 版本回退 |
| 主站风格不一致 | theme.css 随时可调，不阻塞发布 |
| build.mjs 构建失败 | 已验证可用，确定性步骤 |

**回滚**：MyVibe 版本回退 + Blocklet 改回导航入口，两步完成。

## 执行步骤

1. ~~验证前置条件（MyVibe 发布 + 导航配置 + build.mjs）~~ ✅ 已完成
2. 改造组件：doc-smith-content + build.mjs + doc-smith-create + doc-smith-images + doc-smith-publish + MyVibe
3. 端到端验证：生成 MD → 构建 HTML → 发布 MyVibe → 访问
4. 简单搜索 + 旧文档切换
