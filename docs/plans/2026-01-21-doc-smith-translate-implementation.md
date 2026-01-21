# Doc-Smith Translate 功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 doc-smith-translate 翻译功能，支持批量翻译文档和图片

**Architecture:**
- `doc-smith-translate` Skill 作为入口，负责参数解析和流程编排
- `translate-document` SubAgent 负责单个文档的翻译（支持并行调用）
- 图片翻译通过 `doc-smith-images --update` 功能实现（image-to-image 模式）
- 翻译结果保存为 `{locale}.md` 文件，更新 `.meta.yaml` 记录翻译信息

**Tech Stack:** Claude Code Plugin (SKILL.md), SubAgent (Markdown), doc-smith-images

---

## 设计决策

### 1. 图片翻译方案

**选择：使用 doc-smith-images 的 `--update` 功能**

理由：
- `doc-smith-images` 已支持 `--update` 参数（image-to-image 模式）
- 可以添加 `--locale` 参数指定目标语言
- 避免新增 Skill，保持架构简洁
- 翻译图片本质上是"基于原图生成新语言版本"，符合 update 语义

### 2. SubAgent 设计

参考 `agents/doc-smith-content.md` 和 `agents/generate-slot-image.md` 的结构：
- 创建 `agents/translate-document.md` 处理单个文档翻译
- SubAgent 负责：读取源文档、翻译内容、保存结果、更新 meta
- 支持并行调用多个 SubAgent 翻译不同文档

### 3. 文件结构

```
docs/overview/
├── .meta.yaml          # 记录 translations 信息
├── zh.md               # 源语言
├── en.md               # 翻译后的英文版本
└── ja.md               # 翻译后的日文版本

assets/{key}/
├── .meta.yaml          # 记录图片翻译信息
└── images/
    ├── zh.png          # 源语言图片
    ├── en.png          # 翻译后的英文图片
    └── ja.png          # 翻译后的日文图片
```

---

## Phase 1: 创建 translate-document SubAgent

### Task 1.1: 创建 translate-document.md

**Files:**
- Create: `agents/translate-document.md`

**Step 1: 创建 SubAgent 文件**

创建 `agents/translate-document.md`，内容如下：

```markdown
---
name: translate-document
description: |
  翻译单个文档到目标语言。使用场景：
  - doc-smith-translate 主流程调用，批量翻译多个文档（可并行调用多个实例）
  - 独立调用，翻译指定文档到指定语言
  每个子代理独立处理一个文档的翻译，避免占用主对话上下文。
tools: Read, Write, Edit, Glob, Grep, Bash
model: inherit
---

# 文档翻译代理

翻译单个文档到目标语言。

## 输入参数

调用时需要提供：
- **docPath**（必需）：文档路径，如 `/overview`、`/api/auth`
- **targetLanguage**（必需）：目标语言代码，如 `en`、`ja`
- **sourceLanguage**（必需）：源语言代码，如 `zh`
- **force**（可选）：是否强制重新翻译，默认 `false`
- **glossary**（可选）：术语表内容

## 输出

自然语言摘要，包含：
- 文档路径和目标语言
- 翻译状态（成功/跳过/失败）
- 保存的文件路径

## 工作流程

### 1. 验证输入参数

检查必需参数是否完整：
- docPath、targetLanguage、sourceLanguage 必须提供
- 如果缺失，返回错误信息

### 2. 检查是否需要翻译

读取文档的 `.meta.yaml` 文件：

```
.aigne/doc-smith/docs/{docPath}/.meta.yaml
```

**检查逻辑**：
1. 如果 `force` 为 `true`，直接执行翻译
2. 读取源文件内容并计算 hash
3. 检查 `translations.{targetLanguage}.sourceHash` 是否与当前 hash 相同
4. 如果相同，说明源文档未变化，跳过翻译

### 3. 读取源文档

读取源语言文档：

```
.aigne/doc-smith/docs/{docPath}/{sourceLanguage}.md
```

### 4. 执行翻译

使用翻译提示词翻译文档内容。

**翻译要求**：
- 保持 Markdown 格式和结构
- 不翻译代码块内容（除注释外）
- 不翻译链接路径和图片路径
- 不翻译 AFS image slot
- 应用术语表确保专业术语一致性
- 保持文档风格和语气

**翻译提示词参考**（来自原实现）：

```
你是专业的多语言本地化翻译专家。

