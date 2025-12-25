# 文档内容生成指南

本指南定义了生成 markdown 文档时的内容要求和格式规范。

## 基本要求

为结构中的每个文档在 `.aigne/doc-smith/docs/` 中创建 markdown 文件：
- 使用 YAML 中的 `path` 作为文件路径
- 从 `sourcePaths` 提取信息
- 编写清晰、结构化的内容

## 导航链接

在每个文档中添加导航链接，引导用户在文档之间流畅跳转。

### 文档开头导航

在文档正文开始前添加：
- **前置条件**：阅读本文档前建议先了解的内容
- **父主题**：当前文档所属的上级主题

### 文档结尾导航

在文档末尾添加：
- **相关主题**：与当前文档相关的其他文档
- **下一步**：建议阅读的后续内容
- **子文档**：当前文档包含的子主题列表

## 媒体资源

### 图片需求分析

在生成文档内容时，需要分析是否需要展示图片来帮助读者理解内容。常见的需要图片的场景包括：

- **架构图**：系统架构、模块关系、组件结构等
- **流程图**：业务流程、数据流向、状态转换等
- **时序图**：交互时序、调用链路等
- **应用截图**：用户界面、操作步骤、功能演示等
- **概念图**：概念关系、层次结构等
- **数据结构图**：类图、ER 图、数据模型等

### 图片处理策略

确定需要图片后，按以下顺序处理：

#### 1. 检查已有图片

查找工作区中的媒体文件。

根据文件名和位置分析图片用途，如果存在合适的图片，在文档中直接引用：

```markdown
![系统架构图](../images/architecture.png)
```

**重要提醒**：不要复制媒体文件，直接从它们的工作区位置引用。

#### 2. 生成图片 Slot

如果工作区中没有合适的图片，在需要展示图片的位置生成 AFS Image Slot，后续流程会生成真实的图片。

AFS Image Slot Instructions

Use an AFS image slot only when you want to generate a new image.

Slot format (single line):
<!-- afs:image id="img-001" desc="..." -->
Optional stable intent key:
<!-- afs:image id="img-001" key="afs-context-flow" desc="..." -->

Rules:

- Insert a slot only for new image generation.
  If the source already provides an image (existing URL/path/asset), reference it normally; do not create a slot.
- id is required, unique in the same document, and must match: [a-z0-9._-]+
  Use sequential ids: img-001, img-002, ...
- desc is required, concise, double-quoted, and must not contain ".
- key is optional; use a short stable token ([a-z0-9._-]+) when you want stable reuse across edits/sections.

### 媒体使用最佳实践

1. **使用描述性的 alt 文本**：准确描述图片内容
2. **保持路径简洁**：使用相对路径，便于文档移动
3. **添加上下文说明**：在图片前后添加说明文字
4. **优先使用已有资源**：先检查工作区中是否有合适的图片，避免重复生成

## 内容组织原则

1. **层次清晰**：使用恰当的标题层级（H1-H6）
2. **段落简洁**：每个段落专注于单一主题
3. **代码示例**：提供实用的代码示例和说明
4. **列表使用**：用列表组织并列信息
5. **强调重点**：使用粗体、引用等方式突出重要信息
