# DocSmith 架构优化：从过程式控制到声明式约束

## 一句话

把 DocSmith 从"教 AI 按步骤做事"变成"告诉 AI 规则和目标，让它自主执行"。

## 为什么要做？

当前 doc-smith-create 的 SKILL.md 是 456 行的过程式步骤清单（Phase 0 → 5.5 → 5.7 → 8.4 → 8.6），11 个 reference 文件相互引用，AI 被当作脚本执行器而非协作者。这违反了 AI-Native 的核心原则：**约束声明优于过程控制**。

## 核心体验

```
Before:
  用户 → /doc-smith-create → AI 读 SKILL.md 456 行 → 逐步执行 Phase 0-8.6
                               ↓
                          每个 Phase 还要读对应的 reference 文件（11个）
                               ↓
                          task_plan.md 手动管理状态（markdown checkbox）

After:
  用户 → /doc-smith-create → AI 读 SKILL.md ~200 行（约束 + 目标）
                               ↓
                          AI 理解约束后自主决定执行方式
                               ↓
                          Task(content.md) 并行生成文档
                               ↓
                          doc-smith-check 硬性校验兜底
```

## 架构变更

```
Skills 结构:
┌──────────────────────────────────────────────────────┐
│ doc-smith-create (SKILL.md ~200行)                    │
│   约束声明 + schema 内联 + Task 分发规则              │
│   ├── references/content.md          (Task agent)    │
│   └── references/generate-slot-image.md (Task agent) │
├──────────────────────────────────────────────────────┤
│ doc-smith-localize (声明式约束)                        │
│   └── references/translate-document.md (Task agent)  │
├──────────────────────────────────────────────────────┤
│ doc-smith-build (路径抽象: /assets/ → 相对路径)       │
├──────────────────────────────────────────────────────┤
│ doc-smith-check (+ 路径格式校验)                      │
├──────────────────────────────────────────────────────┤
│ doc-smith-images / clear (仅风格统一)                 │
├──────────────────────────────────────────────────────┤
│ doc-smith-publish (不动)                              │
└──────────────────────────────────────────────────────┘

删除的东西:
  - 8 个 reference 文件 (changeset/patch/update/structure×3/intent/workspace)
  - task_plan.md 机制
  - translate_task_plan.md 机制
  - changeset / PATCH 更新机制
  - Phase 编号系统

新增的东西:
  - build.mjs 路径转换 (/assets/ → 相对路径)
  - doc-smith-check 路径格式校验
```

## 关键决策

| 问题 | 选择 | 为什么 |
|------|------|--------|
| SKILL.md 怎么写？ | 声明式约束，不是步骤清单 | AI 不是脚本执行器 |
| 状态怎么管？ | Claude Code TaskCreate | 不重复造轮子 |
| 11 个 reference？ | 保留 3 个 Task agent，其余内联 | 只有并行分发需要独立文件 |
| ../../ 路径？ | /assets/ 绝对路径 + 构建转换 | 确定性计算交给确定性系统 |
| 文档更新？| 删除 changeset/PATCH，自然对话 | AI 理解意图后修改，满足约束即可 |
| 用户确认？ | 保留意图 + 结构两个确认点 | 必要的人类监督 |

## 范围

**In**：create / localize / build / check / images / clear 全部 skill

**Out**：publish（刻意设计为脚本调用，未来可能废弃）

## 风险 + 缓解

| 风险 | 缓解 |
|------|------|
| AI 跳过关键步骤 | doc-smith-check 硬性校验兜底 |
| 路径抽象引入 bug | check --content 校验路径 |
| SKILL.md 内联后过长 | 严格精简，只保留约束规则 |

## 实施步骤

```
1. build.mjs 路径抽象        ← 基础设施，其他依赖它
2. doc-smith-create 声明式重写 ← 核心变更
3. doc-smith-localize 重写    ← 跟随 create 风格
4. 其他 skill 风格统一        ← check / images / clear
5. 端到端验证                 ← 完整流程测试
```
