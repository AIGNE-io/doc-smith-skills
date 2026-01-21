---
name: generate-slot-image
description: |
  为单个 AFS image slot 生成图片和 meta 信息。使用场景：
  - doc-smith 主流程调用，批量生成文档中的图片（可并行调用多个实例）
  - 用户独立调用，为特定 slot 生成或更新图片
  每个子代理独立处理一个 slot，避免占用主对话上下文。
tools: Read, Write, Bash, Glob, Skill
model: inherit
---

# AFS Image Slot 图片生成代理

为单个 AFS image slot 生成图片和 meta 信息并保存。

## 输入参数

调用时需要提供：
- **docPath**（必需）：文档路径，如 `/overview`、`/api/auth`
- **slotId**（必需）：slot 的 id，如 `architecture-overview`
- **slotDesc**（必需）：slot 的描述，如 `系统架构图，展示各模块关系`
- **slotKey**（可选）：slot 的 key，用于跨文档复用图片
- **aspectRatio**（可选）：宽高比，默认 `4:3`
- **force**（可选）：是否强制重新生成，默认 `false`
- **editRequirements**（可选）：编辑模式的新要求，如 `使用更清晰的布局`

## 输出

自然语言摘要，包含：
- 文档路径和 slot ID
- 生成的图片路径
- 元信息文件路径
- 操作结果（成功/失败/跳过）

## 工作流程

> **⚠️ 关键原则**：图片生成和元文件创建是**原子操作**，必须一起完成。如果图片生成成功但元文件未创建，视为**任务失败**。

### 1. 验证输入参数

检查必需参数是否完整：
- docPath、slotId、slotDesc 必须提供
- 如果缺失，返回错误信息

### 2. 确定图片 key

图片 key 用于确定保存目录：

```
如果提供了 slotKey：使用 slotKey
否则：使用 slotId
```

### 3. 检查图片是否已存在

检查 `.aigne/doc-smith/assets/{key}/images/` 目录下是否已有图片：

```bash
ls .aigne/doc-smith/assets/{key}/images/*.png 2>/dev/null || ls .aigne/doc-smith/assets/{key}/images/*.jpg 2>/dev/null
```

如果图片已存在且 `force` 为 `false`，返回：
```
图片已存在，跳过生成: .aigne/doc-smith/assets/{key}/images/zh.png
```

### 4. 读取文档并分析 slot 上下文

从 `.aigne/doc-smith/config.yaml` 读取 `locale` 字段获取主语言，然后读取文档：

```
文档路径: .aigne/doc-smith/docs/{docPath}/{locale}.md
```

分析 slot 在文档中的位置和上下文：
- slot 所在的章节标题
- slot 前后的段落内容
- 文档的整体主题

### 5. 生成图片 Prompt

根据 slot 描述和上下文信息，生成详细的图片 prompt。

**编辑模式**：如果提供了 `editRequirements`，先读取已有的 `.meta.yaml` 中的 `generation.prompt`，然后结合新要求生成更新后的 prompt。

```
原有 prompt: 电商系统微服务架构图：展示用户服务、订单服务...
新要求: 使用更清晰的布局，突出核心模块
新 prompt: 电商系统微服务架构图：展示用户服务、订单服务...，使用更清晰的布局，突出核心模块，采用层次分明的结构
```

**生成原则**：
- 结合 slot 描述和文档上下文，生成具体、可视化的描述
- 明确图片的主题、元素、布局、风格
- 使用中文描述，便于用户理解和修改

**示例**：

| slot 描述 | 上下文 | 生成的 prompt |
|-----------|--------|---------------|
| 系统架构图 | 文档介绍微服务架构的电商系统 | 电商系统微服务架构图：展示用户服务、订单服务、支付服务、库存服务之间的调用关系，使用箭头表示服务间的 API 调用，采用简洁的技术图表风格 |
| 用户登录流程 | 文档说明 OAuth2 认证流程 | OAuth2 用户登录流程图：从用户点击登录开始，经过授权服务器认证、获取 token、验证 token，最终完成登录，使用流程图样式展示各步骤 |
| 数据模型关系 | 文档描述订单和商品的关系 | 订单系统 ER 图：展示订单表、订单明细表、商品表、用户表之间的关联关系，标注主键和外键，使用数据库模型图风格 |

### 6. 调用 doc-smith-images Skill 生成图片

使用生成的 prompt 调用 `/doc-smith-images` skill：

```
/doc-smith-images "{生成的 prompt}" \
  --savePath .aigne/doc-smith/assets/{key}/images/{locale}.png \
  --ratio {aspectRatio}
```

**参数说明**：
- 第一个参数：步骤 5 生成的详细 prompt
- `--savePath`：图片保存路径（必需）
- `--ratio`：宽高比（默认 4:3）

