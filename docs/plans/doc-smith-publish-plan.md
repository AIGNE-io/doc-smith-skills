# Execution Plan: doc-smith-publish

## Overview

从 myvibe-publish 裁剪改造，创建 doc-smith-publish skill，实现文档一键发布到 DocSmith Cloud。

## Prerequisites

- myvibe-publish 源码可读（`/Users/lban/arcblock/code/myvibe-skills/skills/myvibe-publish/`）
- Node.js 18+

## Phase 0: 脚本基础设施（复制 + 裁剪 + 改名）

### Description

从 myvibe-publish 复制 scripts/ 目录，裁剪不需要的模块（截图、标签、图片上传），重命名所有 myvibe 相关常量和路径。此阶段不涉及新功能，只做减法和改名。

### Tests

#### Happy Path
- [ ] constants.mjs 导出 `DOCSMITH_HUB_URL_DEFAULT` 值为 `https://docsmith.aigne.io`
- [ ] store.mjs 使用路径 `~/.aigne/docsmith-connected.yaml`，serviceName 为 `docsmith-publish`
- [ ] auth.mjs TOKEN_KEY 为 `DOCSMITH_ACCESS_TOKEN`，appName 为 `DocSmith`
- [ ] upload.mjs uploaderId 为 `DocSmithPublish`
- [ ] publish.mjs 日志包含 `DocSmith Publish` 而非 `MyVibe`

#### Bad Path
- [ ] 不存在 fetch-tags.mjs 文件
- [ ] 不存在 generate-screenshot.mjs 文件
- [ ] 不存在 upload-image.mjs 文件
- [ ] publish.mjs 不支持 `--url` 参数
- [ ] publish.mjs 不支持 `--file` 参数（仅 --dir）

#### Edge Cases
- [ ] package.json 依赖与 myvibe-publish 一致，`npm install` 成功
- [ ] 所有 import 路径无断裂（无引用已删除模块）

#### Security
- [ ] 凭证存储使用 keyring（@aigne/secrets），不以明文存储
- [ ] 环境变量 `DOCSMITH_ACCESS_TOKEN` 可替代交互式授权

#### Data Leak
- [ ] 授权失败错误信息不包含 token 内容
- [ ] 日志不打印 accessToken 值

#### Data Damage
- [ ] 已删除模块不在任何 import 中被引用

### E2E Gate

```bash
# 验证 scripts 可正常加载（无 import 错误）
cd skills/doc-smith-publish/scripts && npm install && node -e "import('./publish.mjs')"
# 验证已删除文件不存在
test ! -f skills/doc-smith-publish/scripts/utils/fetch-tags.mjs
test ! -f skills/doc-smith-publish/scripts/utils/generate-screenshot.mjs
test ! -f skills/doc-smith-publish/scripts/utils/upload-image.mjs
# 验证常量值
node -e "import('./utils/constants.mjs').then(m => { if(m.DOCSMITH_HUB_URL_DEFAULT !== 'https://docsmith.aigne.io') process.exit(1) })"
```

### Acceptance Criteria

- [ ] scripts/ 目录结构完整，`npm install` 成功
- [ ] 所有 myvibe 引用已替换为 docsmith/aigne
- [ ] 无已删除模块的残留引用
- [ ] `node -e "import('./publish.mjs')"` 不报错

---

## Phase 1: history.mjs 改造（项目本地存储）

### Description

将发布历史从全局 `~/.myvibe/published.yaml` 改为项目本地 `.aigne/doc-smith/cache/publish-history.yaml`。publish.mjs 需新增 `workspace` 配置字段，history.mjs 据此确定存储路径。

### Tests

#### Happy Path
- [ ] 传入 workspace 路径后，历史文件创建在 `{workspace}/cache/publish-history.yaml`
- [ ] `savePublishHistory` 正确写入 did、lastPublished、title
- [ ] `getPublishHistory` 正确读取已有记录并匹配 hubUrl

#### Bad Path
- [ ] workspace 目录不存在时 `getPublishHistory` 返回 null（不报错）
- [ ] publish-history.yaml 格式损坏时返回 null（不报错）
- [ ] hubUrl 不匹配时返回 null

#### Edge Cases
- [ ] cache/ 目录不存在时自动创建
- [ ] 首次发布时历史文件不存在，正常创建

