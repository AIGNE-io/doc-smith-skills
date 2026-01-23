---
name: logo-smith
description: 使用 AI 生成和迭代优化 logo。支持引导式需求收集、多版本生成、迭代优化、现有 logo 修改。当用户需要创建 logo、设计品牌标识、修改现有 logo 时使用此 Skill。
---

# Logo-Smith

使用 AI 生成和迭代优化 logo，专注于品牌标识设计。

## Usage

```bash
# 引导式（推荐，默认）
/logo-smith
/logo-smith 我想做个 logo

# 快速生成（信息已明确时）
/logo-smith "ArcBlock 科技公司 logo，极简风格，蓝色系" --quick

# 指定生成数量
/logo-smith "咖啡店 logo" --count 3

# 指定风格模板
/logo-smith "游戏工作室 logo" --style minimal
/logo-smith "手工艺品牌" --style creative

# 基于现有 logo 修改
/logo-smith "改成蓝色系配色" --update ./old-logo.png
/logo-smith "简化设计" -u ./complex-logo.png

# 完全重新生成（不使用 image-to-image）
/logo-smith "换个方向" --regenerate

# 输出 SVG 格式
/logo-smith "极简 logo" --svg

# 指定保存路径
/logo-smith "项目 logo" --savePath ./assets/logo.png

# 组合使用
/logo-smith "AI 产品 logo，名称 SmartBot" --count 4 --style tech --svg
```

## Options

| 参数 | 别名 | 说明 | 默认值 |
|------|------|------|--------|
| `--count <n>` | `-n` | 生成数量 | 1 |
| `--style <style>` | `-s` | 风格模板（minimal/tech/friendly/pro/creative/gaming） | 无 |
| `--update <path>` | `-u` | 基于已有图片修改 | 无 |
| `--savePath <path>` | | 保存路径 | `./logo.png` |
| `--svg` | | 同时输出 SVG | false |
| `--regenerate` | | 完全重新生成（不使用上一次的图片） | false |
| `--quick` | `-q` | 跳过引导对话，直接生成 | false |

## 风格模板

| 风格 ID | 名称 | 适用场景 | 提示词增强 |
|---------|------|----------|-----------|
| `minimal` | 极简扁平 | 现代产品、工具类应用 | 简洁几何形状、单色或双色、无渐变、留白充足 |
| `tech` | 科技未来 | AI、云服务、开发工具 | 科技感线条、渐变光效、抽象几何、蓝紫色调 |
| `friendly` | 友好亲和 | 社交、教育、生活类应用 | 圆润造型、明亮色彩、可爱元素、温暖感 |
| `pro` | 专业商务 | 企业服务、B2B 产品 | 稳重配色、经典字体、对称结构、信任感 |
| `creative` | 创意手绘 | 设计、艺术、手工品牌 | 手绘质感、自然笔触、独特个性、艺术感 |
| `gaming` | 游戏电竞 | 游戏、娱乐、电竞 | 动感造型、炫酷配色、力量感、视觉冲击 |

## 工作流程

### 步骤 1：解析参数

解析用户输入的参数：
- `--count`：生成数量（默认 1）
- `--style`：风格模板
- `--update`：源图片路径（编辑模式）
- `--savePath`：保存路径（默认 `./logo.png`）
- `--svg`：是否输出 SVG
- `--regenerate`：是否完全重新生成
- `--quick`：是否跳过引导

### 步骤 2：智能判断是否需要引导对话

分析用户输入，检查是否包含以下关键信息：
- **名称**：明确的产品/公司名
- **用途**：明确说明是什么类型的 logo
- **风格**：有明确的风格描述词
- **颜色**：有颜色偏好

**判断规则**：
- 如果用户使用 `--quick` 参数，跳过引导
- 如果以上信息都明确，只做简单确认后直接生成
- 如果缺少关键信息，进入引导对话收集

### 步骤 3：引导式需求收集（如需要）

逐步收集关键信息，每次只问一个问题：

**问题 1：用途**
```
这个 logo 是给什么用的？
A. 软件/应用产品
B. 公司/团队
C. 开源项目
D. 活动/临时项目
E. 其他（请说明）
```

**问题 2：名称**
```
产品/公司叫什么名字？名字需要出现在 logo 中吗？
```

**问题 3：风格**
```
你对风格有什么偏好吗？
A. 极简/扁平
B. 科技/未来感
C. 友好/卡通
D. 专业/商务
E. 创意/手绘
F. 游戏/电竞
G. 不确定，给我看几种
```

**问题 4：颜色**
```
有偏好的颜色吗？或者有需要避开的颜色？
```

**确认信息**：
收集完成后，汇总并请用户确认：
```
明白了，我整理一下：
- 名称：{name}
- 用途：{purpose} logo
- 风格：{style}
- 颜色：{color}
- 名称{是否}出现在 logo 中

确认无误的话，我生成 {count} 个方案供你选择？
```

### 步骤 4：组装提示词

**基础提示词**（所有 logo 自动添加）：
```
Logo 设计要求：
- 图形清晰、辨识度高
- 适合在各种尺寸下使用（从 favicon 到大型展示）
- 背景透明或纯色
- 主体居中，构图平衡
- 避免过于复杂的细节
```

**组装逻辑**：
```
最终 Prompt = 基础要求 + 用户描述 + 风格模板增强 + 颜色偏好 + 名称处理

示例：
"为 SmartBot（AI 聊天产品）设计 logo。
Logo 名称 'SmartBot' 需要清晰可读地展示在设计中。
风格：科技感线条、渐变光效、抽象几何图形。
配色：蓝紫色系。
要求：图形清晰、辨识度高，适合各种尺寸，背景简洁，构图平衡。"
```

