---
name: doc-smith
description: "从工作区数据源生成和更新全面的文档，包括代码仓库、文本文件和媒体资源。当用户请求以下操作时使用此技能：(1) 从代码或文件创建或生成文档，(2) 构建文档结构或文档详情，(3) 更新、修改或改进已有文档，(4) 重写文档的特定章节或段落，(5) 处理 changeset 文件或 PATCH 标记的修改请求。支持技术文档、用户指南、API 参考和一般文档需求的生成与维护。"
---

# DocSmith

从工作区数据源生成和更新结构化文档。

## 概述

DocSmith 分析数据源内容（代码、文件、媒体）并生成：
1. 用户意图描述（`user-intent.md`）
2. 文档结构计划（`document-structure.yaml`）
3. 按层次组织的 Markdown 文档文件

所有输出都创建在独立的 workspace 目录中。

## 使用场景

### 场景 A：生成新文档

当 `docs/` 目录不存在或用户明确要求重新生成时，使用 **文档生成流程**（步骤 1-6）。

**适用情况：**
- 首次为项目生成文档
- 完全重建文档结构
- 用户说"重新生成所有文档"

### 场景 B：更新已有文档

当 `docs/` 目录已存在且用户要求修改时，使用 **文档更新流程**（步骤 7）。

**适用情况：**
- 用户提出自然语言修改请求（如"统一术语"、"补充章节"、"修正错误"）
- 用户提供 changeset 文件路径
- 文档中存在 `:::PATCH` 标记
- 用户说"更新文档"、"修改文档"、"应用修改"

## 工作流程

按以下步骤依次执行：

### 0. Workspace 检测与初始化

**执行任何操作前，首先检测并初始化 workspace。**

**详细流程参考**: `references/workspace-initialization.md`

### 1. 分析工作区

使用 Glob/Grep/Read 工具探索工作区，了解项目目的、结构、主要模块、现有文档和媒体资源。

### 2. 推断用户意图

首先检查用户意图文件是否已存在，如果存在向用户问询是否需要修改。
用户意图格式**必须**参考： `references/user-intent-guide.md`

### 3. 规划文档结构

首先检查文档结构文件是否已存在，如果存在执行第 5 步骤 ，向用户问询是否需要修改。
文档结构规划要求**必须**参考： `references/structure-planning-guide.md`

### 4. 生成 document-structure.yaml

文档结构数据结构**必须**参考： `references/document-structure-schema.md`

### 5. 确认文档结构

向用户展示的结构**必须**参考： `references/structure-confirmation-guide.md`

### 6. 生成文档内容

为结构中的每个文档在 `docs/` 目录中创建 markdown 文件。
文档内容生成要求**必须**参考：`references/document-content-guide.md`

**完成后询问用户是否提交到 Git**:

文档已生成完成。

询问用户: 是否提交到 Git?

如果用户选择 Yes:
```bash
git add config.yaml intent/ planning/ docs/
git commit -m "docsmith: generate v1 (lang=<语言>)"
```

如果用户选择 No:
提示: "跳过提交，可稍后手动执行: git add . && git commit"

### 7. 更新已有文档

仅当 `docs/` 目录已存在时处理文档更新。

**更新流程参考：**
- 整体流程与输入识别：`references/update-workflow.md`
- Changeset 文件处理：`references/changeset-guide.md`
- PATCH 标记处理 (每次文档更新都需要检查文档中是否有 PATCH 需要处理)：`references/patch-guide.md`
- 文档内容要求：`references/document-content-guide.md`

如果涉及文档结构的修改，需要参考以下信息：
- 文档结构数据结构参考： `references/document-structure-schema.md`
- 向用户展示的结构请参考： `references/structure-confirmation-guide.md`

**完成后询问用户是否提交到 Git**:

文档已更新完成。

询问用户: 是否提交到 Git?

如果用户选择 Yes:
```bash
git add planning/ docs/
git commit -m "docsmith: update documentation"
```

如果用户选择 No:
提示: "跳过提交，可稍后手动执行: git add . && git commit"

## Workspace 目录结构

完成后：

```
workspace/                         # 独立 workspace 目录
├── config.yaml                    # workspace 配置文件
├── sources/                       # 源仓库 (git submodule)
│   └── my-project/
├── intent/
│   └── user-intent.md             # 用户意图描述
├── planning/
│   └── document-structure.yaml    # 文档结构计划
├── docs/                          # 生成的文档
│   ├── overview.md
│   ├── getting-started.md
│   └── api/
│       └── authentication.md
└── cache/                         # 临时数据 (不纳入 git)
```

## 关键原则

- **Workspace 优先**：执行任何操作前必须先检测和初始化 workspace
- **参考引用文件**：执行到每个步骤时，如果提供了参考文件，必须先阅读参考文件中的要求
- **文档内容要求**：执行任何文档相关的生成、更新，都需要参考`references/document-content-guide.md`，确保文档符合要求
- **基于用户意图**：所有规划和生成都应参考 `intent/user-intent.md`
- **最小必要原则**：只生成用户意图中明确需要的文档
- **批量执行**：生成文档内容时优先批量执行，缩短执行时间
- **Git 版本管理**：生成/更新完成后询问用户是否提交到 Git
