# Interview Decisions: Agents 迁移为 Skills

> Anchor: 去掉 agents/ 这一独立概念层，将子代理降级为主调用方 skill 目录下的参考文件，消除 agent 概念。

## Decisions

### 1. 迁移方向
- **Question**: 去掉 agent 后用什么替代？
- **Decision**: 保留 Task tool 分发机制（并行执行 + 上下文隔离），但把 agents/*.md 文件升级为标准 skills/*/SKILL.md
- **Rationale**: agent 和 skill 两层概念增加认知负担，实际上 agent 只是没有 frontmatter description 触发的 skill prompt

### 2. 文件组织
- **Question**: agent prompt 收到 skill 后如何组织？generate-slot-image 被多个 skill 共享怎么办？
- **Decision**: 混合处理 — 每个 agent 降级为其主调用方 skill 目录下的参考文件：
  - `agents/doc-smith-content.md` → `skills/doc-smith-create/content.md`
  - `agents/generate-slot-image.md` → `skills/doc-smith-create/generate-slot-image.md`
  - `agents/translate-document.md` → `skills/doc-smith-localize/translate-document.md`
- **Rationale**: 就近放置，减少跨目录引用。generate-slot-image 虽被 localize 也调用，但主要归属 create

### 3. 用户可见性
- **Question**: 降级后用户能否直接调用？
- **Decision**: 不能。仅作为参考文件供 Task tool 内部调用，不暴露给用户
- **Rationale**: 这些是实现细节，不需要用户直接操作

### 4. 迁移范围
- **Question**: 迁移时是否重构内容？
- **Decision**: 最小迁移。只移动文件 + 调整 frontmatter 格式，不改写内容。优先完成架构统一
- **Rationale**: 内容已经通过 Phase 1-3 迭代打磨过，无需重写

### 5. 批次与清理
- **Question**: 分批还是一次性？agents/ 目录如何处理？
- **Decision**: 3 个 agent 全部一次性迁移，完成后直接删除 agents/ 目录
- **Rationale**: 数量少（3个），一次性完成更干净

### 6. 调用方引用语法
- **Question**: 调用方 SKILL.md 中「使用 doc-smith-content 子代理」这类表述怎么改？
- **Decision**: 改为 skill 表述（「使用 doc-smith-content skill」），保持 Task tool 调用方式不变
- **Rationale**: 语义清晰，与新架构一致

### 7. marketplace.json 注册
- **Question**: 降级后的文件是否需要注册？
- **Decision**: 不注册。它们不是独立 skill，只是参考文件
- **Rationale**: 非用户入口，无需在 marketplace 中体现

### 8. CLAUDE.md 更新
- **Question**: CLAUDE.md 中大量涉及 agents/ 和 sub-agent 概念，需要更新
- **Decision**: 需要更新：删除 Sub-agent Structure 规则、更新架构图、更新调用示例、更新工作流说明
- **Rationale**: CLAUDE.md 是项目规范，必须与实际架构一致

## Open Items
（无）

## Out of Scope
- 不改 agent prompt 的核心逻辑内容
- 不改 Task tool 的分发机制
- 不涉及 Phase 2（images/AIGNE Hub）的未完成工作
