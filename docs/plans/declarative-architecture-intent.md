# DocSmith Skills 架构优化 Specification

::: locked {reason="核心架构定位与优化方向"}
## 1. Overview

### 定位
DocSmith 是一组 Claude Code Skills，形成完整的文档生命周期管线：**创建 → 构建 → 校验 → 翻译 → 发布**。AI Agent 作为执行者，人类作为意图定义者和结构审核者。

### 核心理念
**Intent → Structure → Projection 三层分离**

| 层 | 是什么 | 谁拥有 | DocSmith 中的体现 |
|----|-------|--------|------------------|
| Intent | 用户意图、文档目标 | 人类 | user-intent.md |
| Structure | 文档的语义骨架 | 人类设计，AI 参与 | document-structure.yaml |
| Projection | 最终输出形态 | AI 生成，人类审核 | dist/ HTML |

### 优化目标
将 DocSmith 从**过程式步骤清单**转变为**声明式约束定义**，让 AI 理解目标和边界后自主执行，而不是逐步指挥 AI 点击。

### 优化范围

| Skill | 状态 | 说明 |
|-------|------|------|
| doc-smith-create | 重写 | 声明式约束 + 合并 reference 文件 |
| doc-smith-build | 重写 | 路径抽象 + 风格统一 |
| doc-smith-check | 重写 | 风格统一 |
| doc-smith-localize | 重写 | 移除 task_plan.md + 风格统一 |
| doc-smith-images | 轻改 | 仅风格统一，保留 AIGNE CLI |
| doc-smith-clear | 轻改 | 仅风格统一 |
| doc-smith-publish | 不动 | 刻意设计为脚本调用，未来可能废弃 |
:::

---

::: reviewed {by=lban date=2026-02-11}
## 2. Architecture

### 2.1 Skill 间调用关系（不变）

```
用户 → /doc-smith-create
         ├─→ Task(content.md) × N 篇文档（并行）
         ├─→ Task(generate-slot-image.md) × N 张图片（并行）
         ├─→ doc-smith-build --nav（一次）
         ├─→ doc-smith-build --doc（per-doc，由 content.md 内部调用）
         └─→ doc-smith-check（校验）

用户 → /doc-smith-localize
         ├─→ Task(translate-document.md) × N（并行，每批最多 5 个）
         ├─→ doc-smith-images --update × N（图片翻译）
         ├─→ doc-smith-build --nav（重建语言列表）
         └─→ doc-smith-check（校验）

用户 → /doc-smith-publish
         └─→ node scripts/publish-docs.mjs（脚本调用，不改）
```

### 2.3 Reference 文件精简

**Before**：11 个 reference 文件 + 1 个 translate reference

```
references/
├── changeset-guide.md              ← 删除
├── content.md                      ← 保留（Task agent）
├── document-content-guide.md       ← 合并入 SKILL.md
├── document-structure-schema.md    ← 合并入 SKILL.md
├── generate-slot-image.md          ← 保留（Task agent）
├── patch-guide.md                  ← 删除
├── structure-confirmation-guide.md ← 合并入 SKILL.md
├── structure-planning-guide.md     ← 合并入 SKILL.md
├── update-workflow.md              ← 删除
├── user-intent-guide.md            ← 合并入 SKILL.md
└── workspace-initialization.md     ← 合并入 SKILL.md
```

**After**：3 个 Task agent 文件

```
doc-smith-create/
├── SKILL.md                        ← 包含所有约束和内联指南
└── references/
    ├── content.md                  ← Task agent：单篇文档内容生成
    └── generate-slot-image.md      ← Task agent：图片生成

doc-smith-localize/
├── SKILL.md
└── references/
    └── translate-document.md       ← Task agent：单篇文档翻译
```

**保留原则**：只有需要通过 Task tool 并行分发的 agent 才保留为独立文件。其余指南类内容全部内联到 SKILL.md 中（作为约束声明的一部分）。

### 2.4 路径抽象

**Before**：AI 需要根据文档深度计算 `../../` 层级

```markdown
![img](../../assets/logo.png)        <!-- /overview 文档 -->
![img](../../../assets/logo.png)     <!-- /api/auth 文档 -->
```

**After**：文档中统一使用 `/assets/` 绝对路径

```markdown
![img](/assets/logo.png)
```

构建脚本（build.mjs --doc）负责将 `/assets/` 转换为 HTML 输出中的正确相对路径。AI 永远不需要计算路径层级。

