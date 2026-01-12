# Init Agent 功能意图

## 功能概述

Workspace 初始化 Function Agent，在 doc-smith 启动时执行，根据当前目录状态自动选择初始化路径，完成工作空间配置后进入文档生成对话模式。

## 功能意图

DocSmith 需要在启动时自动检测并初始化工作空间，为用户提供无缝的使用体验。用户不需要手动创建目录结构或配置文件，init agent 会根据当前目录状态自动完成所有准备工作，然后将控制权交给主 agent 进入文档生成对话。

## 工作流程

### 启动检测

```
doc-smith 启动
  ↓
调用 init agent
  ↓
检测当前目录状态
  ↓
├─ 是 git 仓库 → 项目内启动流程
├─ 是空目录 → 独立启动流程
└─ 其他情况 → 报错提示
```

### 流程 A：项目内启动

**触发条件**：当前目录是 git 仓库

**步骤**：
1. 检测 `.docsmith/` 是否已存在
   - 已存在且有效 → 跳过初始化，直接进入对话模式
   - 不存在 → 继续初始化
2. 询问用户希望生成什么语言的文档（单选）
3. 创建 `.docsmith/` 目录
4. 初始化目录结构和配置文件
5. 通过 `options.context` 调用 index.yaml 中定义的 agent
6. 传入 message："为当前项目生成 {language} 语言文档"
7. 进入对话模式

### 流程 B：独立启动

**触发条件**：当前目录是空目录

**步骤**：
1. 询问用户提供希望生成文档的项目 git 仓库地址
2. 询问用户希望生成什么语言的文档（单选）
3. 在当前目录初始化 git 仓库
4. 创建 `.gitignore`，忽略 `source/` 目录
5. 克隆用户提供的仓库到 `source/` 目录
6. 记录 source 仓库的 HEAD 信息（commit SHA）
7. 创建目录结构和配置文件
8. 通过 `options.context` 调用 index.yaml 中定义的 agent
9. 传入 message："为当前项目生成 {language} 语言文档"
10. 进入对话模式

## 核心能力

### 1. 目录状态检测

- 检测当前目录是否为 git 仓库（`.git/` 目录存在）
- 检测当前目录是否为空目录
- 检测 `.docsmith/` 是否已存在（避免重复初始化）

### 2. 用户交互

通过 `askUserQuestion` 工具询问：
- 文档语言选择（中文/英文/日文等）
- Git 仓库地址（独立启动时）

### 3. 目录结构创建

项目内启动创建的结构：
```
.docsmith/
├── config.yaml          # 工作空间配置
├── intent/              # 意图文件目录
├── planning/            # 规划文件目录
└── docs/                # 生成的文档目录
```

独立启动创建的结构：
```
./                       # 当前目录
├── .git/
├── .gitignore           # 忽略 source/
├── config.yaml          # 工作空间配置
├── source/              # 克隆的源仓库（被 gitignore）
├── intent/
├── planning/
└── docs/
```

### 4. 配置文件生成

```yaml
# config.yaml

# 文档输出语言
language: "zh"  # 用户选择的语言

# 数据源配置
sources:
  # 项目内启动
  - name: "main"
    type: local-path
    path: "../"

  # 独立启动
  - name: "main"
    type: git-clone
    url: "用户提供的 URL"
    ref: "HEAD commit SHA"
    cachePath: "source"
```

### 5. 进入对话模式

通过 `options.context` 调用主 agent：
```javascript
await options.context({
  message: `为当前项目生成 ${language} 语言文档`
});
```

## 输入输出

### 输入

- 自动检测：
  - 当前目录是否为 git 仓库
  - 当前目录是否为空目录
  - `.docsmith/` 是否已存在

- 用户输入（通过交互获取）：
  - 文档语言（必需）
  - Git 仓库地址（独立启动时必需）

### 输出

- 初始化完成的目录结构
- config.yaml 配置文件
- 进入对话模式的 message

## 约束条件

### 必须遵循的规范

1. **语言选择**：只支持选择一种语言
2. **目录结构**：严格遵循定义的目录结构
3. **配置格式**：config.yaml 遵循统一的 schema

### 职责边界

- **必须执行**：
  - 检测当前目录状态
  - 创建目录结构和配置文件
  - 询问用户必要信息
  - 调用主 agent 进入对话模式

- **不应执行**：
  - 不生成文档内容（交给主 agent）
  - 不创建远程仓库
  - 不推送到远程

## 预期结果

### 成功标准

1. 正确检测目录状态并选择对应流程
2. 用户交互流畅，问题清晰
3. 目录结构和配置文件正确创建
4. 成功进入对话模式，message 正确传递

## 错误处理

### 常见错误

1. **目录状态不明确**：既不是 git 仓库也不是空目录
2. **git clone 失败**：URL 无效或网络问题
3. **权限问题**：无法创建目录或文件

### 处理策略

1. **目录状态不明确**：提示用户在 git 仓库或空目录中运行
2. **clone 失败**：提示检查 URL 和网络，支持重试
3. **权限问题**：提示检查目录权限

## 实现方式

### 1. 创建 init.mjs

在 `skills-entry/doc-smith/` 下创建 `init.mjs` function agent。

### 2. 注册到 index.yaml

在 index.yaml 的 skills 中添加 init agent，并配置为启动时执行。

### 3. 使用的工具

- `askUserQuestion`：用户交互
- `options.context`：调用主 agent
- Node.js fs API：文件操作
- Node.js child_process：执行 git 命令

---

**注意**：本文档描述功能意图，不包含具体实现细节。
