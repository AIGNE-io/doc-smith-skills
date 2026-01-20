---
name: doc-smith-check
description: 检查 Doc-Smith 文档的结构和内容完整性。当需要校验文档结构 YAML、检查文档内容、验证链接和图片路径时使用此技能。也可被其他 doc-smith 技能调用进行校验。
context: fork
---

# Doc-Smith 文档检查

检查 Doc-Smith 文档的结构和内容完整性。

## Usage

```bash
# 运行所有检查（结构 + 内容）
/doc-smith-check

# 只检查结构（document-structure.yaml）
/doc-smith-check --structure
/doc-smith-check -s

# 只检查内容（文档文件、链接、图片）
/doc-smith-check --content
/doc-smith-check -c

# 只检查指定文档的内容
/doc-smith-check --content --path /api/overview
/doc-smith-check -c -p /api/overview

# 检查多个指定文档
/doc-smith-check --content --path /api/overview --path /guides/start
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--structure` | `-s` | 只运行结构检查 |
| `--content` | `-c` | 只运行内容检查 |
| `--path <docPath>` | `-p` | 指定要检查的文档路径（可多次使用，仅与 `--content` 配合） |

## 检查项目

### 结构检查 (--structure)

校验 `planning/document-structure.yaml` 文件：

| 检查项 | 说明 |
|--------|------|
| YAML 格式 | 语法是否正确 |
| 必需字段 | title, path, description 是否存在 |
| path 格式 | 是否以 `/` 开头 |
| sourcePaths | 格式是否正确 |

**执行脚本：**
```bash
node skills/doc-smith-check/scripts/check-structure.mjs
```

### 内容检查 (--content)

检查已生成文档的完整性：

| 检查项 | 说明 |
|--------|------|
| 文档文件 | 是否存在 |
| .meta.yaml | 元数据文件是否存在 |
| 内部链接 | 是否有效 |
| 图片路径 | 是否正确 |
| AFS image slot | 格式是否正确 |

**执行脚本：**
```bash
# 检查所有文档
node skills/doc-smith-check/scripts/check-content.mjs

# 只检查指定文档
node skills/doc-smith-check/scripts/check-content.mjs --path /overview
node skills/doc-smith-check/scripts/check-content.mjs -p /api/auth -p /guides/start
```

## 返回结果

```json
{
  "valid": true,
  "structure": { "valid": true, "errors": [] },
  "content": { "valid": true, "errors": [] }
}
```

失败时返回错误列表和修复建议：

```json
{
  "valid": false,
  "structure": {
    "valid": false,
    "errors": [
      { "type": "missing_field", "path": "/docs/intro", "field": "description", "suggestion": "添加 description 字段" }
    ]
  }
}
```

## 错误处理

### 结构检查失败

1. 分析错误报告，理解问题所在
2. 根据修复建议修正 `document-structure.yaml`
3. 重新执行结构检查
4. 如果连续 3 次失败，向用户报告

### 内容检查失败

1. 分析问题列表
2. 根据问题类型采取行动：
   - 文档缺失：生成缺失的文档
   - 链接错误：修正链接路径
   - 图片问题：提供图片或修正路径
3. 重新执行内容检查

## 被其他 Skill 调用

在 doc-smith 主流程中：
- 生成 document-structure.yaml 后：`/doc-smith-check --structure`
- 生成文档内容后：`/doc-smith-check --content`
- 结束前进行最终校验：`/doc-smith-check`
