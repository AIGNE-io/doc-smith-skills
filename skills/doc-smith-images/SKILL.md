---
name: doc-smith-images
description: 使用 AI 生成图片。当需要生成技术图表、架构图、流程图，或更新已有图片时使用此技能。这是一个通用的图片生成能力，可用于任何场景。
---

# Doc-Smith 图片生成

使用 AI 生成图片，支持技术图表、架构图、流程图等。

## 触发场景

- 文档中有 AFS Image Slot 需要生成图片
- 用户要求生成某张图片
- 用户要求更新/修改已有图片
- 任何需要 AI 生成图片的场景

## 核心能力

这是一个**通用的图片生成能力**，不与文档强绑定。

**输入参数：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `prompt` | string | 是 | 图片描述/生成提示词 |
| `size` | string | 否 | 图片尺寸，默认 "2K" |
| `ratio` | string | 否 | 宽高比，默认 "4:3"，可选 "1:1", "5:4", "4:3", "3:2", "16:9", "21:9" |
| `outputPath` | string | 否 | 图片保存路径 |
| `locale` | string | 否 | 图片中文字的语言，默认 "zh" |
| `context` | string | 否 | 上下文信息（如文档内容），帮助生成更准确的图片 |
| `existingImage` | string | 否 | 已有图片路径，用于图片更新场景 |

**输出：**
- 生成的图片文件路径

## 工作流程

### 1. 收集生图参数

从用户输入或调用方收集必要参数：

```
必需参数：
- prompt: 描述要生成的图片内容

可选参数：
- size: 默认 "2K"
- ratio: 默认 "4:3"
- outputPath: 默认根据 prompt 生成
- locale: 默认 "zh"
```

### 2. 调用 AIGNE 生图

通过 bash 调用 AIGNE 项目执行生图：

```bash
cd <skill-directory>/scripts/aigne-generate
aigne run . generate \
  --prompt="$PROMPT" \
  --size="$SIZE" \
  --ratio="$RATIO" \
  --locale="$LOCALE" \
  --output="$OUTPUT_PATH"
```

**参数映射：**
- `prompt` → AIGNE 的 `desc` 参数
- `context` → AIGNE 的 `documentContent` 参数
- `ratio` → AIGNE 的 `aspectRatio` 参数

### 3. 验证生成结果

检查图片是否成功生成：

```bash
ls -la "$OUTPUT_PATH"
file "$OUTPUT_PATH"  # 验证是图片格式
```

### 4. 返回结果

返回生成的图片路径，供调用方使用。

## 使用示例

### 独立生成图片

```
用户：帮我生成一张系统架构图，展示微服务之间的调用关系

处理：
1. prompt: "系统架构图，展示微服务之间的调用关系，包括 API Gateway、用户服务、订单服务、支付服务的交互"
2. ratio: "16:9"（架构图适合宽屏）
3. 调用 AIGNE 生图
4. 返回图片路径
```

### 在文档流程中使用

当 doc-smith 主流程检测到 AFS Image Slot：

```markdown
<!-- afs:image id="architecture" desc="系统架构图，展示各模块关系" -->
```

主流程提取参数并调用此技能：
- `prompt`: "系统架构图，展示各模块关系"
- `context`: 文档内容（帮助理解上下文）
- `outputPath`: `.aigne/doc-smith/assets/architecture/images/zh.png`

### 更新已有图片

```
用户：把这张架构图的比例改成 16:9

处理：
1. existingImage: 原图片路径
2. prompt: 原有描述
3. ratio: "16:9"
4. 调用 AIGNE 生图（image-to-image 模式）
5. 返回新图片路径
```

## 图片类型支持

| 类型 | 说明 | 推荐比例 |
|------|------|---------|
| **架构图** | 系统架构、模块关系、组件结构 | 16:9 或 4:3 |
| **流程图** | 业务流程、数据流向、状态转换 | 4:3 或 3:2 |
| **时序图** | 交互时序、调用链路 | 16:9 |
| **概念图** | 概念关系、层次结构 | 4:3 |
| **示意图** | 功能示意、原理说明 | 4:3 或 1:1 |

## 注意事项

- 此 Skill 依赖 AIGNE 框架执行实际生图（Claude Code 不支持生图）
- 确保 AIGNE CLI 已安装：`npm install -g @anthropic/aigne-cli`
- 生图使用 Google Gemini 模型，需要配置相应的 API 密钥
- 生图可能需要一定时间，请耐心等待

## 错误处理

### AIGNE CLI 未安装

```
错误: aigne 命令未找到

请安装 AIGNE CLI:
npm install -g @anthropic/aigne-cli
```

### API 密钥未配置

```
错误: 生图模型认证失败

请检查 Google Gemini API 密钥配置。
```

### 生图失败

```
错误: 图片生成失败

可能原因:
1. prompt 描述不清晰
2. 网络连接问题
3. API 配额用尽

建议:
1. 优化 prompt 描述，更具体地说明图片内容
2. 检查网络连接
3. 稍后重试
```
