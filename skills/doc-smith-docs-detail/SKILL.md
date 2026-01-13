---
name: doc-smith-docs-detail
description: |
  生成单个文档的详细内容，根据文档结构和用户意图生成包含导航、代码示例、技术图表的完整文档。
  使用场景：
  - doc-smith 主流程调用，批量生成各文档内容
  - 输入文档路径（与 document-structure.yaml 中的 path 对应）
  - 自动读取 workspace 配置（document-structure.yaml、user-intent.md、config.yaml）
  - 分析源代码并生成结构化内容
  - 调用 saveDocument 保存，调用 checkContent 校验
  - 返回摘要信息（不返回完整内容以节省上下文）
---

# 文档内容生成 Agent

## 核心职责

生成单个文档的详细内容，将文档详情生成从 doc-smith 主流程中解耦。

**输入**：文档路径 + 可选的自定义要求
**输出**：文档摘要 + 校验结果（完整内容已保存到文件）

## 工作流程

### 1. 读取配置信息

从 workspace 约定目录自动读取：

```
planning/document-structure.yaml  → 文档的 title、description、sourcePaths、层级关系
intent/user-intent.md            → 目标用户、使用场景、文档侧重点
config.yaml                      → 语言配置（locale）
```

**关键步骤**：
- 从 `document-structure.yaml` 中找到 `path` 对应的文档条目
- 提取该文档的 `title`、`description`、`sourcePaths`
- 确定文档的父子关系和层级位置
- 从 `config.yaml` 读取 `locale` 字段作为目标语言

### 2. 分析源代码

根据文档的 `sourcePaths` 读取和分析源代码文件：
- 提取 API 接口、类定义、函数签名、配置项
- 理解代码结构和依赖关系
- 识别需要文档化的核心概念

### 3. 理解用户意图

从 `user-intent.md` 中解读：
- 目标用户是谁
- 使用场景是什么
- 文档侧重点在哪里
- 根据文档类型（教程/参考/指南）调整内容风格和详细程度

### 4. 媒体资源前置准备

**在开始生成文档内容前，必须完成以下步骤：**

#### 4.1 确定文档输出目录

文档输出目录固定为：`docs/`

#### 4.2 查找所有媒体文件

执行以下命令查找 `sources` 中的所有媒体文件：

```bash
find . -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.mp4" -o -name "*.webp" \)
```

记录所有结果，例如：
- `./assets/create/screenshot1.png`
- `./assets/run/screenshot2.png`
- `./images/architecture.png`

#### 4.3 图片路径格式

**sources 中的图片使用绝对路径**：

对于数据源中的图片，使用 `/sources/` 开头的绝对路径格式：

```
/sources/<path-to-image>
```

**示例**：
- 图片路径：`modules/sources/assets/run/screenshot.png`
- 文档中引用：`![截图](/sources/assets/run/screenshot.png)`

**注意**：
- 直接使用在 sources 目录下看到的路径
- 不需要计算相对路径层级，统一使用绝对路径
- 路径区分大小写
- 检查和发布阶段会自动解析并处理图片路径

### 5. 生成文档内容

生成符合规范的 Markdown 文档，包含：

#### 基本结构
- **标题和简介**：清晰说明文档主题
- **导航元素**：
  - 文档开头：前置条件（prerequisites）、父主题（parent topic）
  - 文档结尾：相关主题（related topics）、下一步（next steps）、子文档（child documents）

#### 主体内容
- **结构化章节**：逻辑清晰的信息层次
- **代码示例**：实际可运行的代码，使用正确的语言标识符，包含完整上下文
- **媒体资源**：主动添加图片以增强文档的可读性和专业性

#### 图片分类与要求

**A. 技术图表（必须生成）**

以下类型的内容**必须包含相应的技术图表**，没有已有图片时必须生成 AFS Image Slot：

- **架构说明** → 架构图（系统架构、模块关系、组件结构）
- **流程说明** → 流程图（业务流程、数据流向、状态转换）
- **时序说明** → 时序图（交互时序、调用链路）
- **概念解释** → 概念图（概念关系、层次结构）
- **数据结构** → 数据模型图（类图、ER 图）

**B. 应用截图（必须使用已有）**

以下类型必须使用工作区中的已有截图，因为必须使用真实的应用截图：

- **界面介绍** → UI 截图
- **操作步骤** → 操作演示截图
- **功能展示** → 功能界面截图

**强制性要求：**

1. **技术文档必须包含技术图表**：
   - 架构文档：至少 1 个架构图
   - API 文档：至少 1 个时序图或流程图
   - 概念说明：至少 1 个概念图
   - 数据模型：至少 1 个数据结构图

2. **用户指南需要包含应用截图**：
   - 操作指南：每个主要操作步骤至少 1 张截图
   - 功能介绍：每个功能至少 1 张界面截图

3. **综合文档建议配比**：
   - 技术图表：1-3 个
   - 应用截图：1-2 个

#### 图片处理流程

**对于应用截图（B 类）：**

1. 只能从前置准备的查找结果中匹配图片
2. 根据文件名判断用途（如 login.png、dashboard.png、settings.png）
3. 使用层级对照表计算相对路径
4. 引用图片：`![截图说明](../../assets/screenshot.png)`
5. 如果仓库未提供相关截图，可以不展示

**对于技术图表（A 类）：**

1. 检查是否有对应的技术图表（架构图、流程图等）
2. 如果没有，**必须生成 AFS Image Slot**（不是可选）
3. 即使有应用截图，也不能用应用截图替代技术图表

**关键区别：**
- ❌ 错误：架构说明章节使用应用截图代替架构图
- ✅ 正确：架构说明章节生成架构图 slot，另外可以添加应用截图作为补充

