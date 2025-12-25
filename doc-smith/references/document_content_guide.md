# 文档内容生成指南

本指南定义了生成 markdown 文档时的内容要求和格式规范。

## 基本要求

为结构中的每个文档在 `.aigne/doc-smith/docs/` 中创建 markdown 文件：
- 使用 YAML 中的 `path` 作为文件路径
- 从 `sourcePaths` 提取信息
- 编写清晰、结构化的内容
- **在生成文档内容时主动添加图片**（参见"媒体资源"章节）

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

### 前置准备：确定文档和媒体的位置关系

**在开始生成文档前，必须完成以下步骤：**

#### 1. 确定文档输出目录

从 `document_structure.yaml` 的文档配置中读取，文档输出目录固定为：`.aigne/doc-smith/docs/`

#### 2. 查找所有媒体文件

执行以下命令查找工作区中的所有媒体文件：

```bash
find . -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.mp4" -o -name "*.webp" \)
```

记录所有结果，例如：
- `./assets/create/screenshot1.png`
- `./assets/run/screenshot2.png`
- `./images/architecture.png`

#### 3. 相对路径计算规则

**核心公式：**
```
图片相对路径 = (向上到根目录的 ../) + 图片路径（去掉开头的 ./）
```

**层级对照表：**
- 文档在 `docs/` → 3层 → `../../../`
- 文档在 `docs/api/` → 4层 → `../../../../`
- 文档在 `docs/api/auth/` → 5层 → `../../../../../`
- 规律：每增加一层子目录，增加一个 `../`

**示例：**
- 文档：`.aigne/doc-smith/docs/getting-started.md`（3层）
- 图片：`./assets/run/screenshot.png`
- 结果：`../../../assets/run/screenshot.png`

**常见错误：**
- ❌ 层级数数错（`docs/` 用了 `../../` 而非 `../../../`）
- ❌ 忘记计算子目录（`docs/api/` 用了 3层而非 4层）

### 生成文档时的图片处理

在编写每个文档的内容时，必须主动添加图片以增强文档的可读性和专业性。

#### 1. 图片分类与要求

**A. 技术图表（必须生成）**

以下类型的内容**必须包含相应的技术图表**，没有已有图片时必须生成 AFS Image Slot：

- **架构说明** → 架构图（系统架构、模块关系、组件结构）
- **流程说明** → 流程图（业务流程、数据流向、状态转换）
- **时序说明** → 时序图（交互时序、调用链路）
- **概念解释** → 概念图（概念关系、层次结构）
- **数据结构** → 数据模型图（类图、ER 图）

**B. 应用截图（优先使用已有）**

以下类型可以优先使用工作区中的已有截图：

- **界面介绍** → UI 截图
- **操作步骤** → 操作演示截图
- **功能展示** → 功能界面截图

**强制性要求：**

1. **技术文档必须包含技术图表**：
   - 架构文档：至少 1 个架构图
   - API 文档：至少 1 个时序图或流程图
   - 概念说明：至少 1 个概念图
   - 数据模型：至少 1 个数据结构图

2. **用户指南必须包含应用截图**：
   - 操作指南：每个主要操作步骤至少 1 张截图
   - 功能介绍：每个功能至少 1 张界面截图

3. **综合文档建议配比**：
   - 技术图表：1-3 个
   - 应用截图：1-2 个

#### 2. 图片处理流程

**对于应用截图（B 类）：**

1. 从前置准备的查找结果中匹配图片
2. 根据文件名判断用途（如 login.png、dashboard.png、settings.png）
3. 使用层级对照表计算相对路径
4. 引用图片：`![截图说明](../../../assets/screenshot.png)`

**对于技术图表（A 类）：**

1. 检查是否有对应的技术图表（架构图、流程图等）
2. 如果没有，**必须生成 AFS Image Slot**（不是可选）
3. 即使有应用截图，也不能用应用截图替代技术图表

**关键区别：**
- ❌ 错误：架构说明章节使用应用截图代替架构图
- ✅ 正确：架构说明章节生成架构图 slot，另外可以添加应用截图作为补充

#### 3. 生成 AFS Image Slot

**何时必须生成 Slot：**

1. 文档内容需要技术图表（架构图、流程图、时序图等）
2. 工作区中没有对应的技术图表
3. 即使有应用截图，也需要生成技术图表 slot

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

### 图片使用检查清单

生成每个文档时，确认以下项目：

**技术图表检查：**
- [ ] 架构说明章节是否包含架构图？（没有则生成 slot）
- [ ] 流程说明章节是否包含流程图？（没有则生成 slot）
- [ ] 时序说明章节是否包含时序图？（没有则生成 slot）
- [ ] 概念解释章节是否包含概念图？（没有则生成 slot）

**应用截图检查：**
- [ ] 是否有可用的应用截图可以引用？
- [ ] 引用路径是否按层级对照表正确计算？

**数量检查：**
- [ ] 技术文档是否至少包含 1 个技术图表？
- [ ] 用户指南是否包含足够的应用截图？

## 内容组织原则

1. **层次清晰**：使用恰当的标题层级（H1-H6）
2. **段落简洁**：每个段落专注于单一主题
3. **代码示例**：提供实用的代码示例和说明
4. **列表使用**：用列表组织并列信息
5. **强调重点**：使用粗体、引用等方式突出重要信息
