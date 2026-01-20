# Workspace 初始化流程

**用途**: 本文档定义 DocSmith workspace 的验证和数据源管理流程

---

## 一、Workspace 模式

DocSmith 支持两种工作模式，根据用户执行位置自动判断：

### Project 模式（推荐）

**判断条件**：当前目录是 git 仓库

**目录结构**：
```
my-project/                    # 用户的项目目录（cwd）
├── .aigne/
│   └── doc-smith/            # DocSmith workspace
│       ├── config.yaml       # 配置文件
│       ├── intent/           # 意图文件
│       │   └── user-intent.md
│       ├── planning/         # 规划文件
│       │   └── document-structure.yaml
│       ├── docs/             # 生成的文档
│       ├── assets/           # 生成的图片资源
│       └── cache/            # 缓存数据
│           └── task_plan.md
├── src/                       # 项目源代码（数据源）
├── README.md
└── ...
```

**数据源**：项目本身，通过相对路径 `../../` 访问

### Standalone 模式

**判断条件**：当前目录不是 git 仓库

**目录结构**：
```
doc-workspace/                 # 用户创建的工作目录（cwd）
├── config.yaml               # 配置文件
├── intent/                   # 意图文件
├── planning/                 # 规划文件
├── docs/                     # 生成的文档
├── assets/                   # 生成的图片资源
├── cache/                    # 缓存数据
└── sources/                  # 克隆的数据源
    └── cloned-repo/
```

**数据源**：需要克隆到 `sources/` 目录

---

## 二、Workspace 检测流程

### 步骤 1: 检测当前目录状态

```bash
# 检查是否在 git 仓库中
git rev-parse --is-inside-work-tree
```

### 步骤 2: 判断 workspace 是否已存在

**Project 模式检查**：
```bash
ls .aigne/doc-smith/config.yaml
```

**Standalone 模式检查**：
```bash
ls config.yaml
```

### 步骤 3: 根据检测结果处理

| 检测结果 | 处理方式 |
|---------|---------|
| workspace 已存在 | 直接使用，验证配置完整性 |
| 在 git 仓库中，无 workspace | 初始化 Project 模式 |
| 不在 git 仓库中，无 workspace | 初始化 Standalone 模式 |

---

## 三、初始化 Project 模式

当用户在 git 仓库中执行且 `.aigne/doc-smith` 不存在时：

### 步骤 1: 创建目录结构

```bash
mkdir -p .aigne/doc-smith/{intent,planning,docs,assets,cache}
```

### 步骤 2: 在 workspace 中初始化 git

```bash
cd .aigne/doc-smith
git init
```

### 步骤 3: 创建 .gitignore

在 `.aigne/doc-smith/.gitignore` 中写入：

```
# Ignore temporary files
.tmp/
.temp/
temp/
```

### 步骤 4: 获取项目 git 信息

```bash
# 回到项目根目录
cd ../..

# 获取远程 URL
git remote get-url origin

# 获取当前分支
git branch --show-current

# 获取当前 commit
git rev-parse --short HEAD
```

### 步骤 5: 创建 config.yaml

在 `.aigne/doc-smith/config.yaml` 中写入：

```yaml
# Workspace metadata
workspaceVersion: "1.0"
createdAt: "<current-timestamp>"  # ISO 8601 格式

# Project information (待分析后填充)
projectName: ""
projectDesc: ""
locale: ""

# Documentation settings
projectLogo: ""
translateLanguages: []

# 数据源配置
sources:
  - type: local-path
    path: "../../"
    url: "<git-remote-url>"      # 如果有
    branch: "<current-branch>"
    commit: "<current-commit>"
```

### 步骤 6: 创建初始提交

```bash
cd .aigne/doc-smith
git add .
git commit -m "Initial commit: doc-smith workspace"
```

### 步骤 7: 更新主项目 .gitignore（可选）

询问用户是否将 `.aigne/doc-smith` 添加到主项目的 `.gitignore`。

---

## 四、初始化 Standalone 模式

当用户在非 git 目录中执行时：

### 步骤 1: 创建目录结构

```bash
mkdir -p intent planning docs assets cache sources
```

### 步骤 2: 初始化 git

```bash
git init
```

### 步骤 3: 创建 .gitignore

```
# Ignore sources directory
sources/

# Ignore temporary files
.tmp/
.temp/
temp/
```

### 步骤 4: 创建 config.yaml

```yaml
# Workspace metadata
workspaceVersion: "1.0"
createdAt: "<current-timestamp>"

# Project information (待填充)
projectName: ""
projectDesc: ""
locale: ""

# Documentation settings
projectLogo: ""
translateLanguages: []

# 数据源配置（待添加）
sources: []
```

### 步骤 5: 询问数据源

```
请提供源代码仓库的 Git URL
示例: https://github.com/user/repo.git
```

### 步骤 6: 克隆数据源

```bash
git clone -b <branch> <url> sources/<project-name>
cd sources/<project-name>
git rev-parse HEAD  # 获取 commit hash
```

