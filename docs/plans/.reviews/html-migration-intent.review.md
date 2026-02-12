---
source: docs/plans/html-migration-intent.md
created: 2026-02-10
reviewers:
  - claude
  - LBan
status: finalized
---

# Review: per-doc build + nav.js 架构变更

将 build 从全站批量模式改为单篇即时构建，导航外置为 nav.js，MD 仅在单篇生成瞬间存在。

---

## C001 [MODIFY] [ACCEPTED]

> 修改核心思想：MD 从"全部生成后批量构建"改为"每篇生成后立即构建"

**Target:** Section "### 核心思想"

**Before:**
```markdown
- AI 先生成 Markdown（token 消耗低、输出稳定），再转换为 HTML
- Markdown 只是生成过程中的中间产物，不作为最终管理对象
- `doc-smith-content` 改造：生成 MD 后转换为 HTML，只保留 HTML
- `build.mjs` 适配：支持新的转换流程
- 发布统一使用 `/myvibe-publish`（已支持 `--hub` 参数指定目标站点）
- 项目级发布配置：doc-smith-create 生成时写入 `publish.yaml`，`/myvibe-publish` 自动读取目标
```

**After:**
```markdown
- AI 先生成 Markdown（token 消耗低、输出稳定），每篇生成后立即构建为 HTML
- Markdown 仅在单篇文档生成的瞬间存在，生成 → 构建 → 删除，workspace 中始终只有 HTML
- `doc-smith-content` 改造：生成单篇 MD → 调用 build.mjs 构建为 HTML → 删除 MD
- `build.mjs` 改造：支持单篇构建模式（`--doc`）；导航从内联改为外置 nav.js
- 导航外置：侧边栏和语言切换由 nav.js 驱动，更新结构只需重新生成 nav.js，无需重建所有 HTML
- 发布统一使用 `/myvibe-publish`（已支持 `--hub` 参数指定目标站点）
- 项目级发布配置：doc-smith-create 生成时写入 `publish.yaml`，`/myvibe-publish` 自动读取目标
```

**Reason:** 批量模式下 MD 清理后无法增量更新（新增文档时旧页面导航过时且无法重建）。per-doc build 让 MD 仅存在于单篇生成瞬间，彻底消除 MD/HTML 共存问题。

---

## C002 [MODIFY] [ACCEPTED]

> 修改整体流程图：反映 per-doc build 和 nav.js 架构

**Target:** Section "### 整体流程"

**Before:**
```markdown
┌─────────────────────────────────────────────────────────────────┐
│  doc-smith-create（改造）                                        │
│                                                                 │
│  数据源分析 → 结构规划 → AI 生成 Markdown（中间产物）             │
│                              ↓                                  │
│                 .aigne/doc-smith/docs/**/*.md（临时）             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  build.mjs（适配）                                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 渲染器职责（极简、确定性）                                │   │
│  │ 1. Markdown → HTML（markdown-it）                       │   │
│  │ 2. 套固定 HTML 骨架（data-ds 锚点）                      │   │
│  │ 3. 注入导航 + TOC                                       │   │
│  │ 4. 拼接静态资源（CSS）                                   │   │
│  │ 5. 处理图片占位符                                        │   │
│  │ 6. 清理中间 .md 文件（新增）                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**After:**
```markdown
┌─────────────────────────────────────────────────────────────────┐
│  doc-smith-create（编排）                                        │
│                                                                 │
│  数据源分析 → 结构规划 → 并行调用 doc-smith-content              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  doc-smith-content（per-doc，可并行）                             │
│                                                                 │
│  AI 生成 Markdown → build.mjs --doc 构建 HTML → 删除 MD         │
│  （MD 仅在此步骤内瞬间存在）                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  build.mjs（两种模式）                                           │
│                                                                 │
│  --doc 单篇构建:                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Markdown → HTML（markdown-it）                       │   │
│  │ 2. 套 HTML 骨架（data-ds 锚点）                          │   │
│  │ 3. 生成 TOC（页面内联）                                   │   │
│  │ 4. 处理图片占位符                                        │   │
│  │ 5. 拼接静态资源引用（CSS + nav.js）                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  --nav 导航生成:                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 从 structure.yaml 生成 nav.js（侧边栏 + 语言切换）       │   │
│  │ 复制静态资源（docsmith.css、theme.css）                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Reason:** 流程图需要反映 per-doc build 和 nav.js 分离的新架构。

