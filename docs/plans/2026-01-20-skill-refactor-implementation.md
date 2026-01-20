# Doc-Smith Skill 重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 doc-smith-skill 重构为 Claude Code Plugin 结构，拆分为 7 个独立 Skill

**Architecture:** 所有功能以 Claude Code Skill (SKILL.md) 形式提供，模型作为编排者根据用户需求选择调用。仅 doc-smith-images 内部通过 bash 调用 AIGNE 执行生图。

**Tech Stack:** Claude Code Plugin, SKILL.md, AIGNE (仅生图)

**设计文档:** `docs/plans/2026-01-20-skill-refactor-design.md`

---

## Phase 1: 基础设施准备

### Task 1.1: 重命名 doc-smith-docs-detail 为 doc-smith-content

**Files:**
- Rename: `skills/doc-smith-docs-detail/` → `skills/doc-smith-content/`
- Modify: `skills/doc-smith-content/SKILL.md` (更新 name 字段)

**Step 1: 重命名目录**

```bash
cd /Users/lban/arcblock/code/doc-smith-skill
mv skills/doc-smith-docs-detail skills/doc-smith-content
```

**Step 2: 更新 SKILL.md 中的 name 字段**

修改 `skills/doc-smith-content/SKILL.md` 的 frontmatter:

```yaml
---
name: doc-smith-content
description: |
  生成单个文档的详细内容...
---
```

**Step 3: 验证重命名成功**

```bash
ls -la skills/doc-smith-content/
cat skills/doc-smith-content/SKILL.md | head -5
```

Expected: 目录存在且 name 字段为 `doc-smith-content`

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rename doc-smith-docs-detail to doc-smith-content"
```

---

## Phase 2: 创建简单 Skills (无脚本依赖)

### Task 2.1: 创建 doc-smith-clear Skill

**Files:**
- Create: `skills/doc-smith-clear/SKILL.md`
- Create: `skills/doc-smith-clear/scripts/clear-auth.mjs` (从 agents/clear/ 复制并调整)

**Step 1: 创建目录结构**

```bash
mkdir -p skills/doc-smith-clear/scripts
```

**Step 2: 创建 SKILL.md**

创建 `skills/doc-smith-clear/SKILL.md`:

```markdown
---
name: doc-smith-clear
description: 清除 Doc-Smith 的站点授权和部署配置。当用户要求清除授权、重置配置、清除部署信息时使用此技能。
---

# Doc-Smith 清除配置

清除 Doc-Smith 的站点授权和部署配置。

## 触发场景

- 用户要求清除授权 token
- 用户要求清除部署配置
- 用户说"清除配置"、"重置"、"清除授权"

## 存储说明

**授权信息 (authTokens)**：
- 存储在系统 keyring（如 macOS Keychain）中
- 服务名：`aigne-doc-smith-publish`
- 按站点 hostname 组织，支持多站点授权
- 如果系统不支持 keyring，回退到 `~/.aigne/doc-smith-connected.yaml`

**部署配置 (deploymentConfig)**：
- `appUrl` 字段存储在 workspace 的 `config.yaml` 中

## 工作流程

### 1. 确认清除内容

向用户确认要清除的内容：

**可清除的内容：**
- **站点授权 (authTokens)**：清除系统 keyring 中的站点授权信息
- **部署配置 (deploymentConfig)**：清除 workspace `config.yaml` 中的 `appUrl` 字段

询问用户："请选择要清除的内容：1) 站点授权 2) 部署配置 3) 全部清除"

### 2. 清除站点授权

如果用户选择清除授权：

1. 通过 `@aigne/secrets` 读取已授权的站点列表
2. 向用户展示已授权的站点 hostname 列表
3. 让用户选择要清除的站点（支持多选或全部清除）
4. 从 keyring 中删除选中站点的授权信息

**脚本调用：**
```bash
node skills/doc-smith-clear/scripts/clear-auth.mjs
```

### 3. 清除部署配置

如果用户选择清除部署配置：

1. 检查当前目录是否存在 `config.yaml`
2. 如果存在，读取并删除 `appUrl` 字段
3. 写回文件

**注意：** 这需要在 Doc-Smith workspace 目录中执行。

### 4. 确认结果

