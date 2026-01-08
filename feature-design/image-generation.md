# AFS Image Slot 批量生图功能设计

## 一、需求概述

### 1.1 功能目标

实现一个批量图片生成 Skill，能够：
1. 扫描主语言文档中的 AFS image slot
2. 为每个 slot 调用生图 agent 生成主语言图片
3. 将生成的图片保存到规范的多语言目录结构
4. 记录元信息以支持增量更新和图片翻译
5. **不修改文档**（slot 替换在发布阶段处理）

### 1.2 触发方式

作为一个 Skill 在 `doc-smith.yaml` 中注册，由用户显式调用。

### 1.3 与翻译的关系

- **gen-images skill**：只负责生成主语言图片
- **localize skill**：扩展以支持图片翻译（检查 assets 中需要翻译的图片，使用 image-to-image 生成其他语言版本）

## 二、技术方案

### 2.1 Skill 架构

参考 localize agent 的结构，使用 team 类型：

```yaml
type: team
name: generateImages
alias:
  - gen-images
description: |
  扫描主语言文档中的 AFS image slot 并批量生成主语言图片。
skills:
  - url: ./scan-image-slots.mjs       # 扫描主语言文档中的 slot
  - url: ./prepare-generation.mjs     # 准备生图任务（去重、检查已有图片）
  - type: team
    name: processAllSlots             # 批量生成图片
    skills:
      - url: ./generate-slot-image.yaml
    iterate_on: generationTasks
    concurrency: 3                    # 并发生成，避免过载
  - url: ./generate-summary.mjs       # 生成总结报告
input_schema:
  type: object
  properties:
    docs:
      type: array
      items:
        type: string
      description: |
        要处理的文档路径列表（可选）。如果不传或为空数组，则处理所有文档。
    force:
      type: boolean
      default: false
      description: |
        是否强制重新生成已有图片（默认只生成缺失的图片）
mode: sequential
```

### 2.2 图片目录结构

每个图片使用 `key` 作为目录名，支持多语言和未来扩展：

```
assets/
  {key}/                        # 使用 slot 的 key 作为目录名
    .meta.yaml                  # 元信息
    images/                     # 图片文件（预留视频等其他格式）
      zh.png                    # 主语言图片（首次生成）
      en.png                    # 翻译后的图片（localize 时生成）
      ja.png                    # 翻译后的图片
```

**Key 生成规则**：
- 如果 slot 提供了 `key`，直接使用
- 如果未提供 `key`，自动生成：`{docPath}-{id}`
  - 例如：`/overview` + `architecture-diagram` → `overview-architecture-diagram`
- **不检查 key 重复**：相同 key 表示复用同一张图片

**目录说明**：
- `images/` 子目录：预留扩展性（视频、SVG、GIF 等格式）
- 语言版本：读取时如果目标语言不存在，fallback 到主语言
- 主语言确定：从 `config.yaml` 的 `locale` 读取

### 2.3 .meta.yaml 格式

```yaml
# 图片类型标识
kind: image

# Slot 信息
slot:
  id: architecture-overview           # 最后使用这个图片的 slot id
  key: aigne-cli-architecture         # 目录名（用户提供或自动生成）
  desc: "System architecture diagram" # slot 描述

# 生图参数
generation:
  model: google/gemini-3-pro-image-preview  # 使用的模型
  createdAt: "2026-01-07T12:00:00Z"         # 生成时间
  shared: false                              # 是否为无文字共享图（默认 false，翻译时判断）

# 关联文档列表
documents:
  - path: /overview                   # 文档路径
    hash: a1b2c3d4                    # 文档完整内容的 hash
  - path: /getting-started
    hash: e5f6g7h8

# 已生成的语言版本
languages:
  - zh  # 主语言
```

