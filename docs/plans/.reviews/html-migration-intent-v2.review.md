---
source: docs/plans/html-migration-intent.md
created: 2026-02-11
reviewers:
  - LBan
  - claude
status: finalized
---

# Review: 翻译流程适配 + 文档更新场景

HTML 迁移后，MD 仅瞬间存在，但翻译流程和文档更新场景仍依赖持久化的 MD 文件，存在严重断裂。

---

## C001 [ADD] [APPLIED]

> 在"项目范围"中补充翻译相关改造

**Target:** Section "### 项目范围" — 在"**改造** `generate-slot-image` agent"之后

**After:**
```markdown
- **改造** `doc-smith-localize` skill：翻译源从 MD 改为 HTML，翻译结果直接输出 HTML，不经过 MD 中间步骤
- **改造** `translate-document` agent：读取源 HTML 正文，直接翻译为目标语言 HTML 并保存，无需 MD 中间产物
```

**Reason:** 当前 intent 完全遗漏了翻译流程的适配。translate-document 读取 `{sourceLanguage}.md`，但该文件在新架构下已不存在。翻译直接在 HTML 层面完成，避免 HTML→MD→HTML 逆转换。

**Decision:**
- ✓ @LBan (2026-02-11)

---

## C002 [ADD] [APPLIED]

> 新增 §3.7 翻译流程改造说明

**Target:** After "### 3.6 发布（统一 `/myvibe-publish`）"

**After:**
```markdown
### 3.7 翻译流程改造（doc-smith-localize + translate-document）

MD 文件不再持久存在，翻译流程直接在 HTML 层面完成，不引入逆转换。

**当前流程（依赖持久 MD）：**
```
translate-document → 读取 {source}.md → 翻译 → 保存 {target}.md → 完毕
```

**改造后流程（HTML-to-HTML）：**
```
translate-document → 读取源 HTML → 提取可翻译内容 → 翻译 → 复制 HTML 骨架 + 替换翻译内容 → 保存目标 HTML
```

**改造要点：**

1. **翻译源**：直接读取 `dist/{sourceLang}/docs/{path}.html`，提取可翻译部分：
   - `<title>` 标签内容
   - `<meta name="description">` 内容
   - `<main data-ds="content">` 内的正文 HTML
   - `<nav data-ds="toc">` 内的目录标题
2. **翻译产物**：复制源 HTML 骨架（保持 `<head>` 资源引用、`<script>` 等不变），替换翻译后的内容，直接保存为 `dist/{targetLang}/docs/{path}.html`。无需 MD 中间步骤，无需调用 build.mjs
3. **增量翻译判断**：sourceHash 改为对源 HTML 文件做 hash（`dist/{sourceLang}/docs/{path}.html`）
4. **图片引用更新**：直接在目标 HTML 中替换图片路径（`images/{sourceLang}.png` → `images/{targetLang}.png`），无需 MD 中转
5. **nav.js 更新**：翻译完成后需要重新调用 `build.mjs --nav` 更新导航中的语言列表
6. **lang 属性**：目标 HTML 的 `<html lang="...">` 需要更新为目标语言

**不变的部分：**
- .meta.yaml 格式和更新逻辑
- 术语表机制
- 图片翻译流程（图片不依赖 MD 文件）
- 并行翻译策略
```

**Reason:** 翻译是 DocSmith 的核心能力之一。当前 intent 完全遗漏了翻译流程适配。直接 HTML-to-HTML 翻译避免了 HTML→MD→HTML 逆转换的信息丢失风险，流程更简洁。

**Decision:**
- ✓ @LBan (2026-02-11)

---

## C003 [ADD] [APPLIED]

> 在"改动范围"表格中补充翻译相关组件

**Target:** Section "### 4.1 改动范围" — 表格末尾新增行

