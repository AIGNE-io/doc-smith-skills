# 项目自定义要求

## 项目概述

本项目用于维护和管理 Claude Code Skills，采用标准的 Claude Code Plugin 架构。

## 项目架构

```
doc-smith-skill/
├── skills/                    # Skills 目录（用户可直接调用）
│   ├── doc-smith/
│   │   └── SKILL.md          # /doc-smith 命令
│   ├── doc-smith-images/
│   │   └── SKILL.md          # /doc-smith-images 命令
│   └── {skill-name}/
│       └── SKILL.md
├── agents/                    # Sub-agents 目录（由 Skills 调用）
│   ├── doc-smith-content.md  # 文档内容生成子代理
│   ├── generate-slot-image.md # 图片生成子代理
│   └── {agent-name}.md
├── skills-entry/              # [已废弃] AIGNE 入口，仅作参考
├── utils/                     # [已废弃] 共享模块，仅作参考
└── CLAUDE.md
```

## 核心规则

1. **Skill 结构**
   - 每个 Skill 是 `skills/` 下的独立文件夹
   - 必须包含 `SKILL.md` 作为入口文件
   - 用户通过 `/{skill-name}` 调用

2. **Sub-agent 结构**
   - Sub-agent 放在 `agents/` 目录
   - 使用 Markdown 文件定义（`{agent-name}.md`）
   - 由 Skill 通过 Task 工具调用，不直接暴露给用户

3. **语言要求**
   - 所有提示词必须使用中文编写

4. **开发规范**
   - 创建或修改 Skill 时，使用 `/skill-creator` 获取指导
   - 提交 commit 时不要带 `Co-Authored-By` 信息
   - 每次修改后执行 `pnpm lint:fix`

5. **废弃代码处理**
   - `skills-entry/`、`utils/` 等 AIGNE 相关代码仅作参考
   - 不要修改这些目录中的文件
   - 未来会逐步删除

## Skill 文件结构

### SKILL.md 基本结构

```markdown
---
name: skill-name
description: 技能描述，用于触发匹配
---

# Skill 标题

简短说明。

## Usage

使用示例（命令行格式）。

## Options

参数说明表格。

## 工作流程

详细的执行步骤。

## 错误处理

常见错误和处理方式。
```

### Sub-agent 基本结构

```markdown
---
name: agent-name
description: 代理描述
tools: Read, Write, Bash, Glob, Task
model: inherit
---

# Agent 标题

## 输入参数

调用时需要提供的参数。

## 输出

返回的结果格式。

## 工作流程

执行步骤。

## 职责边界

必须执行和不应执行的操作。
```

## 调用关系

```
用户 → /doc-smith → SKILL.md
                      ↓
                   Task 工具调用 Sub-agent
                      ↓
              agents/doc-smith-content.md
              agents/generate-slot-image.md
```

**Skill 调用 Sub-agent 示例**：

```markdown
使用 generate-slot-image 子代理生成图片：
- docPath=/overview
- slotId=architecture
- slotDesc="系统架构图"
```

**并行调用多个 Sub-agent**：

```markdown
使用单独的 generate-slot-image 子代理并行生成以下图片：
- docPath=/overview, slotId=arch, slotDesc="架构图"
- docPath=/api, slotId=flow, slotDesc="流程图"
```

## 设计原则

### KISS 原则

- 优先选择最简方案
- 复杂度是设计不成熟的标志
- 如果需要大量边界处理，重新审视功能抽象

### 职责分离

- Skill：面向用户，处理输入解析和流程编排
- Sub-agent：面向任务，专注单一职责
- 每个组件只做一件事

### 输出设计

- 返回自然语言摘要，而非结构化数据
- 只返回必要信息，避免上下文膨胀
- 使用 `message` 字段返回执行结果描述

## 工作流程

### 创建新 Skill

1. 使用 `/skill-creator` 获取指导
2. 在 `skills/{skill-name}/` 创建 `SKILL.md`
3. 如需 Sub-agent，在 `agents/` 创建对应文件

### 创建新 Sub-agent

1. 在 `agents/` 创建 `{agent-name}.md`
2. 定义 frontmatter（name, description, tools, model）
3. 编写工作流程和职责边界
4. 在父 Skill 中通过 Task 工具调用

### 修改现有组件

1. 直接编辑对应的 `.md` 文件
2. 执行 `pnpm lint:fix`
3. 不要修改 `skills-entry/` 或 `utils/` 中的废弃代码
