# DocSmith → 静态 HTML 文档迁移工程文档

> 从 Discuss Kit 迁移到 DocSmith 生成静态 HTML + MyVibe 托管

状态: draft
日期: 2026-02-09

## 目标

在 DocSmith 现有流程基础上，集成 HTML 构建步骤，发布到 MyVibe 或 DocSmith 站点，替换当前 Discuss Kit 文档站点。

首轮目标：流程可跑通、可发布、可接入、可回滚。不追求最终样式与文案质量。

## 现状锚定

### 已有的（复用 + 适配）

| 组件 | 路径 | 状态 |
|------|------|------|
| doc-smith-create | `skills/doc-smith-create/SKILL.md` | stable，生成 Markdown |
| doc-smith-content agent | `agents/doc-smith-content.md` | stable，为单篇文档生成 MD 内容 |
| doc-smith-build | `skills/doc-smith-build/` | 已实现 MD→HTML（build.mjs 874 行） |
| docsmith.css | `skills/doc-smith-build/assets/docsmith.css` | 已实现，含布局/排版/暗色模式 |
| HTML 骨架契约 | `data-ds` 属性锚点 | 已定义（header/layout/sidebar/content/toc/footer） |
| MyVibe 发布 Skill | `/myvibe-publish` | 可用，支持静态 HTML 目录发布 |
| MyVibe 版本管理 | MyVibe 平台功能 | 可用，支持多版本和版本回退 |

### 需要做的

| 任务 | 涉及文件 | 说明 |
|------|---------|------|
| doc-smith-content 改造 | `agents/doc-smith-content.md` | 先生成 MD（中间产物），再转换为 HTML，只保留 HTML |
| build.mjs 适配 | `skills/doc-smith-build/scripts/build.mjs` | 适配新流程，构建后清理中间 .md 文件 |
| doc-smith-create 增加构建步骤 | `skills/doc-smith-create/SKILL.md` | 集成构建步骤，支持发布到 MyVibe 或 DocSmith 站点 |
| doc-smith-publish 改造 | `skills/doc-smith-publish/` | 支持发布到 DocSmith 站点（精简版 MyVibe） |
| MyVibe 精简改造 | MyVibe 项目 | 抽取静态托管能力，去掉前端页面，支持 Skill 发布 |
| doc-smith-images 去掉 AIGNE CLI | `skills/doc-smith-images/` | AIGNE CLI 不再维护，改为直接调用 AIGNE Hub API，自行处理授权 |
| generate-slot-image 适配 | `agents/generate-slot-image.md` | 适配新的生图接口，更新错误处理 |
| 实现简单前端搜索 | 构建期生成索引 | 先简单版本 |
| 对齐主站主题 | `theme.css` | AI 根据主站风格生成 |

### 不需要做的

| 事项 | 原因 |
|------|------|
| 改造 doc-smith-publish | MyVibe 提供了 `/myvibe-publish` Skill |
| 改导航代码 | Blocklet 后台可配置导航入口指向新地址 |
| 实现版本管理 | Git 管理 + MyVibe 提供多版本和回退功能 |

## 关键设计决策

### 1. AI 先生成 Markdown，再转换为 HTML

**结论**：doc-smith-content agent 改造为先生成 Markdown（中间产物），再转换为 HTML。最终只保留 HTML，不同时管理 MD 和 HTML。

**理由**：
- Markdown 作为 AI 输出的中间格式，token 消耗更低、输出更稳定
- build.mjs 已实现完整的 MD→HTML 转换逻辑，核心能力复用
- 只保留 HTML 避免双格式管理的复杂度
- Markdown 只在生成过程中临时存在

### 2. 集成构建步骤到 doc-smith-create

**结论**：在 doc-smith-create 工作流末尾新增 Phase 8，调用 build.mjs 构建 HTML。

**流程**：
```
doc-smith-create → AI 生成 MD（中间产物）→ build.mjs 构建 HTML + 清理 MD → dist/（只有 HTML）
                                                      ↓
                                            /myvibe-publish → MyVibe
```

### 3. 托管：MyVibe 或 DocSmith 站点

**结论**：支持两种发布目标，都通过 Skill 发布。

- **MyVibe**：文档作为 MyVibe 内容类型，使用 `/myvibe-publish` 发布
- **DocSmith 站点**：精简版 MyVibe，复用静态托管能力，去掉前端页面，使用 `/doc-smith-publish` 发布

**MyVibe 精简改造**：
- 抽取静态资源托管为独立能力（API 层）
- 支持通过 Skill/API 直接发布静态 HTML 目录
- 保留版本管理和回退能力
- DocSmith 站点 = 无 UI 的 MyVibe 实例

### 4. URL 结构

纯静态文件路径，不依赖服务端路由。

```
/zh/docs/overview.html
/zh/docs/guide/intro.html
/en/docs/overview.html
```

### 5. 站点集成