**字段说明**：
- `slot.id`：如果多个文档使用同一个 key，记录最后一个 slot 的 id
- `slot.key`：目录名，复用的关键
- `generation.shared`：默认 false，在 localize 时由 LLM 判断图片是否包含文字
- `documents`：记录所有引用这个图片的文档及其 hash（整个文档内容的 hash）
- `languages`：已生成的语言版本列表

### 2.4 Slot 扫描逻辑

`scan-image-slots.mjs` 需要实现：

1. **读取配置和文档列表**：
   - 从 `config.yaml` 读取主语言（`locale`）
   - 从 `planning/document-structure.yaml` 读取所有文档
   - 或根据输入参数 `docs` 过滤

2. **只扫描主语言文档**：
   - 读取每个文档的主语言文件：`docs/{path}/{locale}.md`
   - 不扫描其他语言版本

3. **解析 slot**：
   ```javascript
   const slotRegex = /<!--\s*afs:image\s+id="([^"]+)"\s+(?:key="([^"]+)"\s+)?desc="([^"]+)"\s*-->/g;
   ```

4. **提取信息并生成 key**：
   - 提取 id、key（可选）、desc
   - 如果未提供 key，生成 key：`{docPath}-{id}`（去掉开头的 `/`）
   - 读取整个文档内容
   - 计算文档内容 hash（用于增量更新判断）

5. **按 key 分组**：
   ```javascript
   {
     locale: "zh",  // 主语言
     slots: [
       {
         key: "aigne-cli-architecture",       // 最终使用的 key
         id: "architecture-overview",         // 最后一个使用这个 key 的 id
         desc: "System architecture diagram", // 最后一个使用这个 key 的 desc
         documents: [
           {
             path: "/overview",
             hash: "a1b2c3d4",
             content: "...",  // 完整文档内容
           },
           {
             path: "/getting-started",
             hash: "e5f6g7h8",
             content: "...",
           }
         ]
       }
     ]
   }
   ```

**Key 重复处理**：
- 如果多个 slot 使用相同的 key，它们共享同一个图片目录
- 使用最后一个遇到的 `id` 和 `desc`（覆盖之前的）
- 所有引用该 key 的文档都记录在 `documents` 列表中

### 2.5 准备生图任务

`prepare-generation.mjs` 需要实现：

1. **检查已有图片**：
   - 对于每个 slot，检查 `assets/{key}/` 是否存在
   - 读取 `.meta.yaml` 获取文档 hash 列表

2. **判断是否需要生成**：
   - 如果 `force=true`，全部重新生成
   - 如果 `force=false`：
     - 图片目录不存在 → 需要生成
     - 图片目录存在但任何关联文档的 hash 变化 → 需要重新生成
     - 所有文档 hash 都未变化 → 跳过

3. **生成任务列表**：
   ```javascript
   {
     locale: "zh",  // 主语言
     generationTasks: [
       {
         key: "aigne-cli-architecture",
         id: "architecture-overview",
         desc: "System architecture diagram",
         documents: [
           { path: "/overview", hash: "a1b2c3d4", content: "..." }
         ],
         isUpdate: false,               // 是否为更新已有图片
         existingImagePath: null        // 如果 isUpdate=true，提供已有图片路径
       }
     ]
   }
   ```

**生图参数**：
- 不在此阶段确定 diagramType、diagramStyle 等参数
- 这些由 `generate-slot-image.yaml` 内部的 LLM 根据 desc 和 documentContent 自动判断

### 2.6 生成图片

`generate-slot-image.yaml` 调用生图 agent：

**输入参数**：
- `key`：图片目录名
- `id`：slot id
- `desc`：slot 描述
- `documents`：关联文档列表（包含完整内容）
- `locale`：主语言
- `isUpdate`：是否为更新已有图片
- `existingImagePath`：如果是更新，提供已有图片路径

**处理流程**：
1. 使用第一篇关联文档的内容作为上下文（`documentContent`）
   - 避免合并多个文档导致内容过多超出 LLM 上下文限制