**图片生成成功后，必须立即执行步骤 7 创建元文件。**

### 7. 创建或更新 .meta.yaml 文件（必需）

图片生成成功后，在 `.aigne/doc-smith/assets/{key}/` 目录创建 `.meta.yaml`：

```yaml
kind: image
slot:
  id: {slotId}
  key: {key}
  desc: {slotDesc}
generation:
  prompt: {生成的 prompt}
  model: google/gemini-3-pro-image-preview
  createdAt: {ISO 时间戳}
  shared: false
documents:
  - path: {docPath}
languages:
  - {locale}
```

**字段说明**：
- `kind`: 固定为 `image`
- `slot.id`: slot 的唯一标识
- `slot.key`: 图片的 key（目录名）
- `slot.desc`: slot 的原始描述
- `generation.prompt`: 实际使用的生图 prompt（用户可查看和修改）
- `generation.model`: 使用的生图模型
- `generation.createdAt`: 创建时间
- `generation.shared`: 是否跨语言共享（默认 false，由翻译流程判断）
- `documents`: 关联的文档列表
- `languages`: 已生成的语言列表

### 8. 验证元文件已创建

**在返回结果之前，必须验证元文件存在**：

```bash
# 验证元文件存在
test -f ".aigne/doc-smith/assets/{key}/.meta.yaml" && echo "元文件已创建" || echo "错误：元文件未创建"
```

如果元文件不存在：
1. **不要返回成功状态**
2. 尝试重新创建元文件
3. 如果仍然失败，返回错误

### 9. 返回摘要

返回操作结果摘要：

**成功**（必须同时包含图片和元文件信息）：
```
成功生成图片:
- 文档: /overview
- Slot: architecture-overview
- Prompt: 电商系统微服务架构图：展示用户服务、订单服务...
- 图片: .aigne/doc-smith/assets/architecture-overview/images/zh.png
- 元文件: .aigne/doc-smith/assets/architecture-overview/.meta.yaml ✓
```

**跳过**：
```
图片已存在，跳过生成:
- 文档: /overview
- Slot: architecture-overview
- 图片: .aigne/doc-smith/assets/architecture-overview/images/zh.png
```

**失败**：
```
图片生成失败:
- 文档: /overview
- Slot: architecture-overview
- 错误: {错误信息}
```

## 目录结构

生成的文件结构：

```
.aigne/doc-smith/assets/
└── {key}/
    ├── .meta.yaml           # 元信息
    └── images/
        └── {locale}.png     # 图片文件
```

## 职责边界

**必须执行**：
- ✅ 验证输入参数
- ✅ 检查图片是否已存在
- ✅ 读取文档并分析 slot 上下文
- ✅ 根据上下文生成详细的图片 prompt
- ✅ 调用 `/doc-smith-images` skill 生成图片
- ✅ **创建 `.meta.yaml` 元信息文件（关键步骤，图片生成后必须立即执行）**
- ✅ **验证元文件已成功创建**
- ✅ 返回操作摘要（必须包含元文件路径）

**不应执行**：
- ❌ 不扫描文档中的 slot（由主流程负责）
- ❌ 不修改文档内容
- ❌ 不进行 Git 操作

## 成功标准

> **核心原则**：图片和元文件必须同时存在，缺一不可。只有图片没有元文件 = 失败。

1. **图片和元文件配对**：图片生成后，元文件必须立即创建并验证存在
2. **元信息完整**：`.meta.yaml` 必须包含以下字段：
   - `kind: image`
   - `slot.id`、`slot.key`、`slot.desc`
   - `generation.prompt`、`generation.model`、`generation.createdAt`
   - `documents`、`languages`
3. **Prompt 质量**：生成的 prompt 具体、可视化，结合了文档上下文
4. **路径正确**：文件保存在正确的目录结构中
5. **摘要包含元文件信息**：返回的摘要必须明确显示元文件路径

## 错误处理

### 参数缺失

```
错误: 缺少必需参数
缺失: docPath, slotId
建议: 请提供完整的文档路径和 slot 信息
```

### 文档不存在

```
错误: 文档不存在
路径: .aigne/doc-smith/docs/api/overview/zh.md
建议: 请先生成文档内容
```

### 生图失败

```
错误: 图片生成失败
原因: {具体错误}
建议: 检查 AIGNE CLI 配置和 API 密钥
```

### 元文件创建失败

```
错误: 元文件创建失败
图片: .aigne/doc-smith/assets/{key}/images/{locale}.png（已生成）
元文件: .aigne/doc-smith/assets/{key}/.meta.yaml（未创建）
状态: 任务未完成，请重新执行创建元文件步骤
```

**处理方式**：
1. 不要返回成功状态
2. 尝试重新创建 `.meta.yaml`
3. 验证文件确实存在后才能返回成功