### 步骤 5：调用 doc-smith:generate-logo sub-agent 生成图片

根据 `--count` 参数决定调用方式：

**单个生成**：
```
使用 doc-smith:generate-logo sub-agent 生成 logo：
- prompt: {组装后的完整提示词}
- savePath: {保存路径}
- aspectRatio: 1:1
```

**多个并行生成**：
```
使用 doc-smith:generate-logo sub-agent 并行生成以下 logo：

Sub-agent 1:
- prompt: "{基础提示词}... 方案1：侧重图形符号表达"
- savePath: ./logo-1.png

Sub-agent 2:
- prompt: "{基础提示词}... 方案2：侧重文字设计"
- savePath: ./logo-2.png

Sub-agent 3:
- prompt: "{基础提示词}... 方案3：图文结合"
- savePath: ./logo-3.png
```

**编辑模式**（使用 `--update`）：
```
使用 doc-smith:generate-logo sub-agent 编辑现有 logo：
- prompt: {修改要求}
- savePath: {保存路径}
- updatePath: {源图片路径}
```

### 步骤 6：展示结果并引导下一步

生成完成后，展示结果并引导用户：

**单个结果**：
```
logo 已生成：./logo.png

满意吗？可以：
- 告诉我需要调整的地方（如：文字大一点、颜色深一些）
- 说"换个方向"完全重新设计
- 说"ok"结束
```

**多个结果**：
```
生成了 3 个方案：
1. ./logo-1.png - 图形符号风格
2. ./logo-2.png - 文字设计风格
3. ./logo-3.png - 图文结合风格

你可以：
- 选择一个（如："用方案 2"）
- 基于某个方案调整（如："方案 2 不错，但文字再大一点"）
- 说"都不太满意"重新生成
```

### 步骤 7：迭代优化（如需要）

根据用户反馈决定下一步：

**基于已有方案调整**：
```
用户: 方案 2 不错，但是文字再大一点

明白，基于方案 2 调整：放大文字。
正在优化...

优化完成：./logo-2-v2.png
满意吗？还需要继续调整？
```

**完全重新生成**：
```
用户: 这个方向不太对，换个风格

好的，要换什么风格方向？
A. 极简扁平
B. 友好亲和
C. 你来描述新的方向
```

### 步骤 8：SVG 转换（如启用 --svg）

如果用户启用了 `--svg` 参数，在 PNG 生成后进行转换：

```bash
vtracer --input {png_path} --output {svg_path} --colormode color
```

**检查 vtracer 是否安装**：
```bash
which vtracer
```

如果未安装，提示用户：
```
vtracer 未安装，PNG 已生成，跳过 SVG 转换。

安装方式：
- cargo install vtracer
- 或 brew install vtracer

注意：SVG 是从 PNG 自动矢量化生成的，可能需要在矢量编辑软件中微调。
```

## 文件保存结构

```bash
# 单个 logo（默认）
./logo.png

# 多版本生成时
./logo-1.png
./logo-2.png
./logo-3.png

# 迭代版本
./logo-2-v2.png
./logo-2-v3.png

# 指定路径时
./assets/brand/logo.png

# 启用 --svg 时
./logo.png
./logo.svg
```

## 会话状态管理

在整个对话过程中，记住以下信息：
- 已生成的所有版本及其路径
- 用户的选择偏好
- 迭代历史（哪个版本是基于哪个版本修改的）
- 收集到的需求信息（名称、用途、风格、颜色）

## 错误处理

### AIGNE CLI 未安装

```
错误: aigne 命令未找到

请安装 AIGNE CLI:
npm install -g @aigne/cli
```

### API 密钥未配置

```
错误: 生图模型认证失败

请执行 `aigne hub connect` 连接到 AIGNE Hub 使用服务，
或在环境变量中配置 Google Gemini API 密钥 `GEMINI_API_KEY`。
```

### 生图失败

```
错误: 图片生成失败

可能原因:
1. prompt 描述不清晰
2. 网络连接问题
3. API 配额用尽

建议:
1. 优化描述，更具体地说明 logo 内容
2. 检查网络连接
3. 稍后重试
```

### 源图片不存在（--update 模式）

```
错误: 源图片不存在
路径: {path}

请检查文件路径是否正确。
```

### vtracer 未安装（--svg 模式）

```
PNG 已生成：{png_path}

vtracer 未安装，跳过 SVG 转换。
安装方式：
- cargo install vtracer
- 或 brew install vtracer
```

## 边界情况处理

### 用户直接发图片要求修改

```
用户: [粘贴图片] 帮我改成蓝色

收到图片。你想要：
- 仅改变配色为蓝色系？
- 还是有其他调整？
```

### 用户需求太模糊

```
用户: 帮我做个好看的 logo

好的！先告诉我几个关键信息：
这个 logo 是给什么用的？产品、公司、还是其他？
```

### 用户要求超出能力范围

```
用户: 生成一个能动的 logo

目前只支持静态图片 logo。
动态 logo（GIF/视频）暂不支持，建议使用专业动效工具制作。
```

## 注意事项

- 此 Skill 依赖 AIGNE CLI 调用 Gemini 生图模型
- Logo 生成可能需要一定时间，请耐心等待
- SVG 转换是可选功能，需要额外安装 vtracer
- 生成的 SVG 是自动矢量化的结果，如需高质量矢量 logo 建议使用专业设计工具
