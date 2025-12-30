# DocSmith Workspace 独立工作目录实施计划

## 文档版本
- **创建时间**: 2025-12-30
- **修订时间**: 2025-12-30 (简化方案 v2)
- **状态**: 待审核
- **基于方案**: workspace-git-managed-design.md

---

## 一、目标与原则

### 核心目标
在不污染源仓库的前提下,让 DocSmith 以 Agentic 方式完成文档生成和更新的闭环。

### 设计原则
1. **源仓库只读**: 不在源仓库内写入任何配置、产物或状态文件
2. **独立 workspace**: 所有产物、状态、配置在独立目录管理
3. **意图与规划分层**:
   - `intent/`: 用户确认的"事实输入",稳定、长期有效
   - `planning/`: AI 推导的执行计划,可重算、可被推翻
4. **Git 版本管理**: 生成/更新后询问用户是否 commit
5. **LLM 原生执行**: 通过 Bash 工具直接执行 git/文件操作,无需编写专门的工具代码

---

## 二、Workspace 目录结构

### 最终形态
```
~/my-doc-workspace/          # 用户自建的 workspace 根目录
  .git/                      # workspace 自己的 Git 仓库
  config.yaml                # workspace 配置文件

  sources/                   # 数据源仓库 (git submodule)
    my-project/              # 作为 submodule clone 的源仓库
      .git/
      src/
      ...

  intent/                    # 人类意图层 (stable, user-confirmed)
    user-intent.md           # AI 起草 → 用户确认 → 作为事实输入

  planning/                  # AI 推导层 (volatile, recomputable)
    document-structure.yaml  # 文档结构规划 (AI 生成,可重算/可改)

  docs/                      # 生成产物 (可导出)
    overview.md
    getting-started.md
    api/
      authentication.md
    ...

  cache/                     # 可选: 中间格式/索引/解析结果 (可清理)
    ...
```

### 目录语义
| 目录 | 写入权限 | 语义 | Git 管理 |
|-----|---------|------|---------|
| `intent/` | 仅用户确认后 | 用户意图,事实输入 | ✓ 提交 |
| `planning/` | AI 可重写 | AI 推导的规划 | ✓ 提交 |
| `docs/` | AI 生成/更新 | 最终产物 | ✓ 提交 |
| `cache/` | AI/程序可写 | 临时数据,可清理 | ✗ .gitignore |
| `sources/` | Git submodule | 源仓库引用,只读 | ✓ submodule |

---

## 三、Workspace 检测逻辑

### 初始化检测规则
```
检查当前目录:
1. 存在 config.yaml + intent/ + planning/ + docs/ → 已初始化,继续执行
2. 空目录 → 执行初始化流程
3. 非空目录且未初始化 → 提示用户并停止
```

**非空未初始化时的提示**:
```
⚠️ 当前目录不是空目录,也未初始化为 workspace。

建议:
1. cd 到空目录并重新执行
2. 或者创建新目录: mkdir my-workspace && cd my-workspace
3. 或者清空当前目录后重新执行

DocSmith 需要在独立的 workspace 目录中工作,以避免污染源仓库。
```

### 不考虑老版本兼容
- MVP 仅支持新架构
- 不检测 `.aigne/doc-smith/` 目录
- 不提供迁移工具

---

## 四、工程实施计划

### 核心思路
- **主要改动**: 修改 `doc-smith/SKILL.md` 和 references 文档
- **详细流程**: 移到独立参考文件 `references/workspace-initialization.md`
- **LLM 原生执行**: 通过 Bash 工具直接执行 git/mkdir/write 等操作
- **最小化代码**: 仅扩展 `utils/config.mjs`,无需新增工具模块

---

### Phase 1: Config.yaml 架构调整

**预计工作量**: 30 分钟

#### 任务
- [ ] 更新 `utils/config.mjs` 的 `generateConfigYAML()` 函数
  - 新增 `workspaceVersion` 字段
  - 新增 `source` 对象字段 (type/path/url/branch)

#### 新增字段定义
```yaml
# Workspace metadata
workspaceVersion: "1.0"
createdAt: "2025-12-30T10:00:00Z"

# Project information
projectName: "My Project"
projectDesc: "Project description"
locale: "zh"

# Source repository (as git submodule)
source:
  type: "git-submodule"
  path: "sources/my-project"
  url: "https://github.com/user/repo.git"
  branch: "main"

# Legacy fields (for publish)
projectLogo: ""
translateLanguages: []
```

