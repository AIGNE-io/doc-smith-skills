# 图片生成流程重构

::: locked {reason="核心架构"}
## 1. Overview

- **定位**：简化 doc-smith 的图片生成流程，移除自定义 `afs:image` slot 语法
- **核心概念**：用标准 Markdown 图片语法 + alt 文本承载图片意图，替代自定义 HTML 注释 slot
- **优先级**：高（当前流程有 bug，slot 被 MD→HTML 转义为可见文本）
- **范围**：涉及 doc-smith-create、doc-smith-check、doc-smith-localize 三个 Skill
:::

::: reviewed {by=lban date=2026-02-12}
## 2. 问题分析

### 当前流程（有 bug）

```
content Task → 写 <!-- afs:image id="arch" desc="架构图" -->
            → build HTML（slot 被转义为 &lt;!-- ... --&gt; 可见文本）
            → 删除 MD
            → 图片生成 Task 尝试读 MD（文件已不存在）
```

**三个问题**：

1. `<!-- afs:image -->` 是 HTML 注释，MD→HTML 转换时被转义为 `&lt;!--` 可见文本
2. content Task 构建 HTML 后删除 MD，图片生成 Task 无法读写 MD
3. 内容摘要只返回 slot ID 列表，主 agent 缺少 desc 信息无法分发图片生成

### 测试验证

9 个 HTML 文件中有 41 处 `afs:image` 引用，全部被转义为可见文本暴露在页面上。
:::

::: reviewed {by=lban date=2026-02-12}
## 3. 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 图片意图存储 | MD 中的 `![desc](path)` alt 文本 | 位置即意图，方便定位 |
| 意图格式 | 标准 Markdown `![详细描述](/assets/key/images/zh.png)` | 不会被转义，无需替换 |
| 生成时机 | 每篇文档 content Task 内联生成 | 简化流程，无需独立阶段 |
| 生成方式 | content Task 直接调 `/doc-smith-images` | 不起子 Task |
| 新旧区分 | 路径前缀：`/assets/{key}/images/` = 需生成 | 简单可靠 |
| KEY 命名 | agent 自行起语义化 kebab-case 名 | 灵活 |
| asset .meta.yaml | 保留 | 记录 prompt/model 便于追溯和重新生成 |
| 生成失败 | 跳过继续，摘要中报告 | 不阻塞文档生成 |
| 多语言图片 | 翻译 agent 负责生成 | 与翻译流程统一 |
| generate-slot-image.md | 删除 | 逻辑合并到 content.md |
:::

::: reviewed {by=lban date=2026-02-12}
## 4. 新流程

```
content Task:
  写 MD → ![架构图](/assets/arch/images/zh.png)
       → 扫描 /assets/{key}/images/ 引用
       → 逐个检查图片文件是否已存在（已存在则跳过）
       → 创建 asset .meta.yaml
       → 调 /doc-smith-images 生成图片
       → build HTML（标准 <img> 标签，无转义问题）
       → 删除 MD
```
:::

::: reviewed {by=lban date=2026-02-12}
## 5. 文件变更清单

### 5.1 修改：`skills/doc-smith-create/references/content.md`

**核心变更**：

#### 步骤 5「生成文档内容 → 图片使用」

移除 AFS Image Slot 格式说明，改为：

```markdown
#### 图片使用

两类图片来源：
- **已有媒体文件**：从 mediaFiles 中匹配，直接引用 `/assets/screenshot.png`
- **技术图表**（架构图、流程图等）：写标准图片语法 `![详细描述](/assets/{key}/images/{locale}.png)`

**路径约定**：
- 已有文件：`/assets/filename.ext`（扁平路径，无 `images/` 子目录）
- 需生成的图片：`/assets/{key}/images/{locale}.png`（含 `images/` 子目录）

**alt 文本要求**：
- alt 文本 = 图片生成 prompt，必须具体描述图片内容
- 结合文档上下文，明确主题、元素、布局、风格
- 示例：`![电商系统微服务架构图，展示用户服务、订单服务、支付服务之间的调用关系和数据流向](/assets/ecommerce-arch/images/zh.png)`

**KEY 命名规则**：
- 语义化 kebab-case，描述图片的角色或位置
- 示例：`architecture-overview`、`deploy-flow`、`data-model`
- 同一文档内 KEY 不重复
```

#### 新增步骤 5.5「生成图片」

在生成 MD 内容后、构建 HTML 前，新增图片生成步骤：

