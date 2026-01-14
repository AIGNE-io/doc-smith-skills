# Workspace 初始化流程更新计划

## 背景

DocSmith 的工作空间初始化逻辑发生了重大变化：

1. **启动检测前置**：初始化检测和目录创建已移至 `index.mjs`，在 agent 启动时自动完成
2. **目录结构调整**：workspace 和 sources 分离，经过封装后执行层看到统一结构

## 执行层视角

无论实际启动方式如何，执行层始终看到统一的目录结构：

```
modules/
  /workspace    # doc-smith 的工作空间
  /sources      # 数据源目录
```

## 当前问题

现有 `workspace-initialization.md` 存在以下过时内容：

| 现有内容 | 问题 |
|---------|------|
| 检测当前目录状态 | 已在启动阶段完成，无需重复 |
| 收集语言、URL 等信息 | 启动阶段不再询问，改为对话中处理 |
| 创建 sources/ 目录并添加 submodule | 目录结构已变化 |
| 单一 source 配置 | 改为 sources 数组，支持多数据源 |
| config.yaml 格式 | 需要更新为新 schema |

## 新的职责划分

### 启动阶段（index.mjs 负责）

- 检测目录状态
- 创建 workspace 目录结构
- 执行 git init
- 生成初始 config.yaml

### 对话阶段（workspace-initialization.md 负责）

- **收集必要信息**（如用户未明确提供）
  - 询问输出语言
- **验证** workspace 配置完整性
- **添加数据源**
- **更新数据源**（git-clone 类型）
- **展示** workspace 状态

## 更新计划

### 1. 移除的内容

删除以下章节：

- ~~一、检测当前目录状态~~（已在启动阶段完成）
- ~~二、执行初始化流程~~（已在启动阶段完成）
  - ~~2.1 收集必要信息~~
  - ~~2.2 创建目录结构~~
  - ~~2.3 添加源仓库为 Submodule~~
  - ~~2.4 生成 config.yaml~~
  - ~~2.5 初次 Git 提交~~
  - ~~2.6 展示初始化结果~~

### 2. 保留并更新的内容

**验证已初始化的 Workspace**（原第三节）：

- 更新 config.yaml 字段检查（新增 mode 字段，source 改为 sources）
- 更新 submodule 更新逻辑（仅对 git-clone 类型生效）

**错误处理**（原第四节）：

- 保留通用错误处理
- 移除初始化相关的错误（如 submodule 添加失败）

### 3. 新增的内容

#### 3.1 执行层目录结构

执行层始终看到统一的目录结构：

```
modules/
  /workspace                    # doc-smith 工作空间
    ├── config.yaml            # 配置文件
    ├── intent/                # 意图文件
    ├── planning/              # 规划文件
    └── docs/                  # 生成的文档
  /sources                     # 数据源目录
    └── <project-name>/        # 源代码仓库
```

#### 3.2 Config.yaml Schema

更新为新格式（保留原有字段，更新 sources 部分）：

```yaml
# Workspace metadata
workspaceVersion: "1.0"
createdAt: "2025-01-13T10:00:00Z"

# Project information
projectName: "my-project"
projectDesc: "项目描述"
locale: "zh"

# Documentation settings (for publish)
projectLogo: ""
translateLanguages: []

# 数据源配置（原 source 改为 sources 数组）
sources:
  # local-path 类型
  - name: "main"
    type: local-path
    path: "../../"              # 相对于 workspace 的路径

  # git-clone 类型
  - name: "aigne-framework"
    type: git-clone
    url: "https://github.com/ArcBlock/aigne-framework.git"
    branch: "main"                    # 分支名（用于恢复）
    commit: "a1b2c3d4e5f6789..."      # 完整的 commit hash
    clonedAt: "2025-01-13T10:00:00Z"  # 克隆/更新时间
```

**变更说明**：
- `source`（单数）改为 `sources`（数组），支持多数据源
- git-clone 类型必须记录：
  - `branch`：分支名，用于在新环境中恢复
  - `commit`：完整 hash，记录精确版本
  - `clonedAt`：时间戳，便于追溯
