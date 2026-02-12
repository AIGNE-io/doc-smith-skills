# 图片生成流程重构：移除 afs:image，用标准 Markdown 替代

## 一句话说明

去掉自定义 `<!-- afs:image -->` slot 语法，内容 agent 直接写 `![desc](path)`，图片生成内联到每篇文档的 content Task 中。

## 为什么？

当前流程有 bug：`<!-- afs:image -->` HTML 注释在 MD→HTML 转换时被转义为 `&lt;!--` 可见文本，41 个 slot 全部暴露在页面上。根因是自定义语法与 Markdown 处理器不兼容，且图片生成阶段的时序设计有缺陷（MD 已删除，图片 Task 无法读写）。

## 核心变更

```
旧流程（3 阶段，有 bug）：
  content Task → 插入 <!-- afs:image --> → build HTML（转义！）→ 删 MD
                                                                    ↓
  主流程 → 分发图片 Task → 读 MD（不存在！）→ 替换 slot → 重建 HTML

新流程（1 阶段，内联）：
  content Task → 写 ![desc](/assets/key/images/zh.png)
              → 扫描需生成的图片 → 创建 meta → 调 /doc-smith-images
              → build HTML（标准 <img>）→ 删 MD → 完成
```

## 关键决策

| 问题 | 决策 | 理由 |
|------|------|------|
| 图片意图怎么表达 | alt 文本 = prompt | 位置即意图，标准语法不被转义 |
| 新旧图片怎么区分 | `/assets/{key}/images/` = 需生成 | 路径前缀约定，简单可靠 |
| 图片何时生成 | content Task 内联 | 去掉独立阶段，简化流程 |
| generate-slot-image.md | 删除 | 逻辑合并到 content.md |
| --check-slots | 移除 | 不再有 slot 概念 |

## 改动范围

| 文件 | 动作 |
|------|------|
| `references/content.md` | 重点改动：移除 afs:image，新增步骤 5.5 图片生成 |
| `SKILL.md`（create） | 删除图片生成阶段和 slot 相关约束 |
| `references/generate-slot-image.md` | 删除 |
| `SKILL.md`（check） | 移除 --check-slots |
| `references/translate-document.md` | 删除 afs:image 相关翻译规则 |

## 风险

- content Task 上下文略增 → 图片逐个生成，API 调用轻量
- 图片 API 限流 → 失败跳过不阻塞

## 下一步

按 intent.md 的变更清单依次修改 5 个文件。
