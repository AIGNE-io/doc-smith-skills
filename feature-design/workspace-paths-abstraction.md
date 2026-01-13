# Workspace 路径抽象方案

## 背景

由于 DocSmith 现在支持两种启动模式（project 和 standalone），workspace 的实际物理路径会根据模式不同而变化：

| 模式 | workspace 物理路径 | sources 物理路径 |
|------|-------------------|-----------------|
| project | `${CWD}/.aigne/doc-smith/` | `${CWD}` |
| standalone | `${CWD}` | `${CWD}/sources/` |

但当前 `agent-constants.mjs` 中的 `PATHS` 定义了硬编码的相对路径，假设 workspace 就是当前工作目录。

## 解决方案

直接修改 `agent-constants.mjs`，让 PATHS 动态导出绝对路径。所有使用 PATHS 的文件无需修改导入方式。

### 实现方案

```javascript
// utils/agent-constants.mjs

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as yamlParse } from "yaml";

/**
 * 检测 workspace 基础路径
 */
function detectWorkspaceBase() {
  const cwd = process.cwd();

  // 检测 config.yaml 位置，确定 workspace 模式
  const projectConfigPath = join(cwd, ".aigne/doc-smith/config.yaml");
  const standaloneConfigPath = join(cwd, "config.yaml");

  if (existsSync(projectConfigPath)) {
    return join(cwd, ".aigne/doc-smith");
  }

  // standalone 模式或未初始化
  return cwd;
}

// 计算 workspace 基础路径
const WORKSPACE_BASE = detectWorkspaceBase();

/**
 * 路径常量定义
 * 所有路径都是基于 workspace 的绝对路径
 */
export const PATHS = {
  // Workspace 根目录
  WORKSPACE_BASE,

  // 临时目录
  TMP_DIR: resolve(WORKSPACE_BASE, ".tmp"),

  // 缓存目录
  CACHE: resolve(WORKSPACE_BASE, "cache"),

  // 文档结构文件
  DOCUMENT_STRUCTURE: resolve(WORKSPACE_BASE, "planning/document-structure.yaml"),

  // 文档目录
  DOCS_DIR: resolve(WORKSPACE_BASE, "docs"),

  // 资源目录（图片等）
  ASSETS_DIR: resolve(WORKSPACE_BASE, "assets"),

  // 配置文件
  CONFIG: resolve(WORKSPACE_BASE, "config.yaml"),

  // 术语表
  GLOSSARY: resolve(WORKSPACE_BASE, "intent/GLOSSARY.md"),

  // 规划目录
  PLANNING_DIR: resolve(WORKSPACE_BASE, "planning"),
};

// ... 其他常量保持不变 (ERROR_CODES, FILE_TYPES, DOC_META_DEFAULTS)
```

### 变更点

| 变更 | 说明 |
|------|------|
| 移除 `DOC_SMITH_DIR: "./"` | 用 `WORKSPACE_BASE` 替代 |
| 所有路径改为绝对路径 | 使用 `resolve(WORKSPACE_BASE, relativePath)` |
| 新增 `detectWorkspaceBase()` | 自动检测 workspace 位置 |

### 对现有代码的影响

**无需修改**：所有使用 `PATHS.XXX` 的代码都无需修改，因为：
- 导入方式不变：`import { PATHS } from "../../utils/agent-constants.mjs"`
- 使用方式不变：`PATHS.DOCS_DIR`、`PATHS.CONFIG` 等
- 只是返回值从相对路径变为绝对路径

**需要检查**：部分代码可能做了 `path.join(process.cwd(), PATHS.XXX)` 的拼接，需要移除多余的 `process.cwd()`。

## 修改清单

### 1. utils/agent-constants.mjs

重构 PATHS 为动态绝对路径（见上方实现方案）。

### 2. utils/config.mjs

```javascript
// 第 13 行，修改前：
const configPath = path.join(process.cwd(), "config.yaml");
// 修改后：
const configPath = PATHS.CONFIG;

// 第 144 行，修改前：
const docSmithDir = path.join(process.cwd());
// 修改后：
const docSmithDir = PATHS.WORKSPACE_BASE;

// 第 149 行，修改前：
const configPath = path.join(docSmithDir, "config.yaml");
// 修改后：
const configPath = PATHS.CONFIG;
```

### 3. utils/files.mjs

```javascript
// 第 63 行，修改前：
const tmpDir = join(process.cwd(), PATHS.DOC_SMITH_DIR, PATHS.TMP_DIR);
// 修改后：
const tmpDir = PATHS.TMP_DIR;
```

### 4. agents/publish/publish-docs.mjs

```javascript
// 第 55 行，修改前：
const docsDir = join(PATHS.DOC_SMITH_DIR, PATHS.TMP_DIR, PATHS.DOCS_DIR);
// 修改后：
const docsDir = join(PATHS.TMP_DIR, "docs");

// 第 227 行，修改前：
const publishCacheFilePath = join(PATHS.DOC_SMITH_DIR, PATHS.CACHE, "upload-cache.yaml");
// 修改后：
const publishCacheFilePath = join(PATHS.CACHE, "upload-cache.yaml");

// 第 315 行，修改前：
const docsDir = join(PATHS.DOC_SMITH_DIR, PATHS.TMP_DIR, PATHS.DOCS_DIR);
// 修改后：
const docsDir = join(PATHS.TMP_DIR, "docs");
```

### 5. agents/publish/translate-meta.mjs

```javascript
// 第 52 行，修改前：
const cacheDir = join(process.cwd(), PATHS.CACHE);
// 修改后：
const cacheDir = PATHS.CACHE;
```

### 不需要修改的文件

| 文件 | 原因 |
|------|------|
| `skills-entry/doc-smith/utils.mjs` | 这里的 `DOC_SMITH_DIR` 是初始化用的常量，与 PATHS 无关 |
| `skills-entry/doc-smith/index.mjs` | 同上 |
| `utils/project.mjs` | `process.cwd()` 用于获取项目名，与 PATHS 无关 |
| `agents/content-checker/validate-content.mjs` | `process.cwd()` 用于相对路径显示，与 PATHS 无关 |

### 验证清单

修改后需要验证的场景：

1. **project 模式**
   - [ ] 保存文档到 `.aigne/doc-smith/docs/`
   - [ ] 读取 `.aigne/doc-smith/config.yaml`
   - [ ] 保存图片到 `.aigne/doc-smith/assets/`

2. **standalone 模式**
   - [ ] 保存文档到 `./docs/`
   - [ ] 读取 `./config.yaml`
   - [ ] 保存图片到 `./assets/`

## 实施步骤

1. 修改 `utils/agent-constants.mjs`
2. 搜索并修改使用 `DOC_SMITH_DIR` 的代码
3. 搜索并移除多余的 `process.cwd()` 拼接
4. 测试两种模式下的文件操作

---

**注意**：本方案一次性完成所有修改，无需新旧并存。
