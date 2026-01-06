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
- 文档中存在 `::: PATCH` 标记
- 用户说"更新文档"、"修改文档"、"应用修改"

## 工作流程

按以下步骤依次执行：

### 0. Workspace 检测与初始化

**执行任何操作前，首先检测并初始化 workspace。**

**详细流程参考**: `references/workspace-initialization.md`

### 1. 分析数据源

使用 Glob/Grep/Read 工具探索`sources`目录下的数据源，了解项目目的、结构、主要模块、现有文档和媒体资源。

### 2. 推断用户意图

首先检查用户意图文件是否已存在，如果存在向用户问询是否需要修改。
用户意图格式**必须**参考： `references/user-intent-guide.md`

### 3. 规划文档结构

首先检查文档结构文件是否已存在，如果存在执行第 5 步骤 ，向用户问询是否需要修改。
文档结构规划要求**必须**参考： `references/structure-planning-guide.md`

### 4. 生成 document-structure.yaml

4.1 **生成 YAML 文件**

文档结构数据结构**必须**参考： `references/document-structure-schema.md`

生成文件到: `planning/document-structure.yaml`

4.2 **立即执行程序化校验**

生成 YAML 后，必须立即调用校验工具进行检查：

**调用方式**：使用 `checkStructure` 工具（自动检查 `planning/document-structure.yaml` 并修复错误）

**校验结果处理**:

- ✅ **成功（valid: true）**: 继续执行步骤 5

- ❌ **失败（valid: false）**:
  1. 分析错误报告（errors 字段），理解哪些字段或格式不正确
  2. 阅读 `references/document-structure-schema.md`
  4. 修复错误或重新生成 `planning/document-structure.yaml`
  5. 重新调用 `checkStructure`
  6. 如果连续 3 次失败，向用户报告错误并询问如何处理

**重要提醒**:
- 不要跳过校验步骤
- 当工具返回 `fixed: true` 时，**必须**重新读取文件以获取最新内容
- 校验失败时必须采取行动（修复或重新生成），不能忽略错误

### 5. 确认文档结构

5.1: 向用户展示的结构**必须**参考： `references/structure-confirmation-guide.md`
5.2: 确认文档结构符合指定的数据结构，参考：`references/document-structure-schema.md`
5.3: 如果用户提出修改意见，修改之后需要再次使用 `checkStructure`工具检查更新后的文档结构。

### 6. 生成文档内容

为文档结构中的每个文档生成内容并保存到 `docs/` 目录。

**重要提示**：
- **新增文档时，必须使用 `saveDocument` 工具**，不要手动创建文件夹和文件
- **编辑已有文档时，直接使用 Edit 工具**修改对应的语言文件（如 `docs/overview/zh.md`）

**详细步骤和要求**: 参考 `references/document-content-guide.md`

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

### 8. 结束前确认任务都已完成

8.1 **重新执行文档结构校验**

在结束前，必须再次校验文档结构文件的完整性：

**调用方式**：使用 `checkStructure` 工具

如果校验失败，按照步骤 4.2 的错误处理流程处理。

8.2 **执行文档内容检查**

在结束前，必须执行文档内容检查：

**调用方式**：使用 `checkContent` 工具

- ✅ **成功（valid: true）**: 继续后续流程

- ❌ **失败（valid: false）**:
  1. 分析错误报告，理解问题所在
  2. 根据错误类型采取行动：
     - 文档缺失：生成缺失的文档
     - 链接错误：修正链接路径
     - 图片问题：提供图片或修正路径
     - 空文档：补充内容
  3. 修复后重新调用 `checkContent`
  4. 如果连续 3 次失败，向用户报告错误并询问如何处理

**重要提醒**:
- 不要跳过内容检查步骤
- 检查失败时必须采取行动（修复或重新生成），不能忽略错误

8.3 **核对完成清单**

- [ ] 文档结构校验通过
- [ ] 文档内容检查通过
- [ ] 确认所有生成的文档所在文件夹路径与 `document-structure.yaml` 中的 path 字段一致，并存在 .meta.yaml 文件和主语言文件
- [ ] 确认文档内部链接都有效
- [ ] 确认图片路径正确且文件存在

**文档更新的场景**：
- [ ] 用户要求的变更都已处理
- [ ] 文档中的 `::: PATCH` 标记都已处理
- [ ] 如果修改了文档结构，重新执行 YAML 校验
- [ ] 如果修改了文档内容，重新执行内容检查

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

## Workspace 目录结构参考

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
│   ├── overview/
│   │   ├── .meta.yaml             # 元信息 (kind/source/default)
│   │   └── zh.md                  # 语言版本文件
│   ├── getting-started/
│   │   ├── .meta.yaml
│   │   └── zh.md
│   └── api/
│       └── authentication/
│           ├── .meta.yaml
│           └── zh.md
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