显示清除结果：
- 已清除的站点授权列表
- 是否清除了部署配置

## 注意事项

- 清除操作不可恢复，执行前必须确认
- 清除站点授权后需要重新授权才能发布到该站点
- 清除部署配置后下次发布需要重新指定目标 URL
- 站点授权是全局的（存储在用户目录），不依赖于当前 workspace
```

**Step 3: 复制并调整清除脚本**

从现有 agents 复制清除授权脚本：

```bash
cp agents/clear/clear-auth-tokens.mjs skills/doc-smith-clear/scripts/clear-auth.mjs
```

修改 `skills/doc-smith-clear/scripts/clear-auth.mjs`：
- 更新导入路径（将 `../../utils/store/index.mjs` 改为相对新位置的路径）
- 或者将 store 相关代码内联

**Step 4: 验证文件创建**

```bash
ls -la skills/doc-smith-clear/
ls -la skills/doc-smith-clear/scripts/
```

**Step 5: Commit**

```bash
git add skills/doc-smith-clear/
git commit -m "feat: add doc-smith-clear skill with auth clearing script"
```

---

### Task 2.2: 创建 doc-smith-check Skill

**Files:**
- Create: `skills/doc-smith-check/SKILL.md`
- Create: `skills/doc-smith-check/scripts/check-structure.mjs`
- Create: `skills/doc-smith-check/scripts/check-content.mjs`

**Step 1: 创建目录结构**

```bash
mkdir -p skills/doc-smith-check/scripts
```

**Step 2: 创建 SKILL.md**

创建 `skills/doc-smith-check/SKILL.md`:

```markdown
---
name: doc-smith-check
description: 检查 Doc-Smith 文档的结构和内容完整性。当需要校验文档结构 YAML、检查文档内容、验证链接和图片路径时使用此技能。也可被其他 doc-smith 技能调用进行校验。
---

# Doc-Smith 文档检查

检查 Doc-Smith 文档的结构和内容完整性。

## 触发场景

- 用户要求检查文档状态
- 用户说"检查文档"、"校验结构"、"验证内容"
- 其他 doc-smith 技能需要进行校验时（如 doc-smith 主流程）

## 检查工具

### 1. 结构检查 (checkStructure)

校验 `planning/document-structure.yaml` 文件的格式和完整性。

**执行方式：**

```bash
node skills/doc-smith-check/scripts/check-structure.mjs
```

**检查内容：**
- YAML 格式是否正确
- 必需字段是否存在（title, path, description）
- path 格式是否正确（必须以 `/` 开头）
- sourcePaths 格式是否正确

**返回结果：**
- `valid: true` - 校验通过
- `valid: false` - 校验失败，返回错误列表和修复建议

### 2. 内容检查 (checkContent)

检查已生成文档的完整性。

**执行方式：**

```bash
node skills/doc-smith-check/scripts/check-content.mjs
```

**检查内容：**
- 文档文件是否存在
- 必需的 `.meta.yaml` 是否存在
- 内部链接是否有效
- 图片路径是否正确
- AFS image slot 格式是否正确

**返回结果：**
- `valid: true` - 检查通过
- `valid: false` - 检查失败，返回问题列表

## 使用场景

### 独立检查

用户直接调用检查文档状态：

```
用户：检查一下文档有没有问题
→ 调用 doc-smith-check
→ 执行结构检查和内容检查
→ 返回检查报告
```

### 被其他 Skill 调用

在 doc-smith 主流程中：
- 生成 document-structure.yaml 后调用结构检查
- 生成文档内容后调用内容检查
- 结束前进行最终校验

## 错误处理

### 结构检查失败

1. 分析错误报告，理解问题所在
2. 根据修复建议修正 `document-structure.yaml`
3. 重新执行结构检查
4. 如果连续 3 次失败，向用户报告

### 内容检查失败

1. 分析问题列表
2. 根据问题类型采取行动：
   - 文档缺失：生成缺失的文档
   - 链接错误：修正链接路径
   - 图片问题：提供图片或修正路径
3. 重新执行内容检查
```

**Step 3: 复制检查脚本**

从现有 agents 复制检查逻辑到 scripts 目录：

```bash
# 复制 structure-checker
cp agents/structure-checker/index.mjs skills/doc-smith-check/scripts/check-structure.mjs
cp agents/structure-checker/validate-structure.mjs skills/doc-smith-check/scripts/validate-structure.mjs

