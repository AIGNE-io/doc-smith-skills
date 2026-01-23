# Logo-Smith 设计文档

## 概述

`logo-smith` 是一个 Claude Code Skill，用于通过 AI 生成和迭代优化 logo。与 `doc-smith-images`（面向技术文档图片）不同，logo-smith 专注于品牌标识设计，内置 logo 专用的提示词策略和引导式交互流程。

## 核心功能

1. **引导式需求收集** — 智能判断用户输入，必要时引导明确名称、用途、风格、颜色
2. **多版本生成** — 支持一次生成多个方案供用户选择
3. **迭代优化** — 基于已选方案进行修改，或完全重新生成
4. **现有 logo 修改** — 支持用户提供现有 logo 进行风格调整、重新设计等
5. **SVG 输出** — 可选的 PNG 转 SVG 矢量化功能

## 目录结构

```
skills/logo-smith/
└── SKILL.md              # 主入口

agents/
└── generate-logo.md      # logo 生成 sub-agent
```

## 命令接口

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

## 参数说明

| 参数 | 别名 | 说明 | 默认值 |
|------|------|------|--------|
| `--count <n>` | `-n` | 生成数量 | 1 |
| `--style <style>` | `-s` | 风格模板 | 无 |
| `--update <path>` | `-u` | 基于已有图片修改 | 无 |
| `--savePath <path>` | | 保存路径 | `./logo.png` |
| `--svg` | | 同时输出 SVG | false |
| `--regenerate` | | 完全重新生成 | false |
| `--quick` | `-q` | 跳过引导，直接生成 | false |

## 交互流程

### 引导式对话（默认）

当用户输入信息不充分时，Skill 主动收集关键信息：

```
用户: /logo-smith 我想做个 logo

Skill: 好的，我来帮你设计 logo。先了解几个关键信息：

1. 这个 logo 是给什么用的？
   A. 软件/应用产品
   B. 公司/团队
   C. 开源项目
   D. 活动/临时项目
   E. 其他（请说明）

用户: A

Skill: 产品叫什么名字？名字会出现在 logo 中吗？

用户: SmartBot，名字要出现

Skill: 你对风格有什么偏好吗？
   A. 极简/扁平
   B. 科技/未来感
   C. 友好/卡通
   D. 专业/商务
   E. 不确定，给我看几种

用户: B

Skill: 有偏好的颜色吗？或者有需要避开的颜色？

用户: 蓝色或紫色都行，不要红色

Skill: 明白了，我整理一下：
- 产品名：SmartBot
- 用途：软件产品 logo
- 风格：科技/未来感
- 颜色：蓝色或紫色系，避开红色
- 名称需要出现在 logo 中

确认无误的话，我生成 3 个方案供你选择？
```

### 智能判断逻辑

用户输入包含以下关键信息时，可跳过部分问题：
- **名称**：明确的产品/公司名
- **用途**：明确说明是什么类型的 logo
- **风格**：有明确的风格描述词
- **颜色**：有颜色偏好

```bash
# 信息充分，只确认后直接生成
/logo-smith "SmartBot，一个 AI 聊天产品，要科技感，蓝紫色"

Skill: 收到，为 SmartBot（AI 聊天产品）设计 logo：
- 风格：科技感
- 配色：蓝紫色系
- 名称显示在 logo 中

我生成 3 个方案，稍等...
```

### 迭代优化对话

```
用户: 方案 2 不错，但是文字再大一点，颜色深一些

Skill: 明白，基于方案 2 调整：
- 放大 "SmartBot" 文字
- 加深整体配色

正在优化...

Skill: 优化完成：./logo-2-v2.png
满意吗？还需要继续调整？
```

### 完全重新生成

```
用户: 这个方向不太对，换个完全不同的风格试试

Skill: 好的，要不要换个风格方向？
   A. 试试极简扁平风格
   B. 试试友好亲和风格
   C. 你来描述新的方向

用户: A

Skill: 好的，用极简风格重新设计，生成 3 个新方案...
```

## 风格模板

| 风格 ID | 名称 | 适用场景 | 提示词增强 |
|---------|------|----------|-----------|
| `minimal` | 极简扁平 | 现代产品、工具类应用 | 简洁几何形状、单色或双色、无渐变、留白充足 |
| `tech` | 科技未来 | AI、云服务、开发工具 | 科技感线条、渐变光效、抽象几何、蓝紫色调 |
| `friendly` | 友好亲和 | 社交、教育、生活类应用 | 圆润造型、明亮色彩、可爱元素、温暖感 |
| `pro` | 专业商务 | 企业服务、B2B 产品 | 稳重配色、经典字体、对称结构、信任感 |
| `creative` | 创意手绘 | 设计、艺术、手工品牌 | 手绘质感、自然笔触、独特个性、艺术感 |
| `gaming` | 游戏电竞 | 游戏、娱乐、电竞 | 动感造型、炫酷配色、力量感、视觉冲击 |