#### Security
- [ ] 历史文件不包含 accessToken
- [ ] 文件权限合理（不过于宽松）

#### Data Leak
- [ ] 历史文件仅包含 did、lastPublished、title，不含其他敏感信息

#### Data Damage
- [ ] 并发写入不损坏 YAML 文件（写入前读取最新）
- [ ] 写入新记录不覆盖其他 sourcePath 的记录

### E2E Gate

```bash
# 创建临时 workspace 并验证历史读写
TMPWS=$(mktemp -d)/doc-smith
mkdir -p "$TMPWS/cache"
node -e "
import { savePublishHistory, getPublishHistory } from './utils/history.mjs';
const ws = '$TMPWS';
await savePublishHistory('/test/dist', 'https://docsmith.aigne.io', 'z2qaTest', 'Test', ws);
const h = await getPublishHistory('/test/dist', 'https://docsmith.aigne.io', ws);
if (!h || h.did !== 'z2qaTest') process.exit(1);
console.log('history OK');
"
```

### Acceptance Criteria

- [ ] history.mjs 接受 workspace 参数
- [ ] 存储路径为 `{workspace}/cache/publish-history.yaml`
- [ ] 读写功能正常

---

## Phase 2: publish.mjs 改造（核心发布逻辑）

### Description

改造 publish.mjs 主逻辑：移除截图等待、移除 tag 相关、移除 URL/file 模式、新增 workspace 配置字段、vibeUrl 使用 `actionResult.vibeUrl`、发布后写入 config.yaml 的 appUrl。

### Tests

#### Happy Path
- [ ] `--config-stdin` 接收 JSON 配置（含 workspace 字段）
- [ ] 发布流程：压缩 → 上传 → 转换 → publish action → 获取 vibeUrl
- [ ] 成功后输出 vibeUrl
- [ ] 成功后 config.yaml 的 appUrl 被更新
- [ ] 成功后发布历史被保存

#### Bad Path
- [ ] source.type 非 "dir" 时报错
- [ ] dir 路径不存在时报错
- [ ] 授权失败（401）时清除 token 并提示重新运行
- [ ] 上传失败时输出明确错误信息
- [ ] 转换失败时输出明确错误信息
- [ ] publish action 失败时提示用户重新运行

#### Edge Cases
- [ ] actionResult 中无 vibeUrl 字段时合理处理（fallback 或提示）
- [ ] config.yaml 不存在时跳过 appUrl 写入（不报错）
- [ ] workspace 字段缺失时使用默认行为

#### Security
- [ ] 不在 JSON 配置中传递 accessToken（运行时获取）
- [ ] 授权 URL 不泄露内部路径

#### Data Leak
- [ ] 上传失败的错误消息不包含完整 accessToken
- [ ] 日志不打印完整配置对象

#### Data Damage
- [ ] config.yaml 写入 appUrl 不破坏其他字段
- [ ] 发布历史写入不覆盖其他项目记录

### E2E Gate

```bash
# 验证 publish.mjs 可解析 config-stdin 格式（dry-run 级别，不实际上传）
echo '{"source":{"type":"dir","path":"./nonexistent"},"hub":"https://docsmith.aigne.io","workspace":".aigne/doc-smith","metadata":{"title":"Test","description":"Test","visibility":"public"}}' | node skills/doc-smith-publish/scripts/publish.mjs --config-stdin 2>&1 | grep -q "Directory not found\|not found\|Error"
echo "publish.mjs config parsing OK"
```

### Acceptance Criteria

- [ ] 移除所有截图相关逻辑
- [ ] 移除 tag 相关逻辑
- [ ] 移除 URL/file 输入模式
- [ ] 新增 workspace 配置字段处理
- [ ] vibeUrl 从 actionResult.vibeUrl 获取
- [ ] 发布后写入 config.yaml appUrl

---

## Phase 3: SKILL.md 编写

### Description

编写 `skills/doc-smith-publish/SKILL.md`，定义用户调用界面和 Agent 工作流。包含输入源检测逻辑、metadata 读取、脚本调用模板。

### Tests

#### Happy Path
- [ ] SKILL.md frontmatter 包含 name: doc-smith-publish 和 description
- [ ] Workflow 步骤完整：检查依赖 → 检测目标 → 读 metadata → 执行发布 → 展示结果
- [ ] 脚本调用示例包含 --config-stdin JSON 格式
- [ ] 默认 hub 为 `https://docsmith.aigne.io`