# 复制 content-checker
cp agents/content-checker/index.mjs skills/doc-smith-check/scripts/check-content.mjs
cp agents/content-checker/validate-content.mjs skills/doc-smith-check/scripts/validate-content.mjs
cp agents/content-checker/clean-invalid-docs.mjs skills/doc-smith-check/scripts/clean-invalid-docs.mjs
```

**Step 4: 更新脚本中的导入路径**

修改复制的脚本，更新 `import` 路径：

- 将 `../../utils/agent-constants.mjs` 改为相对于新位置的路径
- 或者将必要的常量直接内联到脚本中

**Step 5: 验证脚本可执行**

```bash
node skills/doc-smith-check/scripts/check-structure.mjs
```

Expected: 脚本执行（可能报错说找不到 workspace，这是正常的）

**Step 6: Commit**

```bash
git add skills/doc-smith-check/
git commit -m "feat: add doc-smith-check skill with validation scripts"
```

---

### Task 2.3: 创建 doc-smith-translate Skill

**Files:**
- Create: `skills/doc-smith-translate/SKILL.md`

**Step 1: 创建目录和 SKILL.md**

创建 `skills/doc-smith-translate/SKILL.md`:

```markdown
---
name: doc-smith-translate
description: 将 Doc-Smith 生成的文档翻译成多种语言。当用户要求翻译文档、本地化、多语言支持时使用此技能。支持批量翻译和单篇翻译。
---

# Doc-Smith 文档翻译

将文档翻译成多种语言，支持批量翻译和术语一致性。

## 触发场景

- 用户要求翻译文档到其他语言
- 用户说"翻译"、"本地化"、"多语言"
- 批量翻译多篇文档
- 优化某篇文档的翻译质量

## 工作流程

### 1. 检测 Workspace

检查当前目录是否为有效的 Doc-Smith workspace：

```bash
ls -la config.yaml planning/document-structure.yaml docs/
```

如果不存在，提示用户先使用 `doc-smith` 生成文档。

### 2. 确定翻译范围

**文档范围：**
- 如果用户指定了文档路径，只翻译指定文档
- 如果未指定，翻译所有文档

**目标语言：**
- 询问用户目标语言（如 en, ja, fr, de）
- 从 `config.yaml` 读取 `locale` 作为源语言

### 3. 加载术语表

如果存在 `glossary.yaml` 或 `glossary.md`，加载术语表以确保翻译一致性。

术语表格式：
```yaml
terms:
  - source: "工作区"
    en: "workspace"
    ja: "ワークスペース"
```

### 4. 执行翻译

对每个文档：

1. 读取源语言文档内容
2. 保持 Markdown 格式和结构
3. 翻译文本内容，保留：
   - 代码块（不翻译）
   - 链接路径（不翻译）
   - 图片路径（不翻译）
   - AFS image slot（不翻译）
4. 应用术语表确保一致性
5. 保存翻译后的文档到对应语言文件

**文件命名规则：**
- 源文件：`docs/overview/zh.md`
- 翻译后：`docs/overview/en.md`、`docs/overview/ja.md`

### 5. 更新元信息

更新 `docs/xxx/.meta.yaml` 添加新的语言版本。

### 6. 生成翻译报告

返回翻译结果摘要：
- 翻译的文档数量
- 目标语言列表
- 是否有翻译失败的文档

## 翻译质量要求

- **术语一致性**：使用术语表保持专业术语统一
- **格式保持**：保持原文的 Markdown 格式
- **上下文理解**：根据技术文档语境选择合适译法
- **自然流畅**：翻译结果应符合目标语言习惯

## 参数

- `docs`: 文档路径列表（可选），如 `["/overview", "/api/auth"]`
- `langs`: 目标语言列表（必需），如 `["en", "ja"]`
- `force`: 是否强制重新翻译（可选，默认 false）

## 示例

**翻译所有文档到英文和日文：**
```
用户：把文档翻译成英文和日文
→ langs: ["en", "ja"]
→ docs: 全部
```

**翻译指定文档：**
```
用户：把 /overview 翻译成英文
→ langs: ["en"]
→ docs: ["/overview"]
```

