# DocSmith HTML 文档迁移规格

## 1. 概述

### 产品定位

在 DocSmith 现有 Markdown 生成流程基础上，集成 HTML 构建步骤，将产物发布到 MyVibe，替换当前 Discuss Kit 文档站点。

### 核心思想

- AI 先生成 Markdown（token 消耗低、输出稳定），再转换为 HTML
- Markdown 只是生成过程中的中间产物，不作为最终管理对象
- `doc-smith-content` 改造：生成 MD 后转换为 HTML，只保留 HTML
- `build.mjs` 适配：支持新的转换流程
- 发布目标从 Discuss Kit 切换到 MyVibe

### 优先级

高 — 替换 Discuss Kit 文档站点的关键路径

### 目标用户

使用 DocSmith 生成技术文档的开发者

### 项目范围

- **改造** `doc-smith-content` agent：先生成 Markdown（中间产物），再转换为 HTML，只保留 HTML
- **适配** `build.mjs`：适配新的转换流程，构建后清理中间 .md 文件
- **改造** `doc-smith-create`：集成构建步骤，发布指引改为 MyVibe
- **改造** `doc-smith-images` skill：AIGNE CLI 不再维护，改为直接调用 AIGNE Hub API，自行处理授权
- **改造** `generate-slot-image` agent：适配新的生图接口，更新错误处理
- **不改造** `doc-smith-publish`：使用 `/myvibe-publish` 替代
- **不改造** 站点导航代码：Blocklet 后台配置导航入口

## 2. 架构

### 整体流程

```
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
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  输出: 纯静态 HTML 站点                                          │
│                                                                 │
│  .aigne/doc-smith/dist/                                        │
│  ├── index.html              # 重定向到主语言                    │
│  ├── zh/                                                        │
│  │   ├── index.html          # 语言入口重定向                    │
│  │   └── docs/*.html         # 完整 HTML 页面                   │
│  ├── en/                                                        │
│  │   └── docs/*.html                                           │
│  └── assets/                                                    │
│      ├── docsmith.css        # 内置基础样式（稳定）               │
│      ├── theme.css           # 用户/AI 生成的主题样式             │
│      └── images/             # 文档图片                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  发布到 MyVibe（新增步骤）                                       │
│                                                                 │
│  /myvibe-publish → 发布 dist/ 目录 → 线上可访问                  │
│  MyVibe 提供版本管理和版本回退                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 构建脚本架构（适配）

```
skills/doc-smith-build/
├── SKILL.md                    # Skill 定义
├── scripts/
│   ├── build.mjs               # 构建脚本（874 行，已实现）
│   └── package.json            # 依赖（markdown-it, yaml, glob 等）
└── assets/
    └── docsmith.css            # 内置基础样式
```

### HTML 结构契约（不变）

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
    <aside data-ds="sidebar">{{navigation}}</aside>
    <main data-ds="content">{{content}}</main>
    <nav data-ds="toc">{{toc}}</nav>
  </div>
  <footer data-ds="footer">{{footer}}</footer>
</body>
</html>
```

### 主题机制（不变）

```
.aigne/doc-smith/theme.css    # 唯一的主题文件
```

- 存在 → 自动引入
- 不存在 → 使用内置 docsmith.css 默认样式
- AI 只改这一个文件

## 3. 详细行为

### 3.1 doc-smith-content agent（改造）

先生成 Markdown（中间产物），再转换为 HTML。Markdown 只是 AI 输出的中间格式，最终只保留 HTML。

**改造要点：**
- AI 仍然先生成 Markdown（token 消耗低、输出稳定）
- Markdown 是中间产物，生成后通过 build.mjs 转换为 HTML
- 最终只保留 HTML，不同时管理 MD 和 HTML
- AFS Image Slot 占位符：保持 `<!-- afs:image ... -->` 格式（在 MD 中标记，构建时处理）
- .meta.yaml：保留（记录文档元信息）

### 3.2 build.mjs（适配）

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

### 3.3 doc-smith-create 改造（唯一改动）

在现有工作流程末尾增加两个步骤：

#### 改造后的工作流程

```
用户执行 /doc-smith-create
              ↓
Phase 0-5: 不变（workspace 检测、分析、意图、结构规划）
              ↓
Phase 6: 生成文档内容（不变）
  - 调用 doc-smith-content agent 生成 Markdown
  - 每篇文档输出为 {locale}.md
              ↓
Phase 7: 图片处理（不变）
  - AFS Image Slot 检测和生成
              ↓
Phase 8: 构建 HTML（新增）★
  - 调用 build.mjs 将 Markdown 构建为完整 HTML 页面
  - 命令: node skills/doc-smith-build/scripts/build.mjs \
         --workspace .aigne/doc-smith \
         --output .aigne/doc-smith/dist
  - 如果 theme.css 不存在，询问用户是否需要自定义主题
              ↓
Phase 9: 校验 + 结束（改造）
  - 使用 doc-smith-check 校验
  - 报告构建结果（输出路径、页面数量）
  - 提示用户可用 /myvibe-publish 发布（替换原 doc-smith-publish 提示）★
```

