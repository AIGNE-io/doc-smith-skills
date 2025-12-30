# Workspace 初始化流程

**用途**: 本文档定义 DocSmith workspace 的检测和初始化流程

---

## 一、检测当前目录状态

### 使用 Bash 工具检查
```bash
ls -la
```

### 判断逻辑

#### 情况 1: 已初始化 ✅
**特征**: 存在以下文件/目录
- `config.yaml`
- `intent/`
- `planning/`
- `docs/`
- `sources/`

**操作**: 跳过初始化,直接进入后续流程

#### 情况 2: 空目录 ⚙️
**特征**: 目录为空或仅包含隐藏文件 (如 `.git`)

**操作**: 执行初始化流程 (见第二节)

#### 情况 3: 非空且未初始化 ⚠️
**特征**: 目录包含文件,但不是已初始化的 workspace

**操作**: 提示用户并停止
```
⚠️ 当前目录不是空目录,也未初始化为 workspace。

建议:
1. cd 到空目录并重新执行
2. 或者创建新目录: mkdir my-workspace && cd my-workspace
3. 或者清空当前目录后重新执行

Doc Smith 需要在独立的 workspace 目录中工作,以避免污染源仓库。
```

---

## 二、执行初始化流程

**前提**: 仅在空目录时执行

### 2.1 收集必要信息

#### 信息 1: 输出语言 (必须)
- 如果用户在请求中已指定语言 (如 "生成中文文档") → 直接使用
- 否则询问用户:
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
  4. 其他 (请输入语言代码)
  ```

#### 信息 2: 源仓库 URL (必须)
询问用户:
```
请提供源代码仓库的 Git URL
示例: https://github.com/user/repo.git
```

**验证 URL 格式**:
- 检查是否包含 `.git` 或符合 git URL 格式
- 如果格式不对,重新询问

#### 信息 3: 项目名称 (可选,可从 URL 推断)
- 从 URL 提取项目名 (如: `https://github.com/user/my-project.git` → `my-project`)
- 或询问用户: "项目名称是什么? (用于显示,可留空)"

---

### 2.2 创建目录结构

使用 Bash 工具执行:
```bash
# 1. 初始化 Git (如果当前目录未初始化)
git init

# 2. 创建目录结构
mkdir -p intent planning docs cache sources

# 3. 创建 .gitignore
cat > .gitignore << 'EOF'
# Workspace gitignore
cache/
.tmp/
node_modules/
EOF
```

---

### 2.3 添加源仓库为 Submodule

**从 URL 提取项目名**:
```bash
# 示例: https://github.com/user/my-project.git → my-project
# 提取逻辑: 取最后一个 / 之后,.git 之前的部分
```

**添加 submodule**:
```bash
git submodule add <源仓库URL> sources/<项目名>
git submodule update --init --recursive
```

**如果添加失败**:
- 提示用户检查 URL 是否正确
- 提示用户检查是否有 git 访问权限
- 询问是否继续 (不添加 submodule,仅创建目录结构)

---

### 2.4 生成 config.yaml

**使用 Write 工具创建 `config.yaml`**:
```yaml
# Workspace metadata
workspaceVersion: "1.0"
createdAt: "<当前时间戳 ISO 8601 格式>"

# Project information
projectName: "<从URL推断或用户输入的项目名>"
projectDesc: "<从仓库信息中分析>"
locale: "<用户选择的语言代码>"

# Source repository (as git submodule)
source:
  type: "git-submodule"
  path: "sources/<项目名>"
  url: "<源仓库URL>"
  branch: "main"

# Documentation settings (for publish)
projectLogo: ""
translateLanguages: []
```

**字段说明**:
- `workspaceVersion`: 固定为 "1.0"
- `createdAt`: 使用当前时间,格式如 "2025-12-30T10:00:00Z"
- `projectName`: 从 URL 推断或用户输入
- `locale`: 用户选择的语言代码 (zh/en/ja...)
- `source.path`: submodule 路径
- `source.url`: 源仓库 URL
- `source.branch`: 默认 "main",可后续修改

---

### 2.5 初次 Git 提交

```bash
git add .
git commit -m "docsmith: initialize workspace"
```

**如果提交失败**:
- 检查 git 配置 (user.name, user.email)
- 提示用户: "请先配置 git: git config user.name 'Your Name'"
- 询问是否跳过提交 (仅创建文件,不提交)

---

### 2.6 展示初始化结果

输出以下信息:
```
✓ Workspace 初始化完成

目录结构:
  config.yaml              - Workspace 配置
  sources/<项目名>/        - 源代码 (git submodule)
  intent/                  - 用户意图 (待生成)
  planning/                - 文档结构规划 (待生成)
  docs/                    - 生成的文档 (待生成)
  cache/                   - 临时数据 (不提交)

输出语言: <语言>
源仓库: <URL>

下一步将分析源代码并生成文档...
```

---

## 三、验证已初始化的 Workspace

**适用场景**: 当检测到 workspace 已初始化时

### 3.1 读取并验证 config.yaml

使用 Read 工具读取 `config.yaml`,验证必要字段:
- `workspaceVersion`: 必须存在
- `locale`: 必须存在
- `source.url`: 必须存在
- `source.path`: 必须存在

**如果字段缺失**:
- 提示用户: "config.yaml 缺少必要字段: <字段名>"
- 询问是否重新初始化

### 3.2 更新 Submodule (可选)

**询问用户**:
```
是否更新源仓库到最新版本? (Y/n)
```

**如果用户选择 Yes**:
```bash
git submodule update --remote sources/<项目名>
```

**如果用户选择 No**:
- 跳过更新,使用当前版本

---

## 四、错误处理

### 错误 1: Git 未安装
**症状**: `git` 命令不存在

**提示**:
```
错误: 未检测到 Git

DocSmith 需要 Git 来管理 workspace 和源仓库。
请先安装 Git: https://git-scm.com/downloads
```

### 错误 2: Submodule 添加失败
**症状**: `git submodule add` 失败

**提示**:
```
错误: 无法添加源仓库为 submodule

可能原因:
1. URL 不正确或无法访问
2. 没有 git 访问权限
3. 网络连接问题

建议:
1. 检查 URL 是否正确
2. 检查是否有访问权限 (SSH key 或 token)
3. 尝试手动 clone: git clone <URL>

是否跳过 submodule,仅创建目录结构? (Y/n)
```

### 错误 3: 目录权限问题
**症状**: 无法创建目录或文件

**提示**:
```
错误: 没有目录写入权限

请检查当前目录的权限设置,确保有读写权限。
```

### 错误 4: config.yaml 格式错误
**症状**: YAML 解析失败

**提示**:
```
错误: config.yaml 格式不正确

请检查 YAML 语法,或删除 config.yaml 重新初始化。
```

---

## 五、关键约束

1. **空目录要求**: 初始化必须在空目录或已初始化的 workspace 进行
2. **Git 依赖**: 必须安装 Git >= 2.13
3. **独立目录**: Workspace 必须是独立目录,不能在源仓库内
4. **Submodule**: 源仓库作为 git submodule 管理,不污染 workspace

---

## 六、完整流程示意图

```
开始
  ↓
检测当前目录
  ↓
├─ 已初始化? → 验证配置 → 继续
├─ 空目录? → 执行初始化 → 继续
└─ 非空未初始化? → 提示用户 → 停止

初始化流程:
  收集信息 (语言, 源仓库URL)
    ↓
  创建目录结构
    ↓
  添加 submodule
    ↓
  生成 config.yaml
    ↓
  Git commit
    ↓
  展示结果
```