| 方面 | 方案 | 操作方式 |
|------|------|---------|
| 导航入口 | 现有站点导航指向文档站点地址 | Blocklet 后台配置，不改代码 |
| 主题一致 | `theme.css` 与主站设计 token 对齐 | AI 根据主站风格生成/修改 theme.css |
| 搜索 | 前端搜索，构建期生成索引 | 首轮简单版本 |
| 版本 | Git + 托管平台 | 不自己实现 |

### 6. 旧文档处理

渐进迁移：切换导航入口 → Discuss Kit 暂时保留 → 稳定后下线

## 执行计划

### Phase 0：验证前置条件 ✅ 已完成

- [x] 确认 `/myvibe-publish` 可正常发布 HTML 目录到 MyVibe
- [x] 确认 MyVibe 上文档可通过预期 URL 访问
- [x] 确认 Blocklet 后台可配置导航入口指向 MyVibe 地址
- [x] 确认 `build.mjs` MD→HTML 构建可用

### Phase 1：改造三个组件

**doc-smith-content agent（改造）**：
- [ ] 明确 Markdown 为中间产物，生成后由 build.mjs 转换为 HTML
- [ ] 适配更新流程：后续更新时能读取已有 HTML 内容

**build.mjs（适配）**：
- [ ] 构建完成后清理 docs/ 中的中间 .md 文件
- [ ] 确保最终 workspace 只保留 HTML 产物

**doc-smith-create（改造）**：
- [ ] 新增 Phase 8（构建 HTML）：在 MD 和图片生成完毕后，调用 build.mjs
- [ ] 改造 Phase 9（结束提示）：报告构建结果，提示使用 `/myvibe-publish` 或 `/doc-smith-publish` 发布
- [ ] 更新相关技能表：新增 doc-smith-build，保留 /myvibe-publish，改造 doc-smith-publish
- [ ] 更新任务规划模板：增加 Phase 8

**doc-smith-publish（改造）**：
- [ ] 支持发布到 DocSmith 站点（精简版 MyVibe）

**MyVibe（精简改造）**：
- [ ] 抽取静态资源托管为独立能力
- [ ] 支持通过 Skill/API 发布静态 HTML 目录（无 UI）
- [ ] 保留版本管理和回退能力

**doc-smith-images（改造）**：
- [ ] 去掉 `aigne run` 命令调用，改为直接调用 AIGNE Hub HTTP API
- [ ] 替换 `scripts/aigne-generate/` 中的 AIGNE YAML agent 定义为直接 HTTP 调用脚本
- [ ] 自行处理 AIGNE Hub 授权（不再依赖 `aigne hub connect`）

**generate-slot-image（适配）**：
- [ ] 更新错误处理和依赖说明（去掉 AIGNE CLI 相关提示）

### Phase 2：端到端验证

- [ ] 用 `doc-smith-create` 在一个真实项目上生成 Markdown + 构建 HTML
- [ ] 用 `/myvibe-publish` 发布到 MyVibe
- [ ] 在浏览器中访问，验证页面渲染、导航、多语言切换
- [ ] 在 Blocklet 后台配置导航入口，验证跳转
- [ ] 让 AI 修改 `theme.css` 对齐主站风格，验证主题一致性

### Phase 3：搜索 + 收尾

- [ ] 实现简单前端搜索（标题级别）
- [ ] 确认 MyVibe 版本回退功能可用
- [ ] 旧 Discuss Kit 文档入口切换

## 风险与回滚

| 风险 | 概率 | 应对 |
|------|------|------|
| AI 生成的 Markdown 质量波动 | 高 | 首轮不追求完美，MyVibe 版本回退 |
| 主站与文档站风格不一致 | 中 | theme.css 可随时让 AI 调整，不阻塞发布 |
| build.mjs 构建失败 | 低 | 已验证可用，构建步骤是确定性的 |

**回滚方案**：
- MyVibe 版本回退：恢复到上一个已知正常版本
- 导航回退：Blocklet 后台将入口改回 Discuss Kit
- 两步操作即可完成回滚，不需要改代码

## 验收标准

| 标准 | 验证方式 |
|------|---------|
| ✅ doc-smith-create 能生成 HTML | 在真实项目上运行，输出 dist/ 目录 |
| ✅ HTML 能发布到 MyVibe | `/myvibe-publish` 成功，返回访问 URL |
| ✅ 现有站点能接入访问 | Blocklet 后台配置导航后可正常跳转 |
| ✅ 出问题可回滚 | 演练一次：发布新版本 → 回退 → 确认旧版本恢复 |
| ❌ 不追求最终样式与文案质量 | 首轮通过即可 |

## 一句话总结

AI 先生成 Markdown（中间产物，token 低、输出稳定）→ build.mjs 构建 HTML + 清理 MD（核心逻辑复用）→ 发布到 MyVibe 或 DocSmith 站点 → Blocklet 后台配置导航入口 → 托管平台提供版本回退。需要改造的组件：doc-smith-content（MD→HTML 转换流程）、build.mjs（适配 + 清理 MD）、doc-smith-create（集成构建步骤 + 发布指引）、doc-smith-images（去掉 AIGNE CLI，直接调 AIGNE Hub）、MyVibe（精简为纯静态托管）、doc-smith-publish（支持 DocSmith 站点）。
