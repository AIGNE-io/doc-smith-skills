---
description: 将文档翻译成多种语言，支持批量翻译和图片翻译
---

# 文档翻译命令

启动 doc-smith-translate skill 执行文档翻译任务。

## 使用方式

```
/doc-smith:localize                           # 启动翻译流程
/doc-smith:localize 翻译所有文档到英文          # 自然语言描述
/doc-smith:localize --lang en                 # 翻译到英文
/doc-smith:localize --lang en --lang ja       # 翻译到多个语言
/doc-smith:localize --lang en --path /overview # 翻译指定文档
```

## 执行流程

请立即调用 `/doc-smith-translate` skill 开始执行文档翻译任务。

如果用户提供了额外参数："$ARGUMENTS"，将其作为任务描述传递给 skill。