#### 验收标准
- [ ] 可以生成包含新字段的 config.yaml
- [ ] `loadConfigFromFile()` 可以正确读取新字段
- [ ] 老版本 config.yaml (不含新字段) 仍可正常读取

---

### Phase 2: 创建 Workspace 初始化参考文档

**预计工作量**: 已完成

#### 任务
- [x] 创建 `doc-smith/references/workspace-initialization.md`
- [x] 详细定义 workspace 检测和初始化流程
- [x] 包含错误处理和完整示例

#### 文档内容
- Workspace 检测逻辑 (已初始化/空目录/非空未初始化)
- 初始化流程 (收集信息/创建目录/添加 submodule/生成 config/git commit)
- 验证已初始化的 workspace
- 错误处理 (Git 未安装/Submodule 失败/权限问题/YAML 格式错误)

---

### Phase 3: 更新 SKILL.md 主流程

**预计工作量**: 1-2 小时

#### 任务
- [ ] 在工作流程前添加 "步骤 0: Workspace 检测与初始化"
- [ ] 全局替换路径引用
- [ ] 添加 Git 提交询问逻辑

#### 3.1 添加步骤 0
**新增内容**:
```markdown
## 步骤 0: Workspace 检测与初始化

**执行任何操作前,首先检测并初始化 workspace。**

**详细流程参考**: `references/workspace-initialization.md`

**简要说明**:
1. 检测当前目录是否已初始化 (存在 config.yaml, intent/, planning/, docs/)
2. 如果已初始化 → 验证配置,继续执行
3. 如果是空目录 → 执行初始化流程
4. 如果非空且未初始化 → 提示用户并停止

**初始化时需要**:
- 用户指定输出语言
- 用户提供源仓库 Git URL
- 自动创建目录结构
- 自动添加源仓库为 submodule
- 生成 config.yaml
- 初次 git commit
```

#### 3.2 路径替换
全局替换:
- `.aigne/doc-smith/output/user-intent.md` → `intent/user-intent.md`
- `.aigne/doc-smith/output/document-structure.yaml` → `planning/document-structure.yaml`
- `.aigne/doc-smith/docs/` → `docs/`

示例:
```markdown
### 2. 推断用户意图
首先检查 `intent/user-intent.md` 是否已存在...
使用 Write 工具创建 `intent/user-intent.md`...

### 3. 规划文档结构
首先检查 `planning/document-structure.yaml` 是否已存在...
使用 Write 工具创建 `planning/document-structure.yaml`...

### 6. 生成文档内容
在 `docs/` 目录中创建 markdown 文件...
```

#### 3.3 添加 Git 提交询问
**在步骤 6 (生成文档) 结束后添加**:
```markdown
### 6.x Git 提交

文档已生成完成。

**询问用户**: 是否提交到 Git? (Y/n)

**如果用户选择 Yes**:
```bash
git add config.yaml intent/ planning/ docs/
git commit -m "docsmith: generate v1 (lang=<语言>)"
```

**如果用户选择 No**:
提示: "跳过提交,可稍后手动执行: git add . && git commit"
```

**在步骤 7 (更新文档) 结束后添加**:
```markdown
### 7.x Git 提交

文档已更新完成。

**询问用户**: 是否提交到 Git? (Y/n)

**如果用户选择 Yes**:
```bash
git add planning/ docs/
git commit -m "docsmith: update documentation"
```
```

#### 验收标准
- [ ] SKILL.md 包含步骤 0 并引用详细文档
- [ ] 所有路径引用已更新为新路径
- [ ] Git 提交逻辑已添加 (询问用户,而非自动)

---

### Phase 4: 更新 References 文档

**预计工作量**: 1 小时

#### 任务
- [ ] 批量替换所有 `references/*.md` 中的路径
- [ ] 在关键文档开头添加文件位置和权限说明

#### 文件列表
- `user-intent-guide.md` - 添加位置说明: `intent/user-intent.md`
- `structure-planning-guide.md` - 添加位置说明: `planning/document-structure.yaml`
- `document-structure-schema.md` - 路径更新
- `structure-confirmation-guide.md` - 路径更新
- `document-content-guide.md` - 路径更新
- `update-workflow.md` - 路径更新

