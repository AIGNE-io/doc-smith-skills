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
7. 通过 `options.context.invoke()` 调用主 agent，传入初始化 message
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
9. 通过 `options.context.invoke()` 调用主 agent，传入初始化 message
10. 返回，进入对话模式

### 流程 C：已初始化

**触发条件**：`.docsmith/` 或 `config.yaml` 已存在

**步骤**：
1. 读取现有配置
2. 直接通过 `options.context.invoke()` 调用主 agent
3. 返回，进入对话模式

## 核心能力

### 1. 目录状态检测

```javascript
import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

// 检测是否为 git 仓库
async function isGitRepo(dir) {
  try {
    await access(join(dir, '.git'), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// 检测是否为空目录
async function isEmptyDir(dir) {
  const files = await readdir(dir);
  return files.length === 0;
}

// 检测 workspace 是否已初始化
async function isInitialized(dir) {
  try {
    // 检查项目内模式
    await access(join(dir, '.docsmith', 'config.yaml'), constants.F_OK);
    return 'project';
  } catch {
    try {
      // 检查独立模式
      await access(join(dir, 'config.yaml'), constants.F_OK);
      return 'standalone';
    } catch {
      return false;
    }
  }
}
```

### 2. 用户交互

使用 Node.js readline 或第三方库（如 inquirer）实现交互：

```javascript
import readline from 'node:readline';

// 语言选择
async function selectLanguage() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n请选择文档语言：');
  SUPPORTED_LANGUAGES.forEach((lang, index) => {
    console.log(`  ${index + 1}. ${lang.name} (${lang.code})`);
  });

  return new Promise((resolve) => {
    rl.question('\n请输入数字选择 [1]: ', (answer) => {
      rl.close();
      const index = parseInt(answer || '1', 10) - 1;
      resolve(SUPPORTED_LANGUAGES[index] || SUPPORTED_LANGUAGES[0]);
    });
  });
}

// 输入 URL
async function inputRepoUrl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('请输入 Git 仓库地址: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
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

### 4. 目录结构创建

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

```javascript
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function createWorkspaceStructure(baseDir) {
  const dirs = ['intent', 'planning', 'docs'];
  for (const dir of dirs) {
    await mkdir(join(baseDir, dir), { recursive: true });
  }
}
```

### 5. 配置文件生成

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

```javascript
import { stringify as yamlStringify } from 'yaml';

function generateConfig(language, sourceConfig) {
  const config = {
    language: language.code,
    sources: [sourceConfig],
  };
  return yamlStringify(config);
}
```

### 6. Git 操作

```javascript
import { execSync } from 'node:child_process';

// git init
function gitInit(dir) {
  execSync('git init', { cwd: dir, stdio: 'inherit' });
}

// git clone
function gitClone(url, targetDir) {
  execSync(`git clone "${url}" "${targetDir}"`, { stdio: 'inherit' });
}

// 获取 HEAD commit SHA
function getHeadSha(dir) {
  return execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim();
}

// 添加 submodule
function addSubmodule(parentDir, submodulePath) {
  execSync(`git submodule add "./${submodulePath}"`, { cwd: parentDir, stdio: 'inherit' });
}
```

### 7. 调用主 Agent 进入对话模式

使用 AIGNE 框架提供的 `options.context.invoke()` API：

```javascript
export default async function init(input, options) {
  // ... 初始化逻辑 ...

  // 获取主 agent（index.yaml 中定义的）
  const mainAgent = options.context?.agents?.['doc-smith'];

  // 调用主 agent 进入对话模式
  await options.context.invoke(mainAgent, {
    message: `为当前项目生成 ${language.name} 语言文档`,
  });

  return {
    success: true,
    message: '工作空间初始化完成，已进入对话模式',
  };
}
```

## 输入输出

### 输入

Function Agent 标准输入：
- `input`：调用参数（本场景可为空）
- `options.context`：AIGNE 上下文对象
  - `options.context.agents`：可用的 agent 字典
  - `options.context.invoke(agent, params)`：调用 agent 的方法
  - `options.context.userContext`：用户上下文，可存储全局状态

### 输出

```javascript
// 成功
{
  success: true,
  language: 'zh',
  mode: 'project' | 'standalone',
  message: '工作空间初始化完成'
}

// 失败
{
  success: false,
  error: 'ERROR_CODE',
  message: '错误描述'
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

init.description = 'Initialize DocSmith workspace and enter documentation generation mode';

init.input_schema = {
  type: 'object',
  properties: {},
};
```

### 注册到 aigne.yaml

在 `aigne.yaml` 的 cli.agents 配置中，将 init.mjs 设置为 doc-smith 的入口：

```yaml
cli:
  agents:
    - name: doc-smith
      alias: ["create", "gen", "g"]
      url: skills-entry/doc-smith/init.mjs  # 改为 init.mjs
```

或者在 index.yaml 中配置 init 为启动时执行的 agent。

---

**注意**：本文档描述功能意图，具体实现为 JS 代码。
