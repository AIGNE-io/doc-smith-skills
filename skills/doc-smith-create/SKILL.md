---
name: doc-smith-create
description: "Generate and update structured documentation from project data sources. Supports initial generation and modifying existing documents. Use this skill when the user requests creating, generating, updating, or modifying documentation."
---

# DocSmith 文档生成

从工作区数据源生成和更新结构化文档。所有输出创建在 `.aigne/doc-smith/` workspace 中。

## 约束

以下约束在任何操作中都必须满足。

### 1. Workspace 约束

- 所有操作前 workspace 必须存在且有效（config.yaml + sources）
- workspace 有独立 git 仓库，所有 git 操作在 `.aigne/doc-smith/` 下执行
- workspace 不存在时按以下流程初始化：
  1. `mkdir -p .aigne/doc-smith/{intent,planning,docs,assets,cache}`
  2. `cd .aigne/doc-smith && git init`
  3. 创建 config.yaml（schema 见下方）
  4. 初始 commit

**config.yaml schema**：

```yaml
workspaceVersion: "1.0"
createdAt: "2025-01-13T10:00:00Z"  # ISO 8601
projectName: "my-project"
projectDesc: "项目描述"
locale: "zh"                        # 输出语言代码，初始化时必须向用户确认
projectLogo: ""
translateLanguages: []
sources:
  - type: local-path
    path: "../../"                  # 相对于 workspace
    url: ""                         # 可选: git remote URL
    branch: ""                      # 可选: 当前分支
    commit: ""                      # 可选: 当前 commit
```

**locale 确认规则**：初始化 workspace 时，若用户未明确指定语言，必须用 AskUserQuestion 确认输出语言（如 zh、en、ja），不得默认写入。

### 2. 结构约束

- `document-structure.yaml` 必须符合下方 schema
- 结构变更后必须通过 `/doc-smith-check --structure`
- 结构变更后必须重建 nav.js：`node skills/doc-smith-build/scripts/build.mjs --nav --workspace .aigne/doc-smith --output .aigne/doc-smith/dist`

**document-structure.yaml schema**：

```yaml
project:
  title: "项目名称"
  description: "项目概述"
documents:
  - title: "文档标题"
    description: "简要摘要"
    path: "/filename"               # 必须以 / 开头
    sourcePaths: ["src/main.py"]    # 源文件路径（无 workspace: 前缀）
    icon: "lucide:book-open"        # 仅顶层文档必需
    children:                       # 可选：嵌套文档
      - title: "子文档"
        description: "详细信息"
        path: "/section/nested"
        sourcePaths: ["src/utils.py"]
```

### 3. 内容约束

- 每篇文档必须有 `docs/{path}/.meta.yaml`（kind: doc, source, default）
- HTML 必须生成在 `dist/{lang}/docs/{path}.html`
- `docs/` 目录中不得残留 `.md` 文件（构建后删除）
- 所有内部链接必须可达，使用文档 path 格式
- 所有 AFS Image Slot 必须被替换
- 资源引用使用 `/assets/xxx` 绝对路径格式（build.mjs 自动转换为相对路径）

### 4. 人类确认约束

- 用户意图推断后必须经用户确认（使用 AskUserQuestion）
- 文档结构规划后必须经用户确认（使用 AskUserQuestion）
- 确认后若有变更需再次确认

### 5. 上下文管理约束

**主 agent 禁止预读源文件**。源文件由 Task subagent 根据 sourcePaths 自行读取。主 agent 只读取：
- `config.yaml`、`document-structure.yaml`、`user-intent.md`（workspace 元数据）
- 项目的 README（用于推断意图，≤1 次 Read）

**严禁**：主 agent 逐个读取 sourcePaths 中的源代码文件。这会快速耗尽上下文，导致 Task 结果返回后无法继续。

### 6. Task 分发约束

