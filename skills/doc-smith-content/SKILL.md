---
name: doc-smith-content
description: |
  生成单个文档的详细内容。使用场景：
  - doc-smith 主流程调用，批量生成各文档内容
  - 用户独立调用，重新生成某篇文档（如"重新生成 /overview"）
  独立调用时会先检查 workspace 和文档结构是否存在。
---

# 文档内容生成 Agent

生成单个文档的详情。

## Usage

```bash
# 生成指定路径的文档
/doc-smith-content /api/overview
/doc-smith-content /guides/getting-started

# 带自定义要求
/doc-smith-content /api/authentication --require "重点说明安全注意事项"
/doc-smith-content /api/authentication -r "重点说明安全注意事项"

# 多个自定义要求
/doc-smith-content /overview --require "包含性能优化建议" --require "补充错误处理"

# 在 doc-smith 主流程中批量调用
/doc-smith-content /api/overview
/doc-smith-content /api/authentication
/doc-smith-content /guides/installation
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--require <text>` | `-r` | 自定义生成要求（可多次使用） |

## 输出

自然语言摘要，包含：
- 文档路径和主题概述
- 主要章节列表
- 生成的 AFS image slot ID 列表（如有）
- 校验结果和保存状态确认

## 工作流程

### 0. 前置检查（独立调用时）

当用户直接调用此技能（而非通过 doc-smith 主流程）时，必须先检查：

1. **检查 workspace 是否存在**
   如果不存在，提示用户："请先使用 doc-smith 初始化 workspace 并生成文档结构。"

2. **检查目标文档是否在结构中**
   读取 `.aigne/doc-smith/planning/document-structure.yaml`，确认用户请求的文档路径存在。
   如果不存在，提示用户："文档路径 /xxx 不在文档结构中，是否添加文档？"

如果是通过 doc-smith 主流程调用，跳过此检查。

### 1. 读取配置信息

从 workspace 约定目录自动读取：

```
.aigne/doc-smith/planning/document-structure.yaml  → 文档的 title、description、sourcePaths、层级关系
.aigne/doc-smith/intent/user-intent.md            → 目标用户、使用场景、文档侧重点
.aigne/doc-smith/config.yaml                      → 语言配置（locale）
```

**关键步骤**：
- 从 `document-structure.yaml` 中找到 `path` 对应的文档条目
- 提取该文档的 `title`、`description`、`sourcePaths`
- **判断文档层级类型**（见下方规则）
- 确定文档的父子关系和层级位置
- 从 `config.yaml` 读取 `locale` 字段作为目标语言

### 1.1 判断文档层级类型（核心规则）

**根据是否有子文档来决定内容详略程度：**

| 文档类型 | 判断条件 | 内容策略 |
|---------|---------|---------|
| **概览文档** | 在 document-structure.yaml 中有 children | 简写：每个子主题 2-4 段 + 引导链接 |
| **详细文档** | 在 document-structure.yaml 中无 children | 详写：完整展开所有内容 |

**概览文档的写作原则：**
- 每个子主题只写 2-4 段概述，不超过 200 字
- 用 1 个简单代码示例说明核心用法（不超过 10 行）
- 结尾用"详见 [子文档标题](子文档路径)"引导读者
- **不展开子文档会详细覆盖的内容**

**详细文档的写作原则：**
- 完整展开所有细节
- 覆盖边界情况和最佳实践

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

文档输出目录固定为：`.aigne/doc-smith/docs/`

#### 4.2 查找所有媒体文件

在项目根目录查找所有媒体文件（数据源是项目本身）：

```bash
# 查找项目根目录中的媒体文件
find ./ -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.mp4" -o -name "*.webp" \) -not -path "*/.aigne/*" -not -path "*/node_modules/*"
```

记录所有结果，例如：
- `../../assets/create/screenshot1.png`
- `../../assets/run/screenshot2.png`
- `../../images/architecture.png`

#### 4.3 图片路径格式

文档中引用图片使用**相对路径**，需要根据文档层级计算 `../` 的数量。

**路径计算规则**：

```
总层级 = 基础层级(3) + 文档路径层级

基础层级 = 3（.aigne/ + doc-smith/ + docs/）
文档路径层级 = 文档 path 的目录深度
```

**计算示例**：

| 文档 path | 文档文件位置 | 路径层级 | 总 `../` 数 | 图片引用示例 |
|-----------|-------------|---------|------------|-------------|
| `/overview` | `docs/overview/zh.md` | 1 | 4 | `![img](../../../../assets/logo.png)` |
| `/api/auth` | `docs/api/auth/zh.md` | 2 | 5 | `![img](../../../../../assets/logo.png)` |
| `/guides/quick/start` | `docs/guides/quick/start/zh.md` | 3 | 6 | `![img](../../../../../../assets/logo.png)` |

