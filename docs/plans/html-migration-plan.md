# Execution Plan: DocSmith HTML 文档迁移

## Overview

在 DocSmith 现有 Markdown 生成流程基础上，集成 HTML 构建步骤，使文档生成的最终产物为静态 HTML 站点。采用 per-doc build 模式：每篇文档生成后立即构建为 HTML，导航外置为 nav.js。同时将图片生成从 AIGNE CLI 迁移到直接调用 AIGNE Hub API。

## Prerequisites

- [x] build.mjs MD→HTML 构建流程可用（已实现 + 已测试）
- [x] `/myvibe-publish` 可正常发布 HTML 目录
- [x] docsmith.css 基础样式已实现
- [ ] 需要 AIGNE Hub API 的授权凭证和接口文档

## 关键约束

- per-doc build：MD 仅在单篇文档生成瞬间存在，生成 → 构建 → 删除
- 导航外置：侧边栏和语言切换由 nav.js 驱动，使用 `<script src>` 加载（兼容 file://）
- 构建集成到 doc-smith-content 中，doc-smith-create 只负责编排和 nav.js 生成
- 发布方式待定，不在本次改造中处理发布提示
- 不处理预览，只输出 HTML

---

## Phase 0: build.mjs 改造（双模式）

### Description

将 build.mjs 从全站批量构建改造为支持两种模式：`--doc` 单篇构建 + `--nav` 导航生成。这是所有后续 Phase 的基础。

### 涉及文件

- `skills/doc-smith-build/scripts/build.mjs`（改造：双模式）
- `skills/doc-smith-build/SKILL.md`（更新说明）
- `skills/doc-smith-build/assets/docsmith.css`（不变）

### 改造要点

**模式 1：`--doc <md-file> --path <doc-path>` 单篇构建**
- 输入：单篇 MD 文件路径 + 文档 path + workspace/output 路径
- 输出：对应的 HTML 文件到 dist/{lang}/docs/{path}.html
- 职责：
  - Markdown → HTML 转换（markdown-it）
  - 套 HTML 骨架（data-ds 锚点）
  - 生成 TOC（页面内联）
  - 处理图片占位符
  - 拼接静态资源引用（CSS + nav.js）
- 不负责：导航渲染（nav.js 客户端完成）、MD 清理（调用方负责）

**模式 2：`--nav` 导航生成**
- 输入：document-structure.yaml + config.yaml
- 输出：assets/nav.js、assets/docsmith.css、assets/theme.css、index.html 重定向
- nav.js 格式：`window.__DS_NAV__ = { ... }` 数据对象（使用 script src 加载）

**HTML 模板变化：**
- `data-ds="sidebar"` 改为空容器，由 nav.js 在客户端渲染
- `data-ds="toc"` 保持构建时内联
- 新增 `<script src="{assetPath}/nav.js">` 和内联渲染脚本
- 移除：批量构建模式、`cleanupMarkdownFiles` 函数（MD 清理由 doc-smith-content 负责）

### Tests

#### Happy Path
- [ ] `--doc` 模式：输入单篇 MD，输出对应 HTML 到正确路径
- [ ] `--doc` 模式：HTML 包含正确的 nav.js script 引用
- [ ] `--doc` 模式：TOC 正确内联生成
- [ ] `--doc` 模式：sidebar 为空容器（不含内联导航）
- [ ] `--nav` 模式：从 structure.yaml 生成 nav.js 数据文件
- [ ] `--nav` 模式：复制 docsmith.css 到 assets/
- [ ] `--nav` 模式：theme.css 存在时复制，不存在时不报错
- [ ] `--nav` 模式：生成 index.html 重定向
- [ ] 多语言支持：zh/ 和 en/ 目录各自正确输出

#### Bad Path
- [ ] `--doc` 无 MD 文件路径：报告明确错误
- [ ] `--doc` MD 文件不存在：报告明确错误
- [ ] `--nav` 无 structure.yaml：报告明确错误
- [ ] MD 文件格式异常（无标题、空文件）：跳过并警告
- [ ] workspace 路径不存在：报告明确错误

#### Edge Cases
- [ ] 深层嵌套文档路径（/guides/advanced/deployment/config）：目录结构正确
- [ ] 文档标题包含特殊字符（引号、尖括号）：HTML 正确转义
- [ ] 超长文档（>1000 行 MD）：正常构建
- [ ] 只有一种语言的文档：正常处理

#### Security
- [ ] MD 内容中的 `<script>` 标签：构建后被转义
- [ ] MD 内容中的 HTML 注入：被 markdown-it 安全处理
- [ ] 文件路径中的 `../` 穿越：不泄露 workspace 外的文件