核心要求：
1. 语义准确：完整传达原文的含义、语气和细节
2. 本地化流畅：翻译结果符合目标语言的语法和表达习惯
3. 格式保持：保持原文的 Markdown 格式

翻译规则：
- 保持代码块中的代码不变，只翻译注释
- 保持链接路径、图片路径不变
- 保持专业术语一致（参考术语表）
- 表格结构必须完全保持

将以下内容翻译成 {targetLanguage}：
{content}
```

### 5. 保存翻译结果

保存翻译后的文档：

```
.aigne/doc-smith/docs/{docPath}/{targetLanguage}.md
```

### 6. 更新 .meta.yaml

更新文档的元信息文件：

```yaml
# 添加目标语言到 languages 数组
languages:
  - zh
  - en  # 新增

# 记录翻译信息
translations:
  en:
    sourceHash: "abc123..."
    translatedAt: "2026-01-21T10:00:00.000Z"
```

**更新逻辑**：
1. 读取现有 `.meta.yaml`
2. 将 `targetLanguage` 添加到 `languages` 数组（避免重复）
3. 更新 `translations.{targetLanguage}` 对象
4. 写回文件

### 7. 返回摘要

返回操作结果摘要：

**成功**：
```
文档翻译完成:
- 文档: /overview
- 目标语言: en
- 保存路径: .aigne/doc-smith/docs/overview/en.md
- Meta 已更新: .aigne/doc-smith/docs/overview/.meta.yaml
```

**跳过**（源文档未变化）：
```
跳过翻译（源文档未变化）:
- 文档: /overview
- 目标语言: en
```

**失败**：
```
翻译失败:
- 文档: /overview
- 目标语言: en
- 错误: {错误信息}
```

## 职责边界

**必须执行**：
- ✅ 验证输入参数
- ✅ 检查是否需要翻译（hash 比对）
- ✅ 读取源文档并翻译
- ✅ 保存翻译结果
- ✅ 更新 `.meta.yaml`

**不应执行**：
- ❌ 不扫描多个文档（由主流程负责）
- ❌ 不翻译图片（由主流程单独处理）
- ❌ 不进行 Git 操作
```

**Step 2: 验证文件创建成功**

```bash
ls -la agents/translate-document.md
head -20 agents/translate-document.md
```

**Step 3: Commit**

```bash
git add agents/translate-document.md
git commit -m "feat: add translate-document subagent"
```

---

## Phase 2: 更新 doc-smith-translate Skill

### Task 2.1: 重写 SKILL.md 添加完整工作流程

**Files:**
- Modify: `skills/doc-smith-translate/SKILL.md`

**Step 1: 阅读现有 SKILL.md**

```bash
cat skills/doc-smith-translate/SKILL.md
```

**Step 2: 重写 SKILL.md**

将 `skills/doc-smith-translate/SKILL.md` 更新为以下内容：

```markdown
---
name: doc-smith-translate
description: 将 Doc-Smith 生成的文档翻译成多种语言。当用户要求翻译文档、本地化、多语言支持时使用此技能。支持批量翻译文档和图片。
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

# 跳过图片翻译
/doc-smith-translate --lang en --skip-images
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--lang <code>` | `-l` | 目标语言代码（可多次使用），如 en, ja, fr, de |
| `--path <docPath>` | `-p` | 指定要翻译的文档路径（可多次使用），不指定则翻译全部 |
| `--force` | `-f` | 强制重新翻译，覆盖已存在的翻译文件 |
| `--skip-images` | | 跳过图片翻译，只翻译文档内容 |

## 工作流程