#### 批量替换
- `.aigne/doc-smith/output/` → `intent/` 或 `planning/` (根据上下文)
- `.aigne/doc-smith/docs/` → `docs/`

#### 添加文件位置说明
在 `user-intent-guide.md` 开头:
```markdown
**文件位置**: `intent/user-intent.md`
**权限**: 仅在用户确认后写入,AI 可起草但不可直接修改
```

在 `structure-planning-guide.md` 开头:
```markdown
**文件位置**: `planning/document-structure.yaml`
**权限**: AI 可重写/更新,可重算
```

#### 验收标准
- [ ] 7 个 references 文档的路径全部更新
- [ ] 关键文档包含文件位置和权限说明

---

### Phase 5: 更新 Publish Agent

**预计工作量**: 30 分钟

#### 任务
- [ ] 修改 `agents/publish/check-docs.mjs` - 路径兼容检测
- [ ] 修改 `agents/publish/init-config.mjs` - 配置路径兼容
- [ ] 修改 `agents/publish/publish-docs.mjs` - 目录结构适配

#### 代码修改示例
```javascript
// agents/publish/check-docs.mjs
const isWorkspace = existsSync(path.join(process.cwd(), 'config.yaml'))
const docsDir = isWorkspace
  ? path.join(process.cwd(), 'docs')
  : path.join(process.cwd(), '.aigne/doc-smith/docs')

// agents/publish/init-config.mjs
const configPath = existsSync('./config.yaml')
  ? './config.yaml'
  : './.aigne/doc-smith/config.yaml'
```

#### 验收标准
- [ ] Publish 功能同时兼容新旧两种目录结构
- [ ] 优先使用新结构,自动回退到老结构

---

### Phase 6: 更新项目文档

**预计工作量**: 30 分钟

#### 任务
- [ ] 在 README.md 添加 workspace 使用说明
- [ ] 更新 CLAUDE.md (如需要)

#### README.md 新增内容
```markdown
## Workspace 模式 (v1.0)

DocSmith 现在使用独立 workspace 目录,不再在源仓库中创建 `.aigne/doc-smith`。

### 使用方式
1. 创建空目录作为 workspace
   ```bash
   mkdir my-docs-workspace
   cd my-docs-workspace
   ```

2. 执行 doc-smith
   ```bash
   aigne doc-smith.yaml
   ```

3. 按提示输入语言和源仓库 URL

4. DocSmith 会自动:
   - 创建目录结构
   - Clone 源仓库为 submodule
   - 生成配置文件
   - 初始化 git 仓库

### 目录结构
```
workspace/
  config.yaml           - 配置文件
  sources/my-project/   - 源仓库 (submodule)
  intent/               - 用户意图
  planning/             - 文档结构规划
  docs/                 - 生成的文档
  cache/                - 临时数据
```

### 版本管理
- 每次生成/更新后会询问是否提交
- 可随时查看 `git log` 查看历史
- 可通过 `git revert` 回滚版本
```

#### 验收标准
- [ ] README.md 包含 workspace 使用指南
- [ ] 说明清晰易懂,新用户可快速上手

---

## 五、MVP 范围界定

### MVP 包含 (必须完成)
✅ **Phase 1**: Config.yaml 架构扩展 (30分钟)
✅ **Phase 2**: Workspace 初始化参考文档 (已完成)
✅ **Phase 3**: SKILL.md 添加 workspace 流程 (1-2小时)
✅ **Phase 4**: References 文档路径更新 (1小时)
✅ **Phase 5**: Publish Agent 路径适配 (30分钟)
✅ **Phase 6**: 项目文档更新 (30分钟)

**总工作量**: 约 3.5-4.5 小时

**特点**:
- 主要是文档和提示词改动,代码改动最小
- LLM 通过 Bash 工具原生执行操作
- 仅扩展 `utils/config.mjs`,无需新增工具模块
- 详细流程在独立参考文档中,保持 SKILL.md 简洁

### MVP 暂不包含 (后续迭代)
❌ 多 sources 合并
❌ 本地路径 sources (非 git)
❌ Cache 精细化管理
❌ 老版本迁移工具
❌ Changeset 自动应用 (需用户手动处理)

---

## 六、实施步骤建议

1. **Phase 1** (30分钟) - 扩展 Config.yaml
2. **Phase 3** (1-2小时) - 更新 SKILL.md (核心,最重要)
3. **Phase 4** (1小时) - 更新 References 文档
4. **Phase 5** (30分钟) - 更新 Publish Agent
5. **Phase 6** (30分钟) - 更新项目文档