2. 调用 `generate-diagram-image.yaml`：
   - `documentContent`：第一篇文档的完整内容
   - `desc`：slot 描述
   - `locale`：主语言
   - 让 LLM 自动判断 `diagramType` 和 `diagramStyle`
   - 如果 `isUpdate=true`，使用 image-to-image 模式

3. 保存图片：
   - 保存到：`assets/{key}/images/{locale}.png`
   - 生成/更新 `.meta.yaml`

**生成参数自动判断**：
- `diagramType`：由 LLM 根据 desc 和文档内容判断
- `diagramStyle`：默认使用 modern，或从配置读取
- `size`、`ratio`：使用默认值或从配置读取

## 三、工作流程

### 3.1 gen-images Skill 完整流程

```
用户调用 /gen-images
    ↓
1. scan-image-slots.mjs
   - 读取 config.yaml 的 locale（主语言）
   - 扫描主语言文档中的 slot
   - 解析 id、key、desc
   - 生成 key（如未提供）
   - 读取完整文档内容并计算 hash
   - 按 key 分组
   - 输出：{ locale, slots: [...] }
    ↓
2. prepare-generation.mjs
   - 检查 assets/{key}/ 是否存在
   - 读取 .meta.yaml 对比 hash
   - 根据 force 参数判断是否需要生成
   - 输出：{ locale, generationTasks: [...] }
    ↓
3. processAllSlots (team, concurrency=5)
   - 并发调用 generate-slot-image.yaml
   - 每个任务：
     a. 使用第一篇关联文档的内容
     b. 调用 generate-diagram-image.yaml
     c. 保存图片到 assets/{key}/images/{locale}.png
     d. 生成/更新 .meta.yaml
    ↓
4. generate-summary.mjs
   - 统计生成的图片数量
   - 报告失败的任务
   - 列出生成的图片路径
```

**注意**：
- gen-images skill **不修改文档**
- Slot 替换在发布阶段处理

### 3.2 增量更新场景

**场景 1：文档内容变化**
- 用户修改了主语言文档内容
- 再次调用 `/gen-images`
- `prepare-generation.mjs` 检测到 hash 变化
- 使用 image-to-image 模式重新生成该图片

**场景 2：新增 slot**
- 用户在文档中新增了 AFS image slot
- 调用 `/gen-images`
- 检测到新 key，生成新图片

**场景 3：强制重新生成**
- 用户调用 `/gen-images force=true`
- 忽略 hash 检查，重新生成所有图片

### 3.3 图片翻译流程（在 localize skill 中）

```
用户调用 /localize langs=["en","ja"]
    ↓
1. prepare-translation.mjs
   - 准备文档翻译任务
    ↓
2. scan-translatable-images.mjs（新增）
   - 扫描 assets/*/.meta.yaml
   - 检查每个图片的 languages 字段
   - 如果缺少目标语言，加入翻译任务
   - 输出：{ imageTranslationTasks: [...] }
    ↓
3. processAllDocuments
   - 翻译文档内容
    ↓
4. processAllImages（新增 team）
   - 并发调用 translate-image.yaml
   - 每个任务：
     a. 读取主语言图片
     b. 判断是否为无文字共享图（generation.shared）
     c. 如果 shared=false：
        - 使用 image-to-image 模式
        - 传入 existingImage 和目标 locale
        - 生成目标语言图片
     d. 如果 shared=true：
        - 跳过，直接 fallback 到主语言
     e. 保存到 assets/{key}/images/{target-lang}.png
     f. 更新 .meta.yaml 的 languages
    ↓
5. generate-summary.mjs
   - 统计翻译的文档和图片数量
```

**shared 字段判断**：
- 首次生成时，`generation.shared` 默认为 `false`
- 在翻译图片时，由 LLM 判断图片是否包含文字：
  - 如果无文字，设置 `shared: true`，跳过生成
  - 如果有文字，设置 `shared: false`，生成目标语言版本