#### 生成 AFS Image Slot

```text
Use an AFS image slot only when you want the framework to generate a new image.

Slot format (single line):
<!-- afs:image id="architecture-overview" desc="..." -->

Optional stable intent key (for reuse across edits or documents):
<!-- afs:image id="architecture-overview" key="aigne-cli-architecture" desc="..." -->

Rules:
- Insert a slot only for new image generation.
  If the source already provides an image (existing URL/path/asset), reference it directly; do not create a slot.
- id is required and must be a semantic identifier describing the image's role or position
  (e.g. architecture-overview, core-flow, deployment-banner).
  It must be unique in the same document and match: [a-z0-9._-]+.
- desc is required, concise, double-quoted, and must not contain ".
  It describes what the image should depict.
- key is optional. Use a short, stable token ([a-z0-9._-]+) when you want the same image intent to be reused across sections or documents.
```

**何时必须生成 Slot：**

1. 文档内容需要技术图表（架构图、流程图、时序图等）
2. 工作区中没有对应的技术图表

**AFS Image Slot 不能用于：**

1. 应用界面必须使用真实截图，不能用 Slot 生成虚构的界面

#### 图片使用检查清单

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

### 6. 保存文档

调用 `saveDocument` 工具保存文档：
```javascript
saveDocument({
  path: "/api/overview",           // 文档路径
  content: "# API 概览\n...",      // Markdown 内容
  options: {
    language: "zh"                 // 从 config.yaml 的 locale 读取
  }
})
```

**重要**：`language` 参数必须从 `config.yaml` 的 `locale` 字段读取并传入。

### 7. 校验内容

调用 `checkContent` 工具校验文档：
- 格式规范检查
- 导航链接完整性
- 代码示例语法
- AFS image slot 格式

### 8. 返回摘要

返回摘要信息，**不返回完整文档内容**以节省主 agent 上下文：
```javascript
{
  success: true,
  path: "/api/overview",
  summary: "本文档介绍了 API 的整体架构和核心概念...",
  sections: ["快速开始", "核心概念", "API 列表", "最佳实践"],
  imageSlots: ["api-architecture", "request-flow"],
  validationResult: { valid: true, warnings: [] }
}
```

## 输入参数

### path（必需）
- 类型：字符串
- 格式：`/path/to/document`（与 document-structure.yaml 中的 path 一致）
- 用途：确定生成哪篇文档

### customRequirements（可选）
- 类型：字符串
- 用途：用户在当前对话中提出的额外要求
- 示例：
  - "重点说明安全注意事项"
  - "包含性能优化建议"
  - "补充错误处理的最佳实践"
- 应用：
  - 指导生成内容的侧重点
  - 可根据要求补充相关源文件到分析范围

## 输出格式

```javascript
{
  success: boolean,              // 操作是否成功
  path: string,                  // 文档路径，如 "/api/overview"
  summary: string,               // 文档摘要（200-300字）
  sections: string[],            // 主要章节列表
  imageSlots: string[],          // 生成的 AFS image slots ID 列表
  validationResult: object       // checkContent 的校验结果
}
```

## 文档规范要求

### 必须遵循的规范

1. **文档格式**：Markdown，遵循 doc-smith 章节组织规范
2. **图片处理**：
   - 技术图表 → 生成 AFS image slot
   - 应用截图 → 引用现有图片（使用相对路径）
3. **代码示例**：
   - 使用正确的语言标识符（```javascript、```python 等）
   - 确保代码可运行
   - 提供完整上下文和说明
4. **内部链接**：使用相对路径指向 Markdown 文件

### 职责边界

**必须执行**：
- ✅ 读取 workspace 约定目录中的配置信息
- ✅ 分析源代码并生成文档内容
- ✅ 调用 saveDocument 保存文档
- ✅ 调用 checkContent 校验文档
- ✅ 返回摘要信息

**不应执行**：
- ❌ 不创建或修改 document-structure.yaml
- ❌ 不执行结构校验（checkStructure 由 doc-smith 负责）
- ❌ 不进行 Git 操作
- ❌ 不生成空洞的占位内容
- ❌ 不偏离用户意图

## 成功标准

1. **完整性**：包含所有必需章节、导航链接完整、代码示例可运行
2. **准确性**：与源代码一致、技术细节正确
3. **可读性**：结构清晰、语言流畅、示例恰当
4. **一致性**：风格符合用户意图、格式遵循 doc-smith 规范
5. **校验通过**：checkContent 校验无错误

## 错误处理

### 常见错误场景

1. **输入错误**：
   - 缺少 path 参数
   - document-structure.yaml 中找不到对应文档

2. **配置读取失败**：
   - workspace 配置文件不存在或格式错误
   - locale 字段缺失

3. **源代码分析失败**：
   - 源文件不存在
   - 文件格式无法解析

4. **内容校验失败**：
   - checkContent 检测到格式问题
   - 导航链接不完整

### 处理策略

1. **提前验证**：在开始生成前验证输入和配置文件
2. **优雅降级**：信息缺失时使用合理默认值
3. **明确报错**：返回 `{ success: false, error: "错误描述" }`
4. **保持一致**：确保生成的内容符合规范

## 注意事项

1. **语言配置**：必须从 `config.yaml` 的 `locale` 字段读取语言代码
2. **路径校验**：确保 path 参数在 document-structure.yaml 中存在
3. **上下文节省**：只返回摘要，不返回完整文档内容
4. **内容质量**：不生成空洞的占位内容，确保每个章节都有实质性内容
5. **图表规划**：技术图表使用 AFS image slot，应用截图引用现有图片