- 内容生成通过 Task(references/content.md) 分发，每篇文档一个 Task
- 图片生成通过 Task(references/generate-slot-image.md) 分发
- 文档数量 ≤ 5 时并行执行，> 5 时分批（每批 ≤ 5 个），前一批完成后再启动下一批
- 内容生成前先执行媒体资源扫描：`Glob: **/*.{png,jpg,jpeg,gif,svg,mp4,webp}`（排除 .aigne/ 和 node_modules/），将结果作为 mediaFiles 传递给每个 Task
- Task 返回的摘要应尽量简短（路径、状态、slot 列表），避免返回文档内容

### 7. 完成约束

- `/doc-smith-check --structure` 通过
- `/doc-smith-check --content` 通过
- `/doc-smith-check --content --check-slots` 通过
- `dist/` 目录包含所有文档的 HTML
- `nav.js` 包含所有文档条目
- 自动 git commit（在 `.aigne/doc-smith/` 目录下）

## 统一入口

| 场景 | 判断条件 | 行为 |
|------|---------|------|
| 首次生成 | `docs/` 不存在或用户明确要求 | 完整流程：意图 → 结构 → 生成 |
| 修改已有文档 | `docs/` 已存在 | AI 理解修改请求，直接修改，满足约束即可 |

修改场景不需要 changeset/PATCH 机制。用户用自然语言描述修改需求，AI 执行并满足约束。

## 用户意图

文件：`.aigne/doc-smith/intent/user-intent.md`

基于项目 README 和目录结构（`ls`/`Glob`）推断目标用户、使用场景、文档侧重点。不读取源代码文件。生成后用 AskUserQuestion 确认。

```markdown
# 用户意图

## 目标用户
[主要受众是谁]

## 使用场景
- [场景 1]
- [场景 2]

## 文档侧重点
本文档采用**[文档类型]**的形式：
- [侧重点 1]
- [侧重点 2]
```

## 结构规划原则

- 规划必须依据用户意图，只规划明确需要的文档
- 扁平优于嵌套，有疑虑时选择更简单的结构
- 拆分条件：4+ 章节、内容独立、无重复、可独立查阅
- 不拆分：内容单薄、顺序步骤、存在重复
- 结构规划后用 AskUserQuestion 确认，展示文档总数、层次、每个文档的标题和描述

## 内容组织原则

- 导航链接只能链接已生成的文档（使用 path 格式），不链接工作目录文件
- 文档开头：前置条件、父主题
- 文档结尾：相关主题、下一步、子文档
- 有子文档的概览文档：简写（150-300 行），每个子主题 2-4 段 + 引导链接
- 无子文档的详细文档：详写（300-500 行），完整展开

## 关键流程

### 生成 nav.js（结构确认后、内容生成前）

```bash
node skills/doc-smith-build/scripts/build.mjs \
  --nav --workspace .aigne/doc-smith --output .aigne/doc-smith/dist
```

### 并行生成文档内容

```
按 references/content.md 流程使用单独的 Task tool 并行生成以下文档（mediaFiles 见扫描结果）：
- /overview, mediaFiles=[...]
- /api/authentication, mediaFiles=[...]
```

### 并行生成图片

```
按 references/generate-slot-image.md 流程使用单独的 Task tool 并行生成以下图片：
- docPath=/overview, slotId=architecture-overview, slotDesc="系统架构图"
```

### 自动提交

```bash
cd .aigne/doc-smith && git add . && git commit -m "docsmith: xxx"
```

## Workspace 目录结构

```
.aigne/doc-smith/
├── config.yaml
├── intent/user-intent.md
├── planning/document-structure.yaml
├── docs/{path}/.meta.yaml
├── dist/
│   ├── index.html
│   ├── {lang}/docs/{path}.html
│   └── assets/nav.js, docsmith.css, theme.css
├── assets/{key}/.meta.yaml, images/{lang}.png
├── glossary.yaml                  # 可选
└── cache/translation-cache.yaml   # 发布用
```
