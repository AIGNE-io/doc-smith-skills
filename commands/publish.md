---
description: 将文档发布到在线平台，支持发布到已有网站或创建新网站
---

# 文档发布命令

启动 doc-smith-publish skill 执行文档发布任务。

## 使用方式

```
/doc-smith:publish                              # 发布到已配置的目标
/doc-smith:publish 发布文档到网站                 # 自然语言描述
/doc-smith:publish --url https://example.com    # 发布到指定 URL
/doc-smith:publish --new-website                # 创建新网站并发布
```

## 执行流程

请立即调用 `/doc-smith-publish` skill 开始执行文档发布任务。

如果用户提供了额外参数："$ARGUMENTS"，将其作为任务描述传递给 skill。
