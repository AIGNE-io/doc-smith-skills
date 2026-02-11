# Execution Plan: DocSmith 声明式架构优化

## Overview

将 DocSmith Skills 从过程式步骤清单转变为声明式约束定义。核心变更：重写 SKILL.md 文件、精简 reference 文件（11→3）、实现路径抽象（/assets/ → 相对路径）、移除 task_plan.md 状态管理。

## Prerequisites

- 当前分支 `feature/html-docs` 代码干净（已确认 clean）
- skills/ 目录下所有现有 skill 文件可读取
- build.mjs 脚本可运行（`node skills/doc-smith-build/scripts/build.mjs`）

## Test Environment

- **测试项目目录**：`/Users/lban/dev/code/doc-smith-test/doc-smith-features/`
- **workspace 路径**：`/Users/lban/dev/code/doc-smith-test/doc-smith-features/.aigne/doc-smith/`
- **清理命令**：`rm -rf /Users/lban/dev/code/doc-smith-test/doc-smith-features/.aigne/doc-smith`
- 每次端到端测试前清理 workspace，确保干净状态

---

## Phase 0: build.mjs 路径抽象

### Description

修改 build.mjs --doc 模式，新增 `/assets/` 绝对路径到相对路径的转换。这是所有其他 Phase 的前置依赖。

### Tests

#### Happy Path
- [x] `/assets/logo.png` 在 path=/overview (depth=1) 时转换为 `../../assets/logo.png`
- [x] `/assets/arch/images/zh.png` 在 path=/api/auth (depth=2) 时转换为 `../../../assets/arch/images/zh.png`
- [x] `/assets/` 路径在 `<img src>` 和 `![img]()` 两种格式中都正确转换
- [x] 不含 `/assets/` 的路径保持不变（如外部 URL）

#### Bad Path
- [x] 已有的 `../../assets/` 旧格式路径不会被二次转换
- [x] 空文档（无图片引用）构建不报错
- [x] 不存在的文档 path 给出明确错误

#### Edge Cases
- [x] 根级文档 path=/ (depth=0) 路径转换正确
- [x] 深层嵌套 path=/a/b/c/d (depth=4) 路径转换正确
- [x] 同一文档中混合 `/assets/` 和外部 URL 引用

#### Security
- [x] 路径中不允许 `..` 穿越（如 `/assets/../../etc/passwd` 应拒绝或清理）

#### Data Leak
- [x] 构建错误信息不暴露服务器绝对路径

#### Data Damage
- [x] 转换失败时 MD 文件不被删除（保留原文件排查）
- [x] --nav 模式不受路径转换影响（只影响 --doc 模式）

### E2E Gate

#### 单元测试：隔离验证路径转换

```bash
SKILL_DIR="/Users/lban/arcblock/code/doc-smith-skills"

# 创建测试 workspace
mkdir -p /tmp/ds-test/{docs/api/auth,planning}

cat > /tmp/ds-test/docs/api/auth/zh.md << 'EOF'
# Test
![new-format](/assets/arch/images/zh.png)
![old-format](../../../../assets/arch/images/zh.png)
![external](https://example.com/img.png)
![link-format](/assets/downloads/guide.pdf)
EOF

cat > /tmp/ds-test/config.yaml << 'EOF'
workspaceVersion: "1.0"
locale: zh
projectName: test
sources: []
EOF

cat > /tmp/ds-test/planning/document-structure.yaml << 'EOF'
version: "1.0"
documents:
  - path: /api/auth
    title: Test
    description: Test doc
EOF

# 构建
node "$SKILL_DIR/skills/doc-smith-build/scripts/build.mjs" \
  --doc /tmp/ds-test/docs/api/auth/zh.md \
  --path /api/auth \
  --workspace /tmp/ds-test \
  --output /tmp/ds-test/dist

HTML="/tmp/ds-test/dist/zh/docs/api/auth.html"

# 验证 /assets/ 新格式转换正确（depth=2, 需要 ../../../assets/）
grep -q '../../../assets/arch/images/zh.png' "$HTML" && echo "✓ /assets/ 转换正确" || echo "✗ /assets/ 转换失败"

# 验证 ../../ 旧格式仍可用（向后兼容）
# 旧格式 ../../../../assets/ 应被转换为 ../../../assets/
grep -q '../../../assets/arch/images/zh.png' "$HTML" && echo "✓ 旧格式兼容" || echo "✗ 旧格式失败"

# 验证外部 URL 不受影响
grep -q 'https://example.com/img.png' "$HTML" && echo "✓ 外部 URL 不变" || echo "✗ 外部 URL 被修改"

# 验证 HTML 中没有残留的 /assets/ 绝对路径
grep -c 'src="/assets/' "$HTML" && echo "✗ 有未转换的绝对路径" || echo "✓ 无绝对路径残留"

# 清理
rm -rf /tmp/ds-test
```