#### 具体改动点

1. **新增 Phase 8（构建 HTML）**：

   在所有 Markdown 内容和图片生成完毕后，执行构建：

   ```
   调用 doc-smith-build 构建 HTML：
   - workspace: .aigne/doc-smith
   - output: .aigne/doc-smith/dist

   如果 .aigne/doc-smith/theme.css 不存在：
     询问用户是否需要自定义主题
     - 是 → 引导描述风格，AI 生成 theme.css，然后构建
     - 否 → 使用默认样式构建
   ```

2. **Phase 9 结束提示改造**：

   ```
   改造前：
     提示用户使用 /doc-smith-publish 发布

   改造后：
     报告构建结果（dist/ 路径、各语言页面数量）
     提示用户：
     - 预览: npx serve .aigne/doc-smith/dist
     - 发布: /myvibe-publish 发布到 MyVibe
   ```

3. **相关技能表更新**：

   ```
   移除: doc-smith-publish 引用
   新增: /myvibe-publish 说明
   新增: doc-smith-build 作为内部调用步骤
   ```

### 3.4 图片生成（改造）

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

### 3.5 站点集成

| 方面 | 方案 | 操作 |
|------|------|------|
| 导航入口 | 指向 MyVibe 文档地址 | Blocklet 后台配置，不改代码 |
| 主题一致 | theme.css 对齐主站 | AI 根据主站风格生成/修改 |
| 搜索 | 前端搜索 | 首轮简单版本（标题匹配），后续迭代 |
| 版本 | Git + MyVibe | MyVibe 提供多版本和回退 |

### 3.5 旧文档处理

- 切换导航入口到 MyVibe 文档
- Discuss Kit 文档暂时保留
- 新文档稳定后再下线旧文档

## 4. 用户体验

### 4.1 完整工作流（改造后）

```bash
# Step 1: 生成文档（改造后自动包含 HTML 构建）
/doc-smith-create
# → 分析数据源 → 规划结构 → 生成 Markdown → 构建 HTML
# → AI: "需要自定义主题吗？"
# → 用户: "用 Stripe 文档风格"
# → AI: 生成 theme.css → 构建完成
# → 输出: .aigne/doc-smith/dist/

# Step 2: 预览
npx serve .aigne/doc-smith/dist

# Step 3: 发布到 MyVibe
/myvibe-publish
# → 发布 dist/ 目录到 MyVibe
# → 返回访问 URL

# Step 4: 配置导航（手动，一次性）
# → Blocklet 后台配置导航入口指向 MyVibe 文档地址
```

### 4.2 主题迭代（不变）

```
用户: 侧边栏太窄了，代码块背景深一点
AI: 调整 theme.css → 重新构建 → 刷新预览

用户: 主题改坏了，恢复默认
AI: 删除 theme.css → 重新构建
```

### 4.3 文档更新

```
用户: 更新 /api/auth 文档
AI: → 重新生成 Markdown → 重新构建 HTML → 提示发布
```

## 5. 技术实现指南

### 5.1 改动范围

| 组件 | 改动类型 | 说明 |
|------|---------|------|
| `skills/doc-smith-create/SKILL.md` | **改造** | 增加构建步骤 + 发布指引改为 MyVibe |
| `agents/doc-smith-content.md` | **改造** | 先生成 MD（中间产物），再转换为 HTML |
| `skills/doc-smith-build/scripts/build.mjs` | **适配** | 适配新流程，构建后清理中间 .md 文件 |
| `skills/doc-smith-build/assets/docsmith.css` | **不变** | 直接复用 |
| `skills/doc-smith-build/SKILL.md` | **不变** | 作为 create 流程的构建步骤调用 |
| `skills/doc-smith-images/SKILL.md` | **改造** | 去掉 AIGNE CLI，直接调用 AIGNE Hub API |
| `skills/doc-smith-images/scripts/aigne-generate/` | **替换** | AIGNE YAML 定义替换为直接 HTTP 调用 |
| `agents/generate-slot-image.md` | **适配** | 适配新的生图接口，更新错误处理和依赖说明 |
| `doc-smith-publish` | **不改动** | 用 `/myvibe-publish` 替代 |

