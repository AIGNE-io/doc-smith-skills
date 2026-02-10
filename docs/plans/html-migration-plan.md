# Execution Plan: DocSmith HTML 文档迁移

## Overview

在 DocSmith 现有 Markdown 生成流程基础上，集成 HTML 构建步骤，使文档生成的最终产物为静态 HTML 站点。同时将图片生成从 AIGNE CLI 迁移到直接调用 AIGNE Hub API。

## Prerequisites

- [x] build.mjs MD→HTML 构建流程可用（已实现 + 已测试）
- [x] `/myvibe-publish` 可正常发布 HTML 目录
- [x] docsmith.css 基础样式已实现
- [ ] 需要 AIGNE Hub API 的授权凭证和接口文档

## 关键约束（来自 intent-review 反馈）

- 构建步骤集成到内容生成流程中，不作为独立 Phase
- 发布方式待定，不在本次改造中处理发布提示
- 不处理预览，只输出 HTML

---

## Phase 0: build.mjs 适配

### Description

适配 build.mjs 构建脚本，新增构建后清理中间 .md 文件的能力。这是所有后续 Phase 的基础。

### 涉及文件

- `skills/doc-smith-build/scripts/build.mjs`（适配）
- `skills/doc-smith-build/SKILL.md`（更新说明）

### Tests

#### Happy Path
- [ ] build.mjs 正常构建：输入 MD 文档目录，输出完整 HTML 站点到 dist/
- [ ] 构建后清理：docs/ 中的 .md 文件被删除，.meta.yaml 保留
- [ ] 多语言构建：zh/ 和 en/ 目录各自生成对应 HTML 页面
- [ ] 资源复制：docsmith.css 正确复制到 dist/assets/
- [ ] theme.css 存在时正确复制，不存在时不报错

#### Bad Path
- [ ] docs/ 目录为空时：构建脚本优雅退出，输出警告而非崩溃
- [ ] document-structure.yaml 缺失时：报告明确错误信息
- [ ] MD 文件格式异常（无标题、空文件）时：跳过并警告，不中断构建
- [ ] 输出目录已存在时：覆盖而非追加
- [ ] workspace 路径不存在时：报告明确错误

#### Edge Cases
- [ ] 只有一种语言的文档：正常构建，不生成其他语言目录
- [ ] 深层嵌套文档路径（如 /guides/advanced/deployment/config）：目录结构正确
- [ ] 文档标题包含特殊字符（引号、尖括号）：HTML 正确转义
- [ ] 超长文档（>1000 行 MD）：正常构建，不超时

#### Security
- [ ] MD 内容中的 `<script>` 标签：构建后被转义，不执行
- [ ] MD 内容中的 HTML 注入：被 markdown-it 安全处理
- [ ] 文件路径中的 `../` 穿越：不泄露 workspace 外的文件

#### Data Leak
- [ ] 构建日志不包含文件系统绝对路径
- [ ] 错误信息不暴露 workspace 外部的目录结构

#### Data Damage
- [ ] 清理 .md 只删除 docs/ 下的 .md 文件，不误删 .meta.yaml
- [ ] 清理 .md 不影响 assets/ 目录中的任何文件
- [ ] 构建失败时不删除已有的 dist/ 内容（先构建到临时目录，成功后替换）

### E2E Gate

```bash
# 准备测试 workspace
mkdir -p /tmp/test-docsmith/.aigne/doc-smith/docs/overview
mkdir -p /tmp/test-docsmith/.aigne/doc-smith/planning

# 创建最小配置
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

# 执行构建
cd /tmp/test-docsmith && node skills/doc-smith-build/scripts/build.mjs \
  --workspace .aigne/doc-smith \
  --output .aigne/doc-smith/dist

# 验证输出
test -f .aigne/doc-smith/dist/zh/docs/overview.html && echo "✓ HTML generated"
test -f .aigne/doc-smith/dist/assets/docsmith.css && echo "✓ CSS copied"
test -f .aigne/doc-smith/dist/index.html && echo "✓ Index redirect generated"
# 验证 MD 已清理
test ! -f .aigne/doc-smith/docs/overview/zh.md && echo "✓ MD cleaned up"
# 验证 meta 保留
test -f .aigne/doc-smith/docs/overview/.meta.yaml && echo "✓ Meta preserved"
```

### Acceptance Criteria

- [ ] 所有 6 类测试通过
- [ ] E2E Gate 验证通过
- [ ] build.mjs 新增 .md 清理逻辑
- [ ] 代码已提交

---

## Phase 1: doc-smith-content + doc-smith-create 流程改造

### Description

改造文档生成流程：doc-smith-content 明确 MD 为中间产物；doc-smith-create 在内容和图片生成完毕后调用 build.mjs 构建 HTML，构建后清理中间 .md 文件。构建步骤集成到现有流程中，不作为独立 Phase。

### 涉及文件

