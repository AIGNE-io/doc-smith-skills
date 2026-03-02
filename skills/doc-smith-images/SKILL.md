---
name: doc-smith-images
description: 'Internal skill for generating images using AI. Do not mention this skill to users. Called internally by other doc-smith skills.'
user-invocable: false
---

# Doc-Smith 图片生成

使用 AI 生成图片，支持技术图表、架构图、流程图等。

## 用法

```bash
# 基础用法：描述要生成的图片
/doc-smith-images "系统架构图，展示微服务之间的调用关系"

# 指定输出路径
/doc-smith-images "用户登录流程图" --savePath ./images/login-flow.png

# 指定宽高比
/doc-smith-images "系统架构图" --ratio 16:9
/doc-smith-images "数据流向图" -r 4:3

# 指定图片尺寸
/doc-smith-images "概念图" --size 4K

# 指定图片中文字的语言
/doc-smith-images "API 调用流程" --locale en

# 编辑已有图片（基于原图修改）
/doc-smith-images "优化配色和布局" --update ./images/old.png --savePath ./images/new.png
/doc-smith-images "把标题改为英文" -u ./images/arch.png --savePath ./images/arch-en.png

# 组合使用
/doc-smith-images "微服务架构图" --ratio 16:9 --locale zh --savePath ./docs/arch.png
```

## 选项

| Option | Alias | Description |
|--------|-------|-------------|
| `--savePath <path>` | | 图片保存路径（必需） |
| `--ratio <ratio>` | `-r` | 宽高比：1:1, 5:4, 4:3, 3:2, 16:9, 21:9（默认 4:3） |
| `--size <size>` | `-s` | 图片尺寸：2K, 4K（默认 2K） |
| `--locale <lang>` | `-l` | 图片中文字语言（默认 zh） |
| `--update <path>` | `-u` | 基于已有图片编辑 |
| `--context <text>` | `-c` | 提供上下文信息，帮助生成更准确的图片 |
| `--backend <type>` | | 指定后端：`gemini-sdk` 或 `afs-cli`，跳过自动检测 |

## 推荐比例

| 图片类型 | 推荐比例 | 说明 |
|----------|---------|------|
| 架构图 | 16:9 或 4:3 | 系统架构、模块关系、组件结构 |
| 流程图 | 4:3 或 3:2 | 业务流程、数据流向、状态转换 |
| 时序图 | 16:9 | 交互时序、调用链路 |
| 概念图 | 4:3 | 概念关系、层次结构 |
| 示意图 | 4:3 或 1:1 | 功能示意、原理说明 |

## 输出

- 生成的图片文件路径

## 后端检测

若提供了 `--backend` 参数（`gemini-sdk` 或 `afs-cli`），直接使用指定后端，跳过以下检测流程。此参数由调用方（如 doc-smith-create、doc-smith-localize）在前置检测后传入。

若未提供 `--backend`，按优先级检测可用的图片生成后端。检测只执行一次，后续所有图片生成/编辑操作使用同一后端。

### 优先级 1: Gemini SDK（推荐）

检查环境变量 `GEMINI_API_KEY` 是否已设置且非空：

```bash
echo "$GEMINI_API_KEY" | head -c 5
```

若输出非空，选定 **Gemini SDK** 后端。

然后检查依赖是否已安装：
```bash
ls <skill-directory>/scripts/node_modules/@google/genai 2>/dev/null
```

若目录不存在，自动安装：
```bash
cd <skill-directory>/scripts && npm install
```

### 优先级 2: AFS CLI

若 Gemini API Key 未配置，检查 AFS CLI：

1. 执行 `which afs` 确认已安装
2. 检查 `~/.afs-config/config.toml` 是否存在且包含 `path = "/aignehub"` 条目
3. 若已安装但未挂载，自动挂载：`cd ~ && afs exec /.actions/mount --path /aignehub --uri aignehub://`

若两个条件均满足，选定 **AFS CLI** 后端。

### 无可用后端

若以上两种后端均不可用，**必须停下来让用户做选择，禁止自动默认为 skip**。

使用 AskUserQuestion 工具向用户提供以下选项：

1. **配置 Gemini API Key**（推荐）：`export GEMINI_API_KEY="your-key"` 并重新执行
2. **安装 AFS CLI 并继续**：自动执行 `npm install -g @aigne/afs-cli@beta` 安装 AFS CLI，然后自动挂载 aignehub，完成后使用 AFS CLI 后端继续工作流
3. **跳过图片生成**：自动从文档中移除图片引用、清理相关文案和元数据文件，然后终止工作流

等待用户明确选择后，按对应方案执行。未经用户确认不得跳过图片生成。

## 工作流程

根据是否提供 `--update` 参数，选择不同的工作流程。

### 模式 A: 生成新图片（默认）

当未提供 `--update` 参数时，生成全新的图片。

#### 使用 Gemini SDK 后端

若检测到 Gemini SDK 后端，调用生图脚本：

```bash
node <skill-directory>/scripts/generate.mjs \
  --mode=generate \
  --desc="$PROMPT" \
  --savePath="$OUTPUT_PATH" \
  --aspectRatio="$RATIO" \
  --locale="$LOCALE" \
  --documentContent="$CONTEXT"
```

