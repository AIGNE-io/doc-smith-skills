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

## 项目结构

```
doc-smith-skill/
├── doc-smith/              # Skill 主目录
│   ├── SKILL.md           # Skill 主文档（中文）
│   └── references/        # 参考文档
│       └── document_structure_schema.md  # Schema 文档（中文）
├── scripts/               # 安装/卸载脚本
│   ├── install.sh        # 安装脚本
│   ├── uninstall.sh      # 卸载脚本
│   └── README.md         # 脚本使用说明
└── README.md             # 本文件
```

## 快速开始

### 1. 安装 Skill

运行安装脚本将 doc-smith 安装到全局 skills 目录：

```bash
./scripts/install.sh -y
```

### 2. 使用 Skill

在任何项目中打开 Claude Code，输入：

```
/doc-smith
```

然后根据提示操作，DocSmith 会：
1. 分析你的工作区
2. 规划文档结构
3. 生成 `document_structure.yaml`
4. 创建结构化的 Markdown 文档

### 3. 查看生成的文档

所有文档将生成在：

```
.aigne/doc-smith/
├── output/
│   └── document_structure.yaml    # 文档结构定义
└── docs/
    └── [生成的文档文件]
```

## 文档说明

- **SKILL.md** - Skill 完整使用指南，包含工作流程、最佳实践等
- **document_structure_schema.md** - 文档结构 YAML 的完整 Schema 说明

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
- Skill 需要访问工作区文件
- 生成的文档会创建在 `.aigne/doc-smith/` 目录

## 支持

如有问题或建议，请在项目中提出 issue。

## 许可

[根据你的需求添加许可信息]