**完整路径格式**：

```markdown
![描述](../../../.../<项目中的图片路径>)
```

**示例**：
- 文档 path: `/api/overview`（2 层）
- 图片位置: `assets/screenshots/login.png`（在项目根目录下）
- 文档中引用: `![登录截图](../../../../../assets/screenshots/login.png)`

**注意**：
- 路径层级从文档的 `path` 字段计算，不是从文件系统路径
- 每个 `/` 分隔的目录算 1 层（如 `/api/auth` 是 2 层）
- 语言文件（zh.md、en.md）位于文档目录内，不额外增加层级计算

### 5. 生成文档内容

生成符合规范的 Markdown 文档，包含：

#### 基本结构
- **标题和简介**：清晰说明文档主题
- **导航元素**：
  - 文档开头：前置条件（prerequisites）、父主题（parent topic）
  - 文档结尾：相关主题（related topics）、下一步（next steps）、子文档（child documents）
  - 只能链接生成的其他文档，不能链接到工作目录中的 markdown 文件，文档发布后会导致无法访问。
  - 导航链接应该使用文档结构中文档的 `path`

#### 主体内容
- **结构化章节**：逻辑清晰的信息层次
- **代码示例**：见下方"代码示例规则"
- **媒体资源**：主动添加图片以增强文档的可读性和专业性

#### 代码示例规则（重要）

**只包含用户需要的代码，排除内部实现：**

| 类型 | 是否包含 | 示例 |
|------|---------|------|
| ✅ **API 调用示例** | 是 | `POST /api/users { "name": "..." }` |
| ✅ **配置示例** | 是 | 配置文件的写法 |
| ✅ **使用示例** | 是 | 如何调用 SDK/CLI |
| ❌ **内部实现** | 否 | 类的私有方法、算法实现 |
| ❌ **框架代码** | 否 | 中间件实现、内部工具函数 |

**代码示例长度限制：**
- 概览文档：每个示例不超过 10 行
- 详细文档：每个示例不超过 25 行
- 如需完整代码，链接到源文件或单独的示例文档

#### 文档风格
- 语言清晰、克制、专业、友好
- 少营销，多解释
- 重点解释：
  - 这个东西是什么
  - 为什么要这样设计
  - 解决了什么问题
- 语气与节奏
  - 不追求华丽
  - 不用夸张词汇
  - 像在耐心教一个聪明的同事

#### 图片分类与要求

**A. 技术图表（按需生成）**

以下类型的内容**建议包含技术图表**，在没有已有图片且确实有助于理解时生成 AFS Image Slot：

- **架构说明** → 架构图（系统架构、模块关系、组件结构）
- **流程说明** → 流程图（业务流程、数据流向、状态转换）
- **时序说明** → 时序图（交互时序、调用链路）
- **概念解释** → 概念图（概念关系、层次结构）

**B. 应用截图（使用已有）**

以下类型使用工作区中的已有截图：

- **界面介绍** → UI 截图
- **操作步骤** → 操作演示截图
- **功能展示** → 功能界面截图

**图片数量建议（不是强制要求）：**

| 文档类型 | 技术图表 | 应用截图 |
|---------|---------|---------|
| 概览文档 | 0-1 个（整体架构图即可） | 0-1 个 |
| 详细文档 | 1-2 个（按需添加） | 按需引用 |

**判断是否需要图片的原则：**
- ✅ 图片能显著提升理解效率（复杂流程、架构关系）
- ✅ 理解图片相关信息，明确图片和文档上下文关联
- ❌ 文字已经能清晰说明（简单配置、线性步骤）
- ❌ 为了凑数而添加图片

#### 图片处理流程

**应用截图：**
1. 从前置准备的查找结果中匹配相关图片
2. 只在图片明确与文档内容相关时使用
3. 引用格式：`![截图说明](../../../../assets/screenshot.png)`

**技术图表：**
1. 判断是否真的需要图表来辅助理解
2. 如需要且无现有图表，生成 AFS Image Slot
3. 不要用应用截图替代技术图表

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

**何时生成 Slot：**
- 文档需要技术图表来辅助理解
- 工作区中没有对应的技术图表

**Slot 不能用于：**
- 应用界面截图（必须使用真实截图）

### 6. 保存文档

根据文档的 `path` 创建目录结构并保存文件。

#### 6.1 目录结构

```
.aigne/doc-smith/docs/
└── {path}/                    # 根据文档 path 创建目录
    ├── .meta.yaml             # 元信息文件（首次创建时必须生成）
    └── {locale}.md            # 语言版本文件（如 zh.md、en.md）
```

**示例**：文档 path 为 `/api/overview`，语言为 `zh`

