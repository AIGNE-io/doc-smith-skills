# DocSmith Skill

从工作区数据源生成全面的结构化文档的 Claude Code Skill。

## 功能特性

DocSmith 可以帮助你：
- 📚 从代码仓库、文本文件和媒体资源生成全面的文档
- 🏗️ 构建有组织的文档结构和文档站点
- 📝 分析工作区内容并生成结构化的文档
- 🔄 将代码/项目内容转换为可读的文档

支持生成：
- 技术文档
- 用户指南
- API 参考
- 教程和示例
- 产品文档

### 用户意图分析

DocSmith 会自动分析工作区内容，推断：
- **目标用户** - 文档的主要受众（开发者、运维人员、最终用户等）
- **使用场景** - 用户查阅文档的情境（首次接触、开发集成、问题排查等）
- **文档侧重点** - 文档类型（使用指南、API 参考、快速上手、架构说明等）

推断结果会展示给用户确认，支持多轮调整直到满意。

### 结构确认机制

在生成文档前，DocSmith 会展示规划的文档结构：
- 文档总数和层次关系
- 每个文档的标题、描述和来源文件
- 清晰的 emoji 标识便于快速浏览

用户可以：
- 删除/添加文档
- 调整层次结构（合并、拆分、调整父子关系）
- 修改内容范围

只有在用户确认结构后，才会开始生成实际内容。

## 项目结构

```
doc-smith-skill/
├── CLAUDE.md              # Claude Code 项目说明
├── doc-smith/             # Skill 主目录
│   ├── SKILL.md           # Skill 主文档（中文）
│   └── references/        # 参考文档
│       ├── document-structure-schema.md   # 文档结构 Schema
│       ├── structure-confirmation-guide.md # 结构确认指南
│       ├── structure-planning-guide.md    # 结构规划指南
│       └── user-intent-guide.md           # 用户意图指南
├── scripts/               # 安装/卸载脚本
│   ├── install.sh         # 安装脚本
│   ├── uninstall.sh       # 卸载脚本
│   └── README.md          # 脚本使用说明
└── README.md              # 本文件
```

## 快速开始

### 1. 安装 Skill

运行安装脚本将 doc-smith 安装到全局 skills 目录：

```bash
./scripts/install.sh -y
```

### 2. 使用 Skill

#### Workspace 模式 (推荐)

DocSmith 现在使用独立 workspace 目录，不会污染源仓库。

**创建并使用 workspace：**

```bash
# 1. 创建空目录作为 workspace
mkdir my-docs-workspace
cd my-docs-workspace

# 2. 打开 Claude Code 并执行 doc-smith
# 输入: 使用 doc-smith 生成文档
```

**初始化流程：**
DocSmith 会引导你完成初始化：
1. 询问输出语言（如：zh、en）
2. 询问源仓库 Git URL（可选，如果源代码在本地可不提供）
3. 自动创建目录结构
4. 自动添加源仓库为 git submodule（如果提供了 URL）
5. 生成 config.yaml 配置文件
6. 初始化 git 仓库并提交

**后续操作：**
DocSmith 会：
1. 分析源仓库内容
2. 推断用户意图
3. 规划文档结构
4. 生成结构化的 Markdown 文档
5. 询问是否提交到 Git

### 3. Workspace 目录结构

```
my-docs-workspace/              # 独立 workspace 目录
├── config.yaml                 # workspace 配置文件
├── sources/                    # 源仓库 (git submodule)
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
└── cache/                      # 临时数据 (不纳入 git)
```

### 4. 版本管理

Workspace 是一个独立的 Git 仓库，支持完整的版本管理：

```bash
# 查看历史
git log

# 查看变更
git diff

# 回滚版本
git revert <commit-hash>

# 推送到远程仓库（可选）
git remote add origin <your-repo-url>
git push -u origin main
```

## 文档说明

- **SKILL.md** - Skill 完整使用指南，包含工作流程、最佳实践等
- **references/**
  - **document-structure-schema.md** - 文档结构 YAML 的完整 Schema 说明
  - **structure-planning-guide.md** - 文档结构规划指南
  - **structure-confirmation-guide.md** - 结构确认流程指南
  - **user-intent-guide.md** - 用户意图理解指南

所有文档均已翻译为中文，方便理解和编辑。

## 卸载

如需移除 skill：

```bash
./scripts/uninstall.sh
```

## 手动安装

如果脚本无法使用，可以手动安装：

```bash
mkdir -p ~/.claude/skills
cp -r doc-smith ~/.claude/skills/
```

## 开发和自定义

如果你想修改或扩展 doc-smith skill：

1. 编辑 `doc-smith/SKILL.md` 中的说明文档
2. 修改 `doc-smith/references/` 中的参考文档
3. 运行 `./scripts/install.sh -y` 重新安装

## 注意事项

- 确保 Claude Code 已正确安装
- 确保 Git 已安装（用于 submodule 和版本管理）
- Workspace 需要在空目录中初始化
- 生成的文档在独立的 workspace 目录中，不会污染源仓库

## 迁移说明

如果你之前使用过旧版本（`.aigne/doc-smith/` 目录结构），建议：
1. 创建新的 workspace 目录
2. 重新生成文档
3. 旧版本数据可以手动迁移到新的 workspace 目录结构中

## 支持

如有问题或建议，请在项目中提出 issue。

## 许可

[根据你的需求添加许可信息]