## 四、已确定的设计决策

基于讨论，以下问题已有明确决策：

### 4.1 核心设计

1. **Key vs ID**
   - ✅ `key` 用于目录名和图片复用
   - ✅ `id` 仅用于文档中的标记位
   - ✅ 未提供 key 时，自动生成：`{docPath}-{id}`
   - ✅ 不检查 key 重复，相同 key 表示复用

2. **Hash 计算**
   - ✅ 使用整个文档内容的 hash
   - ✅ 使用 SHA256 算法（`crypto.createHash("sha256")`）
   - ✅ 与现有代码保持一致

3. **DiagramType**
   - ✅ 由 LLM 根据 desc 和 documentContent 自动判断
   - ✅ 不在 slot 格式中添加额外参数

4. **多语言策略**
   - ✅ gen-images 只生成主语言图片
   - ✅ localize 负责图片翻译
   - ✅ 无文字图可以共享（通过 shared 字段标记）

5. **目录结构**
   - ✅ 保留 `images/` 子目录（预留视频等格式）

6. **文档修改**
   - ✅ gen-images 不修改文档
   - ✅ Slot 替换在发布阶段处理

7. **扫描范围**
   - ✅ 只扫描主语言文档
   - ✅ 读取整个文档内容作为生图上下文

8. **Meta 信息**
   - ✅ 不记录 slot 行号
   - ✅ 不记录 context.summary

## 五、待实现细节问题

以下问题需要在实现时决定：

### 5.1 实现细节

1. **错误处理**
   - 生图失败时如何处理？
   - 是否继续处理其他任务？
   - 如何在 summary 中报告失败？
   - 是否需要重试机制？

2. **配置选项**
   - 是否在 `config.yaml` 中添加 `imageGeneration` 配置段？
   - 用户是否可以覆盖默认的 diagramStyle、size、ratio？

### 5.2 用户体验

3. **进度反馈**
   - 如何向用户展示生成进度？
   - 是否需要实时显示每个图片的生成状态？

4. **预览功能**
   - 是否需要在生成后让用户预览？
   - 如何处理用户不满意的图片？

## 六、需要考虑的其他问题

基于你提出的方案，以下问题需要在实现时考虑：

### 6.1 图片文件大小和格式

- **问题**：生成的图片可能很大，影响文档加载速度
- **建议**：
  - 考虑图片压缩选项
  - 在 .meta.yaml 中记录文件大小
  - 未来可以支持多种格式（PNG、WebP）

### 6.2 Assets 目录的 Git 管理

- **问题**：生成的图片是否应该提交到 Git？
- **考虑因素**：
  - 图片文件较大，可能影响仓库大小
  - 如果不提交，如何分发和部署？
  - 是否需要使用 Git LFS？
- **建议**：
  - 默认提交到 Git（与文档一起版本管理）
  - 在文档中说明可选的 Git LFS 方案

### 6.3 Key 和 Desc 的一致性

- **问题**：如果多个文档引用同一个 `key`，但 desc 不同，如何处理？
- **当前方案**：使用最后一个遇到的 desc
- **潜在问题**：可能导致图片内容与某些文档的 desc 不匹配
- **建议**：
  - 在扫描时检测这种情况
  - 发出警告，建议用户统一 desc
  - 或者为每个 desc 生成不同的图片（不使用共享 key）

### 6.4 清理未使用的图片

- **问题**：如果删除或修改了文档中的 slot，对应的图片目录是否需要清理？
- **建议**：
  - 添加一个独立的清理命令（如 `/clean-images`）
  - 扫描 assets/ 中的所有图片目录
  - 检查是否还有文档引用
  - 列出未使用的目录，让用户确认删除

### 6.5 API 成本控制

