# Doc-Smith Agent 功能意图

## 功能概述

Doc-Smith 主入口 Agent，在启动时自动检测并初始化工作空间，然后进入文档生成对话模式。整个流程通过单一 index.mjs 文件实现，导出一个 JS 配置对象。

## 功能意图

DocSmith 需要在启动时自动检测工作空间状态，根据不同场景完成初始化，然后进入文档生成对话。由于 AIGNE 框架的实现限制，初始化逻辑和主 agent 配置需要合并在同一个 index.mjs 文件中。

## 工作流程

### 整体流程

```
doc-smith 启动
  ↓
加载 index.mjs（使用 top-level await）
  ↓
检测当前目录状态
  ↓
├─ .doc-smith/ 或 config.yaml 已存在 → 读取配置，生成 AFS modules
├─ 是 git 仓库（无 .doc-smith/）→ 执行项目内初始化，生成 AFS modules
├─ 是空目录 → 执行独立初始化，生成 AFS modules
└─ 其他情况 → 报错退出
  ↓
导出配置对象（含动态生成的 AFS modules）
  ↓
进入文档生成对话模式
```

### 流程 A：项目内启动

**触发条件**：当前目录是 git 仓库，且 `.doc-smith/` 不存在

**步骤**：
1. 创建 `.doc-smith/` 目录
2. 在 `.doc-smith/` 中执行 `git init`
3. 创建目录结构（intent/、planning/、docs/）
4. 创建 `.gitignore` 文件（忽略 source/ 目录）
5. 生成 config.yaml（sources 配置为 local-path 类型）
6. 检测外层目录是否为 git 仓库，是则将 `.doc-smith/` 添加为 submodule
7. 生成 AFS modules 配置

### 流程 B：独立启动

**触发条件**：当前目录是空目录

**步骤**：
1. 向用户询问 git 仓库地址
2. 执行 `git init` 初始化当前目录
3. 创建 `.gitignore`，添加 `source/` 到忽略列表
4. 执行 `git clone` 将用户提供的仓库克隆到 `source/` 目录
5. 获取并记录 source 仓库的 HEAD commit SHA
6. 创建目录结构（intent/、planning/、docs/）
7. 生成 config.yaml（sources 配置为 git-clone 类型）
8. 生成 AFS modules 配置

### 流程 C：已初始化

**触发条件**：`.doc-smith/config.yaml` 或 `./config.yaml` 已存在

**步骤**：
1. 读取现有配置
2. 根据配置模式生成 AFS modules 配置

## 核心能力

### 1. 目录状态检测

- 检测 workspace 是否已初始化（`.doc-smith/config.yaml` 或 `./config.yaml` 存在）
- 检测当前目录是否为 git 仓库（`.git/` 目录存在）
- 检测当前目录是否为空目录

### 2. 用户交互

仅在独立启动模式下需要用户输入：
- `options.prompts.input`：Git 仓库 URL 输入

### 3. 目录结构创建

**项目内启动创建的结构**：
```
.doc-smith/
├── .git/                # 独立 git 仓库
├── .gitignore           # 忽略 source/ 目录
├── config.yaml          # 工作空间配置
├── intent/              # 意图文件目录
├── planning/            # 规划文件目录
└── docs/                # 生成的文档目录
```

**独立启动创建的结构**：
```
./                       # 当前目录
├── .git/
├── .gitignore           # 包含 source/
├── config.yaml          # 工作空间配置
├── source/              # 克隆的源仓库（被 gitignore）
├── intent/
├── planning/
└── docs/
```

### 4. 配置文件内容

config.yaml 包含：
- `sources`：数据源配置数组
  - 项目内启动：`type: local-path`，`path: "../"`
  - 独立启动：`type: git-clone`，`url`、`ref`（HEAD SHA）、`cachePath: "source"`

### 5. 动态 AFS Modules 生成

根据工作空间模式动态生成 AFS modules：

**项目内模式**：
- workspace：`${CWD}/.doc-smith`
- source：根据 config.yaml 中 local-path 类型的 sources 动态添加

**独立模式**：
- workspace：`${CWD}`

**始终包含**：
- history：历史记录存储
- doc-smith skill：技能文件目录

### 6. Git 操作

- `git init`：初始化仓库
- `git clone`：克隆源仓库（独立模式）
- `git rev-parse HEAD`：获取 HEAD commit SHA
- `git submodule add`：添加 submodule（项目内模式）

## 输入输出

### 输入

- 模块加载时自动执行初始化检测
- 独立模式下通过 `options.prompts.input` 获取仓库 URL

### 输出

导出一个 JS 配置对象，包含：
- `type`：agent 类型
- `name`：agent 名称
- `instructions`：指令文件路径
- `skills`：可用技能列表
- `afs.modules`：动态生成的 AFS 模块配置

## 约束条件

### 必须遵循的规范

1. **单文件实现**：所有逻辑在 index.mjs 中实现
2. **导出 JS 对象**：默认导出必须是配置对象，不能是函数
3. **top-level await**：使用 top-level await 在模块加载时执行异步初始化
4. **目录结构**：严格遵循定义的目录结构
5. **配置格式**：config.yaml 遵循统一的 schema

### 职责边界

- **必须执行**：
  - 检测当前目录状态
  - 创建目录结构和配置文件（首次启动）
  - 执行必要的 git 操作
  - 动态生成 AFS modules 配置

- **不应执行**：
  - 不生成文档内容（由对话模式处理）
  - 不创建远程仓库
  - 不推送到远程

## 预期结果

### 成功标准

1. 正确检测目录状态并选择对应流程
2. 目录结构和配置文件正确创建
3. Git 操作正确执行
4. AFS modules 根据模式正确生成
5. 成功导出配置对象进入对话模式

## 错误处理

### 常见错误

1. **目录状态不明确**：既不是 git 仓库也不是空目录
2. **git clone 失败**：URL 无效或网络问题
3. **权限问题**：无法创建目录或文件
4. **git 命令不可用**：系统未安装 git

### 处理策略

1. **目录状态不明确**：输出错误信息，提示用户在 git 仓库或空目录中运行
2. **clone 失败**：输出错误信息，提示检查 URL 和网络
3. **权限问题**：输出错误信息，提示检查目录权限
4. **git 不可用**：输出错误信息，提示安装 git

## 实现方式

### 文件结构

```
skills-entry/doc-smith/
├── index.mjs            # 主入口（含初始化逻辑和配置导出）
├── utils.mjs            # 共享工具函数
├── prompt.md            # agent 指令文件
└── ai/
    └── intent/
        └── doc-smith.md # 本文档
```

### 注册到 aigne.yaml

在 `aigne.yaml` 的 cli.agents 配置中，将 index.mjs 设置为 doc-smith 的入口。

---

**注意**：本文档描述功能意图，不包含具体实现代码。