#### Data Leak
- [ ] 构建日志不包含文件系统绝对路径
- [ ] nav.js 不包含绝对路径

#### Data Damage
- [ ] `--doc` 模式不影响其他已有 HTML 文件
- [ ] `--nav` 模式不影响 docs/ 目录中的内容

### E2E Gate

```bash
# 准备测试 workspace
mkdir -p /tmp/test-docsmith/.aigne/doc-smith/docs/overview
mkdir -p /tmp/test-docsmith/.aigne/doc-smith/planning

cat > /tmp/test-docsmith/.aigne/doc-smith/config.yaml << 'EOF'
locale: zh
EOF

cat > /tmp/test-docsmith/.aigne/doc-smith/planning/document-structure.yaml << 'EOF'
name: test-docs
locale: zh
documents:
  - title: 概述
    path: /overview
    description: 系统概述
EOF

cat > /tmp/test-docsmith/.aigne/doc-smith/docs/overview/.meta.yaml << 'EOF'
kind: doc
source: zh
default: zh
EOF

cat > /tmp/test-docsmith/.aigne/doc-smith/docs/overview/zh.md << 'EOF'
# 系统概述
这是一个测试文档。
## 功能特性
- 特性 1
- 特性 2
EOF

# 测试 --nav 模式
cd /tmp/test-docsmith && node skills/doc-smith-build/scripts/build.mjs \
  --nav --workspace .aigne/doc-smith --output .aigne/doc-smith/dist

test -f .aigne/doc-smith/dist/assets/nav.js && echo "✓ nav.js generated"
test -f .aigne/doc-smith/dist/assets/docsmith.css && echo "✓ CSS copied"
test -f .aigne/doc-smith/dist/index.html && echo "✓ Index redirect generated"

# 测试 --doc 模式
cd /tmp/test-docsmith && node skills/doc-smith-build/scripts/build.mjs \
  --doc .aigne/doc-smith/docs/overview/zh.md --path /overview \
  --workspace .aigne/doc-smith --output .aigne/doc-smith/dist

test -f .aigne/doc-smith/dist/zh/docs/overview.html && echo "✓ HTML generated"
grep 'nav.js' .aigne/doc-smith/dist/zh/docs/overview.html && echo "✓ nav.js referenced"
grep 'data-ds="toc"' .aigne/doc-smith/dist/zh/docs/overview.html && echo "✓ TOC inlined"

# 验证 MD 未被删除（--doc 模式不负责清理）
test -f .aigne/doc-smith/docs/overview/zh.md && echo "✓ MD not deleted (caller's job)"
```

### Acceptance Criteria

- [ ] 所有 6 类测试通过
- [ ] E2E Gate 验证通过
- [ ] `--doc` 模式可正常构建单篇 HTML
- [ ] `--nav` 模式可生成 nav.js + 复制资源
- [ ] HTML 模板包含 nav.js script 引用
- [ ] 代码已提交

---

## Phase 1: doc-smith-content + doc-smith-create + doc-smith-check 流程改造

### Description

改造文档生成流程：doc-smith-content 生成 MD 后立即调用 `build.mjs --doc` 构建 HTML 并删除 MD；doc-smith-create 在开始生成前调用 `build.mjs --nav` 生成导航和资源；doc-smith-check 从校验 MD 改为校验 HTML。

### 涉及文件

- `agents/doc-smith-content.md`（改造：生成 MD → build --doc → 删除 MD）
- `skills/doc-smith-create/SKILL.md`（改造：编排 --nav 和 per-doc 构建流程）
- `skills/doc-smith-check/SKILL.md`（改造：校验 HTML 而非 MD）
- `skills/doc-smith-check/scripts/check-content.mjs`（改造：检查 HTML 文件）
- `skills/doc-smith-check/scripts/validate-content.mjs`（改造：检查 HTML 文件）
- `skills/doc-smith-build/SKILL.md`（适配：更新说明）

### Tests

#### Happy Path
- [ ] doc-smith-content 生成 MD → 调用 build --doc → HTML 生成成功 → MD 被删除
- [ ] doc-smith-create 新建流程：结构确定 → build --nav → 并行 content → check HTML
- [ ] doc-smith-create 更新流程：content 生成/更新 → build --nav（如结构变更）→ check HTML
- [ ] doc-smith-check --content：检查 dist/{lang}/docs/{path}.html 而非 docs/{path}/{lang}.md
- [ ] doc-smith-check --content：验证 nav.js 存在且包含所有文档条目
- [ ] workspace 中无 .md 文件残留，只有 .meta.yaml