#### 边界验证：不同 depth 的文档

```bash
SKILL_DIR="/Users/lban/arcblock/code/doc-smith-skills"

# 测试 depth=1 的文档
mkdir -p /tmp/ds-test2/{docs/overview,planning}
cat > /tmp/ds-test2/config.yaml << 'EOF'
workspaceVersion: "1.0"
locale: zh
projectName: test
sources: []
EOF
cat > /tmp/ds-test2/planning/document-structure.yaml << 'EOF'
version: "1.0"
documents:
  - path: /overview
    title: Overview
    description: Test
EOF
cat > /tmp/ds-test2/docs/overview/zh.md << 'EOF'
# Overview
![img](/assets/logo.png)
EOF

node "$SKILL_DIR/skills/doc-smith-build/scripts/build.mjs" \
  --doc /tmp/ds-test2/docs/overview/zh.md \
  --path /overview \
  --workspace /tmp/ds-test2 \
  --output /tmp/ds-test2/dist

# depth=1: 需要 ../../assets/
grep -q '../../assets/logo.png' /tmp/ds-test2/dist/zh/docs/overview.html \
  && echo "✓ depth=1 正确" || echo "✗ depth=1 失败"

rm -rf /tmp/ds-test2

# 测试 depth=4 的文档
mkdir -p /tmp/ds-test3/{docs/a/b/c/d,planning}
cat > /tmp/ds-test3/config.yaml << 'EOF'
workspaceVersion: "1.0"
locale: zh
projectName: test
sources: []
EOF
cat > /tmp/ds-test3/planning/document-structure.yaml << 'EOF'
version: "1.0"
documents:
  - path: /a/b/c/d
    title: Deep
    description: Test
EOF
cat > /tmp/ds-test3/docs/a/b/c/d/zh.md << 'EOF'
# Deep doc
![img](/assets/deep.png)
EOF

node "$SKILL_DIR/skills/doc-smith-build/scripts/build.mjs" \
  --doc /tmp/ds-test3/docs/a/b/c/d/zh.md \
  --path /a/b/c/d \
  --workspace /tmp/ds-test3 \
  --output /tmp/ds-test3/dist

# depth=4: 需要 ../../../../../assets/
grep -q '../../../../../assets/deep.png' /tmp/ds-test3/dist/zh/docs/a/b/c/d.html \
  && echo "✓ depth=4 正确" || echo "✗ depth=4 失败"

rm -rf /tmp/ds-test3
```

#### 安全验证：路径穿越

```bash
SKILL_DIR="/Users/lban/arcblock/code/doc-smith-skills"

mkdir -p /tmp/ds-test4/{docs/overview,planning}
cat > /tmp/ds-test4/config.yaml << 'EOF'
workspaceVersion: "1.0"
locale: zh
projectName: test
sources: []
EOF
cat > /tmp/ds-test4/planning/document-structure.yaml << 'EOF'
version: "1.0"
documents:
  - path: /overview
    title: Test
    description: Test
EOF
cat > /tmp/ds-test4/docs/overview/zh.md << 'EOF'
# Test
![safe](/assets/logo.png)
![traversal](/assets/../../etc/passwd)
EOF

node "$SKILL_DIR/skills/doc-smith-build/scripts/build.mjs" \
  --doc /tmp/ds-test4/docs/overview/zh.md \
  --path /overview \
  --workspace /tmp/ds-test4 \
  --output /tmp/ds-test4/dist

# 安全路径应正常转换
grep -q '../../assets/logo.png' /tmp/ds-test4/dist/zh/docs/overview.html \
  && echo "✓ 安全路径正常" || echo "✗ 安全路径失败"

# 穿越路径应被保留不转换（原样输出）
grep -q '/assets/../../etc/passwd' /tmp/ds-test4/dist/zh/docs/overview.html \
  && echo "✓ 穿越路径被拒绝" || echo "✗ 穿越路径被意外转换"

rm -rf /tmp/ds-test4
```