---

## C003 [MODIFY] [ACCEPTED]

> 修改 §3.1 doc-smith-content agent 改造要点

**Target:** Section "### 3.1 doc-smith-content agent（改造）"

**Before:**
```markdown
先生成 Markdown（中间产物），再转换为 HTML。Markdown 只是 AI 输出的中间格式，最终只保留 HTML。

**改造要点：**
- AI 仍然先生成 Markdown（token 消耗低、输出稳定）
- Markdown 是中间产物，生成后通过 build.mjs 转换为 HTML
- 最终只保留 HTML，不同时管理 MD 和 HTML
- AFS Image Slot 占位符：保持 `<!-- afs:image ... -->` 格式（在 MD 中标记，构建时处理）
- .meta.yaml：保留（记录文档元信息）
```

**After:**
```markdown
每篇文档生成后立即构建为 HTML。MD 仅在生成瞬间存在，构建完成后立即删除。

**改造要点：**
- AI 先生成 Markdown（token 消耗低、输出稳定）
- 生成后立即调用 `build.mjs --doc` 构建为 HTML，然后删除 MD
- MD 仅在 doc-smith-content 执行期间瞬间存在，不会出现在 workspace 中
- AFS Image Slot 占位符：保持 `<!-- afs:image ... -->` 格式（在 MD 中标记，构建时处理）
- .meta.yaml：保留（记录文档元信息）
```

**Reason:** 构建从全站模式变为 per-doc 模式，由 doc-smith-content 负责触发。

---

## C004 [MODIFY] [ACCEPTED]

> 修改 §3.2 build.mjs 适配为两种模式

**Target:** Section "### 3.2 build.mjs（适配）"

**Before:**
```markdown
核心能力直接复用，需要适配以支持新的工作流。

**复用的能力：**
- Markdown → HTML 转换（markdown-it + markdown-it-anchor）
- HTML 骨架模板（data-ds 锚点）
- 导航生成（从 document-structure.yaml）
- TOC 生成（从 HTML 提取 h2-h4）
- 多语言处理（独立目录输出）
- 图片占位符处理
- 资源复制（docsmith.css + theme.css）
- index.html 重定向生成

**需要适配：**
- 构建完成后清理 docs/ 中的中间 .md 文件
- 确保最终 workspace 只保留 HTML 产物
```

**After:**
```markdown
从全站批量构建改为支持两种模式：单篇构建 + 导航生成。

**模式 1：`--doc <path>` 单篇构建**
- 输入：单篇 MD 文件路径 + 文档 path
- 输出：对应的 HTML 文件到 dist/{lang}/docs/{path}.html
- 职责：Markdown → HTML 转换、HTML 骨架套用、TOC 内联生成、图片占位符处理、CSS + nav.js 引用
- 不负责：导航渲染（由 nav.js 在客户端完成）、MD 清理（由调用方 doc-smith-content 负责）

**模式 2：`--nav` 导航生成**
- 输入：document-structure.yaml + config.yaml
- 输出：assets/nav.js（导航数据）、assets/docsmith.css、assets/theme.css、index.html 重定向
- 调用时机：初始化时、结构变更后

**导航外置 nav.js：**
- 侧边栏和语言切换由 nav.js 驱动，页面通过 `<script src="{assetPath}/nav.js">` 加载
- 使用 `<script src>` 而非 fetch，兼容 file:// 和 http:// 协议
- 更新文档结构只需重新生成 nav.js，无需重建 HTML 页面
- TOC 仍然在构建时内联生成（页面特有内容）

**HTML 模板变化：**
- `data-ds="sidebar"` 改为 JS 渲染（从 nav.js 数据）
- `data-ds="toc"` 保持构建时内联
- 新增 `<script src="{assetPath}/nav.js">` 和内联渲染脚本
```

