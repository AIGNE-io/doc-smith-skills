---
name: doc-smith-check
description: 检查 Doc-Smith 文档的结构和内容完整性。当需要校验文档结构 YAML、检查文档内容、验证链接和图片路径时使用此技能。也可被其他 doc-smith 技能调用进行校验。
---

# Doc-Smith 文档检查

检查 Doc-Smith 文档的结构和内容完整性。

## 触发场景

- 用户要求检查文档状态
- 用户说"检查文档"、"校验结构"、"验证内容"
- 其他 doc-smith 技能需要进行校验时（如 doc-smith 主流程）

## 检查工具

### 1. 结构检查 (checkStructure)

校验 `planning/document-structure.yaml` 文件的格式和完整性。

**执行方式：**

```bash
node skills/doc-smith-check/scripts/check-structure.mjs
```

**检查内容：**
- YAML 格式是否正确
- 必需字段是否存在（title, path, description）
- path 格式是否正确（必须以 `/` 开头）
- sourcePaths 格式是否正确

**返回结果：**
- `valid: true` - 校验通过
- `valid: false` - 校验失败，返回错误列表和修复建议

### 2. 内容检查 (checkContent)

检查已生成文档的完整性。

**执行方式：**

```bash
node skills/doc-smith-check/scripts/check-content.mjs
```

**检查内容：**
- 文档文件是否存在
- 必需的 `.meta.yaml` 是否存在
- 内部链接是否有效
- 图片路径是否正确
- AFS image slot 格式是否正确

**返回结果：**
- `valid: true` - 检查通过
- `valid: false` - 检查失败，返回问题列表

## 使用场景

### 独立检查

用户直接调用检查文档状态：

```
用户：检查一下文档有没有问题
→ 调用 doc-smith-check
→ 执行结构检查和内容检查
→ 返回检查报告
```

### 被其他 Skill 调用

在 doc-smith 主流程中：
- 生成 document-structure.yaml 后调用结构检查
- 生成文档内容后调用内容检查
- 结束前进行最终校验

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