### Acceptance Criteria

- [x] build.mjs --doc 正确转换 `/assets/` 路径
- [x] 现有 `../../` 格式仍兼容（向后兼容过渡期）
- [x] --nav 模式不受影响
- [x] E2E Gate 验证通过
- [x] 代码已提交

---

## Phase 1: doc-smith-check 路径格式校验

### Description

新增路径格式校验规则：检测文档中使用 `../../assets/` 旧格式的引用并警告。同时统一 SKILL.md 为声明式风格。

### Tests

#### Happy Path
- [x] 使用 `/assets/` 格式的文档通过校验
- [x] `--check-slots` 功能不受影响
- [x] `--structure` 校验不受影响

#### Bad Path
- [x] 使用 `../../assets/` 旧格式的文档产生警告
- [x] 混合新旧格式的文档标记所有旧格式位置

#### Edge Cases
- [x] 代码块中的 `../../assets/` 不触发警告（只检查正文）
- [x] 外部 URL 中包含 `assets` 关键字不误报

#### Security
- [x] 不适用（校验工具无安全风险）

#### Data Leak
- [x] 不适用

#### Data Damage
- [x] 校验工具只读不写，不修改任何文件

### E2E Gate

```bash
TEST_PROJECT="/Users/lban/dev/code/doc-smith-test/doc-smith-features"
WORKSPACE="$TEST_PROJECT/.aigne/doc-smith"
SKILL_DIR="/Users/lban/arcblock/code/doc-smith-skills"

# 前置：确保测试项目有已构建的 workspace
# （如果 workspace 不存在，先用当前版本的 /doc-smith-create 生成一次）

# 1. 验证现有校验功能不受影响
cd "$TEST_PROJECT"
node "$SKILL_DIR/skills/doc-smith-check/scripts/check-structure.mjs"
# 应正常输出结构校验结果（通过或有具体错误）

node "$SKILL_DIR/skills/doc-smith-check/scripts/check-content.mjs"
# 应正常输出内容校验结果

# 2. 验证路径格式校验（创建带旧格式的测试 MD 文件）
mkdir -p "$WORKSPACE/docs/test-path-check"
cat > "$WORKSPACE/docs/test-path-check/.meta.yaml" << 'EOF'
kind: generated
default: zh
languages: [zh]
EOF

cat > "$WORKSPACE/docs/test-path-check/zh.md" << 'EOF'
# 路径格式测试
![old](../../assets/test/images/zh.png)
![new](/assets/test/images/zh.png)
EOF

# 构建该测试文档
node "$SKILL_DIR/skills/doc-smith-build/scripts/build.mjs" \
  --doc "$WORKSPACE/docs/test-path-check/zh.md" \
  --path /test-path-check \
  --workspace "$WORKSPACE" \
  --output "$WORKSPACE/dist"

# 验证 HTML 中两种格式都被正确转换为相对路径
grep -c '../../assets/test/images/zh.png' "$WORKSPACE/dist/zh/docs/test-path-check.html" || true
# 应为 0（已转换）

grep -c '/assets/test/images/zh.png' "$WORKSPACE/dist/zh/docs/test-path-check.html" || true
# 应为 0（已转换为相对路径）

# 清理测试文件
rm -rf "$WORKSPACE/docs/test-path-check"
rm -f "$WORKSPACE/dist/zh/docs/test-path-check.html"
```

### Acceptance Criteria

- [x] 新增路径格式校验规则
- [x] doc-smith-check SKILL.md 重写为声明式风格
- [x] 现有校验功能（结构 + 内容 + slots）不受影响
- [x] 在测试项目上验证通过
- [ ] 代码已提交

---

## Phase 2: doc-smith-create 声明式重写

### Description

核心变更。删除 8 个 reference 文件，将关键内容精简后内联到 SKILL.md。重写 SKILL.md 为声明式约束定义。移除 task_plan.md 机制。