**Phase 2 已完成** (workspace-initialization.md 已创建)

---

## 七、关键技术决策

### 决策 1: Workspace 流程移到独立参考文档
**理由**:
- 保持 SKILL.md 简洁
- 详细逻辑在 `references/workspace-initialization.md`
- LLM 可按需阅读详细流程

**影响**:
- ✅ SKILL.md 更易维护
- ✅ 详细流程单独管理
- ⚠️ 需确保 LLM 会阅读参考文档

---

### 决策 2: Git 提交改为询问用户,不自动
**理由**:
- 用户可能想手动编辑后再提交
- 更灵活,用户有完全控制权
- 简化实现,不需要 autoCommit 配置

**影响**:
- ✅ 简化 config.yaml schema
- ✅ 用户体验更友好
- ⚠️ 需在文档中说明如何手动 commit

---

### 决策 3: 不考虑老版本兼容
**理由**:
- MVP 快速上线
- 老用户可继续使用老版本或手动迁移
- 节省开发时间

**影响**:
- ✅ 实施简单,代码干净
- ⚠️ 老用户需手动迁移 (可后续提供工具)

---

### 决策 4: Sources 作为 Git Submodule
**理由**:
- 标准 Git 功能,成熟稳定
- 自动跟踪版本
- workspace 可独立分发

**影响**:
- ✅ 不污染源仓库
- ✅ 版本可追溯
- ⚠️ 用户需了解 submodule 基本概念 (但 LLM 会自动执行)

---

### 决策 5: LLM 通过 Bash 工具原生执行,不编写专门工具代码
**理由**:
- LLM 已具备完善的 Bash 执行能力
- git/mkdir/cat 等都是标准命令,无需封装
- 减少代码维护成本

**影响**:
- ✅ 实施简单,代码量最小
- ✅ 灵活性高,LLM 可根据情况调整
- ⚠️ 依赖 Bash 工具的稳定性

**例外**: `utils/config.mjs` 保留,因为 YAML 格式化需要专门处理

---

## 八、验收清单

### 功能验收

#### Phase 1: Config.yaml
- [ ] `generateConfigYAML()` 包含新字段
- [ ] `loadConfigFromFile()` 正确读取新字段
- [ ] 老版本 config.yaml 仍可正常读取

#### Phase 3: SKILL.md
- [ ] 包含步骤 0 并引用 workspace-initialization.md
- [ ] 所有路径引用已更新
- [ ] Git 提交询问逻辑已添加

#### Phase 4: References
- [ ] 7 个文档的路径全部更新
- [ ] 关键文档包含文件位置说明

#### Phase 5: Publish Agent
- [ ] 兼容新旧两种目录结构
- [ ] 优先使用新结构,自动回退老结构

#### Phase 6: 项目文档
- [ ] README.md 包含 workspace 使用指南

---

### 集成测试场景

#### 场景 1: 新用户首次使用
```
1. 创建空目录 my-docs-workspace
2. cd my-docs-workspace
3. 执行 doc-smith
4. 验证: 提示输入语言和源仓库 URL
5. 验证: 自动创建目录结构
6. 验证: 自动 clone submodule
7. 验证: 生成 config.yaml 包含所有字段
8. 验证: 自动 git commit
9. 验证: 继续执行文档生成流程
10. 验证: 生成完成后询问是否 commit
```

#### 场景 2: Workspace 已初始化的用户
```
1. cd existing-workspace
2. 执行 doc-smith (更新文档)
3. 验证: 跳过初始化,直接进入步骤 1
4. 验证: 读取 config.yaml 配置
5. 验证: 生成/更新文档到正确路径
6. 验证: 完成后询问是否 commit
```

#### 场景 3: 非空目录执行
```
1. cd non-empty-directory
2. 执行 doc-smith
3. 验证: 检测到非空且未初始化
4. 验证: 显示清晰提示
5. 验证: 停止执行,不创建任何文件
```

---

### 质量标准
- [ ] SKILL.md 和 references 文档语言清晰,无歧义
- [ ] 关键决策点有明确的判断逻辑
- [ ] Git 操作失败时有明确的错误信息和解决建议
- [ ] 所有 Bash 命令都经过验证,不会产生意外副作用
- [ ] workspace-initialization.md 包含完整的错误处理