**重新翻译：**
```
用户：重新翻译 /api/auth 这篇文档的英文版本
→ langs: ["en"]
→ docs: ["/api/auth"]
→ force: true
```
```

**Step 2: 验证文件创建**

```bash
ls -la skills/doc-smith-translate/
```

**Step 3: Commit**

```bash
git add skills/doc-smith-translate/
git commit -m "feat: add doc-smith-translate skill"
```

---

### Task 2.4: 创建 doc-smith-publish Skill

**Files:**
- Create: `skills/doc-smith-publish/SKILL.md`

**Step 1: 创建目录和 SKILL.md**

创建 `skills/doc-smith-publish/SKILL.md`:

```markdown
---
name: doc-smith-publish
description: 将 Doc-Smith 生成的文档发布到在线平台。当用户要求发布文档、上线、部署文档时使用此技能。
---

# Doc-Smith 文档发布

将生成的文档发布到在线平台。

## 触发场景

- 用户要求发布文档
- 用户说"发布"、"上线"、"部署文档"

## 工作流程

### 1. 检测 Workspace

检查当前目录是否为有效的 Doc-Smith workspace：

```bash
ls -la config.yaml planning/document-structure.yaml docs/
```

### 2. 检查发布条件

调用 `doc-smith-check` 确保文档完整：
- 文档结构校验通过
- 文档内容检查通过
- 必需的文档都已生成

如果检查失败，提示用户先修复问题。

### 3. 确认发布目标

**读取已有配置：**
从 `config.yaml` 读取 `appUrl`（上次发布的目标）

**确认或更新目标：**
- 如果用户提供了新的 URL，使用新 URL
- 如果未提供且有历史记录，询问是否使用上次的目标
- 如果都没有，要求用户提供发布目标 URL

### 4. 检查授权

检查 `config.yaml` 中是否有有效的 `authToken`。

如果没有授权：
1. 提示用户需要授权
2. 引导用户完成授权流程
3. 保存 authToken 到 config.yaml

### 5. 翻译 Meta 信息

确保文档的 meta 信息（标题、描述）已翻译到所有目标语言。

### 6. 执行发布

调用发布 API 上传文档：

```bash
# 发布脚本（如果需要）
node skills/doc-smith-publish/scripts/publish.mjs --url="$APP_URL"
```

### 7. 保存发布信息

更新 `config.yaml`：
- `appUrl`: 发布目标 URL
- `deployedAt`: 发布时间

### 8. 返回结果

返回发布结果：
- 发布状态（成功/失败）
- 发布的文档数量
- 在线访问 URL

## 参数

- `appUrl`: 发布目标 URL（可选，优先使用历史记录）

## 错误处理

- **授权失败**：引导用户重新授权
- **网络错误**：提示重试
- **文档不完整**：提示先完成文档生成
```

**Step 2: 验证文件创建**

```bash
ls -la skills/doc-smith-publish/
```

**Step 3: Commit**

```bash
git add skills/doc-smith-publish/
git commit -m "feat: add doc-smith-publish skill"
```

---

## Phase 3: 创建需要脚本的 Skill

### Task 3.1: 创建 doc-smith-images Skill

**Files:**
- Create: `skills/doc-smith-images/SKILL.md`
- Create: `skills/doc-smith-images/scripts/` (AIGNE 生图项目)

**Step 1: 创建目录结构**

```bash
mkdir -p skills/doc-smith-images/scripts
```

**Step 2: 创建 SKILL.md**

创建 `skills/doc-smith-images/SKILL.md`:

```markdown
---
name: doc-smith-images
description: 使用 AI 生成图片。当需要生成技术图表、架构图、流程图，或更新已有图片时使用此技能。这是一个通用的图片生成能力，可用于任何场景。
---

# Doc-Smith 图片生成

使用 AI 生成图片，支持技术图表、架构图、流程图等。

## 触发场景

- 文档中有 AFS Image Slot 需要生成图片
- 用户要求生成某张图片
- 用户要求更新/修改已有图片
- 任何需要 AI 生成图片的场景

## 核心能力

这是一个**通用的图片生成能力**，不与文档强绑定。

