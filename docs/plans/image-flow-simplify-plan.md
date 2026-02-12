# Execution Plan: image-flow-simplify

## Overview

重构 doc-smith 图片生成流程：移除 `afs:image` 自定义 slot 语法，改用标准 Markdown 图片语法 + alt 文本承载图片意图，图片生成从独立阶段内联到 content Task 中。

## Prerequisites

- 已审批的 Intent: `docs/plans/image-flow-simplify-intent.md`
- 项目中 5 个目标文件均存在且可编辑

## Phase 0: 修改 content.md（核心变更）

### Description

修改 `skills/doc-smith-create/references/content.md`，移除 afs:image slot 格式，新增标准 Markdown 图片语法和内联图片生成步骤。这是整个重构的核心文件。

### 变更内容

1. **步骤 5「图片使用」**：移除 AFS Image Slot 格式说明，替换为标准 Markdown 图片语法 + 路径约定 + alt 文本要求 + KEY 命名规则
2. **新增步骤 5.5「生成图片」**：扫描 MD → 检查已存在 → 创建 .meta.yaml → 调 /doc-smith-images → 失败跳过
3. **步骤 9「返回摘要」**：`slots: [id1, id2]` → `images: N ok, M failed(key1, key2)`
4. **移除**：「生成 AFS Image Slot」小节、所有 `<!-- afs:image -->` 格式和示例、步骤 7 中 slot 相关描述
5. **frontmatter**：tools 增加 `Skill`，skills 增加 `doc-smith-images`

### Tests

#### Happy Path
- [x] 文件中不存在 `afs:image` 字符串
- [x] 文件中存在 `![详细描述](/assets/{key}/images/{locale}.png)` 格式说明
- [x] 文件中存在步骤 5.5「生成图片」
- [x] 摘要格式包含 `images: N ok, M failed`
- [x] frontmatter tools 包含 `Skill`
- [x] frontmatter skills 包含 `doc-smith-images`

#### Bad Path
- [x] 没有遗漏的 `<!-- afs:image` 或 `afs:image` 引用
- [x] 步骤编号连续无跳跃（5 → 5.5 → 6 → 6.5 → 7 → 8 → 8.5 → 9）
- [x] 没有引用已删除的 `generate-slot-image.md`

#### Edge Cases
- [x] `/assets/{key}/images/` 路径约定说明清晰，与已有文件路径 `/assets/filename.ext` 区分明确
- [x] .meta.yaml schema 不含 `slot` 相关字段（`slot.id`、`slot.key`、`slot.desc`）

#### Security
- [x] N/A（Skill prompt 文件，无运行时安全面）

#### Data Leak
- [x] N/A

#### Data Damage
- [x] 原文件中非图片相关的内容（步骤 1-4、6-8）未被意外修改

### E2E Gate

```bash
# 验证 afs:image 完全移除
grep -c "afs:image" skills/doc-smith-create/references/content.md && echo "FAIL: afs:image still exists" || echo "PASS"

# 验证新步骤存在
grep -c "### 5.5" skills/doc-smith-create/references/content.md | grep -q "1" && echo "PASS: step 5.5 exists" || echo "FAIL"

# 验证 frontmatter
head -12 skills/doc-smith-create/references/content.md | grep -q "doc-smith-images" && echo "PASS: skill ref exists" || echo "FAIL"
```

### Acceptance Criteria

- [x] content.md 中 afs:image 完全移除
- [x] 步骤 5.5 图片生成流程完整
- [x] 路径约定、alt 文本要求、KEY 命名规则清晰

---

## Phase 1: 修改 SKILL.md + 删除 generate-slot-image.md

### Description

修改 `skills/doc-smith-create/SKILL.md` 移除图片生成阶段相关约束和流程，删除 `skills/doc-smith-create/references/generate-slot-image.md`。

### 变更内容

1. **约束 3「内容约束」**：删除 `所有 AFS Image Slot 必须被替换`
2. **约束 6「Task 分发约束」**：删除图片生成 Task 类型
3. **约束 7「完成约束」**：删除 `--check-slots` 校验行
4. **关键流程**：删除「并行生成图片」整个小节
5. **删除文件**：`references/generate-slot-image.md`

### Tests