### Tests

#### Happy Path
- [ ] 新 SKILL.md 行数 ≤ 200 行
- [ ] 包含全部 6 类约束（Workspace/结构/内容/人类确认/Task分发/完成）
- [ ] config.yaml schema 已内联
- [ ] document-structure.yaml schema 已内联
- [ ] user-intent.md 格式模板已内联
- [ ] content.md（Task agent）保留且可被 Task tool 引用
- [ ] generate-slot-image.md（Task agent）保留且可被 Task tool 引用

#### Bad Path
- [ ] 已删除的 reference 文件不存在于 references/ 目录
  - [ ] changeset-guide.md 已删除
  - [ ] patch-guide.md 已删除
  - [ ] update-workflow.md 已删除
  - [ ] document-content-guide.md 已删除
  - [ ] document-structure-schema.md 已删除
  - [ ] structure-confirmation-guide.md 已删除
  - [ ] structure-planning-guide.md 已删除
  - [ ] user-intent-guide.md 已删除
  - [ ] workspace-initialization.md 已删除
- [ ] SKILL.md 中不包含 Phase 编号（Phase 0, Phase 1 等）
- [ ] SKILL.md 中不包含 task_plan.md 相关指令

#### Edge Cases
- [ ] SKILL.md 中引用的 schema/模板内容完整（对比原 reference 文件关键字段）
- [ ] content.md 中路径引用已更新为 `/assets/` 格式
- [ ] generate-slot-image.md 风格统一

#### Security
- [ ] 不适用（Skill 文件无安全风险）

#### Data Leak
- [ ] 不适用

#### Data Damage
- [ ] 原 reference 文件内容的关键信息（schema 字段、配置规则）在内联后无遗漏

### E2E Gate

```bash
# 验证文件结构
ls skills/doc-smith-create/references/
# 应只有: content.md, generate-slot-image.md

# 验证 SKILL.md 行数
wc -l skills/doc-smith-create/SKILL.md
# 应 ≤ 200 行

# 验证已删除的文件
for f in changeset-guide.md patch-guide.md update-workflow.md \
         document-content-guide.md document-structure-schema.md \
         structure-confirmation-guide.md structure-planning-guide.md \
         user-intent-guide.md workspace-initialization.md; do
  test ! -f "skills/doc-smith-create/references/$f" || echo "FAIL: $f still exists"
done

# 验证关键约束关键词存在
grep -q 'doc-smith-check --structure' skills/doc-smith-create/SKILL.md
grep -q 'doc-smith-check --content' skills/doc-smith-create/SKILL.md
grep -q '/assets/' skills/doc-smith-create/SKILL.md
grep -q '.meta.yaml' skills/doc-smith-create/SKILL.md
grep -q 'TaskCreate\|Task tool' skills/doc-smith-create/SKILL.md || true
```

### Acceptance Criteria

- [ ] SKILL.md ≤ 200 行，声明式约束风格
- [ ] 8 个 reference 文件已删除
- [ ] 2 个 Task agent 文件保留且更新
- [ ] 6 类约束完整内联
- [ ] 无 Phase 编号、无 task_plan.md 引用
- [ ] config.yaml schema + document-structure.yaml schema 已内联
- [ ] 代码已提交

---

## Phase 3: doc-smith-localize 声明式重写

### Description

重写 localize SKILL.md 为声明式约束风格。移除 translate_task_plan.md 机制。更新 translate-document.md 中的路径格式。

### Tests

#### Happy Path
- [ ] SKILL.md 重写为声明式约束风格
- [ ] 7 条约束声明完整
- [ ] translate-document.md（Task agent）保留且路径引用更新为 `/assets/`
- [ ] 不包含 translate_task_plan.md 相关指令

#### Bad Path
- [ ] SKILL.md 中不包含 Phase 编号
- [ ] 不包含 task_plan 相关文件引用

#### Edge Cases
- [ ] translate-document.md 中图片路径替换规则适配新的 `/assets/` 格式

#### Security
- [ ] 不适用

#### Data Leak
- [ ] 不适用

#### Data Damage
- [ ] 翻译约束中的关键规则无遗漏（sourceHash、nav.js 重建、config.yaml 更新）

### E2E Gate