## 提示词策略

### 基础提示词（所有 logo 自动添加）

```
Logo 设计要求：
- 图形清晰、辨识度高
- 适合在各种尺寸下使用（从 favicon 到大型展示）
- 背景透明或纯色
- 主体居中，构图平衡
- 避免过于复杂的细节
```

### 提示词组装逻辑

```
最终 Prompt = 基础要求 + 用户描述 + 风格模板增强 + 颜色偏好 + 名称处理

示例：
用户输入: "SmartBot，AI 聊天产品"
选择风格: tech
颜色: 蓝紫色

组装后:
"为 SmartBot（AI 聊天产品）设计 logo。
Logo 名称 'SmartBot' 需要清晰可读地展示在设计中。
风格：科技感线条、渐变光效、抽象几何图形。
配色：蓝紫色系。
要求：图形清晰、辨识度高，适合各种尺寸，背景简洁，构图平衡。"
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

## SVG 转换

使用 [vtracer](https://github.com/visioncortex/vtracer) 进行位图矢量化：

```bash
vtracer --input logo.png --output logo.svg --colormode color
```

**安装方式**：
```bash
cargo install vtracer
# 或
brew install vtracer
```

**转换说明**：
> 注意：SVG 是从 PNG 自动矢量化生成的，可能需要在矢量编辑软件中微调。如需高质量矢量 logo，建议将 PNG 作为参考，使用专业设计工具重绘。

## 职责划分

### SKILL.md（主 Skill）

| 职责 | 说明 |
|------|------|
| 参数解析 | 解析 `--count`、`--style`、`--update` 等参数 |
| 智能判断 | 根据用户输入决定是否需要引导对话 |
| 需求收集 | 引导用户明确名称、用途、风格、颜色等 |
| 流程编排 | 决定调用多少个 sub-agent、是否并行 |
| 会话管理 | 记住已生成的版本、用户选择、迭代历史 |
| 结果展示 | 向用户展示生成结果，引导下一步 |
| SVG 转换 | 调用 vtracer 进行格式转换 |

### generate-logo.md（Sub-agent）

| 职责 | 说明 |
|------|------|
| 接收参数 | prompt、savePath、aspectRatio、updatePath |
| 组装提示词 | 将基础要求 + 风格模板 + 用户描述组装成完整 prompt |
| 调用生图 | 通过 AIGNE CLI 调用 Gemini 生图 |
| 返回结果 | 返回生成的图片路径或错误信息 |

### 调用关系示例

```markdown
# 用户要生成 3 个方案
主 Skill 并行调用 3 个 generate-logo sub-agent：

Sub-agent 1:
  - prompt: "SmartBot logo... 方案1侧重图形符号"
  - savePath: ./logo-1.png

Sub-agent 2:
  - prompt: "SmartBot logo... 方案2侧重文字设计"
  - savePath: ./logo-2.png

Sub-agent 3:
  - prompt: "SmartBot logo... 方案3图文结合"
  - savePath: ./logo-3.png
```

## 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| AIGNE CLI 未安装 | 提示安装命令 `npm install -g @aigne/cli` |
| API 密钥未配置 | 提示执行 `aigne hub connect` 或配置 `GEMINI_API_KEY` |
| 生图失败 | 提示可能原因，建议优化描述或稍后重试 |
| vtracer 未安装 | 提示安装方式，仍然返回 PNG 结果 |
| 更新的源图片不存在 | 提示文件路径错误 |
| 用户中断对话 | 保存已收集的信息，下次可继续 |

## 边界情况

```markdown
# 用户直接发图片要求修改
用户: [粘贴图片] 帮我改成蓝色

Skill: 收到图片。你想要：
- 仅改变配色为蓝色系？
- 还是有其他调整？

# 用户需求太模糊
用户: 帮我做个好看的 logo

Skill: 好的！先告诉我几个关键信息：
这个 logo 是给什么用的？产品、公司、还是其他？

# 用户要求超出能力范围
用户: 生成一个能动的 logo

Skill: 目前只支持静态图片 logo。
动态 logo（GIF/视频）暂不支持，建议使用专业动效工具制作。
```

## 技术依赖

- **AIGNE CLI** — 调用 Gemini 生图模型
- **vtracer**（可选） — PNG 转 SVG 矢量化

## 后续扩展

- 支持更多风格模板
- 支持导出多种尺寸（favicon、社交媒体头像等）
- 支持生成 logo 使用规范文档