### 1. 检测 Workspace

检查当前目录是否为有效的 Doc-Smith workspace：

```bash
ls -la .aigne/doc-smith/config.yaml .aigne/doc-smith/planning/document-structure.yaml .aigne/doc-smith/docs/
```

如果不存在，提示用户先使用 `doc-smith` 生成文档。

### 2. 读取配置

从 `.aigne/doc-smith/config.yaml` 读取：
- `locale`：源语言代码

从 `.aigne/doc-smith/planning/document-structure.yaml` 读取：
- 所有文档路径列表

### 3. 验证参数

**验证目标语言**：
- 过滤掉与源语言相同的语言
- 如果过滤后为空，提示用户

**验证文档路径**（如果指定了 `--path`）：
- 检查路径是否存在于 document-structure.yaml 中
- 如果路径无效，提示用户

### 4. 加载术语表

检查是否存在术语表文件：
- `.aigne/doc-smith/glossary.yaml`
- `.aigne/doc-smith/glossary.md`

如果存在，读取术语表内容供翻译使用。

### 5. 批量翻译文档

使用 `translate-document` 子代理批量翻译文档。

**并行调用示例**：

```
使用单独的 translate-document 子代理并行翻译以下文档：
- docPath=/overview, targetLanguage=en, sourceLanguage=zh
- docPath=/api/auth, targetLanguage=en, sourceLanguage=zh
- docPath=/guides/start, targetLanguage=en, sourceLanguage=zh
```

**注意**：
- 每个子代理处理一个文档到一种语言的翻译
- 如果有多种目标语言，为每个文档的每种语言创建一个任务
- 子代理会检查 hash 避免重复翻译

### 6. 翻译图片（可选）

如果未指定 `--skip-images`，扫描翻译后的文档中引用的图片，检查是否需要翻译。

**扫描图片**：

使用 Grep 在 `.aigne/doc-smith/assets/` 目录下查找所有 `.meta.yaml` 文件：

```bash
find .aigne/doc-smith/assets -name ".meta.yaml" -type f
```

**检查图片是否需要翻译**：

对每个图片资源：
1. 读取 `.meta.yaml`
2. 检查 `generation.shared` 字段
   - 如果为 `true`，跳过翻译（跨语言共享的图片，如纯图标）
   - 如果为 `false` 或不存在，检查目标语言图片是否存在
3. 检查 `languages` 数组是否包含目标语言
   - 如果包含，跳过（已翻译）
   - 如果不包含，需要翻译

**翻译图片**：

调用 `doc-smith-images` 的 `--update` 功能：

```bash
/doc-smith-images "将图片中的文字翻译成 {targetLanguage}" \
  --update .aigne/doc-smith/assets/{key}/images/{sourceLanguage}.png \
  --savePath .aigne/doc-smith/assets/{key}/images/{targetLanguage}.png \
  --locale {targetLanguage}
```

**更新图片 .meta.yaml**：

翻译完成后更新：
- 添加 `targetLanguage` 到 `languages` 数组
- 添加 `translations.{targetLanguage}` 记录

### 7. 更新文档中的图片引用

翻译后的文档需要引用对应语言的图片。

**替换逻辑**：

在翻译后的文档中，将图片路径中的语言后缀替换：

```markdown
# 原文档（zh.md）
![架构图](../../assets/arch/images/zh.png)

# 翻译后文档（en.md）
![Architecture](../../assets/arch/images/en.png)
```

**注意**：如果目标语言图片不存在（shared=true 或跳过图片翻译），保持使用源语言图片。

### 8. 更新 config.yaml

将新的目标语言添加到 `translateLanguages` 数组：

```yaml
translateLanguages:
  - en
  - ja  # 新增
```

### 9. 生成翻译报告

返回翻译结果摘要：

```
翻译完成:
- 源语言: zh
- 目标语言: en, ja
- 文档数量: 10
- 图片数量: 5
- 跳过（未变化）: 3
- 失败: 0
```

## 翻译质量要求