- **问题**：批量生图可能产生大量 API 调用费用
- **建议**：
  - 在生成前显示将要生成的图片数量
  - 支持 `--dry-run` 模式（只扫描不生成，显示任务列表）
  - 考虑添加成本估算（如果 API 提供定价信息）

### 6.6 多文档引用同一 Key 的处理

- **问题**：如果多个文档引用同一个 key，应该基于哪个文档的内容生成图片？
- **当前方案**：✅ 只使用第一篇关联文档的内容
- **优点**：
  - 避免内容过多超出 LLM 上下文限制
  - 简化实现逻辑
  - 性能更好
- **注意**：生成的图片可能更贴合第一篇文档的内容，其他文档需要确保 desc 与图片内容匹配

### 6.7 图片生成失败后的重试

- **问题**：网络问题或 API 限流可能导致生成失败
- **建议**：
  - 在 summary 中明确列出失败的 key
  - 支持只重新生成失败的图片
  - 考虑添加自动重试机制（如重试 3 次）

## 七、实施计划

### 7.1 Phase 1: gen-images Skill 核心功能

**目标**：实现基本的图片生成功能

**任务**：
1. 创建 `agents/generate-images/` 目录结构
2. 实现 `scan-image-slots.mjs`
   - 读取主语言配置
   - 扫描主语言文档
   - 解析 slot 并生成 key
   - 计算文档 hash
3. 实现 `prepare-generation.mjs`
   - 检查已有图片
   - 对比 hash 判断是否需要更新
4. 实现 `generate-slot-image.yaml`
   - 调用 generate-diagram-image.yaml
   - 保存图片和 .meta.yaml
5. 实现 `generate-summary.mjs`
6. 在 `doc-smith.yaml` 中注册 skill

**确定的参数**：
- Hash 算法：SHA256（与现有代码保持一致）
- 默认生图参数：diagramStyle=modern, size=2K, ratio=4:3
- 并发数：concurrency=5
- 文档上下文：只使用第一篇关联文档（避免内容过多）

### 7.2 Phase 2: localize Skill 图片翻译扩展

**目标**：支持图片的多语言翻译

**任务**：
1. 在 `agents/localize/` 中添加：
   - `scan-translatable-images.mjs`
   - `translate-image.yaml`
2. 修改 `localize/index.yaml` 添加图片翻译流程
3. 实现 shared 字段的自动判断（LLM 判断图片是否包含文字）

### 7.3 Phase 3: 增强功能

**可选的增强功能**（按优先级）：
1. **清理命令**：`/clean-images` 清理未使用的图片
2. **Dry-run 模式**：`/gen-images --dry-run` 预览任务列表
3. **配置选项**：在 `config.yaml` 中支持图片生成参数配置
4. **重试机制**：失败任务自动重试
5. **Key/Desc 一致性检查**：警告相同 key 但不同 desc 的情况

## 八、总结

### 核心设计要点

1. **职责分离**：
   - gen-images：扫描 slot → 生成主语言图片
   - localize：翻译文档 + 翻译图片
   - 发布阶段：替换 slot 为图片引用

2. **Key 机制**：
   - 用户提供或自动生成
   - 用于目录名和跨文档复用
   - 不检查重复

3. **增量更新**：
   - 基于文档 hash 判断是否需要重新生成
   - 支持 force 参数强制重新生成

4. **多语言支持**：
   - 主语言在 gen-images 时生成
   - 其他语言在 localize 时翻译
   - 无文字图片可以共享

### 已确认的实施细节

所有核心参数已确定，可以开始实施 Phase 1：

✅ **Hash 算法**：SHA256（与现有代码保持一致）
✅ **默认生图参数**：ratio=4:3, size=2K, diagramStyle=modern
✅ **并发数**：concurrency=5
✅ **文档上下文**：只使用第一篇关联文档
✅ **Phase 1 范围**：不包含 Key/Desc 一致性检查（放到 Phase 3）

### 下一步行动

设计方案已完成，可以开始实施 Phase 1 核心功能。
