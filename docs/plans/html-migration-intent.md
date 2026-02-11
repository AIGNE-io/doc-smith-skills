# DocSmith HTML 文档迁移规格

<!-- critique: 2026-02-10 -->

::: locked {reason="核心架构"}
## 1. 概述

### 产品定位

在 DocSmith 现有 Markdown 生成流程基础上，集成 HTML 构建步骤，将产物发布到 MyVibe 托管，替换当前 Discuss Kit 文档站点。

### 核心思想

- AI 先生成 Markdown（token 消耗低、输出稳定），每篇生成后立即构建为 HTML
- Markdown 仅在单篇文档生成的瞬间存在，生成 → 构建 → 删除，workspace 中始终只有 HTML
- `doc-smith-content` 改造：生成单篇 MD → 调用 build.mjs 构建为 HTML → 删除 MD
- `build.mjs` 改造：支持单篇构建模式（`--doc`）；导航从内联改为外置 nav.js
- 导航外置：侧边栏和语言切换由 nav.js 驱动，更新结构只需重新生成 nav.js，无需重建所有 HTML
- 发布统一使用 `/myvibe-publish`（已支持 `--hub` 参数指定目标站点）
- 项目级发布配置：doc-smith-create 生成时写入 `publish.yaml`，`/myvibe-publish` 自动读取目标

### 优先级

高 — 替换 Discuss Kit 文档站点的关键路径

### 目标用户

使用 DocSmith 生成技术文档的开发者

### 项目范围

- **改造** `doc-smith-content` agent：生成单篇 MD → 调用 build.mjs --doc 构建 HTML → 删除 MD
- **改造** `build.mjs`：支持 `--doc` 单篇构建 + `--nav` 导航生成（nav.js）两种模式
- **改造** `doc-smith-create`：结构确定后生成 nav.js，文档构建由 doc-smith-content 各自完成
- **改造** `doc-smith-check`：内容检查从校验 MD 改为校验 HTML
- **改造** `doc-smith-images` skill：AIGNE CLI 不再维护，改为直接调用 AIGNE Hub API，自行处理授权
- **改造** `generate-slot-image` agent：适配新的生图接口，更新错误处理
- **改造** `doc-smith-localize` skill：翻译源从 MD 改为 HTML，翻译结果直接输出 HTML，不经过 MD 中间步骤
- **改造** `translate-document` agent：读取源 HTML 正文，直接翻译为目标语言 HTML 并保存，无需 MD 中间产物
- **不改造** MyVibe：`/myvibe-publish` 已支持静态 HTML 发布和 `--hub` 参数
- **不改造** `doc-smith-publish`：统一使用 `/myvibe-publish`
- **不改造** 站点导航代码：Blocklet 后台配置导航入口

### 不包含（延后）

- 全文搜索（pagefind / lunr.js）
- 可选注入点（head.html + body-end.html）
- 站点集成（导航入口、搜索、版本管理）和旧文档下线

### 不包含（不做）

- 主题继承/扩展系统
- schema 校验
- 模板系统
- 评论系统
- PDF 导出
- 自建版本管理

:::

::: reviewed {by=lban date=2026-02-10}
## 2. 架构

### 整体流程

```
doc-smith-create（编排）→ build.mjs --nav → 并行 doc-smith-content
doc-smith-content（per-doc）→ 生成 MD → build.mjs --doc → HTML → 删除 MD
输出 → dist/{lang}/docs/*.html + assets/nav.js → /myvibe-publish 发布
```

### HTML 结构契约（适配 nav.js）

```html
<!DOCTYPE html>
<html lang="{{lang}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} - {{siteName}}</title>
  <meta name="description" content="{{description}}">
  <link rel="stylesheet" href="{{assetPath}}/docsmith.css">
  <link rel="stylesheet" href="{{assetPath}}/theme.css">
</head>
<body>
  <header data-ds="header">{{header}}</header>
  <div data-ds="layout">
    <aside data-ds="sidebar"><!-- nav.js 渲染 --></aside>
    <main data-ds="content">{{content}}</main>
    <nav data-ds="toc">{{toc}}</nav>
  </div>
  <footer data-ds="footer">{{footer}}</footer>
  <script src="{{assetPath}}/nav.js"></script>
  <script>/* 内联：从 nav.js 数据渲染侧边栏和语言切换 */</script>
</body>
</html>
```

:::

::: reviewed {by=lban date=2026-02-10}
## 3. 详细行为

### 3.1 doc-smith-content agent（改造）

每篇文档生成后立即构建为 HTML。MD 仅在生成瞬间存在，构建完成后立即删除。