**Reason:** 全站批量构建改为 per-doc 模式后，导航需要外置才能支持增量更新。

---

## C005 [MODIFY] [ACCEPTED]

> 修改 §3.3 doc-smith-create 改造约束

**Target:** Section "### 3.3 doc-smith-create 改造"

**Before:**
```markdown
**约束：**
- 在所有 MD 和图片生成完毕后，调用 build.mjs 构建 HTML
- 构建命令：`node skills/doc-smith-build/scripts/build.mjs --workspace .aigne/doc-smith --output .aigne/doc-smith/dist`
- 如果 theme.css 不存在，询问用户是否需要自定义主题
- 结束时报告构建结果（dist/ 路径、各语言页面数量）
- 在 workspace 中写入 `publish.yaml`（含目标站点地址）
```

**After:**
```markdown
**约束：**
- 构建不再是独立步骤：doc-smith-content 每生成一篇文档即自动构建为 HTML
- doc-smith-create 在开始生成文档前，调用 `build.mjs --nav` 生成 nav.js 和静态资源
- 文档结构变更后（新增/删除文档），需要重新调用 `build.mjs --nav` 更新 nav.js
- 如果 theme.css 不存在，询问用户是否需要自定义主题（在首次 --nav 之前）
- doc-smith-check 改为校验 HTML 文件（而非 MD）
- 结束时报告构建结果（dist/ 路径、各语言页面数量）
- 在 workspace 中写入 `publish.yaml`（含目标站点地址）
```

**Reason:** doc-smith-create 不再直接调用全站构建，改为在结构确定后生成 nav.js，内容构建由 doc-smith-content 各自完成。

---

## C006 [MODIFY] [ACCEPTED]

> 修改 §4.2 Workspace 结构变化说明

**Target:** Section "### 4.2 Workspace 结构变化"

**Before:**
```markdown
相比现有结构，新增/变化：
- **新增** `publish.yaml`：发布配置（目标站点地址）
- **新增** `dist/`：构建输出目录（由 build.mjs 生成，含 HTML + assets）
- **变化** `docs/**/*.md`：生成时临时存在，构建后清理（MD 是中间产物）
```

**After:**
```markdown
相比现有结构，新增/变化：
- **新增** `publish.yaml`：发布配置（目标站点地址）
- **新增** `dist/`：构建输出目录（含 HTML + assets + nav.js）
- **新增** `dist/assets/nav.js`：导航数据（侧边栏 + 语言切换，由 build.mjs --nav 生成）
- **变化** `docs/**/*.md`：不再持久存在，仅在 doc-smith-content 执行单篇生成时瞬间存在
- **变化** `docs/**/`：目录和 .meta.yaml 保留，.md 文件在构建后立即删除
```

**Reason:** 反映 nav.js 和 per-doc build 的 workspace 结构变化。

---

## C007 [ADD] [ACCEPTED]

> 新增 §3.x doc-smith-check 改造说明

**Target:** After "### 3.3 doc-smith-create 改造"

**After:**
```markdown
### 3.x doc-smith-check 改造

内容检查从校验 MD 文件改为校验 HTML 文件。

**改造要点：**
- 文档存在性检查：检查 `dist/{lang}/docs/{path}.html` 而非 `docs/{path}/{lang}.md`
- .meta.yaml 检查：保持不变（仍在 docs/{path}/ 目录）
- 内部链接检查：从 HTML 中提取链接并验证
- 图片检查：从 HTML 中提取图片引用并验证
- AFS Image Slot 检查：在 HTML 中不应存在未替换的占位符
- nav.js 检查：验证 nav.js 存在且包含所有文档条目
```

**Reason:** MD 不再持久存在，check 必须适配为检查 HTML 产物。
