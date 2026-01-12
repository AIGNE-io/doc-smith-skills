# Init Agent 功能意图

## 功能概述

Workspace 初始化 Function Agent（JS 脚本），在 doc-smith 启动时执行，根据当前目录状态自动选择初始化路径，完成工作空间配置后进入文档生成对话模式。

## 功能意图

DocSmith 需要在启动时自动检测并初始化工作空间，为用户提供无缝的使用体验。init agent 是一个 JS 函数，通过代码逻辑检测当前目录状态、与用户交互、创建目录结构和配置文件，然后将控制权交给主 agent 进入文档生成对话。

## 工作流程

### 启动检测

```
doc-smith 启动
  ↓
调用 init()
  ↓
检测当前目录状态
  ↓
├─ .doc-smith/ 已存在且有效 → 直接进入对话模式
├─ 是 git 仓库（无 .doc-smith/）→ 项目内启动流程
├─ 是空目录 → 独立启动流程
└─ 其他情况 → 报错提示
```

### 流程 A：项目内启动

**触发条件**：当前目录是 git 仓库，且 `.doc-smith/` 不存在

**步骤**：
1. 向用户展示语言选择列表，等待用户选择
2. 创建 `.doc-smith/` 目录
3. 在 `.doc-smith/` 中执行 `git init`
4. 创建目录结构（intent/、planning/、docs/）
5. 创建 `.gitignore` 文件（忽略 source/ 目录，为后续添加其他 source 做准备）
6. 生成 config.yaml
7. 检测外层目录是否为 git 仓库
   - 是 → 将 `.doc-smith/` 添加为 submodule
   - 否 → 跳过 submodule 步骤
8. 设置 `options.context.userContext.docSmithWorkspace = './.doc-smith'`
9. 通过 `options.context.invoke()` 调用主 agent，传入初始化 message
10. 返回，进入对话模式

### 流程 B：独立启动

**触发条件**：当前目录是空目录

**步骤**：
1. 向用户询问 git 仓库地址
2. 向用户展示语言选择列表，等待用户选择
3. 执行 `git init` 初始化当前目录
4. 创建 `.gitignore`，添加 `source/` 到忽略列表
5. 执行 `git clone` 将用户提供的仓库克隆到 `source/` 目录
6. 获取并记录 source 仓库的 HEAD commit SHA
7. 创建目录结构（intent/、planning/、docs/）
8. 生成 config.yaml
9. 设置 `options.context.userContext.docSmithWorkspace = '/'`
10. 通过 `options.context.invoke()` 调用主 agent，传入初始化 message
11. 返回，进入对话模式

### 流程 C：已初始化

**触发条件**：`.doc-smith/` 或 `config.yaml` 已存在

**步骤**：
1. 读取现有配置
2. 设置 `options.context.userContext.docSmithWorkspace`（根据检测到的模式）
3. 直接通过 `options.context.invoke()` 调用主 agent
4. 返回，进入对话模式

## 核心能力

### 1. 目录状态检测

- 检测当前目录是否为 git 仓库（`.git/` 目录存在）
- 检测当前目录是否为空目录
- 检测 workspace 是否已初始化（`.doc-smith/config.yaml` 或 `./config.yaml` 存在）

### 2. 用户交互

使用 AIGNE 框架提供的 `options.prompts` API：
- `options.prompts.select`：语言选择（单选列表）
- `options.prompts.input`：Git 仓库 URL 输入

### 3. 支持的语言选项

| 代码 | 语言名称 |
|------|---------|
| en | English |
| zh | 简体中文 |
| zh-TW | 繁體中文 |
| ja | 日本語 |
| ko | 한국어 |
| es | Español |
| fr | Français |
| de | Deutsch |
| pt | Português |
| ru | Русский |
| it | Italiano |
| ar | العربية |

### 4. 目录结构创建

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

### 5. 配置文件内容

config.yaml 包含：
- `language`：文档输出语言
- `sources`：数据源配置数组
  - 项目内启动：`type: local-path`，`path: "../"`
  - 独立启动：`type: git-clone`，`url`、`ref`（HEAD SHA）、`cachePath: "source"`

### 6. Git 操作

- `git init`：初始化仓库
- `git clone`：克隆源仓库（独立模式）
- `git rev-parse HEAD`：获取 HEAD commit SHA
- `git submodule add`：添加 submodule（项目内模式，外层是 git 仓库时）

### 7. 全局上下文设置

在 `options.context.userContext` 中设置 `docSmithWorkspace` 字段：
- 项目内启动：`./.doc-smith`
- 独立启动：`/`

该字段供后续 agent 使用，用于定位 doc-smith 工作目录。

### 8. 调用主 Agent

通过 `options.context.invoke()` 调用 index.yaml 中定义的主 agent，传入 message 进入对话模式。

## 输入输出

### 输入

- `input`：调用参数（本场景可为空）
- `options.context`：AIGNE 上下文对象
  - `options.context.agents`：可用的 agent 字典
  - `options.context.invoke(agent, params)`：调用 agent 的方法
  - `options.context.userContext`：用户上下文，可存储全局状态
- `options.prompts`：AIGNE 交互 API
  - `options.prompts.select(config)`：单选列表
  - `options.prompts.input(config)`：文本输入

### 输出

成功时返回：
- `success: true`
- `language`：选择的语言代码
- `mode`：启动模式（'project' | 'standalone'）
- `message`：操作结果描述

失败时返回：
- `success: false`
- `error`：错误代码
- `message`：错误描述

## 约束条件

### 必须遵循的规范

1. **纯 JS 实现**：所有逻辑通过 JS 代码实现，不依赖 LLM 能力
2. **语言单选**：只支持选择一种语言
3. **目录结构**：严格遵循定义的目录结构
4. **配置格式**：config.yaml 遵循统一的 schema
5. **全局上下文**：必须设置 `docSmithWorkspace` 字段

### 职责边界

- **必须执行**：
  - 检测当前目录状态
  - 与用户交互获取必要信息
  - 创建目录结构和配置文件
  - 执行必要的 git 操作
  - 设置全局上下文
  - 调用主 agent 进入对话模式

- **不应执行**：
  - 不生成文档内容（交给主 agent）
  - 不创建远程仓库
  - 不推送到远程

## 预期结果

### 成功标准

1. 正确检测目录状态并选择对应流程
2. 用户交互清晰，选项明确
3. 目录结构和配置文件正确创建
4. Git 操作正确执行
5. 全局上下文正确设置
6. 成功调用主 agent 进入对话模式

## 错误处理

### 常见错误

1. **目录状态不明确**：既不是 git 仓库也不是空目录
2. **git clone 失败**：URL 无效或网络问题
3. **权限问题**：无法创建目录或文件
4. **git 命令不可用**：系统未安装 git

### 处理策略

1. **目录状态不明确**：返回错误，提示用户在 git 仓库或空目录中运行
2. **clone 失败**：返回错误，提示检查 URL 和网络
3. **权限问题**：返回错误，提示检查目录权限
4. **git 不可用**：返回错误，提示安装 git

## 实现方式

### 文件结构

```
skills-entry/doc-smith/
├── index.yaml           # 主 agent 配置
├── prompt.md
├── init.mjs             # init function agent
└── ai/
    └── intent/
        └── init.md      # 本文档
```

### 注册到 aigne.yaml

在 `aigne.yaml` 的 cli.agents 配置中，将 init.mjs 设置为 doc-smith 的入口。

---

**注意**：本文档描述功能意图，不包含具体实现代码。