```
.aigne/doc-smith/docs/
└── api/
    └── overview/
        ├── .meta.yaml         # 元信息
        └── zh.md              # 中文内容
```

#### 6.2 元信息文件 (.meta.yaml)

**首次创建文档时，必须同时创建 `.meta.yaml` 文件**：

```yaml
kind: doc                      # 固定值，表示文档类型
source: zh                     # 源语言，与 default 相同
default: zh                    # 默认语言，从 config.yaml 的 locale 读取
```

| 字段 | 说明 |
|------|------|
| `kind` | 固定为 `doc`，表示这是一个文档 |
| `source` | 文档的源语言，新建时与 `default` 相同 |
| `default` | 默认显示语言，从 `config.yaml` 的 `locale` 读取 |

#### 6.3 保存步骤

1. **读取语言配置**：从 `config.yaml` 获取 `locale` 字段（如 `zh`）
2. **创建文档目录**：根据 path 创建 `docs/{path}/` 目录
3. **创建元信息文件**：首次保存时创建 `.meta.yaml`
4. **保存语言文件**：将 Markdown 内容保存为 `{locale}.md`

**更新已有文档时**：
- 如果 `.meta.yaml` 已存在，无需重新创建
- 直接更新对应的语言文件内容

### 7. 校验内容

调用 `doc-smith-check` 校验文档：

```bash
/doc-smith-check --content
```

校验内容：
- 格式规范检查
- 导航链接完整性
- 代码示例语法
- AFS image slot 格式

### 8. 验证保存结果

**在结束前必须执行以下检查：**

1. **验证目录结构**：检查 `docs/{path}/` 目录是否已创建
2. **验证元信息文件**：检查 `.meta.yaml` 是否存在且内容正确
3. **验证语言文件**：检查 `{locale}.md` 是否存在且内容完整
4. **如果文件缺失**：重新创建缺失的文件

### 9. 返回摘要

使用自然语言返回处理结果摘要，**不返回完整文档内容**以节省主 agent 上下文。

**摘要应包含以下信息：**

- 文档路径（如 `/api/overview`）
- 文档主题概述（1-2 句话描述文档内容）
- 主要章节列表
- 生成的 AFS image slot ID 列表（如有）
- 校验结果（通过/警告/错误）
- 保存状态确认

## 职责边界

**必须执行**：
- ✅ 读取 workspace 约定目录中的配置信息
- ✅ 分析源代码并生成文档内容
- ✅ 创建文档目录、元信息文件和语言文件
- ✅ 调用 `/doc-smith-check --content` 校验文档
- ✅ 返回摘要信息

**不应执行**：
- ❌ 不创建或修改 document-structure.yaml
- ❌ 不进行 Git 操作
- ❌ 不生成空洞的占位内容
- ❌ 不偏离用户意图

## 成功标准

1. **完整性**：包含必需章节、导航链接完整
2. **准确性**：与源代码一致、技术细节正确
3. **可读性**：结构清晰、语言流畅、示例恰当
4. **一致性**：风格符合用户意图、格式遵循 doc-smith 规范
5. **校验通过**：`/doc-smith-check --content` 校验无错误
6. **保存验证**：文档目录、`.meta.yaml` 和语言文件都已正确创建
7. **长度适当**：符合下方长度参考标准

### 长度参考标准

| 文档类型 | 建议行数 | 代码示例数量 | 说明 |
|---------|---------|-------------|------|
| **概览文档**（有子文档） | 150-300 行 | 3-5 个简短示例 | 每个子主题简要介绍 |
| **详细文档**（无子文档） | 300-500 行 | 5-10 个完整示例 | 完整展开技术细节 |

**超长文档的处理：**
- 如果内容超过 500 行，考虑拆分为多个子文档
- 概览文档超过 300 行，说明包含了过多子文档应有的内容

**过短文档的处理：**
- 详细文档少于 200 行，可能缺少必要的示例或说明

## 注意事项
### 避免重复内容（重要）

**核心原则：概览文档不重复子文档的内容**

生成概览文档时，必须遵循：
- 每个子主题只写 2-4 段概述
- 不展开技术实现细节（那是子文档的职责）
- 用"详见 [链接]"引导读者到子文档

**自检问题：**
- 这段内容是否会在子文档中详细说明？→ 是则简写
- 这个代码示例是否应该放在更专门的子文档？→ 是则省略或简化
- 读者是否需要在概览文档中就了解这个细节？→ 否则删除

### 控制文档长度（重要）

**写作前先问自己：**
1. 这是概览文档还是详细文档？
2. 目标行数是多少？
3. 应该包含多少个代码示例？

**写作时的控制方法：**
- 概览文档：每个子主题写完后检查是否超过 200 字
- 代码示例：先问"用户真的需要这个示例吗？"
- 内部实现：一律不写，只写 API 使用方式