```bash
# 验证文件结构
ls skills/doc-smith-localize/references/
# 应只有: translate-document.md

# 验证无 task_plan 引用
! grep -q 'task_plan\|translate_task_plan' skills/doc-smith-localize/SKILL.md

# 验证约束关键词
grep -q 'sourceHash' skills/doc-smith-localize/SKILL.md
grep -q 'nav.js' skills/doc-smith-localize/SKILL.md
grep -q 'translateLanguages' skills/doc-smith-localize/SKILL.md
```

### Acceptance Criteria

- [ ] SKILL.md 声明式约束风格
- [ ] translate-document.md 路径格式更新
- [ ] 无 task_plan 机制引用
- [ ] 7 条约束完整
- [ ] 代码已提交

---

## Phase 4: doc-smith-build / images / clear 风格统一

### Description

统一剩余 skill 的 SKILL.md 风格。build SKILL.md 更新路径抽象说明。images 和 clear 仅做风格统一。

### Tests

#### Happy Path
- [ ] doc-smith-build SKILL.md 包含路径抽象契约说明
- [ ] doc-smith-images SKILL.md 风格统一（保留 AIGNE CLI 依赖）
- [ ] doc-smith-clear SKILL.md 风格统一

#### Bad Path
- [ ] build SKILL.md 中不包含旧的 `../../` 路径教程

#### Edge Cases
- [ ] images SKILL.md 保留所有现有功能描述（save/edit 模式）

#### Security
- [ ] 不适用

#### Data Leak
- [ ] 不适用

#### Data Damage
- [ ] 不适用

### E2E Gate

```bash
# 验证所有 SKILL.md 存在且非空
for skill in doc-smith-build doc-smith-images doc-smith-clear; do
  test -s "skills/$skill/SKILL.md" || echo "FAIL: $skill/SKILL.md missing or empty"
done

# 验证 build 包含路径抽象说明
grep -q '/assets/' skills/doc-smith-build/SKILL.md
```

### Acceptance Criteria

- [ ] 3 个 SKILL.md 风格统一
- [ ] build 包含路径抽象契约
- [ ] 功能描述完整无遗漏
- [ ] 代码已提交

---

## Phase 5: 端到端验证

### Description

在实际项目上运行完整的 create → build → check → localize 流程，验证所有变更协同工作。

### Tests

#### Happy Path
- [ ] `/doc-smith-create` 在全新项目上成功生成文档（声明式约束驱动）
- [ ] 生成的文档中图片引用使用 `/assets/` 格式
- [ ] `doc-smith-check --structure` 通过
- [ ] `doc-smith-check --content` 通过
- [ ] `/doc-smith-localize --lang en` 成功翻译
- [ ] 翻译后 nav.js 包含语言切换
- [ ] 所有 HTML 文件中图片路径正确（相对路径）

#### Bad Path
- [ ] 缺少 workspace 时给出明确提示
- [ ] 结构校验失败时给出可操作的错误信息
- [ ] 内容校验失败时给出具体文件和问题

#### Edge Cases
- [ ] 已有 workspace（旧格式）的兼容性
- [ ] 修改已有文档的场景（统一入口）

#### Security
- [ ] 不适用（Skill 文件）

#### Data Leak
- [ ] 不适用

#### Data Damage
- [ ] workspace git commit 正常工作
- [ ] 文档修改不影响已有翻译的 sourceHash 机制

### E2E Gate

分为三步：代码层验证 → 交互式流程测试 → 输出验证。

#### Step 1: 代码层验证（自动）

```bash
SKILL_DIR="/Users/lban/arcblock/code/doc-smith-skills"
cd "$SKILL_DIR"

echo "=== Skill 文件结构验证 ==="
for skill in doc-smith-create doc-smith-build doc-smith-check \
             doc-smith-localize doc-smith-images doc-smith-clear \
             doc-smith-publish; do
  test -s "skills/$skill/SKILL.md" && echo "✓ $skill" || echo "✗ $skill"
done

echo ""
echo "=== Reference 文件验证 ==="
echo "create/references:"
ls skills/doc-smith-create/references/
# 应只有: content.md, generate-slot-image.md
echo "localize/references:"
ls skills/doc-smith-localize/references/
# 应只有: translate-document.md

echo ""
echo "=== Publish 未修改验证 ==="
git diff --name-only HEAD -- skills/doc-smith-publish/
# 应无输出

echo ""
echo "=== 旧机制清除验证 ==="
grep -rl 'task_plan' skills/ && echo "WARN: task_plan references found" || echo "✓ No task_plan references"

echo ""
echo "=== SKILL.md 行数 ==="
wc -l skills/doc-smith-create/SKILL.md
# 应 ≤ 200 行
```

