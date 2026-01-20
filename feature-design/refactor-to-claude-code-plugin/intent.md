# 重构为 Claude Code Plugin 结构

## 功能概述

将当前基于 AIGNE 框架的 doc-smith-skill 项目重构为标准的 Claude Code Plugin 结构，通过多个独立的 Skills 提供文档生成、翻译、图片生成、发布等功能。

## 功能意图

### 为什么需要重构

1. **降低使用门槛**：当前需要用户了解 AIGNE 框架，重构后用户只需使用 Claude Code 的 `/skill-name` 命令
2. **更好的集成体验**：Claude Code 原生支持 Skills，用户可以在对话中自然地调用功能
3. **灵活的功能组合**：拆分为多个独立 Skills 后，用户可以按需使用特定功能
4. **保留核心能力**：复杂的 AI 工作流（如翻译、图片生成）继续使用 AIGNE 框架执行

### 核心思路

采用**混合模式**：
- **简单功能**：重写为纯 JS 实现的 Claude Code Skill
- **复杂功能**：保留 AIGNE agents，通过 Skills 调用 `aigne run` 命令执行

## 工作流程

### 用户视角

```
用户 --> Claude Code --> /doc-smith-xxx Skill --> AIGNE Agent (如需要)
                              |
                              v
                         直接执行或 bash: aigne run . agent-name
```

### 功能调用路径

| Skill | 执行方式 | 说明 |
|-------|---------|------|
| `/doc-smith` | `aigne run . doc-smith` | 主文档生成流程 |
| `/doc-smith-translate` | `aigne run . localize` | 批量翻译文档 |
| `/doc-smith-images` | `aigne run . generateImages` | 生成/更新图片 |
| `/doc-smith-publish` | `aigne run . publish` | 发布文档 |
| `/doc-smith-check` | 纯 JS | 检查结构和内容 |
| `/doc-smith-clear` | 纯 JS | 清除配置 |

## 核心能力

### Skills 列表

| Skill 名称 | 功能描述 | 实现方式 |
|-----------|---------|---------|
| `doc-smith` | 主文档生成和更新入口 | AIGNE |
| `doc-smith-translate` | 翻译文档到多种语言 | AIGNE |
| `doc-smith-images` | 生成 AI 图片 | AIGNE |
| `doc-smith-publish` | 发布文档到平台 | AIGNE |
| `doc-smith-check` | 检查文档结构和内容 | 纯 JS |
| `doc-smith-clear` | 清除授权和配置 | 纯 JS |

### 每个 Skill 的职责

#### 1. doc-smith（主入口）
- 初始化 workspace
- 分析数据源
- 生成文档结构
- 生成文档内容
- 协调其他功能（翻译、图片、发布）

#### 2. doc-smith-translate
- 批量翻译文档到指定语言
- 支持指定文档范围
- 支持强制重新翻译

#### 3. doc-smith-images
- 扫描文档中的 image slots
- 使用 AI 生成图片
- 支持更新已有图片

#### 4. doc-smith-publish
- 检查发布条件
- 翻译 meta 信息
- 上传文档到平台

#### 5. doc-smith-check
- 验证 document-structure.yaml 格式
- 检查文档内容完整性
- 报告问题并建议修复

#### 6. doc-smith-clear
- 清除授权 tokens
- 清除部署配置
- 交互式选择清除内容

## 输入输出

### 输入
- **必需输入**：用户通过 Claude Code 对话提供的指令
- **可选输入**：文档路径、语言代码、强制选项等参数
- **自动获取**：从 workspace 的 config.yaml 读取配置

### 输出
- **执行结果**：操作成功/失败状态
- **生成文件**：文档、图片、配置文件等
- **日志信息**：执行过程的关键信息

## 约束条件

### 必须遵循的规范
- Claude Code Plugin 目录结构规范
- SKILL.md 文件格式规范
- 中文编写所有提示词

### 职责边界
- **必须执行**：
  - 保持现有功能完整性
  - 提供清晰的用户交互
  - 正确传递参数到 AIGNE agents

- **不应执行**：
  - 重复实现已有的 AIGNE 功能
  - 绕过 workspace 初始化检查
  - 直接操作 AIGNE 内部状态

### 协作方式
- Skills 作为入口层，负责参数收集和结果展示
- AIGNE agents 作为执行层，负责实际业务逻辑
- 通过 bash 命令 `aigne run` 连接两层

## 预期结果

### 成功标准
1. 所有现有功能通过新的 Skills 可用
2. 用户可以在 Claude Code 中通过 `/doc-smith-xxx` 调用功能
3. 错误信息清晰，用户知道如何处理
4. 文档完整，新用户可以快速上手

### 目录结构

```
doc-smith-skill/
├── .claude-plugin/           # Claude Code Plugin 配置
│   └── ...
├── skills/                   # Skills 目录
│   ├── doc-smith/           # 主文档生成
│   │   ├── SKILL.md
│   │   └── references/      # 参考文档
│   ├── doc-smith-translate/ # 翻译
│   │   └── SKILL.md
│   ├── doc-smith-images/    # 图片生成
│   │   └── SKILL.md
│   ├── doc-smith-publish/   # 发布
│   │   └── SKILL.md
│   ├── doc-smith-check/     # 检查
│   │   └── SKILL.md
│   └── doc-smith-clear/     # 清除
│       └── SKILL.md
├── agents/                  # AIGNE Agents（保留）
│   ├── localize/
│   ├── generate-images/
│   ├── publish/
│   └── ...
├── utils/                   # 共享工具（保留）
├── aigne.yaml              # AIGNE 配置（保留）
├── CLAUDE.md               # 项目说明
└── package.json
```

## 错误处理

### 常见错误
1. AIGNE CLI 未安装
2. workspace 未初始化
3. 配置文件缺失
4. 参数格式错误

### 处理策略
1. 检测 AIGNE CLI，提示安装命令
2. 引导用户初始化 workspace
3. 提供默认配置或要求用户提供
4. 显示参数格式说明

## 实现方式

### 技术选型
- **Skills**：使用 SKILL.md 格式定义
- **执行层**：通过 bash 调用 `aigne run`
- **工具层**：保留现有 utils 模块

### 迁移步骤

#### 阶段 1：准备工作
1. 创建 `.claude-plugin` 目录结构
2. 整理现有 skills 目录
3. 更新 CLAUDE.md

#### 阶段 2：创建 Skills
1. 创建 `doc-smith` 主 Skill
2. 创建 `doc-smith-translate` Skill
3. 创建 `doc-smith-images` Skill
4. 创建 `doc-smith-publish` Skill
5. 创建 `doc-smith-check` Skill
6. 创建 `doc-smith-clear` Skill

#### 阶段 3：调整 AIGNE 配置
1. 简化 aigne.yaml，移除 CLI 入口配置
2. 保留 agents 定义供 bash 调用
3. 确保 `aigne run . <agent>` 可正常工作

#### 阶段 4：测试验证
1. 测试每个 Skill 的独立功能
2. 测试 Skills 之间的协作
3. 验证错误处理

#### 阶段 5：文档更新
1. 更新 README.md
2. 更新 CLAUDE.md
3. 为每个 Skill 编写使用说明

---
**注意**：本文档描述功能意图，不包含具体实现细节。