**After:**
```markdown
| `skills/doc-smith-localize/SKILL.md` | **改造** | 翻译源从 MD 改为 HTML，直接输出目标 HTML，图片引用在 HTML 中替换 |
| `agents/translate-document.md` | **改造** | HTML-to-HTML 翻译：读取源 HTML → 翻译可翻译部分 → 输出目标 HTML |
```

**Reason:** 改动范围表需要完整反映所有受影响的组件。

**Decision:**
- ✓ @LBan (2026-02-11)

---

## C004 [ADD] [APPLIED]

> 在风险表中新增翻译相关风险

**Target:** Section "## 5. 风险" — 风险表格新增行

**After:**
```markdown
| AI 翻译 HTML 时破坏标签结构 | 低 | 页面渲染异常 | 翻译时只提取可翻译文本，保持 HTML 标签不动；翻译后做 HTML 合法性校验 |
| 源文档更新后翻译过期 | 高 | 用户看到不同语言内容不一致 | doc-smith-content 更新后检查 .meta.yaml，提示用户重新翻译 |
```

**Reason:** 直接翻译 HTML 有标签完整性风险；文档更新后翻译过期是高概率场景，需要提醒机制。

**Decision:**
- ✓ @LBan (2026-02-11)

---

## C005 [ADD] [APPLIED]

> 新增 §3.8 文档更新场景说明

**Target:** After 新增的 "### 3.7 翻译流程改造"

**After:**
```markdown
### 3.8 文档更新场景

当用户更新已有文档时，需要处理已有翻译的同步问题。

**场景 1：更新源语言文档（如重新生成中文版 /overview）**

```
doc-smith-content 重新生成 zh.md → build.mjs --doc 构建新的 zh HTML → 删除 zh.md
```

此时：
- 源 HTML 已更新，但其他语言的 HTML（如 en）仍是旧版
- .meta.yaml 中 translations.{lang}.sourceHash 与新 HTML 不匹配
- 用户需要手动调用 `/doc-smith-localize` 重新翻译

**处理方式**：
- doc-smith-content 更新文档后，检查 .meta.yaml 中是否有 translations 记录
- 如果有，在返回摘要中提示："源文档已更新，已有 en/ja 翻译可能需要更新，请使用 /doc-smith-localize 重新翻译"
- 不自动触发翻译（避免意外的长时间操作）

**场景 2：批量重新生成所有文档**

- doc-smith-create 重新生成所有文档后，所有翻译都需要重新执行
- 在 doc-smith-create 结束时的报告中提示翻译状态
```

**Reason:** 文档更新后翻译同步是必须考虑的场景，当前 intent 未提及。不处理的话，用户更新了源文档却不知道翻译已过期。

**Decision:**
- ✓ @LBan (2026-02-11)

---

## C006 [MODIFY] [APPLIED]

> 在 §3.1 doc-smith-content 改造要点中补充翻译提醒

**Target:** Section "### 3.1 doc-smith-content agent（改造）"

**Before:**
```markdown
**改造要点：**
- AI 先生成 Markdown（token 消耗低、输出稳定）
- 生成后立即调用 `build.mjs --doc` 构建为 HTML，然后删除 MD
- MD 仅在 doc-smith-content 执行期间瞬间存在，不会出现在 workspace 中
- AFS Image Slot 占位符：保持 `<!-- afs:image ... -->` 格式（在 MD 中标记，构建时处理）
```

**After:**
```markdown
**改造要点：**
- AI 先生成 Markdown（token 消耗低、输出稳定）
- 生成后立即调用 `build.mjs --doc` 构建为 HTML，然后删除 MD
- MD 仅在 doc-smith-content 执行期间瞬间存在，不会出现在 workspace 中
- AFS Image Slot 占位符：保持 `<!-- afs:image ... -->` 格式（在 MD 中标记，构建时处理）
- 更新已有文档时：检查 .meta.yaml 是否有 translations 记录，如有则在摘要中提示翻译可能需要更新
```

**Reason:** doc-smith-content 是文档更新的入口，需要在此处提醒用户翻译可能过期。

**Decision:**
- ✓ @LBan (2026-02-11)