- **术语一致性**：使用术语表保持专业术语统一
- **格式保持**：保持原文的 Markdown 格式
- **上下文理解**：根据技术文档语境选择合适译法
- **自然流畅**：翻译结果应符合目标语言习惯

## 错误处理

### Workspace 不存在

```
错误: Doc-Smith workspace 不存在

请先使用 /doc-smith 生成文档。
```

### 目标语言无效

```
错误: 所有目标语言都与源语言 (zh) 相同

请指定不同的目标语言。
```

### 文档路径无效

```
错误: 以下文档路径不存在于文档结构中:
- /invalid/path

请检查文档路径是否正确。
```

## 示例

**翻译所有文档到英文和日文**：
```bash
/doc-smith-translate -l en -l ja
```

**翻译指定文档到英文**：
```bash
/doc-smith-translate -l en -p /overview -p /api/auth
```

**强制重新翻译（覆盖已有）**：
```bash
/doc-smith-translate -l en --force
```

**只翻译文档，跳过图片**：
```bash
/doc-smith-translate -l en --skip-images
```
```

**Step 3: Commit**

```bash
git add skills/doc-smith-translate/SKILL.md
git commit -m "feat: update doc-smith-translate with complete workflow"
```

---

## Phase 3: 更新 doc-smith-images 支持翻译功能

### Task 3.1: 添加 --locale 参数支持

**Files:**
- Modify: `skills/doc-smith-images/SKILL.md`

**Step 1: 阅读现有 SKILL.md**

```bash
cat skills/doc-smith-images/SKILL.md
```

**Step 2: 确认 --locale 参数已存在**

检查 `--locale` 参数是否已在 Options 表格中：
- 如果已存在，跳过此 Task
- 如果不存在，添加该参数

**当前状态**：`--locale` 参数已存在（Line 44），无需修改。

**Step 3: 验证 AIGNE 脚本支持 locale 参数**

检查 `skills/doc-smith-images/scripts/aigne-generate/` 目录下的脚本是否支持 `locale` 参数。

```bash
ls -la skills/doc-smith-images/scripts/aigne-generate/
```

如果需要，更新 AIGNE 脚本以支持 `locale` 参数。

---

## Phase 4: 验证和测试

### Task 4.1: 验证文件结构

**Step 1: 检查所有文件**

```bash
ls -la agents/translate-document.md
ls -la skills/doc-smith-translate/SKILL.md
```

**Step 2: 验证 SubAgent 格式**

```bash
head -15 agents/translate-document.md
```

确认 frontmatter 格式正确：
- `name`
- `description`
- `tools`
- `model`

### Task 4.2: Phase 4 手动测试

**Step 1: 测试翻译单个文档**

在一个有 doc-smith workspace 的项目中：

```
用户：把 /overview 翻译成英文
→ 调用 /doc-smith-translate -l en -p /overview
```

验证：
- 翻译文件创建：`.aigne/doc-smith/docs/overview/en.md`
- Meta 文件更新：`.aigne/doc-smith/docs/overview/.meta.yaml` 包含 en 语言

**Step 2: 测试批量翻译**

```
用户：把所有文档翻译成英文和日文
→ 调用 /doc-smith-translate -l en -l ja
```

验证：
- 所有文档都有 en.md 和 ja.md
- 所有 .meta.yaml 都更新了 languages 和 translations

**Step 3: 测试图片翻译**

验证图片翻译流程：
- 图片是否正确翻译并保存
- 图片 .meta.yaml 是否更新
- 翻译后的文档是否引用正确的图片

---

## 实现顺序总结

| Phase | 任务 | 产出 |
|-------|------|------|
| 1 | 创建 translate-document SubAgent | `agents/translate-document.md` |
| 2 | 更新 doc-smith-translate Skill | `skills/doc-smith-translate/SKILL.md` |
| 3 | 验证 doc-smith-images 翻译支持 | 确认 `--locale` 参数可用 |
| 4 | 验证和测试 | 手动测试翻译流程 |