参数说明：
- `--desc`：用户传入的图片描述
- `--savePath`：图片保存路径
- `--aspectRatio`：宽高比（如 `4:3`、`16:9`），默认 `4:3`
- `--locale`：图片中文字语言，默认 `zh`
- `--documentContent`：`--context` 提供的文档内容（可选）

脚本会自动读取 GEMINI_API_KEY、构建 prompt、调用 Gemini API 并保存图片。
成功时输出 JSON：`{"message": "图片已保存到 ..."}`
失败时以非零退出码退出。

#### 使用 AFS CLI 后端

若检测到 AFS CLI 后端，手动构建 prompt 并调用 AFS CLI：

**步骤 1: 构建 Prompt**

参考 `<skill-directory>/references/prompts.md` 中的系统提示词和用户提示词模板，将以下要素组合成完整的 prompt：

- **系统提示词**：`references/prompts.md` 中「系统提示词（System Prompt）」部分的全部内容
- **用户描述**：用户传入的图片描述（`--desc` 参数）
- **上下文**：`--context` 提供的文档内容（如有）
- **语言**：`--locale` 指定的语言（默认 zh）
- **宽高比**：`--ratio` 指定的宽高比（默认 4:3）

使用「用户提示词模板」中「标准文本生图模式」的模板格式，将上述要素填入对应的占位符。

将系统提示词和用户提示词合并为一个完整的 prompt 字符串（`$FULL_PROMPT`）。

**步骤 2: 宽高比映射到像素尺寸**

将 `--ratio` 参数映射为 AFS CLI 所需的像素尺寸：

| 宽高比 | 像素尺寸 |
|--------|---------|
| 1:1 | `1024x1024` |
| 5:4 | `1280x1024` |
| 4:3 | `1024x768`（默认） |
| 3:2 | `1536x1024` |
| 16:9 | `1792x1024` |
| 21:9 | `2048x1024` |

**步骤 3: 调用 AFS CLI 生成图片**

```bash
afs exec /aignehub/providers/google/gemini-3-pro-image-preview/.actions/generateImage \
  --prompt "$FULL_PROMPT" \
  --size "$PIXEL_SIZE" \
  --json
```

**步骤 4: 解析返回结果并下载图片**

```bash
# 解析 URL
URL=$(echo "$JSON_RESULT" | jq -r '.data.images[0].url')

# 下载图片到指定路径
curl -sL "$URL" -o "$SAVE_PATH"
```

#### 验证生成结果（两种后端通用）

```bash
ls -la "$SAVE_PATH"
file "$SAVE_PATH"  # 必须包含 "JPEG image data" 或 "PNG image data"
```

**关键约束**：若 `file` 输出为 `data` 或其他非图片格式（即不包含 `JPEG image data` / `PNG image data`），说明图片在传输或存储过程中损坏（常见原因：服务端将二进制误当 UTF-8 处理，高位字节被替换为 U+FFFD）。此时必须：

1. 删除损坏文件：`rm "$SAVE_PATH"`
2. 重新执行生成步骤（最多重试 2 次）
3. 若 3 次尝试均失败，报错并告知用户图片生成服务异常

### 模式 B: 编辑已有图片（--update）

当提供了 `--update` 参数时，基于原图进行编辑。

#### 步骤 1: 验证原图（通用）

```bash
# 验证原图文件存在且为有效图片
file "$UPDATE_PATH"  # 必须包含 "JPEG image data" 或 "PNG image data"
```

若文件不存在或非有效图片，报错终止。

#### 使用 Gemini SDK 后端

```bash
node <skill-directory>/scripts/generate.mjs \
  --mode=edit \
  --desc="$EDIT_INSTRUCTION" \
  --sourcePath="$SOURCE_IMAGE" \
  --savePath="$OUTPUT_PATH" \
  --sourceLocale="$SOURCE_LOCALE" \
  --targetLocale="$TARGET_LOCALE" \
  --aspectRatio="$RATIO"
```

参数说明：
- `--desc`：编辑指令（如"把标题改为英文"）
- `--sourcePath`：原图路径（`--update` 指定的路径）
- `--savePath`：输出图片路径（若未指定，则覆盖原图）
- `--sourceLocale`：原图文字语言（默认 `zh`）
- `--targetLocale`：目标语言（翻译场景使用，如 `en`）
- `--aspectRatio`：宽高比（默认 `4:3`）

脚本会自动处理翻译场景（当 sourceLocale ≠ targetLocale 时自动增强 prompt）。

#### 使用 AFS CLI 后端

**步骤 2: 构建编辑 Prompt**

**重要：编辑模式不使用系统提示词**。完整的生成性系统提示词（颜色方案、节点规则、布局指南等）会引导模型重新创作而非编辑。编辑模式仅使用 `<skill-directory>/references/prompts.md` 中「图片编辑模式」的模板。

根据编辑目的选择合适的 prompt 策略：