**输入：**
- prompt: 图片描述/生成提示词
- size: 图片尺寸（如 "2K", "1080p"）
- ratio: 宽高比（如 "16:9", "4:3", "1:1"）
- referenceImage: 参考图片路径（可选，用于图片更新）

**输出：**
- 生成的图片文件路径

## 工作流程

### 1. 准备生图参数

收集必要的参数：
- **prompt**（必需）：描述要生成的图片内容
- **size**（可选）：默认 "2K"
- **ratio**（可选）：默认 "16:9"
- **outputPath**（可选）：图片保存路径

### 2. 调用 AIGNE 生图

通过 bash 调用 AIGNE 项目执行生图：

```bash
cd skills/doc-smith-images/scripts/aigne-generate
aigne run . generate --prompt="$PROMPT" --size="$SIZE" --ratio="$RATIO" --output="$OUTPUT_PATH"
```

### 3. 验证生成结果

检查图片是否成功生成：
```bash
ls -la "$OUTPUT_PATH"
```

### 4. 返回结果

返回生成的图片路径，供调用方使用。

## 使用示例

### 生成架构图

```
用户：帮我生成一张系统架构图
→ prompt: "System architecture diagram showing..."
→ 调用 AIGNE 生图
→ 返回图片路径
```

### 在文档流程中使用

当 doc-smith 主流程检测到 AFS Image Slot：

```markdown
<!-- afs:image id="architecture" desc="系统架构图，展示各模块关系" -->
```

主流程提取 desc 作为 prompt，调用 doc-smith-images 生成图片。

### 更新已有图片

```
用户：把这张图片的比例改成 4:3
→ prompt: 原有描述
→ ratio: "4:3"
→ referenceImage: 原图片路径
→ 生成新图片
```

## 图片类型支持

- **架构图**：系统架构、模块关系、组件结构
- **流程图**：业务流程、数据流向、状态转换
- **时序图**：交互时序、调用链路
- **概念图**：概念关系、层次结构
- **示意图**：功能示意、原理说明

## 注意事项

- 此 Skill 依赖 AIGNE 框架执行实际生图（Claude Code 不支持生图）
- 确保 AIGNE CLI 已安装：`npm install -g @anthropic/aigne-cli`
- 生图可能需要一定时间，请耐心等待
```

**Step 3: 设置 AIGNE 生图项目**

复制或创建 AIGNE 生图项目到 `scripts/aigne-generate/`：

```bash
# 从现有 agents 复制生图相关文件
cp -r agents/generate-images skills/doc-smith-images/scripts/aigne-generate
```

**Step 4: 简化 AIGNE 项目**

修改复制的 AIGNE 项目，使其成为独立的生图能力：
- 移除与文档扫描相关的逻辑
- 保留核心生图功能
- 更新输入参数为 prompt/size/ratio

**Step 5: 验证结构**

```bash
ls -laR skills/doc-smith-images/
```

**Step 6: Commit**

```bash
git add skills/doc-smith-images/
git commit -m "feat: add doc-smith-images skill with AIGNE integration"
```

---

## Phase 4: 更新现有 Skills

### Task 4.1: 更新 doc-smith 主 Skill

**Files:**
- Modify: `skills/doc-smith/SKILL.md`

**Step 1: 阅读现有 SKILL.md**

```bash
cat skills/doc-smith/SKILL.md
```

**Step 2: 更新 SKILL.md**

更新 `skills/doc-smith/SKILL.md`，添加对其他 Skill 的引用：

1. 在 description 中说明这是主入口
2. 在流程中添加对 `doc-smith-content`、`doc-smith-check`、`doc-smith-images` 的引用
3. 说明翻译和发布由独立 Skill 处理

**关键修改点：**

在"步骤 4.2 执行程序化校验"中：
```markdown
**调用方式**：使用 `doc-smith-check` 技能进行结构校验
```

在"步骤 6 生成文档内容"中：
```markdown
使用 `doc-smith-content` 技能为文档结构中的每个文档生成内容。
```

在"步骤 8.4 检查是否存在 afs image slot"中：
```markdown
如果存在 AFS Image Slot，使用 `doc-smith-images` 技能生成图片。
```

添加说明：
```markdown
## 相关技能