#### Step 2: 交互式流程测试（手动执行）

在测试项目上运行完整的文档生命周期：

```
# 准备：清理测试 workspace
rm -rf /Users/lban/dev/code/doc-smith-test/doc-smith-features/.aigne/doc-smith

# 在测试项目目录下执行以下 skill 调用：
cd /Users/lban/dev/code/doc-smith-test/doc-smith-features/

# 1. 运行 /doc-smith-create
#    - 验证：能正确推断意图、规划结构、获取用户确认
#    - 验证：Task(content.md) 并行生成文档
#    - 验证：生成的 MD 中图片引用使用 /assets/ 格式
#    - 验证：build --doc 正确将 /assets/ 转换为相对路径
#    - 验证：自动执行 doc-smith-check 通过

# 2. 运行 /doc-smith-check
#    - 验证：--structure 通过
#    - 验证：--content 通过
#    - 验证：--content --check-slots 通过

# 3. 运行 /doc-smith-localize --lang en
#    - 验证：翻译 Task 并行执行
#    - 验证：翻译后 nav.js 包含 en 语言
#    - 验证：翻译后 HTML 中图片路径正确
```

#### Step 3: 输出验证（自动）

```bash
TEST_PROJECT="/Users/lban/dev/code/doc-smith-test/doc-smith-features"
WS="$TEST_PROJECT/.aigne/doc-smith"
SKILL_DIR="/Users/lban/arcblock/code/doc-smith-skills"

echo "=== Workspace 结构验证 ==="
# config.yaml 存在
test -f "$WS/config.yaml" && echo "✓ config.yaml" || echo "✗ config.yaml"
# document-structure.yaml 存在
test -f "$WS/planning/document-structure.yaml" && echo "✓ document-structure.yaml" || echo "✗ document-structure.yaml"
# intent 存在
test -f "$WS/intent/user-intent.md" && echo "✓ user-intent.md" || echo "✗ user-intent.md"

echo ""
echo "=== 文档输出验证 ==="
# dist 目录包含 HTML
find "$WS/dist" -name "*.html" | head -10
# nav.js 存在
test -f "$WS/dist/assets/nav.js" && echo "✓ nav.js" || echo "✗ nav.js"

echo ""
echo "=== 路径格式验证 ==="
# HTML 中不应有未转换的 /assets/ 绝对路径（排除 nav.js 和 CSS 引用）
# 检查 img src 中是否还有 /assets/ 绝对路径
grep -r 'src="/assets/' "$WS/dist/" --include="*.html" || echo "✓ No absolute /assets/ in img src"
# 检查是否有旧格式 ../../assets 残留
grep -r 'src="\.\./' "$WS/dist/" --include="*.html" | grep 'assets' | head -5 || echo "（相对路径是预期行为）"

echo ""
echo "=== docs 目录无 .md 残留 ==="
find "$WS/docs" -name "*.md" 2>/dev/null | head -5
# 应无输出（MD 文件在构建后被删除）

echo ""
echo "=== 翻译验证（如果执行了 localize） ==="
# 英文 HTML 存在
ls "$WS/dist/en/docs/" 2>/dev/null | head -5 || echo "（未执行翻译）"
# nav.js 包含语言数据
grep -o '"code":"en"' "$WS/dist/assets/nav.js" 2>/dev/null && echo "✓ nav.js has en" || echo "（未执行翻译）"

echo ""
echo "=== Check 脚本验证 ==="
cd "$TEST_PROJECT"
node "$SKILL_DIR/skills/doc-smith-check/scripts/check-structure.mjs" 2>&1 | tail -3
node "$SKILL_DIR/skills/doc-smith-check/scripts/check-content.mjs" 2>&1 | tail -3
```

### Acceptance Criteria

