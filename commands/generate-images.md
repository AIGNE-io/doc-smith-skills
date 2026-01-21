---
description: 生成或编辑文档中的图片，需要指定文档，或着检查所有文档中的图片是否需要生成。
---

# 文档图片生成命令

为 DocSmith 文档中的 AFS Image Slot 生成或编辑图片。

## 使用方式

```
/doc-smith:generate-images /overview           # 生成指定文档的图片
/doc-smith:generate-images --all               # 生成所有文档的图片
/doc-smith:generate-images /overview --force   # 强制重新生成
/doc-smith:generate-images /overview --slot architecture --edit "使用更清晰的布局"
```

## 参数说明

- 文档路径：如 `/overview`、`/api/auth`
- `--all`：生成所有文档中的图片
- `--force`：强制重新生成，即使图片已存在
- `--slot <id>`：指定要处理的 slot ID
- `--edit <要求>`：编辑模式，提供新的要求来更新图片

## 执行流程

### 1. 读取配置

从 `.aigne/doc-smith/config.yaml` 读取 `locale`（主语言）。

### 2. 确定目标文档

- 指定文档路径：处理该文档
- 使用 `--all`：扫描 `.aigne/doc-smith/docs/` 下所有文档

### 3. 扫描 AFS Image Slot

读取文档内容，查找所有 AFS Image Slot：

```markdown
<!-- afs:image id="xxx" desc="xxx" -->
```

### 4. 调用 generate-slot-image 子代理

对于每个需要处理的 slot，调用 `generate-slot-image` 子代理：

```
使用 generate-slot-image 子代理生成图片：
- docPath={文档路径}
- slotId={slot ID}
- slotDesc={slot 描述}
- force={是否强制}
- editRequirements={编辑要求，如有}
```

多个 slot 可以**并行**调用子代理。

### 5. 返回结果

```
文档图片生成完成:

文档: /overview
- architecture: 图片和元信息已生成
- work-flow: 图片已重新生成，并更新元信息
- data-flow: 已跳过（已存在）

共 2 个，生成 1 个，跳过 1 个
```