#### Bad Path
- [ ] build --doc 执行失败：doc-smith-content 报告错误，保留 MD 不删除
- [ ] build --nav 执行失败：doc-smith-create 报告错误，不开始内容生成
- [ ] npm 依赖未安装时：自动执行 npm install 后重试
- [ ] workspace 不完整（缺少 config.yaml）时：在 --nav 前检测并报错

#### Edge Cases
- [ ] 更新已有文档时：只重建该文档的 HTML，不影响其他 HTML
- [ ] 新增文档后：重新调用 --nav 更新导航数据
- [ ] 并行生成多篇文档时：各 doc-smith-content 独立构建，不冲突
- [ ] 用户选择自定义主题时：先生成 theme.css 再调用 --nav

#### Security
- [ ] theme.css 只允许 CSS，不允许 `<script>`
- [ ] document-structure.yaml 中的路径注入：验证路径格式

#### Data Leak
- [ ] 构建结果报告不暴露绝对路径
- [ ] 错误信息不暴露系统信息

#### Data Damage
- [ ] 单篇构建失败不影响其他已有 HTML
- [ ] 更新文档时不丢失未修改的文档

### E2E Gate

```bash
# 在真实项目上测试完整流程（需要人工触发 /doc-smith-create）
# 验证最终输出
test -d .aigne/doc-smith/dist && echo "✓ dist/ exists"
ls .aigne/doc-smith/dist/zh/docs/ | wc -l  # 应有多个 HTML 文件
test -f .aigne/doc-smith/dist/assets/nav.js && echo "✓ nav.js exists"

# 验证无 MD 残留
test ! "$(find .aigne/doc-smith/docs -name '*.md' 2>/dev/null)" && echo "✓ No MD files"

# 验证 meta 文件保留
find .aigne/doc-smith/docs -name '.meta.yaml' | wc -l  # 应 > 0

# 验证 HTML 页面包含 nav.js 引用
grep -l 'nav.js' .aigne/doc-smith/dist/zh/docs/*.html | wc -l  # 应 > 0
```

### Acceptance Criteria

- [ ] 所有 6 类测试通过
- [ ] E2E Gate 验证通过
- [ ] doc-smith-content.md 已更新（per-doc build + MD 清理）
- [ ] doc-smith-create SKILL.md 已更新（--nav 编排 + 移除批量构建）
- [ ] doc-smith-check 已更新（校验 HTML）
- [ ] 代码已提交

---

## Phase 2: doc-smith-images + generate-slot-image 改造（AIGNE CLI → AIGNE Hub API）

### Description

将图片生成从依赖 AIGNE CLI 迁移到直接调用 AIGNE Hub HTTP API。替换 `scripts/aigne-generate/` 中的 AIGNE YAML agent 定义为直接 HTTP 调用脚本，自行处理授权。

### 涉及文件

- `skills/doc-smith-images/SKILL.md`（改造：去掉 `aigne run`，改为 HTTP API 调用）
- `skills/doc-smith-images/scripts/aigne-generate/`（替换：YAML 定义 → HTTP 调用脚本）
- `agents/generate-slot-image.md`（适配：更新错误处理和依赖说明）

### Tests

#### Happy Path
- [ ] 新图生成（text-to-image）：提供描述 → 调用 AIGNE Hub API → 返回图片并保存
- [ ] 已有图片编辑（image-to-image）：提供源图 + 编辑要求 → 返回修改后的图片
- [ ] 图片翻译：中文图片 → 英文图片，布局和风格不变
- [ ] 不同宽高比（1:1, 4:3, 16:9）：API 参数正确传递
- [ ] generate-slot-image 完整流程：分析上下文 → 生成 prompt → 创建 meta → 调用 images skill → 替换占位符

#### Bad Path
- [ ] AIGNE Hub 授权失败（401）：报告明确的授权错误，提示配置方法
- [ ] API 返回 429 限流：等待后重试，最多 3 次
- [ ] API 返回 500 内部错误：报告错误，建议重试
- [ ] 网络超时：报告超时错误，不挂起
- [ ] 无效的 prompt（空字符串）：在调用 API 前校验
- [ ] 无效的图片路径（不存在的 sourcePath）：在调用 API 前校验
- [ ] API 返回非图片格式的响应：检测并报错

#### Edge Cases
- [ ] 极长的 prompt（>2000 字符）：截断或分段处理
- [ ] 图片保存路径目录不存在时：自动创建目录
- [ ] 并发调用多个图片生成（generate-slot-image 并行）：不互相干扰
- [ ] AIGNE Hub 返回的图片尺寸与请求不一致：接受并记录