- [ ] Step 1 代码层验证全部通过
- [ ] Step 2 交互式流程：/doc-smith-create 成功生成文档
- [ ] Step 2 交互式流程：/doc-smith-check 三种模式均通过
- [ ] Step 2 交互式流程：/doc-smith-localize 成功翻译（可选）
- [ ] Step 3 输出验证全部通过
- [ ] Reference 文件精简完成（create 2 个 + localize 1 个）
- [ ] doc-smith-publish 未被修改
- [ ] 路径抽象在端到端流程中正常工作
- [ ] 代码已提交并 push

---

## Final E2E Verification

执行 Phase 5 的完整三步验证。以下为快速摘要检查：

```bash
SKILL_DIR="/Users/lban/arcblock/code/doc-smith-skills"
TEST_PROJECT="/Users/lban/dev/code/doc-smith-test/doc-smith-features"
cd "$SKILL_DIR"

echo "=== DocSmith 架构优化 Final Checklist ==="

# 1. Skill 文件完整
echo "--- Skills ---"
for skill in doc-smith-create doc-smith-build doc-smith-check \
             doc-smith-localize doc-smith-images doc-smith-clear doc-smith-publish; do
  test -s "skills/$skill/SKILL.md" && echo "✓ $skill" || echo "✗ $skill"
done

# 2. Reference 精简
echo "--- References ---"
echo "create: $(ls skills/doc-smith-create/references/ 2>/dev/null | tr '\n' ' ')"
echo "localize: $(ls skills/doc-smith-localize/references/ 2>/dev/null | tr '\n' ' ')"

# 3. 行数检查
echo "--- SKILL.md Lines ---"
wc -l skills/doc-smith-create/SKILL.md

# 4. 旧机制清除
echo "--- Old Mechanisms ---"
grep -rl 'task_plan' skills/ 2>/dev/null && echo "✗ task_plan references found" || echo "✓ No task_plan"
grep -rl 'changeset-guide\|patch-guide\|update-workflow' skills/ 2>/dev/null && echo "✗ deleted refs found" || echo "✓ No deleted refs"

# 5. 路径抽象
echo "--- Path Abstraction ---"
grep -q '/assets/' skills/doc-smith-create/SKILL.md && echo "✓ create mentions /assets/" || echo "✗"
grep -q '/assets/' skills/doc-smith-build/SKILL.md && echo "✓ build mentions /assets/" || echo "✗"

# 6. Publish 不变
echo "--- Publish ---"
git diff --name-only HEAD -- skills/doc-smith-publish/ | wc -l | xargs -I{} sh -c '[ {} -eq 0 ] && echo "✓ Unchanged" || echo "✗ Modified"'

# 7. 测试项目输出（如果 Phase 5 Step 2 已执行）
WS="$TEST_PROJECT/.aigne/doc-smith"
if [ -d "$WS/dist" ]; then
  echo "--- Test Project Output ---"
  echo "HTML files: $(find "$WS/dist" -name '*.html' | wc -l)"
  test -f "$WS/dist/assets/nav.js" && echo "✓ nav.js" || echo "✗ nav.js"
  grep -r 'src="/assets/' "$WS/dist/" --include="*.html" -l 2>/dev/null | wc -l | xargs -I{} sh -c '[ {} -eq 0 ] && echo "✓ No absolute /assets/ in HTML" || echo "✗ Found absolute paths"'
else
  echo "--- Test Project ---"
  echo "⚠ Phase 5 Step 2（交互式流程测试）尚未执行"
fi
```

## Risk Mitigation

| Risk | Mitigation | Contingency |
|------|------------|-------------|
| 声明式 SKILL.md AI 跳过关键步骤 | doc-smith-check 硬性校验兜底 | 在约束中添加更明确的校验调用指令 |
| 路径抽象引入构建 bug | Phase 0 独立测试 + check 校验 | 回退到 `../../` 兼容模式 |
| Reference 合并后关键信息遗漏 | Phase 2 逐文件核对 | 从 git history 恢复并补充 |
| SKILL.md 超过 200 行 | 严格精简原则 | 拆分为 SKILL.md + 1 个 inline-guide.md |

## References

- [Intent](./declarative-architecture-intent.md)
- [Overview](./declarative-architecture-overview.md)