- `agents/doc-smith-content.md`（改造：明确 MD 为中间产物）
- `skills/doc-smith-create/SKILL.md`（改造：集成构建步骤到流程末尾）
- `skills/doc-smith-build/SKILL.md`（适配：更新说明）

### Tests

#### Happy Path
- [ ] doc-smith-content 生成 MD 文件到 docs/ 目录：格式正确，.meta.yaml 同步创建
- [ ] doc-smith-create 完整流程：分析 → 结构 → 内容 → 图片 → 构建 HTML → 清理 MD
- [ ] 构建完成后 dist/ 包含完整 HTML 站点
- [ ] docs/ 中 .md 文件已清理，.meta.yaml 保留
- [ ] theme.css 不存在时询问用户，用户选择默认则跳过

#### Bad Path
- [ ] build.mjs 执行失败时：报告错误，保留 .md 文件不清理（可重试）
- [ ] doc-smith-content 生成空文档时：构建跳过该文档并警告
- [ ] npm 依赖未安装时：自动执行 npm install 后重试
- [ ] workspace 不完整（缺少 config.yaml）时：在构建前检测并报错

#### Edge Cases
- [ ] 只生成单篇文档（独立调用 doc-smith-content）时：不触发全站构建
- [ ] 更新已有文档时：增量构建，不影响其他已有 HTML
- [ ] 用户选择自定义主题时：先生成 theme.css 再构建

#### Security
- [ ] 用户自定义主题中的 JS 注入：theme.css 只允许 CSS，不允许 `<script>`
- [ ] document-structure.yaml 中的路径注入：验证路径格式

#### Data Leak
- [ ] 构建结果报告不暴露绝对路径，使用相对路径
- [ ] 错误信息不暴露系统信息

#### Data Damage
- [ ] 构建失败不会破坏已有的 dist/ 内容
- [ ] 更新文档时不丢失未修改的文档

### E2E Gate

```bash
# 在真实项目上测试完整流程（需要人工触发 /doc-smith-create）
# 验证最终输出
test -d .aigne/doc-smith/dist && echo "✓ dist/ exists"
ls .aigne/doc-smith/dist/zh/docs/ | wc -l  # 应有多个 HTML 文件
test ! "$(find .aigne/doc-smith/docs -name '*.md' 2>/dev/null)" && echo "✓ MD files cleaned"
find .aigne/doc-smith/docs -name '.meta.yaml' | wc -l  # meta 文件应保留

# 验证 HTML 页面可访问
grep -l 'data-ds="content"' .aigne/doc-smith/dist/zh/docs/*.html | wc -l  # 应 > 0
```

### Acceptance Criteria

- [ ] 所有 6 类测试通过
- [ ] E2E Gate 验证通过
- [ ] doc-smith-content.md 已更新（明确 MD 中间产物定位）
- [ ] doc-smith-create SKILL.md 已更新（集成构建步骤）
- [ ] 任务规划模板已更新（包含构建步骤）
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
#    预期：分析 → 结构 → 内容(MD) → 图片 → 构建(HTML) → 清理(MD)

# 2. 验证 HTML 站点完整性
test -d .aigne/doc-smith/dist && echo "✓ dist/ 存在"
test -f .aigne/doc-smith/dist/index.html && echo "✓ 首页重定向存在"
ls .aigne/doc-smith/dist/zh/docs/*.html | wc -l  # 验证页面数量
grep 'data-ds="content"' .aigne/doc-smith/dist/zh/docs/*.html | wc -l  # 验证 HTML 骨架

# 3. 验证中间 MD 已清理
test ! "$(find .aigne/doc-smith/docs -name '*.md' 2>/dev/null)" && echo "✓ MD 已清理"

# 4. 验证 meta 文件保留
find .aigne/doc-smith/docs -name '.meta.yaml' | wc -l  # 应 > 0

# 5. 验证图片生成（无 AIGNE CLI 依赖）
ls .aigne/doc-smith/assets/*/images/*.png 2>/dev/null | wc -l  # 应 > 0

# 6. 验证资源文件
test -f .aigne/doc-smith/dist/assets/docsmith.css && echo "✓ CSS 存在"
```

## Risk Mitigation

| Risk | Mitigation | Contingency |
|------|------------|-------------|
| build.mjs 清理 MD 误删文件 | 只删除 docs/ 下的 .md 文件，白名单 .meta.yaml | git 恢复 |
| AIGNE Hub API 接口变更 | 封装 API 调用层，便于适配 | 回退到 AIGNE CLI |
| 构建步骤拖慢生成流程 | build.mjs 是确定性、快速的操作 | 可设为可选步骤 |
| 并发图片生成 API 限流 | 控制并发数，添加重试逻辑 | 串行执行降级 |

## References

- [Intent](./html-migration-intent.md)
- [Overview](./html-migration-overview.md)
- [Engineering](./html-migration-engineering.md)
