# 重构实施计划

## 当前状态分析

### 现有项目结构

```
doc-smith-skill/
├── aigne.yaml                 # AIGNE 入口配置
├── agents/                    # AIGNE Agents
│   ├── clear/                 # 清除配置
│   ├── content-checker/       # 内容检查
│   ├── generate-images/       # 图片生成
│   ├── localize/              # 翻译
│   ├── publish/               # 发布
│   ├── structure-checker/     # 结构检查
│   └── update-image/          # 图片更新
├── skills-entry/              # AIGNE 入口（将废弃）
│   ├── doc-smith/
│   └── doc-smith-docs-detail/
├── skills/                    # 已有 Skills（需迁移）
│   ├── doc-smith/
│   └── doc-smith-docs-detail/
└── utils/                     # 共享工具
```

### 现有功能清单

| 功能 | 当前入口 | 复杂度 | 重构方式 |
|------|---------|--------|---------|
| 文档生成 | `aigne run . doc-smith` | 高 | 保留 AIGNE |
| 文档详情生成 | `generateDocumentDetails` tool | 高 | 合并到 doc-smith |
| 翻译 | `aigne run . localize` | 高 | 保留 AIGNE |
| 图片生成 | `generateImages` tool | 高 | 保留 AIGNE |
| 图片更新 | `updateImage` tool | 中 | 保留 AIGNE |
| 发布 | `aigne run . publish` | 中 | 保留 AIGNE |
| 结构检查 | `checkStructure` tool | 低 | 可纯 JS |
| 内容检查 | `checkContent` tool | 低 | 可纯 JS |
| 清除配置 | `aigne run . clear` | 低 | 纯 JS |

## 目标结构

```
doc-smith-skill/
├── .claude-plugin/                # Claude Code Plugin 配置
│   └── marketplace.json           # Plugin 元信息
├── skills/                        # Claude Code Skills
│   ├── doc-smith/                 # 主文档生成
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── workspace-initialization.md
│   │       ├── user-intent-guide.md
│   │       ├── structure-planning-guide.md
│   │       ├── document-structure-schema.md
│   │       ├── structure-confirmation-guide.md
│   │       ├── document-content-guide.md
│   │       ├── update-workflow.md
│   │       ├── changeset-guide.md
│   │       └── patch-guide.md
│   ├── doc-smith-translate/       # 翻译
│   │   └── SKILL.md
│   ├── doc-smith-images/          # 图片生成
│   │   └── SKILL.md
│   ├── doc-smith-publish/         # 发布
│   │   └── SKILL.md
│   ├── doc-smith-check/           # 检查
│   │   └── SKILL.md
│   └── doc-smith-clear/           # 清除
│       └── SKILL.md
├── agents/                        # AIGNE Agents（保留）
├── utils/                         # 共享工具（保留）
├── aigne.yaml                     # AIGNE 配置（简化）
├── CLAUDE.md                      # 项目说明（更新）
└── package.json
```

### .claude-plugin/marketplace.json 配置

```json
{
  "name": "doc-smith-skills",
  "owner": {
    "name": "ArcBlock",
    "email": "contact@arcblock.io"
  },
  "version": "1.0.0",
  "description": "文档生成和管理技能集",
  "plugins": [
    {
      "name": "doc-smith-skills",
      "description": "文档生成、翻译、图片和发布",
      "strict": false,
      "skills": [
        "doc-smith",
        "doc-smith-translate",
        "doc-smith-images",
        "doc-smith-publish",
        "doc-smith-check",
        "doc-smith-clear"
      ],
      "source": "."
    }
  ]
}
```

## 实施步骤

### 阶段 1：准备工作

#### 1.1 备份现有结构
```bash
# 创建备份分支
git checkout -b backup/pre-refactor
git push origin backup/pre-refactor
git checkout feat-to-agent-skills
```

#### 1.2 创建 .claude-plugin 目录
```bash
mkdir -p .claude-plugin
```

创建 `.claude-plugin/marketplace.json` 文件（内容见上文）。

#### 1.3 整理 skills 目录
- 移除 `skills-entry/` 目录（内容迁移到 skills）
- 移动 `skills-entry/doc-smith/references/` 到 `skills/doc-smith/references/`
- 移动 `skills-entry/doc-smith/prompt.md` 内容到 `skills/doc-smith/SKILL.md`

#### 1.3 简化 aigne.yaml
保留 agents 定义，移除 CLI 入口配置：

```yaml
#!/usr/bin/env aigne

model: anthropic/claude-sonnet-4-5
image_model:
  model: google/gemini-3-pro-image-preview

agents:
  - agents/publish/index.yaml
  - agents/localize/index.yaml
  - agents/generate-images/index.yaml
  - agents/update-image/index.yaml
  - agents/structure-checker/index.mjs
  - agents/content-checker/index.mjs
  - agents/clear/index.yaml
  - skills-entry/doc-smith-docs-detail/batch.yaml

# 移除 cli 部分
```

### 阶段 2：创建 Skills

#### 2.1 doc-smith（主入口）

**文件**: `skills/doc-smith/SKILL.md`

**核心内容**:
- 从 `skills-entry/doc-smith/prompt.md` 迁移提示词
- 添加 AIGNE 执行方式说明
- 整合 references 目录