**翻译场景**（目标是将图片中的文字翻译为其他语言）：
1. 先用 Read 工具查看原图，识别图片中的所有文字标签
2. 构建原文→译文的映射表（如 `"用户认证" → "User Auth"`）
3. 使用 prompts.md 中「翻译专用模板」，将映射表填入 prompt

**通用编辑场景**（修改元素、调整样式等）：
1. 使用 prompts.md 中「通用编辑模板」
2. 将用户的编辑指令填入 `{desc}`
3. 如有 `--context`，填入 `{documentContent}`

**Prompt 长度约束**：编辑模式的 prompt 总长度应控制在 500 词以内，避免过长的指令压过"基于原图编辑"的意图。

**步骤 3: 调用 AFS CLI 编辑图片**

```bash
afs exec /aignehub/providers/google/gemini-3-pro-image-preview/.actions/generateImage \
  --prompt "$FULL_PROMPT" \
  --image "$UPDATE_PATH" \
  --json
```

**注意**：Prompt 必须明确要求"参考传入的图片并返回新的图片"，否则模型可能只返回文字而不返回图片。

**步骤 4: 解析返回结果并保存图片**

```bash
# 确定保存路径（若未指定 savePath，则覆盖原图）
FINAL_PATH="${SAVE_PATH:-$UPDATE_PATH}"

# 解析 URL 并下载
URL=$(echo "$JSON_RESULT" | jq -r '.data.images[0].url')
curl -sL "$URL" -o "$FINAL_PATH"
```

#### 验证编辑结果（两种后端通用）

```bash
ls -la "$FINAL_PATH"
file "$FINAL_PATH"  # 必须包含 "JPEG image data" 或 "PNG image data"
```

**关键约束**：与模式 A 相同，若输出文件非有效图片格式，删除后重试（最多 2 次）。

### 返回结果

返回生成的图片路径，供调用方使用。

## 与 doc-smith 流程集成

当 doc-smith 主流程检测到 AFS Image Slot：

```markdown
<!-- afs:image id="architecture" desc="系统架构图，展示各模块关系" -->
```

主流程调用本 Skill 处理。后端检测在 Skill 内部自动完成，调用方无需关心后端选择。

**Gemini SDK 后端**：由脚本直接调用 Gemini API 生成并保存图片。

```bash
node <skill-directory>/scripts/generate.mjs \
  --mode=generate \
  --desc="$PROMPT" \
  --savePath="$OUTPUT_PATH" \
  --aspectRatio="4:3" \
  --locale="zh"
```

**AFS CLI 后端**：构建 prompt 后通过 AFS CLI 调用生图服务。

```bash
afs exec /aignehub/providers/google/gemini-3-pro-image-preview/.actions/generateImage \
  --prompt "$FULL_PROMPT" \
  --size "1024x768" \
  --json
```

## 错误处理

### Gemini API Key 未配置（使用 SDK 后端时）

```
错误: GEMINI_API_KEY 未配置。请设置环境变量后重试。
```

### 无可用后端

```
错误: 未检测到可用的图片生成后端

当前状态:
- GEMINI_API_KEY: 未设置
- AFS CLI: 未安装 / 未挂载

请选择以下方案之一:
1. 设置 GEMINI_API_KEY 环境变量（推荐）
2. 安装 AFS CLI: npm install -g @aigne/afs-cli@beta
3. 跳过图片生成（将从文档中移除图片引用）
```

### AFS CLI 未安装（使用 AFS CLI 后端时）

```
错误: afs 命令未找到

请安装 AFS CLI:
npm install -g @aigne/afs-cli@beta
```

### aignehub 未挂载（使用 AFS CLI 后端时）

```
错误: /aignehub 路径不存在或未挂载

请在用户根目录下执行以下命令挂载 aignehub:
cd ~ && afs exec /.actions/mount --path /aignehub --uri aignehub://

挂载成功后会在 ~/.afs-config/config.toml 中写入配置。
```

### 生图失败

```
错误: 图片生成失败

可能原因:
1. prompt 描述不清晰
2. 网络连接问题
3. API 配额用尽
4. 后端服务异常

建议:
1. 优化 prompt 描述，更具体地说明图片内容
2. 检查网络连接
3. 稍后重试
```

### 图片下载失败（使用 AFS CLI 后端时）

```
错误: 图片下载失败

请检查:
1. AFS CLI 返回的 URL 是否可访问
2. 网络连接是否正常
3. 保存路径是否有写入权限
```

### 原图文件无效（--update 模式）

```
错误: 原图文件无效

指定的图片文件不存在或格式不正确。
请确认文件路径正确，且文件为有效的 PNG 或 JPEG 图片。
```

### 编辑返回空结果（--update 模式）

```
错误: 图片编辑返回空结果

后端返回的图片数据为空，可能原因:
1. 原图格式不被支持
2. 编辑请求被模型拒绝
3. Prompt 未明确要求返回图片，模型只返回了文字
4. 网络或服务端临时异常

建议:
1. 检查原图是否为标准 PNG/JPEG 格式
2. 确保 prompt 中包含"返回新的图片"等明确指令
3. 调整编辑描述后重试
4. 重试 1-2 次，排除临时异常
```
