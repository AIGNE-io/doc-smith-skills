# Agents 迁移为 Skill 参考文件

消除 `agents/` 独立目录层，将 3 个子代理 prompt 文件降级为主调用方 skill 目录下的参考文件。项目架构从 skill + agent 双层简化为 skill-only 单层。

## 1. 文件映射

| 原路径 | 目标路径 | 主调用方 |
|--------|---------|---------|
| `agents/doc-smith-content.md` | `skills/doc-smith-create/content.md` | doc-smith-create |
| `agents/generate-slot-image.md` | `skills/doc-smith-create/generate-slot-image.md` | doc-smith-create |
| `agents/translate-document.md` | `skills/doc-smith-localize/translate-document.md` | doc-smith-localize |

迁移后删除 `agents/` 目录。

## 2. 调用方引用更新

所有调用方 SKILL.md 中的「子代理」表述统一改为参考文件引用。调用方式不变（仍通过 Task tool 分发），仅更新措辞。

涉及文件：`doc-smith-create/SKILL.md`、`doc-smith-localize/SKILL.md`。跨 skill 引用（如 localize 引用 create 下的 generate-slot-image.md）使用相对路径。

## 3. CLAUDE.md 更新

### 删除

- Core Rules 中的 "Sub-agent Structure" 规则
- "Sub-agent Basic Structure" 模板
- "Creating a New Sub-agent" 工作流
- Call Relationships 中的 agent 调用图

### 更新

- 架构图：移除 `agents/` 目录，在 skill 目录下体现参考文件
- Separation of Concerns：移除 Sub-agent 描述
- Call Relationships：更新调用示例使用新路径

## 4. 边界

**不变**：
- 参考文件的 prompt 内容不改写，frontmatter 保留
- Task tool 并行分发机制不变
- marketplace.json 不注册参考文件

**非目标**：
- 不涉及 Phase 2（images/AIGNE Hub）
- 不涉及 skills-entry/、utils/ 等已废弃目录