```markdown
### 5.5 生成图片

扫描刚生成的 MD 文件，找出所有需要生成的图片引用：

**识别规则**：匹配 `![...](/assets/{key}/images/{locale}.png)` 格式的引用。

对每个需要生成的图片：

1. **检查图片是否已存在**：
   - `Glob: .aigne/doc-smith/assets/{key}/images/*.{png,jpg}`
   - 已存在则跳过

2. **创建 asset .meta.yaml**（先于图片生成）：
   ```yaml
   kind: image
   generation:
     prompt: {alt 文本内容}
     model: google/gemini-3-pro-image-preview
     createdAt: {ISO 时间戳}
   documents:
     - path: {docPath}
   languages:
     - {locale}
   ```
3. **调用 /doc-smith-images 生成图片**：
   ```
   /doc-smith-images "{alt 文本}" \
     --savePath .aigne/doc-smith/assets/{key}/images/{locale}.png \
     --ratio 4:3
   ```

4. **失败处理**：
   - 跳过失败的图片，继续处理下一个
   - 在步骤 9 摘要中标注失败的图片

**注意**：图片逐个生成，不并行（避免 API 限流）。
```

#### 步骤 6.5「构建 HTML」

保持不变。图片已生成完毕，`![](path)` 是标准 Markdown 语法，build 正常转换为 `<img>` 标签。

#### 步骤 9「返回摘要」

更新摘要格式：

```
/api/overview: 成功 | HTML ✓ | .meta.yaml ✓ | MD 已清理 | images: 3 ok, 1 failed(deploy-flow) | 翻译过期: en, ja
```

**变更总结**：将 `slots: [id1, id2]` 改为 `images: N ok, M failed(key1, key2)`。

#### 移除的内容

- 删除「生成 AFS Image Slot」整个小节
- 删除所有 `<!-- afs:image ... -->` 格式说明和示例
- 步骤 7 校验中删除「AFS image slot 已替换」描述
- tools 列表增加 `Skill`（用于调用 `/doc-smith-images`）
- skills 列表增加 `doc-smith-images`

### 5.2 修改：`skills/doc-smith-create/SKILL.md`

#### 约束 3「内容约束」

删除：
```
- 所有 AFS Image Slot 必须被替换
```

#### 约束 6「Task 分发约束」

删除图片生成 Task 类型：
```diff
 Task 类型：
 - **结构规划** Task（按需）：当项目较大时，委派 Task 分析源文件生成 document-structure.yaml 草稿
 - **内容生成** Task：通过 Task(references/content.md) 分发，每篇文档一个 Task
-- **图片生成** Task：通过 Task(references/generate-slot-image.md) 分发
```

#### 约束 7「完成约束」

删除：
```
- `/doc-smith-check --content --check-slots` 通过
```

#### 关键流程

删除「并行生成图片」整个小节（图片生成已内联到 content Task 中）。

### 5.3 删除：`skills/doc-smith-create/references/generate-slot-image.md`

整个文件删除。图片生成逻辑已合并到 `content.md` 步骤 5.5。

### 5.4 修改：`skills/doc-smith-check/SKILL.md`

#### 用法

删除 `--check-slots` 示例：
```diff
 /doc-smith-check --content                    # 只检查内容
 /doc-smith-check --content --path /api/auth   # 检查指定文档
-/doc-smith-check --content --check-slots      # 检查 AFS image slot 已替换
```

#### 选项表

删除 `--check-slots` 行。

#### 内容校验表

删除「AFS slot 已替换」行。

#### 被其他 Skill 调用

删除：
```
- 图片生成后校验 slot：`/doc-smith-check --content --check-slots`
```

### 5.5 修改：`skills/doc-smith-localize/references/translate-document.md`

#### 步骤 4「执行翻译」

删除：
```
- 不翻译 AFS image slot 注释（`<!-- afs:image ... -->`）
```

（已不存在此格式，无需特殊处理）
:::

::: reviewed {by=lban date=2026-02-12}
## 6. 风险

| 风险 | 缓解 |
|------|------|
| content Task 上下文增加（多了图片生成步骤） | 图片逐个生成、API 调用轻量 |
| agent 起的 KEY 不够语义化 | 在 content.md 中给出命名示例和规则 |
| 图片生成 API 限流 | 逐个生成而非并行，失败跳过不阻塞 |
:::

::: reviewed {by=lban date=2026-02-12}
## 7. 不在范围内

- 图片编辑/更新功能（保持现有 `/doc-smith-images --update` 不变）
- check-content.mjs 脚本中 `--check-slots` 的代码删除（脚本自身的改动不在此次范围）
:::