#### Bad Path
- [ ] 错误处理表覆盖所有 intent 中定义的 7 种错误
- [ ] dist 不存在时的提示明确指向 `/doc-smith-create`

#### Edge Cases
- [ ] 检测当前目录为 doc-smith 输出的条件明确（`assets/nav.js` 存在）
- [ ] --hub 参数覆盖默认值的说明

#### Security
- [ ] 脚本执行提示需要网络权限
- [ ] 不在 SKILL.md 中硬编码任何凭证

#### Data Leak
- [ ] 示例配置中不包含真实 DID 或 token

#### Data Damage
- [ ] appUrl 写入说明明确为更新字段，不覆盖文件

### E2E Gate

```bash
# 验证 SKILL.md 格式正确
test -f skills/doc-smith-publish/SKILL.md
head -5 skills/doc-smith-publish/SKILL.md | grep -q "name: doc-smith-publish"
grep -q "docsmith.aigne.io" skills/doc-smith-publish/SKILL.md
grep -q "config-stdin" skills/doc-smith-publish/SKILL.md
echo "SKILL.md structure OK"
```

### Acceptance Criteria

- [ ] SKILL.md 符合项目 CLAUDE.md 中定义的 Skill 文件结构
- [ ] 工作流步骤与 intent 一致
- [ ] 所有提示文案使用中文（按 CLAUDE.md 要求）

---

## Phase 4: 集成验证 + doc-smith-create 更新

### Description

端到端集成验证：确保 skill 可被 Claude Code 识别和调用。更新 doc-smith-create 的完成提示，从 `/myvibe-publish` 改为 `/doc-smith-publish`。

### Tests

#### Happy Path
- [ ] `/doc-smith-publish` 命令可被 Claude Code 识别
- [ ] doc-smith-create 完成后提示使用 `/doc-smith-publish`

#### Bad Path
- [ ] 在无 workspace 的目录运行时给出明确错误提示

#### Edge Cases
- [ ] doc-smith-create SKILL.md 中无 myvibe-publish 残留引用

#### Security
- [ ] 无新增安全风险

#### Data Leak
- [ ] 无新增泄露风险

#### Data Damage
- [ ] doc-smith-create SKILL.md 修改仅限提示文案，不影响其他功能

### E2E Gate

```bash
# 验证 skill 目录完整
test -f skills/doc-smith-publish/SKILL.md
test -f skills/doc-smith-publish/scripts/publish.mjs
test -f skills/doc-smith-publish/scripts/package.json
test -d skills/doc-smith-publish/scripts/utils
# 验证 doc-smith-create 引用更新
grep -q "doc-smith-publish" skills/doc-smith-create/SKILL.md
! grep -q "myvibe-publish" skills/doc-smith-create/SKILL.md
echo "Integration OK"
```

### Acceptance Criteria

- [ ] skill 目录结构完整
- [ ] doc-smith-create 提示已更新
- [ ] 代码已提交到 feat/doc-smith-publish 分支

---

## Final E2E Verification

```bash
# 完整验证
cd /Users/lban/arcblock/code/doc-smith-skills

# 1. 文件结构
test -f skills/doc-smith-publish/SKILL.md
test -f skills/doc-smith-publish/scripts/publish.mjs
test -f skills/doc-smith-publish/scripts/package.json

# 2. 依赖安装
cd skills/doc-smith-publish/scripts && npm install && cd -

# 3. 模块加载
node -e "import('./skills/doc-smith-publish/scripts/publish.mjs')"

# 4. 已删除文件不存在
test ! -f skills/doc-smith-publish/scripts/utils/fetch-tags.mjs
test ! -f skills/doc-smith-publish/scripts/utils/generate-screenshot.mjs

# 5. myvibe 残留检查
! grep -r "myvibe" skills/doc-smith-publish/ --include="*.mjs" --include="*.md" -l

# 6. doc-smith-create 引用
grep -q "doc-smith-publish" skills/doc-smith-create/SKILL.md

echo "All checks passed"
```

## References

- [Intent](./doc-smith-publish-intent.md)
- [Overview](./doc-smith-publish-overview.md)
- [myvibe-publish 源码](/Users/lban/arcblock/code/myvibe-skills/skills/myvibe-publish/)