#### Security
- [ ] API 授权凭证不硬编码在脚本中：从环境变量或配置读取
- [ ] API 授权凭证不出现在日志或错误信息中
- [ ] prompt 中的用户输入：在发送 API 前进行基本清理
- [ ] HTTP 请求强制使用 HTTPS

#### Data Leak
- [ ] API 响应中的调试信息不透传给用户
- [ ] 图片元信息（.meta.yaml）不包含 API 密钥
- [ ] 错误日志不包含完整的 HTTP 请求/响应体

#### Data Damage
- [ ] 图片保存使用临时文件 + 重命名：避免写入一半的损坏文件
- [ ] 编辑模式（--update）：不覆盖源文件，保存到指定路径
- [ ] 生成失败时 .meta.yaml 已创建：保留 meta，用户可重试

### E2E Gate

```bash
# 测试直接 API 调用（需要有效授权）
# 生成一张测试图片
node skills/doc-smith-images/scripts/generate-image.mjs \
  --desc "A simple flowchart showing input, process, output" \
  --savePath /tmp/test-image.png \
  --ratio 4:3

# 验证图片生成
test -f /tmp/test-image.png && echo "✓ Image generated"
file /tmp/test-image.png | grep -i "image" && echo "✓ Valid image format"

# 测试编辑模式
node skills/doc-smith-images/scripts/edit-image.mjs \
  --desc "Translate all text to English" \
  --sourcePath /tmp/test-image.png \
  --savePath /tmp/test-image-en.png

test -f /tmp/test-image-en.png && echo "✓ Image edited"
```

### Acceptance Criteria

- [ ] 所有 6 类测试通过
- [ ] E2E Gate 验证通过
- [ ] AIGNE CLI 依赖完全移除（无 `aigne run` 调用）
- [ ] 新的 HTTP 调用脚本替换 YAML agent 定义
- [ ] 授权流程文档化
- [ ] generate-slot-image.md 错误处理已更新
- [ ] 代码已提交

---

## Final E2E Verification

```bash
# 全流程端到端验证（在真实项目上）

# 1. 执行 /doc-smith-create 生成文档
#    预期：分析 → 结构 → --nav → 并行 content(MD→HTML→删MD) → 图片 → check HTML

# 2. 验证 HTML 站点完整性
test -d .aigne/doc-smith/dist && echo "✓ dist/ 存在"
test -f .aigne/doc-smith/dist/index.html && echo "✓ 首页重定向存在"
test -f .aigne/doc-smith/dist/assets/nav.js && echo "✓ nav.js 存在"
ls .aigne/doc-smith/dist/zh/docs/*.html | wc -l  # 验证页面数量
grep 'data-ds="content"' .aigne/doc-smith/dist/zh/docs/*.html | wc -l  # 验证 HTML 骨架

# 3. 验证无 MD 残留
test ! "$(find .aigne/doc-smith/docs -name '*.md' 2>/dev/null)" && echo "✓ 无 MD 文件"

# 4. 验证 meta 文件保留
find .aigne/doc-smith/docs -name '.meta.yaml' | wc -l  # 应 > 0

# 5. 验证图片生成（无 AIGNE CLI 依赖）
ls .aigne/doc-smith/assets/*/images/*.png 2>/dev/null | wc -l  # 应 > 0

# 6. 验证资源文件
test -f .aigne/doc-smith/dist/assets/docsmith.css && echo "✓ CSS 存在"

# 7. 验证导航数据
grep -q '__DS_NAV__' .aigne/doc-smith/dist/assets/nav.js && echo "✓ nav.js 有效"
```

## Risk Mitigation

| Risk | Mitigation | Contingency |
|------|------------|-------------|
| build.mjs 双模式改造复杂度 | 保留核心转换逻辑，只拆分入口和导航生成 | 分步实现 --doc 和 --nav |
| nav.js 客户端渲染兼容性 | 使用 script src（非 fetch），兼容 file:// | 退回内联导航 |
| per-doc 并发构建冲突 | 各 doc 写入不同路径，无共享状态 | 串行构建降级 |
| AIGNE Hub API 接口变更 | 封装 API 调用层，便于适配 | 回退到 AIGNE CLI |
| 并发图片生成 API 限流 | 控制并发数，添加重试逻辑 | 串行执行降级 |

## References

- [Intent](./html-migration-intent.md)
- [Overview](./html-migration-overview.md)
- [Engineering](./html-migration-engineering.md)