**执行方式**:
```bash
# 进入 workspace 所在目录
cd <project-root>
# 执行文档生成
aigne run <path-to-doc-smith-skill> doc-smith --interactive
```

#### 2.2 doc-smith-translate

**文件**: `skills/doc-smith-translate/SKILL.md`

**Frontmatter**:
```yaml
---
name: doc-smith-translate
description: "翻译 DocSmith 生成的文档到多种语言。支持批量翻译、指定文档范围、强制重新翻译。"
---
```

**执行方式**:
```bash
aigne run <path-to-doc-smith-skill> localize --langs '["en", "ja"]'
aigne run <path-to-doc-smith-skill> localize --docs '["/overview"]' --langs '["en"]'
```

#### 2.3 doc-smith-images

**文件**: `skills/doc-smith-images/SKILL.md`

**Frontmatter**:
```yaml
---
name: doc-smith-images
description: "为文档中的 AFS Image Slot 生成 AI 图片。支持扫描所有文档或指定文档，支持强制重新生成。"
---
```

**执行方式**:
```bash
aigne run <path-to-doc-smith-skill> generateImages
aigne run <path-to-doc-smith-skill> generateImages --docs '["/api/auth"]' --force
```

#### 2.4 doc-smith-publish

**文件**: `skills/doc-smith-publish/SKILL.md`

**Frontmatter**:
```yaml
---
name: doc-smith-publish
description: "将 DocSmith 生成的文档发布到在线平台。自动检查发布条件、翻译 meta 信息、上传文档。"
---
```

**执行方式**:
```bash
aigne run <path-to-doc-smith-skill> publish
aigne run <path-to-doc-smith-skill> publish --appUrl "https://example.com"
```

#### 2.5 doc-smith-check

**文件**: `skills/doc-smith-check/SKILL.md`

**实现方式**: 纯指令 Skill，引导 Claude Code 使用现有工具

**核心内容**:
- 结构检查：执行 `aigne run . structure-checker`
- 内容检查：执行 `aigne run . content-checker`
- 或直接使用 Node.js 脚本

#### 2.6 doc-smith-clear

**文件**: `skills/doc-smith-clear/SKILL.md`

**实现方式**: 纯指令 Skill

**核心内容**:
- 交互式选择清除内容
- 执行 `aigne run . clear`

### 阶段 3：迁移现有内容

#### 3.1 迁移 references 目录

```bash
# 如果 skills-entry/doc-smith 有 references，移动到 skills/doc-smith
mv skills-entry/doc-smith/references/* skills/doc-smith/references/
```

#### 3.2 更新 SKILL.md 中的路径引用

确保所有 `references/xxx.md` 引用指向正确位置。

#### 3.3 处理 doc-smith-docs-detail

将 `doc-smith-docs-detail` 功能合并到 `doc-smith` 中，作为内部工具而非独立 Skill。

### 阶段 4：更新配置文件

#### 4.1 更新 CLAUDE.md

移除 AIGNE 框架开发指南部分（不再需要用户了解）。
添加 Skills 使用说明。

#### 4.2 更新 package.json

确保 `aigne` 作为依赖存在：
```json
{
  "dependencies": {
    "@anthropic-ai/aigne": "^1.x.x"
  }
}
```

### 阶段 5：测试验证

#### 5.1 单元测试

测试每个 Skill 的独立功能：
1. `/doc-smith` - 能否正确初始化 workspace 并生成文档
2. `/doc-smith-translate` - 能否正确调用翻译
3. `/doc-smith-images` - 能否正确生成图片
4. `/doc-smith-publish` - 能否正确发布
5. `/doc-smith-check` - 能否正确检查
6. `/doc-smith-clear` - 能否正确清除

#### 5.2 集成测试

测试完整工作流：
1. 新建项目 → 生成文档 → 翻译 → 生成图片 → 发布
2. 更新文档 → 重新翻译 → 更新图片

### 阶段 6：清理

#### 6.1 移除废弃文件

```bash
rm -rf skills-entry/
```

#### 6.2 更新 .gitignore

确保临时文件不被提交。

## 风险评估

### 低风险
- Skills 创建：只是编写 SKILL.md 文件
- 目录整理：简单的文件移动

### 中风险
- AIGNE 调用方式变更：需要确保 `aigne run` 在 Claude Code 环境中正常工作
- 参数传递：JSON 格式的参数传递需要测试

### 高风险
- 功能遗漏：迁移过程中可能遗漏某些功能
- 路径问题：AIGNE 相对路径在不同执行上下文可能出问题

## 回滚计划

如果重构出现问题：
1. 切换到备份分支：`git checkout backup/pre-refactor`
2. 或恢复 skills-entry 目录结构
3. 恢复 aigne.yaml 中的 CLI 配置

## 时间估算

| 阶段 | 预估工作量 |
|------|-----------|
| 阶段 1：准备工作 | 小 |
| 阶段 2：创建 Skills | 中 |
| 阶段 3：迁移内容 | 中 |
| 阶段 4：更新配置 | 小 |
| 阶段 5：测试验证 | 中 |
| 阶段 6：清理 | 小 |

## 后续优化

重构完成后可考虑：
1. 添加更多 Skills（如文档模板生成）
2. 优化 AIGNE 执行性能
3. 添加进度显示
4. 支持更多发布平台