### 5.2 Workspace 结构变化

```
.aigne/doc-smith/
├── config.yaml                     # 不变
├── intent/
│   └── user-intent.md              # 不变
├── planning/
│   └── document-structure.yaml     # 不变
├── docs/                           # 最终只保留 HTML（MD 是中间产物，构建后清理）
│   ├── overview/
│   │   ├── .meta.yaml
│   │   └── zh.md                  # ← 生成时临时存在，构建后清理
│   └── api/
│       └── authentication/
│           ├── .meta.yaml
│           └── zh.md              # ← 同上
├── theme.css                       # 不变：主题样式（可选）
├── dist/                           # 构建输出（由 build.mjs 生成）
│   ├── index.html
│   ├── zh/docs/*.html
│   ├── en/docs/*.html
│   └── assets/
│       ├── docsmith.css
│       ├── theme.css
│       └── images/
├── assets/                         # 不变：图片资源
└── cache/
    └── task_plan.md                # 不变
```

### 5.3 doc-smith-create 改造清单

需要修改 `skills/doc-smith-create/SKILL.md`：

1. **新增 Phase 8（构建 HTML）**：
   - 在 Phase 7（图片处理）之后、Phase 9（结束确认）之前
   - 检查 theme.css 是否存在，不存在则询问用户
   - 调用 build.mjs 执行构建
   - 报告构建结果

2. **Phase 9 结束提示改造**：
   - 报告 dist/ 输出路径和各语言页面数量
   - 提示使用 `npx serve` 预览
   - 提示使用 `/myvibe-publish` 发布
   - 移除 `doc-smith-publish` 相关引用

3. **相关技能表更新**：
   - 新增 `doc-smith-build`（内部调用）
   - 新增 `/myvibe-publish`（用户按需调用）
   - 移除 `doc-smith-publish`

4. **任务规划模板更新**：
   - 新文档生成模板中增加 Phase 8: Build HTML

## 6. 决策总结

| 决策 | 选择 | 理由 |
|------|------|------|
| AI 中间输出 | Markdown（中间产物） | token 消耗低、输出稳定，生成后转换为 HTML |
| MD→HTML 转换 | build.mjs（适配） | 核心逻辑复用，适配新流程 |
| HTML 锚点 | `data-ds` 属性（不变） | 稳定契约 |
| 主题机制 | 单文件 theme.css（不变） | AI 直接改 |
| 托管平台 | MyVibe | 文档作为 MyVibe 内容类型 |
| 发布方式 | `/myvibe-publish` | 现成可用 |
| 导航集成 | Blocklet 后台配置 | 不改代码 |
| 版本管理 | Git + MyVibe | 不自己实现 |
| 图片处理 | AFS Image Slot（流程不变） | 占位符格式不变，底层从 AIGNE CLI 改为直接调 AIGNE Hub |

## 7. MVP 范围

### 包含

- [ ] doc-smith-create 增加 HTML 构建步骤（调用 build.mjs）
- [ ] doc-smith-create 发布指引改为 /myvibe-publish
- [ ] 简单前端搜索（标题级别）

### 不包含（延后）

- [ ] 全文搜索（pagefind / lunr.js）
- [ ] 可选注入点（head.html + body-end.html）
- [ ] --preview 本地预览服务器

### 不包含（不做）

- [ ] 主题继承/扩展系统
- [ ] schema 校验
- [ ] 模板系统
- [ ] 评论系统
- [ ] PDF 导出
- [ ] 自建版本管理

## 8. 风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| AI 生成的 Markdown 质量波动 | 高 | 文档内容不理想 | 首轮不追求完美，MyVibe 版本回退 |
| 主站与文档站风格不一致 | 中 | 体验割裂 | theme.css 可随时让 AI 调整 |
| build.mjs 构建失败 | 低 | 无法输出 HTML | 已验证可用，构建步骤是确定性的 |
| AIGNE Hub API 调用失败 | 中 | 图片无法生成 | 授权流程需要验证，失败时保留占位符不阻塞文档发布 |

**回滚方案**：
1. MyVibe 版本回退 → 恢复上一个正常版本
2. Blocklet 后台改导航 → 入口改回 Discuss Kit
3. 两步操作，不需要改代码

## 9. 前置条件（已验证）

- [x] `/myvibe-publish` 可正常发布 HTML 目录到 MyVibe
- [x] MyVibe 上文档可通过预期 URL 访问
- [x] Blocklet 后台可配置导航入口指向 MyVibe 地址
- [x] `build.mjs` MD→HTML 构建流程可用（已实现 + 已测试）
