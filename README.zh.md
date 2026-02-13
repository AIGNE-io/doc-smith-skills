# doc-smith-skills

[English](./README.md) | 中文

AI 驱动的文档生成、翻译和发布 Claude Code Skills。

## 前置条件

- 已安装 [Claude Code](https://claude.com/claude-code)
- 已安装 AIGNE CLI：`npm i -g @aigne/cli`

## 安装

### 快速安装（推荐）

```bash
npx add-skill AIGNE-io/doc-smith-skills
```

### 注册为插件市场

在 Claude Code 中运行以下命令：

```bash
/plugin marketplace add AIGNE-io/doc-smith-skills
```

### 安装 Skills

**方式一：通过界面浏览**

1. 选择 **Browse and install plugins**
2. 选择 **doc-smith-skills**
3. 选择要安装的插件
4. 选择 **Install now**

**方式二：直接安装**

```bash
# 安装指定插件
/plugin install doc-smith@doc-smith-skills
```

**方式三：让 Agent 帮你安装**

直接告诉 Claude Code：

> 请从 github.com/ArcBlock/doc-smith-skills 安装 Skills

## 可用 Skills

| Skill | 说明 |
|-------|------|
| [doc-smith-create](#doc-smith-create) | 从工作区数据源生成和更新结构化文档 |
| [doc-smith-localize](#doc-smith-localize) | 将文档翻译成多种语言 |
| [doc-smith-publish](#doc-smith-publish) | 发布文档到 DocSmith Cloud 在线预览 |

内部 Skills（由以上 Skills 自动调用，无需手动使用）：

| Skill | 说明 |
|-------|------|
| doc-smith-build | 将 Markdown 文档构建为静态 HTML |
| doc-smith-check | 验证文档结构和内容完整性 |
| doc-smith-images | 使用 AI 生成图片（图表、流程图、架构图） |

---

### doc-smith-create

从代码仓库、文本文件和媒体资源生成全面的文档。

```bash
# 为当前项目生成英文文档
/doc-smith-create Generate English documentation for the current project

# 为当前项目生成中文文档
/doc-smith-create 为当前项目生成中文文档
```

**功能特性：**
- 分析源代码和项目结构
- 推断用户意图和目标受众
- 规划文档结构并与用户确认
- 生成组织良好的文档，输出为 HTML 格式
- AI 生成图片（图表、架构图等）
- 支持技术文档、用户指南、API 参考和教程

---

### doc-smith-localize

将文档翻译成多种语言，支持批量翻译和术语一致性。

```bash
# 翻译所有文档到英文
/doc-smith-localize --lang en

# 翻译到多个语言
/doc-smith-localize --lang en --lang ja

# 只翻译指定文档
/doc-smith-localize --lang en --path /overview

# 强制重新翻译
/doc-smith-localize --lang en --force
```

**功能特性：**
- HTML 到 HTML 直接翻译（无中间 Markdown 步骤）
- 批量翻译，支持进度跟踪
- 跨文档术语一致性
- 图片文字翻译支持
- 基于 hash 的增量翻译（自动跳过未变更内容）

---

### doc-smith-publish

将生成的文档一键发布到 DocSmith Cloud，获取在线预览地址。

```bash
# 使用默认设置发布
/doc-smith-publish

# 指定发布目录
/doc-smith-publish --dir .aigne/doc-smith/dist

# 发布到自定义 Hub
/doc-smith-publish --hub https://custom.hub.io
```

**功能特性：**
- 一键发布到 DocSmith Cloud
- 自动资源上传和优化
- 返回在线预览 URL

## Workspace 目录结构

DocSmith 在 `.aigne/doc-smith/` 目录创建独立的 workspace（含独立 git 仓库）：

```
my-project/                            # 用户的项目目录（cwd）
├── .aigne/
│   └── doc-smith/                     # DocSmith workspace（独立 git 仓库）
│       ├── config.yaml                # Workspace 配置文件
│       ├── intent/
│       │   └── user-intent.md         # 用户意图描述
│       ├── planning/
│       │   └── document-structure.yaml # 文档结构计划
│       ├── docs/                      # 文档元数据
│       │   └── overview/
│       │       └── .meta.yaml         # 元信息 (kind/source/default)
│       ├── dist/                      # 构建后的 HTML 输出
│       │   ├── index.html             # 重定向到默认语言
│       │   ├── zh/
│       │   │   ├── index.html
│       │   │   └── docs/
│       │   │       └── overview.html
│       │   ├── en/
│       │   │   ├── index.html
│       │   │   └── docs/
│       │   │       └── overview.html
│       │   └── assets/
│       │       ├── docsmith.css       # 内置基础样式
│       │       ├── theme.css          # 用户主题
│       │       └── nav.js            # 导航数据（侧边栏 + 语言切换）
│       ├── assets/                    # 生成的图片资源
│       │   └── architecture/
│       │       ├── .meta.yaml
│       │       └── images/
│       │           ├── zh.png
│       │           └── en.png
│       └── cache/                     # 临时数据（不纳入 git）
├── src/                               # 项目源代码（数据源）
└── ...
```

## 作者

**ArcBlock** - [blocklet@arcblock.io](mailto:blocklet@arcblock.io)

GitHub: [@ArcBlock](https://github.com/ArcBlock)

## 许可

Elastic-2.0 License