- `doc-smith-content`：生成单篇文档内容
- `doc-smith-check`：校验文档结构和内容
- `doc-smith-images`：生成图片
- `doc-smith-translate`：翻译文档（用户需要时单独调用）
- `doc-smith-publish`：发布文档（用户需要时单独调用）
- `doc-smith-clear`：清除配置
```

**Step 3: 验证修改**

```bash
cat skills/doc-smith/SKILL.md | grep -A5 "相关技能"
```

**Step 4: Commit**

```bash
git add skills/doc-smith/SKILL.md
git commit -m "refactor: update doc-smith skill to reference other skills"
```

---

### Task 4.2: 更新 doc-smith-content Skill

**Files:**
- Modify: `skills/doc-smith-content/SKILL.md`

**Step 1: 添加独立调用检查逻辑**

在 `skills/doc-smith-content/SKILL.md` 中添加独立调用时的检查：

在"工作流程"开头添加：

```markdown
### 0. 前置检查（独立调用时）

当用户直接调用此技能（而非通过 doc-smith 主流程）时，必须先检查：

1. **检查 workspace 是否存在**
   ```bash
   ls -la config.yaml planning/document-structure.yaml
   ```
   如果不存在，提示用户："请先使用 doc-smith 初始化 workspace 并生成文档结构。"

2. **检查目标文档是否在结构中**
   读取 `planning/document-structure.yaml`，确认用户请求的文档路径存在。
   如果不存在，提示用户："文档路径 /xxx 不在文档结构中，请先添加到文档结构或使用 doc-smith 生成。"

如果是通过 doc-smith 主流程调用，跳过此检查（假设已完成初始化）。
```

**Step 2: 更新 description**

```yaml
---
name: doc-smith-content
description: |
  生成单个文档的详细内容。使用场景：
  - doc-smith 主流程调用，批量生成各文档内容
  - 用户独立调用，重新生成某篇文档（如"重新生成 /overview"）
  独立调用时会先检查 workspace 和文档结构是否存在。
---
```

**Step 3: Commit**

```bash
git add skills/doc-smith-content/SKILL.md
git commit -m "feat: add independent call validation to doc-smith-content"
```

---

## Phase 5: 清理和验证

### Task 5.1: 更新 CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: 添加 Skill 列表说明**

在 `CLAUDE.md` 中添加新的 Skill 说明：

```markdown
## Doc-Smith Skills

本项目提供以下 Claude Code Skills：

| Skill | 功能 |
|-------|------|
| `doc-smith` | 主入口，完整文档生成流程 |
| `doc-smith-content` | 生成单篇文档内容 |
| `doc-smith-translate` | 翻译文档 |
| `doc-smith-images` | AI 图片生成 |
| `doc-smith-publish` | 发布文档 |
| `doc-smith-clear` | 清除配置 |
| `doc-smith-check` | 文档检查工具 |
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with skill list"
```

---

### Task 5.2: 验证所有 Skills

**Step 1: 列出所有 Skills**

```bash
ls -la skills/
```

Expected: 7 个 Skill 目录
- doc-smith
- doc-smith-content
- doc-smith-translate
- doc-smith-images
- doc-smith-publish
- doc-smith-clear
- doc-smith-check

**Step 2: 验证每个 SKILL.md 存在**

```bash
for skill in skills/*/; do
  echo "=== $skill ==="
  head -5 "${skill}SKILL.md"
done
```

**Step 3: 最终 Commit**

```bash
git add -A
git commit -m "chore: complete skill refactor phase 1"
```

---

## 实现顺序总结

1. **Phase 1**: 重命名 doc-smith-docs-detail → doc-smith-content
2. **Phase 2**: 创建简单 Skills (无脚本依赖)
   - doc-smith-clear
   - doc-smith-check (含脚本)
   - doc-smith-translate
   - doc-smith-publish
3. **Phase 3**: 创建 doc-smith-images (含 AIGNE 集成)
4. **Phase 4**: 更新现有 Skills
   - doc-smith (添加引用)
   - doc-smith-content (添加独立调用检查)
5. **Phase 5**: 清理和验证

## 后续工作

- 测试每个 Skill 的独立功能
- 测试 Skill 间的协作（模型能否正确选择调用）
- 根据测试结果调整 Skill 描述
- 清理不再需要的旧 agents 代码（可选）