**实现要点**：
- MD 文件中所有资源引用使用 `/assets/xxx` 格式
- build.mjs 在 MD → HTML 转换时，根据文档 path 深度计算并替换为正确的相对路径
- 已有的 AFS Image Slot 生成的图片同样遵循此规则
- HTML 中的最终路径仍然是相对路径（保证 file:// 协议可用）

### 2.5 状态管理

**Before**：task_plan.md（markdown checkbox，文件编辑驱动流程）

**After**：Claude Code 原生 TaskCreate / TaskUpdate / TaskList

- 移除 `.aigne/doc-smith/cache/task_plan.md`
- 移除 `.aigne/doc-smith/cache/translate_task_plan.md`
- SKILL.md 中不再指导 AI 如何管理任务状态
- AI 使用自身的 TaskCreate/TaskUpdate 能力追踪进度
:::

---

::: locked {reason="核心约束定义，整个重写的基础"}
## 3. doc-smith-create 声明式重写

### 3.1 核心约束（Constraints）

以下约束必须在 SKILL.md 中声明，AI 在任何操作中都必须满足：

```
1. Workspace 约束
   - 所有操作前 workspace 必须存在且有效（config.yaml + sources）
   - workspace 有独立 git 仓库，所有 git 操作在 .aigne/doc-smith/ 下执行
   - 数据源通过 config.yaml 的 sources 配置访问

2. 结构约束
   - document-structure.yaml 必须符合 schema（内联到 SKILL.md）
   - 结构变更后必须通过 /doc-smith-check --structure 校验
   - 结构变更后必须重建 nav.js（build.mjs --nav）

3. 内容约束
   - 每篇文档必须有 docs/{path}/.meta.yaml
   - HTML 必须生成在 dist/{lang}/docs/{path}.html
   - docs/ 目录中不得残留 .md 文件（构建后删除）
   - 所有内部链接必须可达
   - 所有 AFS Image Slot 必须被替换
   - 资源引用使用 /assets/ 绝对路径格式

4. 人类确认约束
   - 用户意图推断后必须经用户确认
   - 文档结构规划后必须经用户确认
   - 确认后变更需要再次确认

5. Task 分发约束
   - 内容生成通过 Task(references/content.md) 分发，每篇文档一个 Task
   - 图片生成通过 Task(references/generate-slot-image.md) 分发
   - 优先并行执行以缩短时间

6. 完成约束
   - /doc-smith-check --structure 通过
   - /doc-smith-check --content 通过
   - /doc-smith-check --content --check-slots 通过
   - dist/ 目录包含所有文档的 HTML
   - nav.js 包含所有文档条目
   - 自动 git commit
```

### 3.2 统一入口（生成 + 修改）

doc-smith-create 同时处理两种场景：

| 场景 | 判断条件 | 行为 |
|------|---------|------|
| 首次生成 | docs/ 不存在或用户明确要求重新生成 | 完整流程：意图 → 结构 → 生成 |
| 修改已有文档 | docs/ 已存在 | AI 理解修改请求，直接修改，满足约束即可 |

**修改场景不再需要 changeset / PATCH 机制。** 用户直接用自然语言描述修改需求，AI 理解后执行，修改结果必须满足上述约束。

### 3.4 需要内联到 SKILL.md 的内容

以下 reference 文件的**关键信息**需要精简后内联：

| 原 reference 文件 | 内联为 | 保留什么 |
|-------------------|--------|---------|
| workspace-initialization.md | Workspace 约束段落 | config.yaml schema、sources 配置规则 |
| user-intent-guide.md | 意图确认段落 | user-intent.md 的格式模板 |
| structure-planning-guide.md | 结构规划段落 | 拆分/合并原则、层级规则 |
| structure-confirmation-guide.md | 结构确认段落 | 展示格式 |
| document-structure-schema.md | 结构 schema 段落 | YAML schema 定义 |
| document-content-guide.md | 内容约束段落 | 导航链接规则、内容组织原则 |

**精简原则**：只保留约束和规则，删除冗余的解释文字。目标是将 SKILL.md 控制在 200 行以内（约束定义天然比步骤清单更短）。
:::

---

::: reviewed {by=lban date=2026-02-11}
## 4. doc-smith-localize 优化

### 4.1 变更

| 项目 | Before | After |
|------|--------|-------|
| 状态管理 | translate_task_plan.md | TaskCreate/TaskUpdate |
| 风格 | 过程式步骤 | 声明式约束 + 关键步骤 |
| 核心逻辑 | 不变 | 不变 |

### 4.2 约束声明