### 步骤 7: 更新 config.yaml

添加数据源配置到 sources 数组。

---

## 五、Config.yaml Schema

```yaml
# Workspace metadata
workspaceVersion: "1.0"        # 固定版本号
createdAt: "2025-01-13T10:00:00Z"

# Project information
projectName: "my-project"      # 项目名称
projectDesc: "项目描述"         # 项目描述
locale: "zh"                   # 输出语言代码

# Documentation settings
projectLogo: ""                # 项目 Logo 路径
translateLanguages: []         # 翻译目标语言列表

# 数据源配置
sources:
  # local-path 类型（Project 模式）
  - type: local-path
    path: "../../"             # 相对于 workspace 的路径
    url: "https://..."         # 可选，git 远程 URL
    branch: "main"             # 可选，当前分支
    commit: "a1b2c3d"          # 可选，当前 commit

  # git-clone 类型（Standalone 模式）
  - name: "aigne-framework"
    type: git-clone
    url: "https://github.com/ArcBlock/aigne-framework.git"
    branch: "main"
    commit: "a1b2c3d4e5f6789"
    clonedAt: "2025-01-13T10:00:00Z"
```

---

## 六、收集必要信息

在 workspace 初始化或检测后，检查并收集以下信息：

### 6.1 输出语言 (locale)

**检查条件**：config.yaml 中 `locale` 为空

**处理逻辑**：
- 如果用户在请求中已指定语言（如"生成中文文档"）→ 直接使用
- 否则询问用户选择

**询问用户**：
```
请选择文档输出语言:
1. 简体中文 (zh)
2. English (en)
3. 繁體中文 (zh-TW)
4. 日本語 (ja)
5. 其他 (请输入语言代码)
```

### 6.2 项目信息

**检查条件**：`projectName` 或 `projectDesc` 为空

**处理逻辑**：
1. 分析数据源（README、package.json 等）
2. 推断项目名称和描述
3. 使用 `locale` 指定的语言生成描述
4. 保存到 config.yaml

---

## 七、验证 Workspace 完整性

### 7.1 配置完整性检查

读取 config.yaml，验证必要字段：

**必须存在**：
- `workspaceVersion`
- `sources`（至少一个数据源）

**可为空但需收集**：
- `projectName`
- `projectDesc`
- `locale`

### 7.2 数据源有效性检查

**local-path 类型**：
- 检查相对路径指向的目录是否存在
- 检查是否包含有效的项目文件

**git-clone 类型**：
- 检查 `sources/<name>/` 目录是否存在
- 不存在则执行恢复流程

---

## 八、数据源恢复

**触发条件**：git-clone 类型的数据源目录不存在

**步骤**：
1. 读取 config.yaml 中的 url、branch、commit
2. 克隆仓库：`git clone -b <branch> <url> sources/<name>`
3. 切换到记录的 commit：`git checkout <commit>`
4. 提示用户恢复完成

---

## 九、路径映射

在生成文档时，需要正确映射路径：

### Project 模式

| 概念 | 实际路径 |
|------|---------|
| workspace 根目录 | `.aigne/doc-smith/` |
| config.yaml | `.aigne/doc-smith/config.yaml` |
| 文档目录 | `.aigne/doc-smith/docs/` |
| 数据源根目录 | `./`（项目根目录） |
| 数据源中的文件 | 相对于项目根目录的路径 |

### Standalone 模式

| 概念 | 实际路径 |
|------|---------|
| workspace 根目录 | `./`（当前目录） |
| config.yaml | `./config.yaml` |
| 文档目录 | `./docs/` |
| 数据源根目录 | `./sources/<name>/` |
| 数据源中的文件 | 相对于 sources 目录的路径 |

---

## 十、错误处理

### 错误 1: Git 未安装

```
错误: 未检测到 Git

DocSmith 需要 Git 来管理版本。
请先安装 Git: https://git-scm.com/downloads
```

### 错误 2: 数据源克隆失败

```
错误: 无法克隆数据源

可能原因:
1. URL 不正确或无法访问
2. 没有 git 访问权限
3. 网络连接问题

建议:
1. 检查 URL 是否正确
2. 检查是否有访问权限
```

### 错误 3: config.yaml 格式错误

```
错误: config.yaml 格式不正确

请检查 YAML 语法，或删除 config.yaml 重新初始化。
```

---

## 十一、完整流程示意图

```
用户执行 /doc-smith
  ↓
检查 git rev-parse --is-inside-work-tree
  ├─ 成功 (是 git 仓库) → 检查 .aigne/doc-smith/config.yaml
  │   ├─ 存在 → Project 模式，验证配置
  │   └─ 不存在 → 初始化 Project 模式
  │
  └─ 失败 (非 git 仓库) → 检查 ./config.yaml
      ├─ 存在 → Standalone 模式，验证配置
      └─ 不存在 → 初始化 Standalone 模式
  ↓
收集必要信息 (locale, projectName, projectDesc)
  ↓
验证数据源有效性
  ↓
进入文档生成流程
```
