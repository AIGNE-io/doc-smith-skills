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

# 更新已有图片（基于原图修改）— ⚠️ 暂不可用，见模式 B 说明
/doc-smith-images "优化配色和布局" --update ./images/old.png

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
| `--update <path>` | `-u` | 基于已有图片更新（⚠️ 暂不可用，见模式 B） |
| `--context <text>` | `-c` | 提供上下文信息，帮助生成更准确的图片 |

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

## 前置依赖

在执行工作流前，按顺序完成以下检查：

1. **AFS CLI**：执行 `which afs` 确认已安装，若未找到则执行 `npm install -g @aigne/afs-cli@beta`
2. **挂载 aignehub**（必须在用户根目录 `~` 下执行）：
   - 检查 `~/.afs-config/config.toml` 是否存在且包含 `path = "/aignehub"` 条目
   - 若已存在，说明已挂载，跳过
   - 若不存在，执行：`cd ~ && afs exec /.actions/mount --path /aignehub --uri aignehub://`

## 工作流程

根据是否提供 `--update` 参数，选择不同的工作流程。

### 模式 A: 生成新图片（默认）

当未提供 `--update` 参数时，生成全新的图片。

#### 步骤 1: 构建 Prompt

参考 `<skill-directory>/references/prompts.md` 中的系统提示词和用户提示词模板，将以下要素组合成完整的 prompt：

- **系统提示词**：`references/prompts.md` 中「系统提示词（System Prompt）」部分的全部内容
- **用户描述**：用户传入的图片描述（`--desc` 参数）
- **上下文**：`--context` 提供的文档内容（如有）
- **语言**：`--locale` 指定的语言（默认 zh）
- **宽高比**：`--ratio` 指定的宽高比（默认 4:3）

使用「用户提示词模板」中「标准文本生图模式」的模板格式，将上述要素填入对应的占位符。

将系统提示词和用户提示词合并为一个完整的 prompt 字符串（`$FULL_PROMPT`）。

#### 步骤 2: 宽高比映射到像素尺寸

将 `--ratio` 参数映射为 AFS CLI 所需的像素尺寸：

| 宽高比 | 像素尺寸 |
|--------|---------|
| 1:1 | `1024x1024` |
| 5:4 | `1280x1024` |
| 4:3 | `1024x768`（默认） |
| 3:2 | `1536x1024` |
| 16:9 | `1792x1024` |
| 21:9 | `2048x1024` |

#### 步骤 3: 调用 AFS CLI 生成图片

```bash
afs exec /aignehub/.actions/generateImage \
  --model gemini-3-pro-image-preview \
  --prompt "$FULL_PROMPT" \
  --size "$PIXEL_SIZE" \
  --outputFileType url \
  --json
```

#### 步骤 4: 解析返回结果并下载图片

AFS CLI 返回 JSON，解析 `data.urls[0]` 获取图片 URL：

```bash
# 解析 URL
URL=$(echo "$JSON_RESULT" | jq -r '.data.urls[0]')

# 下载图片到指定路径
curl -sL "$URL" -o "$SAVE_PATH"
```

#### 步骤 5: 验证生成结果

```bash
ls -la "$SAVE_PATH"
file "$SAVE_PATH"  # 必须包含 "JPEG image data" 或 "PNG image data"
```

**关键约束**：若 `file` 输出为 `data` 或其他非图片格式（即不包含 `JPEG image data` / `PNG image data`），说明图片在传输或存储过程中损坏（常见原因：服务端将二进制误当 UTF-8 处理，高位字节被替换为 U+FFFD）。此时必须：

1. 删除损坏文件：`rm "$SAVE_PATH"`
2. 重新执行步骤 3-4（最多重试 2 次）
3. 若 3 次尝试均失败，报错并告知用户图片生成服务异常

### 模式 B: 编辑已有图片（--update）

> ⚠️ **TODO**: AFS CLI 暂不支持 `editImage` 接口，`--update` 模式暂时不可用。
> 当 AFS 支持 editImage 后再实现此模式。

当调用时提供了 `--update` 参数，应给出以下提示信息并终止：

```
⚠️ --update 模式暂不可用。

AFS CLI 当前仅支持 generateImage，尚不支持 editImage（image-to-image）。
该功能将在 AFS 支持 editImage 接口后实现。

替代方案：可以尝试使用 --context 参数描述原图内容，通过生成新图片来替代编辑。
```

### 返回结果

返回生成的图片路径，供调用方使用。

## 与 doc-smith 流程集成

当 doc-smith 主流程检测到 AFS Image Slot：

```markdown
<!-- afs:image id="architecture" desc="系统架构图，展示各模块关系" -->
```

主流程调用本 Skill 处理，内部通过 AFS CLI 生成图片：

```bash
# 由 SKILL.md 工作流执行
afs exec /aignehub/.actions/generateImage \
  --model gemini-3-pro-image-preview \
  --prompt "$FULL_PROMPT" \
  --size "1024x768" \
  --outputFileType url \
  --json
```

## 注意事项

- 此 Skill 依赖 AFS CLI 执行实际生图
- 确保 AFS CLI 已安装：`npm install -g @aigne/afs-cli@beta`
- 确保 aignehub 已挂载：检查 `~/.afs-config/config.toml` 是否包含 `/aignehub` 条目，若无则在 `~` 下执行 `afs exec /.actions/mount --path /aignehub --uri aignehub://`
- 生图可能需要一定时间，请耐心等待

## 错误处理

### AFS CLI 未安装

```
错误: afs 命令未找到

请安装 AFS CLI:
npm install -g @aigne/afs-cli@beta
```

### aignehub 未挂载

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
4. AFS CLI 返回的 URL 无效

建议:
1. 优化 prompt 描述，更具体地说明图片内容
2. 检查网络连接
3. 检查 AFS CLI 返回的 JSON 是否包含有效 URL
4. 稍后重试
```

### 图片下载失败

```
错误: 图片下载失败

请检查:
1. AFS CLI 返回的 URL 是否可访问
2. 网络连接是否正常
3. 保存路径是否有写入权限
```
