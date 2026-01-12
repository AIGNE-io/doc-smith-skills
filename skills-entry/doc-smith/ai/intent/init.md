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
├─ .docsmith/ 已存在且有效 → 直接进入对话模式
├─ 是 git 仓库（无 .docsmith/）→ 项目内启动流程
├─ 是空目录 → 独立启动流程
└─ 其他情况 → 报错提示
```

### 流程 A：项目内启动

**触发条件**：当前目录是 git 仓库，且 `.docsmith/` 不存在

**步骤**：
1. 向用户展示语言选择列表，等待用户选择
2. 创建 `.docsmith/` 目录
3. 在 `.docsmith/` 中执行 `git init`
4. 创建目录结构（intent/、planning/、docs/）
5. 生成 config.yaml
6. 检测外层目录是否为 git 仓库
   - 是 → 将 `.docsmith/` 添加为 submodule
   - 否 → 跳过 submodule 步骤
7. 通过 `options.context` 调用主 agent，传入初始化 message
8. 返回，进入对话模式

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
9. 通过 `options.context` 调用主 agent，传入初始化 message
10. 返回，进入对话模式

### 流程 C：已初始化

**触发条件**：`.docsmith/` 或 `config.yaml` 已存在

**步骤**：
1. 读取现有配置
2. 直接通过 `options.context` 调用主 agent
3. 返回，进入对话模式

## 核心能力

### 1. 目录状态检测（JS 实现）

```javascript
// 检测是否为 git 仓库
async function isGitRepo(dir) {
  // 检查 .git 目录是否存在
}

// 检测是否为空目录
async function isEmptyDir(dir) {
  // 读取目录内容，判断是否为空
}

// 检测 workspace 是否已初始化
async function isInitialized(dir) {
  // 检查 .docsmith/config.yaml 或 ./config.yaml 是否存在
}
```

### 2. 用户交互（JS 实现）

使用 AIGNE 提供的交互能力或 Node.js readline 实现：

```javascript
// 语言选择
async function selectLanguage() {
  // 展示选项列表，返回用户选择的语言代码
}

// 输入 URL
async function inputRepoUrl() {
  // 提示用户输入，返回 URL 字符串
}
```

### 3. 支持的语言选项

```javascript
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'it', name: 'Italiano' },
  { code: 'ar', name: 'العربية' },
];
```

### 4. 目录结构创建（JS 实现）

项目内启动创建的结构：
```
.docsmith/
├── .git/                # 独立 git 仓库
├── config.yaml          # 工作空间配置
├── intent/              # 意图文件目录
├── planning/            # 规划文件目录
└── docs/                # 生成的文档目录
```

独立启动创建的结构：
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

### 5. 配置文件生成（JS 实现）

```yaml
# config.yaml

# 文档输出语言
language: "zh"

# 数据源配置
sources:
  # 项目内启动
  - name: "main"
    type: local-path
    path: "../"

  # 独立启动
  - name: "main"
    type: git-clone
    url: "https://github.com/user/repo.git"
    ref: "abc123def"  # HEAD commit SHA
    cachePath: "source"
```

### 6. Git 操作（JS 实现）

```javascript
// 使用 child_process 执行 git 命令
import { execSync, exec } from 'child_process';

// git init
function gitInit(dir) {
  execSync('git init', { cwd: dir });
}

// git clone
function gitClone(url, targetDir) {
  execSync(`git clone ${url} ${targetDir}`);
}

// 获取 HEAD commit SHA
function getHeadSha(dir) {
  return execSync('git rev-parse HEAD', { cwd: dir }).toString().trim();
}

// 添加 submodule
function addSubmodule(parentDir, submoduleDir) {
  execSync(`git submodule add ./${submoduleDir}`, { cwd: parentDir });
}
```

### 7. 进入对话模式（JS 实现）

```javascript
// 通过 options.context 调用主 agent
await options.context({
  message: `为当前项目生成 ${languageName} 语言文档`
});
```

## 输入输出

### 输入

Function Agent 标准输入：
- `options.context`：调用主 agent 的能力
- `options.cwd`：当前工作目录

### 输出

```javascript
// 成功
{
  success: true,
  message: "工作空间初始化完成，已进入对话模式"
}

// 失败
{
  success: false,
  message: "错误描述"
}
```

## 约束条件

### 必须遵循的规范

1. **纯 JS 实现**：所有逻辑通过 JS 代码实现，不依赖 LLM 能力
2. **语言单选**：只支持选择一种语言
3. **目录结构**：严格遵循定义的目录结构
4. **配置格式**：config.yaml 遵循统一的 schema

### 职责边界

- **必须执行**：
  - 检测当前目录状态
  - 与用户交互获取必要信息
  - 创建目录结构和配置文件
  - 执行必要的 git 操作
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
5. 成功调用主 agent 进入对话模式

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

### 函数签名

```javascript
// init.mjs
export default async function init(input, options) {
  // 实现逻辑
}

init.description = "Initialize DocSmith workspace";
init.input_schema = {
  type: "object",
  properties: {}
};
```

### 注册到 index.yaml

```yaml
skills:
  - ./init.mjs  # 添加 init agent
  # ... 其他 skills
```

---

**注意**：本文档描述功能意图，具体实现为 JS 代码。