---

## 九、项目依赖与约束

### 技术依赖
- **Node.js** >= 18 (现有依赖)
- **Git** >= 2.13 (submodule 支持)
- **@aigne/cli** (现有依赖)
- **yaml** 包 (现有依赖,用于 config.yaml 处理)

### 外部约束
- AFS local-fs 模块通过 `${CWD}` 绑定
- Git submodule 机制
- 用户必须在 workspace 目录内执行

### 假设前提
- 用户具备基本命令行操作能力 (cd, mkdir)
- 源仓库是 Git 仓库 (MVP 范围)
- 用户有 Git 操作权限 (clone, commit)

---

## 十、附录

### A. 完整配置示例

```yaml
# Workspace metadata
workspaceVersion: "1.0"
createdAt: "2025-12-30T10:00:00Z"

# Project information
projectName: "My Awesome Project"
projectDesc: "A comprehensive guide for my project"
projectLogo: "https://example.com/logo.png"
locale: "zh"

# Source repository (as git submodule)
source:
  type: "git-submodule"
  path: "sources/my-project"
  url: "https://github.com/user/my-project.git"
  branch: "main"

# Translation (optional)
translateLanguages:
  - en
  - ja

# Documentation settings (for publish)
docsDir: "./docs"
```

---

### B. Git Submodule 快速参考

```bash
# 添加 submodule
git submodule add <repo-url> sources/<name>

# 初始化并更新所有 submodule
git submodule update --init --recursive

# 更新 submodule 到最新
git submodule update --remote sources/<name>

# 克隆包含 submodule 的仓库
git clone --recurse-submodules <workspace-url>

# 移除 submodule
git submodule deinit sources/<name>
git rm sources/<name>
```

---

### C. 目录权限矩阵

| 目录/文件 | AI 读 | AI 写 | 用户读 | 用户写 | Git 管理 | 说明 |
|---------|------|------|-------|-------|---------|------|
| config.yaml | ✓ | ✓ | ✓ | ✓ | ✓ | 配置文件 |
| intent/ | ✓ | 仅起草 | ✓ | 确认后 | ✓ | 用户意图 |
| planning/ | ✓ | ✓ | ✓ | ✗ | ✓ | AI 规划 |
| docs/ | ✓ | ✓ | ✓ | ✗ | ✓ | 生成产物 |
| cache/ | ✓ | ✓ | ✓ | ✗ | ✗ | 临时数据 |
| sources/ | ✓ | ✗ | ✓ | Submodule | ✓ | 源仓库 |

---

## 结语

本实施计划基于 workspace-git-managed-design 方案,经过简化和调整,制定了务实的工程落地路径。

### 核心亮点

1. **最小化代码改动**
   - 主要修改 SKILL.md 和 references 文档
   - 仅扩展 `utils/config.mjs`,无需新建工具模块
   - LLM 通过 Bash 工具原生执行 git/文件操作

2. **保持 SKILL.md 简洁**
   - 详细 workspace 流程移到 `references/workspace-initialization.md`
   - SKILL.md 仅保留主流程和引用

3. **用户友好的 Git 管理**
   - 生成/更新后询问用户是否 commit (不自动)
   - 用户有完全控制权
   - 规范化 commit message

4. **不污染源仓库**
   - 所有产物在独立 workspace 管理
   - 源仓库作为 Git Submodule 引用
   - 清晰的目录语义

### 实施要点

- **预计工作量**: 3.5-4.5 小时
- **核心任务**: 更新 SKILL.md (Phase 3)
- **不考虑**: 老版本兼容、Changeset 自动应用
- **验收方式**: 3 个集成测试场景

### 下一步行动

请审查本计划,重点确认:

1. ✅ **简化程度**: 是否足够简洁?是否还有可简化的地方?
2. ✅ **workspace 流程**: 移到独立参考文档是否合理?
3. ✅ **Git 策略**: 询问用户(而非自动)是否 commit 是否合适?
4. ✅ **MVP 范围**: 6 个 Phase,3.5-4.5小时工作量是否合理?

**确认后**,我们可以立即开始实施:
- 从 Phase 1 (扩展 Config.yaml) 开始
- 重点完成 Phase 3 (SKILL.md 核心流程)
- 逐步完成 Phase 4-6

预计在半天到一天内完成 MVP 开发并测试。
