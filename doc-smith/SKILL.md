---
name: doc-smith
description: "从工作区数据源生成全面的文档，包括代码仓库、文本文件和媒体资源。当用户请求以下操作时使用此技能：(1) 从代码或文件创建或生成文档，(2) 构建文档结构或文档站点，(3) 分析工作区内容以生成有组织的文档，(4) 将代码/项目内容转换为可读文档。支持技术文档、用户指南、API 参考和一般文档需求。"
---

# DocSmith

从工作区数据源生成结构化文档。

## 概述

DocSmith 分析工作区内容（代码、文件、媒体）并生成：
1. 文档结构计划（`document_structure.yaml`）
2. 按层次组织的 Markdown 文档文件

所有输出都创建在 `.aigne/doc-smith/` 目录中。

## 工作流程

按以下步骤依次执行：

### 1. 分析工作区

探索工作区以了解可用的数据源：

```bash
# 查找相关文件
find . -type f -name "*.md" -o -name "*.py" -o -name "*.js" # 等

# 或使用 Glob/Grep 工具发现：
# - 包含文档的代码文件
# - README 文件
# - 现有文档
# - 媒体资源（图片、视频）
```

**需要收集的关键信息：**
- 项目目的和结构
- 主要模块/组件
- 现有文档
- 代码注释和文档字符串
- 可引用的媒体资源

### 2. 规划文档结构

基于工作区分析，设计一个逻辑化的文档层次结构：

**考虑因素：**
- **受众**：技术文档 vs. 用户指南
- **范围**：API 参考、教程、概述
- **深度**：多少层级的嵌套
- **分组**：在父节点下组织相关主题

**示例结构：**

*代码项目：*
```
概述 → 快速开始 → API 参考 → 示例 → 高级主题
```

*产品文档：*
```
介绍 → 功能特性 → 用户指南 → 常见问题 → 故障排查
```

*层次化方式：*
```
快速开始
  ├─ 安装
  ├─ 快速入门
  └─ 配置
API 参考
  ├─ 身份验证
  └─ 端点
```

### 3. 生成 document_structure.yaml

按照 schema 创建 `.aigne/doc-smith/output/document_structure.yaml`。

**Schema 参考：** 完整格式和示例请参见 [document_structure_schema.md](references/document_structure_schema.md)。

**快速模板：**
```yaml
project:
  title: "项目名称"
  description: "项目简要描述"

documents:
  - title: "文档标题"
    description: "此文档涵盖的内容"
    path: "/filename.md"
    sourcePaths:
      - "path/to/source/file.py"
    icon: "lucide:icon-name"  # 仅顶层文档需要
    children:  # 可选的嵌套
      - title: "嵌套文档"
        description: "详细信息"
        path: "/section/nested.md"
        sourcePaths: []
```

**关键要求：**
- `path`：必须以 `/` 开头，以 `.md` 结尾
- `sourcePaths`：相对路径，不要使用 `workspace:` 前缀，如果没有则使用 `[]`
- `icon`：顶层文档必需，格式为 `lucide:icon-name`，参见 https://lucide.dev/icons
- 子文档不需要 icons

### 4. 生成文档内容

为结构中的每个文档在 `.aigne/doc-smith/docs/` 中创建 markdown 文件：

**文件命名：** 使用 YAML 中的 `path`（例如：`/api/auth.md` → `docs/api/auth.md`）

**内容指南：**
- 从 `sourcePaths` 列出的文件中提取信息
- 包含源文件中的代码示例
- 使用相对路径或 markdown 语法引用媒体资源
- 编写清晰、结构化的内容，包含标题和章节

**示例：**
```markdown
# 身份验证

学习如何验证 API 请求。

## 概述
[从源文件中提取]

## 方法
[文档化身份验证方式]

## 示例
[来自 sourcePaths 的代码片段]

---
**相关：** [API 参考](/api.md) | [快速开始](/getting-started.md)
```

### 5. 链接相关文档

**在文档开头和结尾**，添加指向相关文档的导航链接：

```markdown
<!-- 开头 -->
**前置条件：** [快速开始](/getting-started.md)

[主要内容]

<!-- 结尾 -->
---
**相关文档：**
- [API 参考](/api.md)
- [示例](/examples.md)
- [故障排查](/troubleshooting.md)
```

**链接策略：**
- 开头：前置条件、父主题
- 结尾：相关主题、下一步、子文档
- 使用与文档 `path` 值匹配的相对路径

## 输出结构

完成后：

```
.aigne/doc-smith/
├── output/
│   └── document_structure.yaml    # 文档计划
└── docs/
    ├── overview.md                # 生成的文档
    ├── getting-started.md
    └── api/
        └── authentication.md
```

## 媒体资源

当工作区中存在媒体文件（图片、视频）时：

**发现：**
```bash
find . -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.gif" -o -name "*.mp4" \)
```

**在 markdown 中引用：**
```markdown
![架构图](../path/to/diagram.png)

<!-- 或相对于文档位置 -->
![截图](../../screenshots/ui.png)
```

**不要复制**媒体文件。直接从它们的工作区位置引用。

## 最佳实践

1. **先宽泛后详细**：首先创建高层结构
2. **使用源上下文**：从 `sourcePaths` 文件中提取实际内容
3. **保持一致性**：如果存在现有文档，遵循其风格
4. **验证路径**：确保所有文件路径和链接都正确
5. **检查 schema**：在生成文档之前验证 YAML 是否符合所需格式
