# doc-smith-skills

[English](./README.md) | 中文

AI 驱动的文档生成和管理 Claude Code Skills。

## 前置条件

- 已安装 [Claude Code](https://claude.com/claude-code)
- 已安装 AIGNE CLI：`npm i -g @aigne/cli`

## 安装

### 快速安装（推荐）

```bash
npx add-skill ArcBlock/doc-smith-skills
```

### 注册为插件市场

在 Claude Code 中运行以下命令：

```bash
/plugin marketplace add ArcBlock/doc-smith-skills
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
/plugin install doc-smith-skills@doc-smith-skills
```

**方式三：让 Agent 帮你安装**

直接告诉 Claude Code：

> 请从 github.com/ArcBlock/doc-smith-skills 安装 Skills

## 可用 Skills

| Skill | 说明 |
|-------|------|
| [doc-smith](#doc-smith) | 从工作区数据源生成结构化文档 |
| [doc-smith-translate](#doc-smith-translate) | 将文档翻译成多种语言 |
| [doc-smith-publish](#doc-smith-publish) | 发布文档到在线平台 |

---

### doc-smith

从代码仓库、文本文件和媒体资源生成全面的文档。

```bash
# 为当前项目生成英文文档
/doc-smith Generate English documentation for the current project

# 为当前项目生成中文文档
/doc-smith 为当前项目生成中文文档
```

**功能特性：**
- 分析源代码和项目结构
- 推断用户意图和目标受众
- 规划文档结构并与用户确认
- 生成组织良好的 Markdown 文档
- 支持技术文档、用户指南、API 参考和教程

---

### doc-smith-translate

将文档翻译成多种语言，支持批量翻译和术语一致性。

```bash
# 翻译所有文档到英文
/doc-smith-translate 翻译所有文档到英文

# 翻译到多个语言
/doc-smith-translate Translate all documents to English and Japanese

# CLI 格式
/doc-smith-translate --lang en
/doc-smith-translate --lang en --lang ja
```

**功能特性：**
- 批量翻译，支持进度跟踪
- 跨文档术语一致性
- 图片文字翻译支持
- 增量翻译（跳过已翻译内容）

---

### doc-smith-publish

发布生成的文档到在线平台。

```bash
# 发布到已配置的目标
/doc-smith-publish 发布文档到网站

# 发布到指定 URL
/doc-smith-publish Publish documents to https://example.com/docs

# CLI 格式
/doc-smith-publish --url https://example.com/docs
```

**功能特性：**
- 发布到 ArcBlock 驱动的文档站点
- 自动资源上传和优化
- 版本管理支持

## Workspace 目录结构

DocSmith 使用独立的 workspace 目录：

```
my-docs-workspace/
├── config.yaml                 # Workspace 配置文件
├── sources/                    # 源仓库（git submodule）
│   └── my-project/
├── intent/
│   └── user-intent.md          # 用户意图描述
├── planning/
│   └── document-structure.yaml # 文档结构计划
├── docs/                       # 生成的文档
│   ├── overview.md
│   ├── getting-started.md
│   └── api/
│       └── authentication.md
└── cache/                      # 临时数据（不纳入 git）
```

## 卸载

```bash
./scripts/uninstall.sh
```

## 作者

**ArcBlock** - [blocklet@arcblock.io](mailto:blocklet@arcblock.io)

GitHub: [@ArcBlock](https://github.com/ArcBlock)

## 许可

Elastic-2.0 License
