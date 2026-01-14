# Sources 图片绝对路径 - 实施规划

## 实施步骤

### 第一步：创建路径解析工具

> 此步骤无需 intent 文档，直接创建工具函数。

**新建文件**：`utils/sources-path-resolver.mjs`

**功能**：
1. `isSourcesAbsolutePath(imagePath)` - 判断是否为 `/sources/...` 绝对路径
2. `parseSourcesPath(absolutePath)` - 解析路径，返回相对路径部分
3. `resolveSourcesPath(absolutePath, sourcesConfig)` - 在各 source 中查找图片，返回物理路径

**实现逻辑**：

```javascript
// 判断是否为 sources 绝对路径
function isSourcesAbsolutePath(imagePath) {
  return imagePath.startsWith('/sources/');
}

// 解析路径，提取相对路径部分
function parseSourcesPath(absolutePath) {
  // /sources/assets/screenshot.png → assets/screenshot.png
  const match = absolutePath.match(/^\/sources\/(.+)$/);
  if (!match) return null;
  return match[1];
}

// 在各 source 中查找图片，返回物理路径
async function resolveSourcesPath(absolutePath, sourcesConfig, workspaceBase) {
  const relativePath = parseSourcesPath(absolutePath);
  if (!relativePath) return null;

  // 依次在每个 source 中查找
  for (const source of sourcesConfig) {
    let physicalPath;

    if (source.type === 'local-path') {
      physicalPath = path.resolve(workspaceBase, source.path, relativePath);
    } else if (source.type === 'git-clone') {
      physicalPath = path.resolve(workspaceBase, 'sources', source.name, relativePath);
    } else {
      continue;
    }

    // 检查文件是否存在
    if (await fs.pathExists(physicalPath)) {
      return { physicalPath, sourceName: source.name };
    }
  }

  return null;
}
```

---

### 第二步：更新 content-checker intent 文档

> **前置条件**：在修改代码前，先更新 intent 文档并获得用户确认。

**操作**：
1. 检查 `agents/content-checker/ai/intent.md` 是否存在
2. 如存在，更新到最新状态，补充本次变更（支持 `/sources/...` 绝对路径检查）
3. 如不存在，分析当前功能并创建 intent 文档
4. **等待用户确认后**，再进行第三步的代码修改

**intent 文档需包含**：
- 当前功能：文档内容校验（文件存在性、链接、图片等）
- 本次变更：支持 `/sources/...` 绝对路径的图片校验
- 路径解析逻辑：依次在各 source 中查找图片

---

### 第三步：更新 content-checker 代码

**修改文件**：`agents/content-checker/validate-content.mjs`

**修改位置**：`validateLocalImage` 方法

**修改内容**：

1. 导入新工具和配置加载函数
2. 在 `validateLocalImage` 中添加对 `/sources/...` 路径的处理
3. 加载 config.yaml 获取 sources 配置
4. 调用 `resolveSourcesPath` 在各 source 中查找图片

---

### 第四步：创建 publish 功能 intent 文档

> **前置条件**：在修改代码前，先创建 intent 文档并获得用户确认。

**操作**：
1. 分析 `agents/publish/publish-docs.mjs` 和 `utils/docs-converter.mjs` 的当前功能
2. 创建 `agents/publish/ai/intent.md`，描述完整的发布流程
3. 在 intent 中包含本次变更（处理 `/sources/...` 绝对路径图片）
4. **等待用户确认后**，再进行第五步的代码修改

**intent 文档需包含**：
- 当前功能：文档发布流程（转换格式、复制到临时目录、上传等）
- docs-converter 职责：文档格式转换、图片路径处理、AFS slot 替换
- 本次变更：处理 `/sources/...` 绝对路径，复制源图片并转换为相对路径

---

### 第五步：更新 docs-converter 代码

**修改文件**：`utils/docs-converter.mjs`

**新增功能**：处理 `/sources/...` 绝对路径的图片

**修改内容**：

1. 新增 `processSourcesImages` 函数
2. 在 `copyDocumentsToTemp` 中调用该函数
3. 查找并复制源图片到临时目录
4. 替换文档中的绝对路径为相对路径

---

### 第六步：更新文档规范

#### 6.1 更新 `skills/doc-smith-docs-detail/SKILL.md`

**修改位置**：「4. 媒体资源前置准备」章节

**删除内容**：
- 「4.3 相对路径计算规则」整个小节

**新增内容**：

```markdown
#### 4.3 图片路径格式

**sources 中的图片使用绝对路径**：

对于数据源中的图片，使用 `/sources/` 开头的绝对路径格式：

```
/sources/<path-to-image>
```

**示例**：
- 执行层看到的图片路径：`modules/sources/assets/run/screenshot.png`
- 文档中引用：`![截图](/sources/assets/run/screenshot.png)`

**注意**：
- 直接使用在 sources 目录下看到的路径
- 不需要计算相对路径层级，统一使用绝对路径
- 路径区分大小写
- 检查和发布阶段会自动解析并处理图片路径
```

#### 6.2 更新 `skills/doc-smith/references/document-content-guide.md`

**修改位置**：「媒体资源」→「前置准备：确定文档和媒体的位置关系」

**删除内容**：
- 「3. 相对路径计算规则」整个小节

**新增内容**：同 6.1

---

## 实施顺序

1. ✅ 创建设计文档（本文档）
2. ✅ 创建 `utils/sources-path-resolver.mjs`
3. ✅ 更新 `agents/content-checker/ai/intent.md` → 用户已确认
4. ✅ 更新 `agents/content-checker/validate-content.mjs`
5. ✅ 创建 `agents/publish/ai/intent.md` → 用户已确认
6. ✅ 更新 `utils/docs-converter.mjs`
7. ✅ 更新 `skills/doc-smith-docs-detail/SKILL.md`
8. ✅ 更新 `skills/doc-smith/references/document-content-guide.md`