**改造要点：**
- AI 先生成 Markdown（token 消耗低、输出稳定）
- 生成后立即调用 `build.mjs --doc` 构建为 HTML，然后删除 MD
- MD 仅在 doc-smith-content 执行期间瞬间存在，不会出现在 workspace 中
- AFS Image Slot 占位符：保持 `<!-- afs:image ... -->` 格式（在 MD 中标记，构建时处理）
- 更新已有文档时：检查 .meta.yaml 是否有 translations 记录，如有则在摘要中提示翻译可能需要更新

### 3.2 build.mjs（改造）

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

### 3.3 doc-smith-create 改造

**约束：**
- 构建不再是独立步骤：doc-smith-content 每生成一篇文档即自动构建为 HTML
- doc-smith-create 在开始生成文档前，调用 `build.mjs --nav` 生成 nav.js 和静态资源
- 文档结构变更后（新增/删除文档），需要重新调用 `build.mjs --nav` 更新 nav.js
- 如果 theme.css 不存在，询问用户是否需要自定义主题（在首次 --nav 之前）
- 结束时报告构建结果（dist/ 路径、各语言页面数量）
- 在 workspace 中写入 `publish.yaml`（含目标站点地址）

### 3.4 doc-smith-check 改造

内容检查从校验 MD 文件改为校验 HTML 文件。

**改造要点：**
- 文档存在性检查：检查 `dist/{lang}/docs/{path}.html` 而非 `docs/{path}/{lang}.md`
- .meta.yaml 检查：保持不变（仍在 docs/{path}/ 目录）
- 内部链接检查：从 HTML 中提取链接并验证
- 图片检查：从 HTML 中提取图片引用并验证
- AFS Image Slot 检查：在 HTML 中不应存在未替换的占位符
- nav.js 检查：验证 nav.js 存在且包含所有文档条目

### 3.5 图片生成（改造）

AIGNE CLI 不再维护，生图能力需要从 AIGNE CLI 迁移到直接调用 AIGNE Hub API。

**当前流程（依赖 AIGNE CLI）：**
```
generate-slot-image agent → /doc-smith-images skill → aigne run ... → AIGNE CLI → Gemini API
```

**改造后流程（直接调 AIGNE Hub）：**
```
generate-slot-image agent → /doc-smith-images skill → 直接 HTTP 调用 AIGNE Hub API → Gemini API
```

**改造要点：**
- `doc-smith-images` skill：去掉 `aigne run` 命令，改为直接调用 AIGNE Hub HTTP API
- `scripts/aigne-generate/` 目录：AIGNE YAML agent 定义（`generate-image.yaml`、`generate-and-save.yaml`、`edit-and-save.yaml`）替换为直接 HTTP 调用脚本
- 授权：自行处理 AIGNE Hub 授权（不再依赖 `aigne hub connect`）
- `generate-slot-image` agent：接口不变（仍然调用 `/doc-smith-images`），但需要更新错误处理和依赖说明
- 保留能力：新图生成（text-to-image）、已有图片编辑（image-to-image）、图片翻译

**不变的部分：**
- AFS Image Slot 占位符格式（`<!-- afs:image ... -->`）
- `generate-slot-image` agent 的调用接口和参数
- 图片保存目录结构（`.aigne/doc-smith/assets/{key}/images/`）
- `.meta.yaml` 元信息格式

### 3.6 发布（统一 `/myvibe-publish`）

统一使用 `/myvibe-publish`，doc-smith-create 在 workspace 写入 `publish.yaml` 指定目标站点：

```yaml
# .aigne/doc-smith/publish.yaml
hub: https://docs.example.com  # 目标站点地址
```

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

**文档更新时的翻译同步：**
- 源文档更新后，已有翻译通过 sourceHash 不匹配检测为过期（§3.1 已补充提示逻辑）
- 不自动触发翻译，由用户手动调用 `/doc-smith-localize` 重新翻译

:::

:::

::: reviewed {by=lban date=2026-02-10}
## 5. 风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| AI 生成的 Markdown 质量波动 | 高 | 文档内容不理想 | 首轮不追求完美，MyVibe 版本回退 |
| 主站与文档站风格不一致 | 中 | 体验割裂 | theme.css 可随时让 AI 调整 |
| build.mjs 构建失败 | 低 | 无法输出 HTML | 已验证可用，构建步骤是确定性的 |
| AIGNE Hub API 调用失败 | 中 | 图片无法生成 | 授权流程需要验证，失败时保留占位符不阻塞文档发布 |
| AI 翻译 HTML 时破坏标签结构 | 低 | 页面渲染异常 | 翻译时只提取可翻译文本，保持 HTML 标签不动；翻译后做 HTML 合法性校验 |
| 源文档更新后翻译过期 | 高 | 用户看到不同语言内容不一致 | doc-smith-content 更新后检查 .meta.yaml，提示用户重新翻译 |

**回滚方案**：
1. MyVibe 版本回退 → 恢复上一个正常版本
2. Blocklet 后台改导航 → 入口改回 Discuss Kit
3. 两步操作，不需要改代码

:::

