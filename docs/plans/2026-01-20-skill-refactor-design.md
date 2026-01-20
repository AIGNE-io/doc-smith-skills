# Doc-Smith Skill 拆分设计

## 概述

将 doc-smith-skill 项目重构为 Claude Code Plugin 结构，拆分为 7 个独立的 Skill，提供文档生成、翻译、图片生成、发布等功能。

## Skill 拆分方案

### 1. Skills 列表（7 个）

| Skill | 职责 | 用户独立调用 | 特殊说明 |
|-------|------|-------------|---------|
| `doc-smith` | 主入口，完整文档生成流程 | ✓ | 协调其他 Skill |
| `doc-smith-content` | 生成/重新生成文档内容 | ✓ | 上下文隔离；独立调用时检查文档是否存在 |
| `doc-smith-translate` | 翻译文档 | ✓ | 通用翻译能力 |
| `doc-smith-images` | 生成/更新图片 | ✓ | 通用生图能力，内部通过 bash 调用 AIGNE |
| `doc-smith-publish` | 发布文档 | ✓ | |
| `doc-smith-clear` | 清除配置 | ✓ | |
| `doc-smith-check` | 结构校验、内容检查 | ✓ | 封装检查工具供其他 Skill 调用 |

### 2. 各 Skill 详细设计

#### doc-smith（主入口）

**触发场景：**
- 用户要求为项目生成文档
- 首次创建文档
- 规划或调整文档结构
- 完整的文档生成流程

**职责边界：**
- Workspace 检测和初始化
- 数据源分析
- 用户意图推断
- 文档结构规划和生成
- 协调调用 `doc-smith-content` 生成内容
- 协调调用 `doc-smith-images` 生成图片
- 调用 `doc-smith-check` 进行校验
- 自动提交 Git

**不负责：**
- 翻译（由 `doc-smith-translate` 处理）
- 发布（由 `doc-smith-publish` 处理）

#### doc-smith-content（文档内容生成）

**触发场景：**
- 主流程中需要生成文档详细内容
- 用户独立要求重新生成某篇文档（如"重新生成 /overview"）

**职责边界：**
- 根据文档结构生成具体内容
- 上下文隔离，避免占用主对话上下文
- 独立调用时：检查文档是否已存在于 `document-structure.yaml`，若不存在则提醒用户先生成

#### doc-smith-translate（翻译）

**触发场景：**
- 用户要求翻译文档到其他语言
- 批量翻译多篇文档
- 优化某篇文档的翻译质量

**职责边界：**
- 翻译指定文档或全部文档
- 支持指定目标语言
- 读取术语表确保术语一致性
- 独立调用时：检查 workspace 和文档是否存在

#### doc-smith-images（图片生成/更新）

**触发场景：**
- 文档中有 AFS Image Slot 需要生成图片
- 用户要求更新某张图片
- 用户要求为其他内容生成图片（通用能力）

**职责边界：**
- 接收 prompt、尺寸、比例等参数
- 通过 bash 调用 AIGNE 执行生图
- 返回生成的图片路径
- 通用能力，可用于任意场景的图片生成

**不负责：**
- 扫描文档中的 image slot（由主流程 LLM 处理）

#### doc-smith-publish（发布）

**触发场景：**
- 用户要求发布文档到平台
- 用户说"发布"、"上线"、"部署文档"

**职责边界：**
- 检查发布条件（文档完整性等）
- 翻译 meta 信息
- 上传文档到平台
- 独立调用时：检查 workspace 是否存在

#### doc-smith-clear（清除配置）

**触发场景：**
- 用户要求清除授权 token
- 用户要求清除部署配置
- 用户说"清除配置"、"重置"

**职责边界：**
- 交互式选择清除内容
- 清除授权 tokens
- 清除部署配置

#### doc-smith-check（检查工具）

**触发场景：**
- 主流程中需要校验文档结构
- 主流程中需要检查文档内容完整性
- 用户独立要求检查文档状态

**职责边界：**
- 封装 `checkStructure` 工具：校验 `document-structure.yaml` 格式
- 封装 `checkContent` 工具：检查文档完整性、链接、图片路径
- 提供给其他 Skill 调用

## 设计原则

### 模型作为编排者
- Skill 描述触发场景和职责
- 模型根据用户需求自动选择调用哪个 Skill
- 不需要在 Skill 内部编排调用其他 Skill

### 通过描述引用
- Skill 之间通过 SKILL.md 中的描述引导模型调用其他 Skill
- 例如：`doc-smith` 中描述"生成结构后，调用 `doc-smith-check` 进行校验"

### 胶水代码由 LLM 处理
- 减少脚本依赖
- 简单逻辑让 LLM 直接执行
- 例如：扫描 image slot 由 LLM 在主流程中处理

### 必要脚本内置
- 只有 LLM 无法完成的功能才使用脚本
- 脚本放在各自 Skill 的 scripts 目录中
- 例如：AIGNE 生图（Claude Code 不支持生图）

## 目录结构

```
doc-smith-skill/
├── .claude-plugin/              # Claude Code Plugin 配置
│
├── skills/                      # Skills 目录（7 个）
│   ├── doc-smith/               # 主入口
│   │   ├── SKILL.md
│   │   └── references/
│   │
│   ├── doc-smith-content/       # 文档内容生成
│   │   └── SKILL.md
│   │
│   ├── doc-smith-translate/     # 翻译
│   │   └── SKILL.md
│   │
│   ├── doc-smith-images/        # 图片生成
│   │   ├── SKILL.md
│   │   └── scripts/             # AIGNE 生图
│   │
│   ├── doc-smith-publish/       # 发布
│   │   ├── SKILL.md
│   │   └── scripts/             # 上传 API 调用（如必要）
│   │
│   ├── doc-smith-clear/         # 清除配置
│   │   └── SKILL.md
│   │
│   └── doc-smith-check/         # 检查工具
│       ├── SKILL.md
│       └── scripts/             # 复杂校验逻辑（如必要）
│
├── CLAUDE.md
└── package.json
```

## 与原 intent.md 的差异

| 原设计 | 新设计 |
|-------|-------|
| 6 个 Skill | 7 个 Skill（新增 doc-smith-check） |
| 翻译用 AIGNE | 翻译用 Claude Code Skill |
| 共享 utils 目录 | 移除，胶水代码由 LLM 处理 |
| checkStructure/checkContent 作为 Script | 封装为 doc-smith-check Skill |
| doc-smith-images 和文档强关联 | 通用生图能力，输入 prompt |

## 实现建议

1. **优先实现核心 Skill**：`doc-smith`、`doc-smith-content`、`doc-smith-check`
2. **验证 Skill 间协作**：确保模型能正确根据描述调用其他 Skill
3. **逐步迁移**：从简单功能开始（如 `doc-smith-clear`），验证 Plugin 结构
4. **必要时添加脚本**：实现时具体判断哪些功能需要脚本

---

**设计日期**：2026-01-20