#### Happy Path
- [x] SKILL.md 中不存在 `AFS Image Slot` 字符串
- [x] SKILL.md 中不存在 `generate-slot-image` 引用
- [x] SKILL.md 中不存在 `--check-slots` 引用
- [x] SKILL.md 关键流程中无「并行生成图片」小节
- [x] `references/generate-slot-image.md` 文件不存在

#### Bad Path
- [x] SKILL.md 中 Task 分发约束仍保留结构规划和内容生成两种类型
- [x] SKILL.md 中完成约束仍保留 `--structure` 和 `--content` 校验

#### Edge Cases
- [x] SKILL.md 其他约束（1-2、4-5）未被意外修改

#### Security
- [x] N/A

#### Data Leak
- [x] N/A

#### Data Damage
- [x] N/A

### E2E Gate

```bash
# 验证 SKILL.md 无 slot 引用
grep -c "afs:image\|check-slots\|generate-slot-image\|AFS Image Slot" skills/doc-smith-create/SKILL.md && echo "FAIL" || echo "PASS"

# 验证文件已删除
[ ! -f skills/doc-smith-create/references/generate-slot-image.md ] && echo "PASS: file deleted" || echo "FAIL"
```

### Acceptance Criteria

- [x] SKILL.md 约束和流程中所有 slot/图片生成阶段引用已移除
- [x] generate-slot-image.md 已删除

---

## Phase 2: 修改 doc-smith-check + translate-document

### Description

修改 `skills/doc-smith-check/SKILL.md` 移除 `--check-slots` 选项，修改 `skills/doc-smith-localize/references/translate-document.md` 移除 afs:image 翻译规则。

### 变更内容

1. **doc-smith-check/SKILL.md**：
   - 用法中删除 `--check-slots` 示例
   - 选项表删除 `--check-slots` 行
   - 内容校验表删除「AFS slot 已替换」行
   - 被其他 Skill 调用中删除 slot 校验行
2. **translate-document.md**：
   - 步骤 4 删除 `不翻译 AFS image slot 注释` 规则

### Tests

#### Happy Path
- [ ] doc-smith-check/SKILL.md 中不存在 `check-slots` 字符串
- [ ] doc-smith-check/SKILL.md 中不存在 `AFS slot` 或 `AFS image` 字符串
- [ ] translate-document.md 中不存在 `afs:image` 字符串

#### Bad Path
- [ ] doc-smith-check/SKILL.md 仍保留 `--structure` 和 `--content` 选项
- [ ] doc-smith-check/SKILL.md 仍保留其他校验项（HTML 存在、meta 存在、nav.js、链接、图片路径）
- [ ] translate-document.md 步骤 4 其他翻译规则未被修改

#### Edge Cases
- [ ] N/A

#### Security
- [ ] N/A

#### Data Leak
- [ ] N/A

#### Data Damage
- [ ] N/A

### E2E Gate

```bash
# 验证 check SKILL.md 无 slot 引用
grep -c "check-slots\|AFS.*slot\|AFS.*image" skills/doc-smith-check/SKILL.md && echo "FAIL" || echo "FAIL" || echo "PASS"

# 验证 translate-document 无 afs:image
grep -c "afs:image" skills/doc-smith-localize/references/translate-document.md && echo "FAIL" || echo "PASS"
```

### Acceptance Criteria

- [ ] 两个文件中所有 afs:image/slot 引用已移除
- [ ] 其他不相关内容未被修改

---

## Final E2E Verification

```bash
# 全项目扫描：确认 afs:image 在所有 Skill 文件中完全移除
grep -r "afs:image" skills/ --include="*.md" && echo "FAIL: afs:image still found" || echo "PASS: clean"

# 确认 check-slots 在所有 Skill 文件中完全移除
grep -r "check-slots" skills/ --include="*.md" && echo "FAIL: check-slots still found" || echo "PASS: clean"

# 确认 generate-slot-image.md 已删除
[ ! -f skills/doc-smith-create/references/generate-slot-image.md ] && echo "PASS" || echo "FAIL"

# 确认核心文件存在且非空
for f in \
  skills/doc-smith-create/SKILL.md \
  skills/doc-smith-create/references/content.md \
  skills/doc-smith-check/SKILL.md \
  skills/doc-smith-localize/references/translate-document.md; do
  [ -s "$f" ] && echo "PASS: $f exists" || echo "FAIL: $f missing/empty"
done
```

## References

- [Intent](./image-flow-simplify-intent.md)
- [Overview](./image-flow-simplify-overview.md)