```
1. 翻译直接在 HTML 层面完成，不走 MD 中间步骤
2. sourceHash 比对避免重复翻译（除非 --force）
3. 翻译后必须更新 config.yaml 的 translateLanguages
4. 翻译后必须重建 nav.js（语言切换生效的关键）
5. 图片翻译检查 .meta.yaml 的 shared 标记
6. 翻译后的 HTML 中图片路径必须指向对应语言版本
7. 每批最多 5 个 Task 并行
```
:::

---

::: reviewed {by=lban date=2026-02-11}
## 5. doc-smith-build 优化

### 5.1 路径抽象契约

- **输入**：MD 中的 `/assets/xxx` 绝对路径
- **输出**：HTML 中根据文档 path 深度计算的正确相对路径（保证 file:// 可用）

### 5.2 其他变更

- SKILL.md 风格统一为声明式
- 核心逻辑（--nav / --doc 双模式）不变
- 客户端 nav.js 渲染架构不变
:::

---

::: reviewed {by=lban date=2026-02-11}
## 6. doc-smith-check 优化

- SKILL.md 风格统一
- 校验逻辑不变（结构 + 内容 + slots）
- 新增：校验路径格式（确保文档中使用 /assets/ 而非 ../../）
:::

---

::: reviewed {by=lban date=2026-02-11}
## 7. doc-smith-images / doc-smith-clear

- 仅 SKILL.md 风格统一
- images 保留 AIGNE CLI 依赖
- clear 逻辑不变
:::

---

::: reviewed {by=lban date=2026-02-11}
## 8. Workspace 目录结构（优化后）

```
.aigne/doc-smith/                   # DocSmith workspace
├── config.yaml                     # workspace 配置
├── intent/
│   └── user-intent.md              # 用户意图（人类确认后锁定）
├── planning/
│   └── document-structure.yaml     # 文档结构（人类确认后锁定）
├── docs/                           # 文档元信息
│   └── {path}/
│       └── .meta.yaml              # kind/source/default/languages/translations
├── dist/                           # 构建输出（HTML 站点）
│   ├── index.html
│   ├── {lang}/
│   │   ├── index.html
│   │   └── docs/{path}.html
│   └── assets/
│       ├── nav.js
│       ├── docsmith.css
│       └── theme.css
├── assets/                         # 生成的图片
│   └── {key}/
│       ├── .meta.yaml
│       └── images/{lang}.png
├── glossary.yaml                   # 术语表（可选）
└── cache/                          # 缓存数据
    └── translation-cache.yaml      # 发布用的 meta 翻译缓存
```

**变更**：
- 移除 `cache/task_plan.md`
- 移除 `cache/translate_task_plan.md`
- 其他结构不变
:::

---

::: reviewed {by=lban date=2026-02-11}
## 9. Decisions Summary

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| 1 | 重构程度 | 声明式重写 | 过程式步骤清单不适合 AI 协作，约束定义让 AI 自主执行 |
| 2 | 状态管理 | 迁移到 TaskCreate | 不重新发明轮子，使用 Claude Code 原生工具 |
| 3 | Reference 文件 | 11 → 3 | 只有 Task agent 需要独立文件，指南类内容内联到 SKILL.md |
| 4 | 路径抽象 | /assets/ 绝对路径 + 构建转换 | AI 不应该做确定性的路径层级计算 |
| 5 | 用户确认 | 保留意图 + 结构两个确认点 | 必要的人类监督，是声明式约束的一部分 |
| 6 | 更新流程 | 删除 changeset/PATCH | 自然对话 + 约束验证更符合 AI 协作模式 |
| 7 | 入口统一 | create 同时处理生成和修改 | AI 根据 workspace 状态自主判断 |
| 8 | Publish | 不动 | 刻意设计为脚本调用，未来可能废弃 |
| 9 | Images | 保持现状 | AIGNE CLI 依赖保留，仅风格统一 |
:::

---

::: reviewed {by=lban date=2026-02-11}
## 10. 实施依赖与风险

### 关键依赖

build.mjs 路径抽象是其他所有变更的前置依赖。create/localize/check 的路径相关约束都依赖它先完成。

### 风险

| 风险 | 缓解 |
|------|------|
| 声明式 SKILL.md 让 AI 跳过关键步骤 | doc-smith-check 硬性校验兜底 |
| 路径抽象引入构建 bug | doc-smith-check --content 校验路径 |
| Reference 合并后 SKILL.md 过长 | 严格精简，只保留约束规则 |
| TaskCreate 不如 task_plan.md 持久 | workspace 文件状态（.meta.yaml、HTML）是真正的持久状态 |
:::
