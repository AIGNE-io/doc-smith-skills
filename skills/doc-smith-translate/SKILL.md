---
name: doc-smith-translate
description: 将 Doc-Smith 生成的文档翻译成多种语言。当用户要求翻译文档、本地化、多语言支持时使用此技能。支持批量翻译和单篇翻译。
---

# Doc-Smith 文档翻译

将文档翻译成多种语言，支持批量翻译和术语一致性。

## Usage

```bash
# 翻译所有文档到指定语言
/doc-smith-translate --lang en
/doc-smith-translate -l en

# 翻译到多个语言
/doc-smith-translate --lang en --lang ja
/doc-smith-translate -l en -l ja

# 只翻译指定文档
/doc-smith-translate --lang en --path /overview
/doc-smith-translate -l en -p /overview

# 翻译多个指定文档
/doc-smith-translate --lang en --path /overview --path /api/auth

# 强制重新翻译（覆盖已有翻译）
/doc-smith-translate --lang en --force
/doc-smith-translate -l en -f
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--lang <code>` | `-l` | 目标语言代码（可多次使用），如 en, ja, fr, de |
| `--path <docPath>` | `-p` | 指定要翻译的文档路径（可多次使用），不指定则翻译全部 |
| `--force` | `-f` | 强制重新翻译，覆盖已存在的翻译文件 |

## 触发场景

- 用户要求翻译文档到其他语言
- 用户说"翻译"、"本地化"、"多语言"
- 批量翻译多篇文档
- 优化某篇文档的翻译质量

## 工作流程

### 1. 检测 Workspace

检查当前目录是否为有效的 Doc-Smith workspace：

```bash
ls -la config.yaml planning/document-structure.yaml docs/
```

如果不存在，提示用户先使用 `doc-smith` 生成文档。

### 2. 确定翻译范围

**文档范围：**
- 如果用户指定了文档路径，只翻译指定文档
- 如果未指定，翻译所有文档

**目标语言：**
- 询问用户目标语言（如 en, ja, fr, de）
- 从 `config.yaml` 读取 `locale` 作为源语言

### 3. 加载术语表

如果存在 `glossary.yaml` 或 `glossary.md`，加载术语表以确保翻译一致性。

### 4. 执行翻译

对每个文档：

1. 读取源语言文档内容
2. 保持 Markdown 格式和结构
3. 翻译文本内容，保留：
   - 代码块（不翻译）
   - 链接路径（不翻译）
   - 图片路径（不翻译）
   - AFS image slot（不翻译）
4. 应用术语表确保一致性
5. 保存翻译后的文档到对应语言文件

**文件命名规则：**
- 源文件：`docs/overview/zh.md`
- 翻译后：`docs/overview/en.md`、`docs/overview/ja.md`

### 5. 更新元信息

更新 `docs/xxx/.meta.yaml` 添加新的语言版本。

### 6. 生成翻译报告

返回翻译结果摘要：
- 翻译的文档数量
- 目标语言列表
- 是否有翻译失败的文档

## 翻译质量要求

- **术语一致性**：使用术语表保持专业术语统一
- **格式保持**：保持原文的 Markdown 格式
- **上下文理解**：根据技术文档语境选择合适译法
- **自然流畅**：翻译结果应符合目标语言习惯

## 示例

**翻译所有文档到英文和日文：**
```bash
/doc-smith-translate -l en -l ja
```

**翻译指定文档到英文：**
```bash
/doc-smith-translate -l en -p /overview -p /api/auth
```

**强制重新翻译（覆盖已有）：**
```bash
/doc-smith-translate -l en --force
```