- 其他字段（workspaceVersion、projectName、locale 等）保持不变

#### 3.3 收集必要信息

在对话开始时，如果用户未明确提供，需要询问：

**输出语言**（如 config.yaml 中 locale 为空）：
```
请选择文档输出语言:
1. English (en)
2. 简体中文 (zh)
3. 繁體中文 (zh-TW)
4. 日本語 (ja)
5. 한국어 (ko)
6. Español (es)
7. Français (fr)
8. Deutsch (de)
9. Português (pt)
10. Русский (ru)
11. Italiano (it)
12. العربية (ar)
13. 其他 (请输入语言代码)
```

- 如果用户在请求中已指定语言（如"生成中文文档"）→ 直接使用
- 询问后更新 config.yaml 中的 locale 字段

#### 3.4 数据源检查与添加流程

**检查流程**：
1. 读取 config.yaml 中的 sources 配置
2. 如果 sources 为空或不存在 → 询问用户提供仓库 URL
3. 如果 sources 存在 → 检查 `/sources/` 目录是否存在
   - 目录存在 → 跳过，继续后续流程
   - 目录不存在 → 执行恢复流程

**添加数据源**（sources 为空时）：
1. 询问用户提供仓库 URL
2. 验证 URL 格式
3. 询问分支名（默认 main）
4. 从 URL 提取项目名
5. 克隆到 `/sources/<项目名>/`
6. 获取当前 HEAD 的 commit hash
7. 更新 config.yaml 的 sources 数组

**命令**：
```bash
git clone -b <branch> <url> /sources/<project-name>
cd /sources/<project-name>
git rev-parse HEAD  # 获取 commit hash
```

**恢复数据源**（配置存在但目录不存在）：
1. 读取 sources 配置中的 url、branch、commit
2. 克隆仓库到 `/sources/<name>/`
3. 切换到记录的 commit
4. 提示用户恢复完成

**恢复命令**：
```bash
git clone -b <branch> <url> /sources/<name>
cd /sources/<name>
git checkout <commit>  # 切换到精确版本
```

#### 3.5 更新数据源流程

对 git-clone 类型的数据源执行更新：

**步骤**：
1. 读取 config.yaml 获取 sources 配置
2. 询问用户是否更新
3. 对每个 git-clone 类型的数据源：
   - 进入 `/sources/<name>/` 目录
   - 执行 `git fetch && git pull`
   - 获取新的 commit hash
   - 更新 config.yaml 中的 commit 和 clonedAt（branch 保持不变）

**询问用户**：
```
是否更新数据源到最新版本? (Y/n)
```

**更新命令**：
```bash
cd /sources/<name>
git fetch origin
git pull origin <branch>
git rev-parse HEAD  # 获取新的 commit hash
```

#### 3.6 验证 Workspace 流程

检查 workspace 配置完整性：

**必须存在的字段**：
- `sources`：数据源配置数组

**验证数据源**：
- local-path 类型：检查 path 指向的目录是否存在
- git-clone 类型：
  - 检查 `/sources/<name>/` 目录是否存在
  - 验证当前 commit 是否与配置一致（可选警告）

### 4. 更新后的文档结构

```
# Workspace 初始化流程

## 一、执行层目录结构
  - workspace 目录
  - sources 目录

## 二、Config.yaml Schema
  - sources 配置
  - 版本信息记录

## 三、收集必要信息
  - 询问输出语言（如未提供）

## 四、验证 Workspace
  - 配置完整性检查
  - 数据源有效性检查

## 五、数据源管理
  - 检查数据源配置
  - 添加数据源（配置为空时）
  - 恢复数据源（目录不存在时）
  - 更新数据源

## 六、错误处理

## 七、关键约束
```

## 实施步骤

1. 备份现有 `workspace-initialization.md`
2. 按上述结构重写文档
3. 更新引用该文档的其他文件（如有）
4. 验证新文档与 `index.mjs` 实现的一致性

---

**注意**：本文档是更新计划，待确认后实施修改。
