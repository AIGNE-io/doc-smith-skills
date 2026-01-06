# 多语言文档文件夹结构实施方案

## 一、目标

将文档保存结构从单文件调整为文件夹形式，支持多语言文档管理：

```
docs/
  overview/
    .meta.yaml    # 元信息（kind, source, default）
    zh.md         # 中文版本
```

**设计原则**：
- 首次生成只创建一种语言版本（从 config.yaml 读取 locale）
- 通过 .meta.yaml 记录元信息（文档类型、源语言、默认语言）
- 预留多语言扩展能力（翻译时添加其他语言文件）

---

## 二、新的文档结构

### 2.1 文件夹结构示例

```
docs/
  overview/
    .meta.yaml
    zh.md
  getting-started/
    .meta.yaml
    zh.md
  api/
    authentication/
      .meta.yaml
      zh.md
```

### 2.2 .meta.yaml 格式

```yaml
kind: doc              # 文档类型（固定为 doc）
source: zh             # 源语言（从 config.yaml 的 locale 读取）
default: zh            # 默认展示语言（从 config.yaml 的 locale 读取）
```

**说明**：
- `languages` 字段在翻译时添加，首次生成时省略
- 所有字段都是必需的

### 2.3 document-structure.yaml 调整

**新格式**：
```yaml
documents:
  - title: "概述"
    description: "项目介绍"
    path: "/overview"              # 不带 .md 后缀，指向文件夹
    sourcePaths:
      - "README.md"
    icon: "lucide:home"

  - title: "API 认证"
    path: "/api/authentication"    # 嵌套文件夹路径
    sourcePaths: []
```

**关键变化**：
- `path` 不再以 `.md` 结尾
- `path` 指向文件夹而非文件

---

## 三、影响范围

### 3.1 需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `doc-smith/references/document-structure-schema.md` | 更新 path 字段说明 |
| `doc-smith/references/document-content-guide.md` | 更新文档生成指导、图片路径层级对照表 |
| `doc-smith/SKILL.md` | 更新步骤 6 的文档生成流程 |
| `agents/document-checker/validate-structure.mjs` | 新增 path 格式校验规则 |
| `agents/document-checker/structure-checker.mjs` | 调整 path 格式修复逻辑 |
| `agents/document-checker/validate-content.mjs` | 调整文件存在性检查、新增 .meta.yaml 校验、调整链接和图片路径处理 |

---

## 四、详细实施方案

### 4.1 document-structure-schema.md 修改

**位置**：`doc-smith/references/document-structure-schema.md`

**修改 path 字段说明（第 44-47 行）**：
```markdown
- **path**（必需）：相对于 `docs/` 的文件夹路径
  - 必须以 `/` 开头
  - 不能以 `.md` 结尾（指向文件夹而非文件）
  - 可以包含子目录：`/api/authentication`
  - 实际文件结构：`docs{path}/.meta.yaml` 和 `docs{path}/{language}.md`
```

**更新示例（第 66-92 行）**：
```yaml
# 扁平结构
documents:
  - title: "概述"
    path: "/overview"           # 不带 .md
    sourcePaths: ["README.md"]
    icon: "lucide:home"

# 嵌套结构
documents:
  - title: "核心功能"
    path: "/features"
    icon: "lucide:box"
    children:
      - title: "子功能 A"
        path: "/features/feature-a"
        sourcePaths: []
```

---

### 4.2 document-content-guide.md 修改

**位置**：`doc-smith/references/document-content-guide.md`

**新增第 6 节：文档生成步骤**（插入到第 11 行之前）：
```markdown
## 文档生成步骤

### 6.1 创建文档文件夹

为结构中的每个文档创建文件夹：
- 使用 `path` 字段去掉开头的 `/`
- 使用 Write 工具或 Bash 的 mkdir 创建（包括父目录）

### 6.2 生成 .meta.yaml

在每个文档文件夹中创建 `.meta.yaml`：

```yaml
kind: doc
source: {从 config.yaml 读取 locale}
default: {从 config.yaml 读取 locale}
```

说明：
- 所有文档的 `kind` 固定为 `doc`
- `source` 和 `default` 都设置为 config.yaml 中的 `locale` 值
- `languages` 字段在翻译时添加，首次生成时省略

### 6.3 生成语言版本文件

在每个文档文件夹中创建 `{language}.md` 文件：
- 文件名：使用 config.yaml 中的 `locale`（如 `zh.md`, `en.md`）
- 内容：从 `sourcePaths` 提取信息，编写清晰、结构化的内容

### 6.4 批量执行

优先批量创建文件夹和文件，缩短执行时间。
```

**更新图片路径层级对照表（第 61-65 行）**：
```markdown
**层级对照表：**
- 文档在 `docs/overview/` → 2层（文件夹 + 语言文件）→ `../../`
- 文档在 `docs/api/authentication/` → 3层 → `../../../`
- 规律：文件夹层级 + 1（语言文件在文件夹内）
```

**更新图片路径示例（第 67-70 行）**：
```markdown
**示例：**
- 文档：`docs/getting-started/zh.md`（2层）
- 图片：在 workspace 的 `sources/my-project/assets/screenshot.png`
- 结果：`../../sources/my-project/assets/screenshot.png`
```

---

### 4.3 SKILL.md 修改

**位置**：`doc-smith/SKILL.md`

**替换步骤 6（第 103-106 行）**：
```markdown
### 6. 生成文档内容

为结构中的每个文档在 `docs/` 目录中创建文档文件夹和文件。

#### 6.1 创建文档文件夹

为每个文档创建文件夹（使用 YAML 中的 `path` 字段）：
- 文件夹路径：`docs/` + `path`（去掉开头的 `/`）
- 使用 Write 工具或 Bash 的 mkdir 创建（包括父目录）

#### 6.2 生成 .meta.yaml

在每个文档文件夹中创建 `.meta.yaml`：
```yaml
kind: doc
source: <从 config.yaml 读取 locale>
default: <从 config.yaml 读取 locale>
```

说明：
- 所有文档的 `kind` 固定为 `doc`
- `source` 和 `default` 都设置为 config.yaml 中的 `locale` 值
- `languages` 字段在翻译时添加，首次生成时省略

#### 6.3 生成语言版本文件

在每个文档文件夹中创建 `{language}.md` 文件：
- 文件名：`{config.yaml 中的 locale}.md`（如 `zh.md`, `en.md`）
- 内容：从 `sourcePaths` 提取信息，按照文档内容要求生成
- 详细要求参考：`references/document-content-guide.md`

#### 6.4 批量执行

优先批量执行文件夹和文件创建，缩短执行时间。
```

---

### 4.4 validate-structure.mjs 修改

**位置**：`agents/document-checker/validate-structure.mjs`

**新增 path 格式校验（在 validateDocument 函数中）**：
```javascript
function validateDocument(doc, docPath, errors) {
  // ... 现有校验逻辑 ...

  // 新增：path 格式校验
  if (doc.path) {
    // 必须以 / 开头
    if (!doc.path.startsWith('/')) {
      errors.fixable.push({
        type: 'PATH_FORMAT',
        path: `${docPath}.path`,
        message: 'path 必须以 / 开头',
        expected: `/${doc.path}`,
        fix: 'add_leading_slash'
      });
    }

    // 不能以 .md 结尾
    if (doc.path.endsWith('.md')) {
      errors.fatal.push({
        type: 'PATH_FORMAT',
        path: `${docPath}.path`,
        message: 'path 不应以 .md 结尾（应指向文件夹）',
        current: doc.path,
        expected: doc.path.slice(0, -3),
        suggestion: `将 path 改为 "${doc.path.slice(0, -3)}"`
      });
    }
  }

  // ... 现有校验逻辑 ...
}
```

---

### 4.5 structure-checker.mjs 修改

**位置**：`agents/document-checker/structure-checker.mjs`

**修改 fixPath 方法（第 55-76 行）**：
```javascript
fixPath(pathParts, error) {
  const docPathParts = pathParts.slice(0, -1);
  const doc = this.getDocument(docPathParts);
  if (!doc || !doc.path) return;

  let fixed = false;

  if (error.fix === "add_leading_slash" && !doc.path.startsWith("/")) {
    doc.path = `/${doc.path}`;
    fixed = true;
  }

  // 移除：不再自动添加 .md 后缀
  // if (error.fix === "add_md_extension" && !doc.path.endsWith(".md")) {
  //   doc.path = `${doc.path}.md`;
  //   fixed = true;
  // }

  if (fixed) {
    this.fixCount++;
  }
}
```

---

### 4.6 validate-content.mjs 修改

**位置**：`agents/document-checker/validate-content.mjs`

#### 修改 1：添加导入
```javascript
import { readdir, stat } from 'node:fs/promises';
```

#### 修改 2：validateDocumentFiles 方法（第 104-122 行）

**完全替换为**：
```javascript
async validateDocumentFiles() {
  for (const doc of this.documents) {
    const docFolder = path.join(this.docsDir, doc.filePath);

    // 检查 1: 文件夹存在且是目录
    let folderExists = false;
    try {
      const stats = await stat(docFolder);
      if (!stats.isDirectory()) {
        this.errors.fatal.push({
          type: 'INVALID_DOCUMENT_FOLDER',
          path: doc.path,
          filePath: docFolder,
          message: `路径不是文件夹: ${doc.path}`,
          suggestion: '请确保 path 指向文件夹'
        });
        continue;
      }
      folderExists = true;
    } catch (_error) {
      this.errors.fatal.push({
        type: 'MISSING_DOCUMENT_FOLDER',
        path: doc.path,
        filePath: docFolder,
        message: `文档文件夹缺失: ${doc.path}`,
        suggestion: `请生成此文档文件夹或从 document-structure.yaml 中移除`
      });
      continue;
    }

    // 检查 2: .meta.yaml 存在且格式正确
    if (folderExists) {
      await this.validateMetaFile(docFolder, doc);

      // 检查 3: 至少有一个语言文件
      await this.validateLanguageFiles(docFolder, doc);
    }
  }
}
```

#### 修改 3：新增 validateMetaFile 方法（插入到 validateDocumentFiles 之后）

```javascript
/**
 * 校验 .meta.yaml
 */
async validateMetaFile(docFolder, doc) {
  const metaPath = path.join(docFolder, '.meta.yaml');

  try {
    await access(metaPath, constants.F_OK | constants.R_OK);
  } catch (_error) {
    this.errors.fatal.push({
      type: 'MISSING_META_FILE',
      path: doc.path,
      filePath: metaPath,
      message: `.meta.yaml 缺失: ${doc.path}`,
      suggestion: '请在文档文件夹中创建 .meta.yaml'
    });
    return;
  }

  // 读取并校验内容
  try {
    const content = await readFile(metaPath, 'utf8');
    const meta = yamlParse(content);

    // 必需字段校验
    const requiredFields = ['kind', 'source', 'default'];
    for (const field of requiredFields) {
      if (!meta[field]) {
        this.errors.fatal.push({
          type: 'INVALID_META',
          path: doc.path,
          field,
          message: `.meta.yaml 缺少必需字段 "${field}": ${doc.path}`,
          suggestion: `添加 ${field} 字段到 .meta.yaml`
        });
      }
    }

    // kind 值校验
    if (meta.kind && meta.kind !== 'doc') {
      this.errors.fatal.push({
        type: 'INVALID_META',
        path: doc.path,
        field: 'kind',
        message: `.meta.yaml 的 kind 应为 "doc"，当前为 "${meta.kind}"`,
        suggestion: '修改为 kind: doc'
      });
    }
  } catch (error) {
    this.errors.fatal.push({
      type: 'INVALID_META',
      path: doc.path,
      message: `.meta.yaml 格式错误: ${error.message}`,
      suggestion: '检查 YAML 语法是否正确'
    });
  }
}
```

#### 修改 4：新增 validateLanguageFiles 方法

```javascript
/**
 * 校验语言文件
 */
async validateLanguageFiles(docFolder, doc) {
  try {
    const files = await readdir(docFolder);
    const langFiles = files.filter(f =>
      f.endsWith('.md') &&
      !f.startsWith('.') &&
      /^[a-z]{2}(-[A-Z]{2})?\.md$/.test(f)
    );

    if (langFiles.length === 0) {
      this.errors.fatal.push({
        type: 'MISSING_LANGUAGE_FILE',
        path: doc.path,
        message: `没有语言版本文件: ${doc.path}`,
        suggestion: '请生成至少一个语言版本文件（如 zh.md, en.md）'
      });
      return;
    }

    // 检查 default 和 source 语言文件是否存在
    const metaPath = path.join(docFolder, '.meta.yaml');
    try {
      const metaContent = await readFile(metaPath, 'utf8');
      const meta = yamlParse(metaContent);

      if (meta.default) {
        const defaultFile = `${meta.default}.md`;
        if (!langFiles.includes(defaultFile)) {
          this.errors.fatal.push({
            type: 'MISSING_DEFAULT_LANGUAGE',
            path: doc.path,
            defaultLang: meta.default,
            message: `默认语言文件缺失: ${defaultFile}`,
            suggestion: `生成 ${defaultFile} 或修改 .meta.yaml 中的 default 字段`
          });
        }
      }

      if (meta.source) {
        const sourceFile = `${meta.source}.md`;
        if (!langFiles.includes(sourceFile)) {
          this.errors.fatal.push({
            type: 'MISSING_SOURCE_LANGUAGE',
            path: doc.path,
            sourceLang: meta.source,
            message: `源语言文件缺失: ${sourceFile}`,
            suggestion: `生成 ${sourceFile} 或修改 .meta.yaml 中的 source 字段`
          });
        }
      }
    } catch (_error) {
      // .meta.yaml 错误已在 validateMetaFile 中报告
    }
  } catch (error) {
    this.errors.fatal.push({
      type: 'READ_FOLDER_ERROR',
      path: doc.path,
      message: `无法读取文档文件夹: ${error.message}`
    });
  }
}
```

#### 修改 5：validateDocument 方法（第 126-151 行）

**替换为**：
```javascript
async validateDocument(doc, checkRemoteImages) {
  const docFolder = path.join(this.docsDir, doc.filePath);

  try {
    // 读取 .meta.yaml 获取语言列表
    const metaPath = path.join(docFolder, '.meta.yaml');
    const metaContent = await readFile(metaPath, 'utf8');
    const meta = yamlParse(metaContent);

    // 获取所有语言文件
    const files = await readdir(docFolder);
    const langFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));

    // 检查每个语言版本
    for (const langFile of langFiles) {
      const fullPath = path.join(docFolder, langFile);
      const content = await readFile(fullPath, 'utf8');

      this.stats.checkedDocs++;

      // Layer 2: 内容解析和检查
      this.checkEmptyDocument(content, doc, langFile);
      this.checkHeadingHierarchy(content, doc, langFile);

      // Layer 3: 链接和图片验证
      await this.validateLinks(content, doc, langFile);
      await this.validateImages(content, doc, langFile, checkRemoteImages);
    }
  } catch (error) {
    // 错误已在 Layer 1 报告
  }
}
```

#### 修改 6：checkEmptyDocument 方法签名（第 156 行）

```javascript
checkEmptyDocument(content, doc, langFile) {
  // ... 现有逻辑，错误信息中添加 langFile
}
```

#### 修改 7：checkHeadingHierarchy 方法签名（第 175 行）

```javascript
checkHeadingHierarchy(content, doc, langFile) {
  // ... 现有逻辑，错误信息中添加 langFile
}
```

#### 修改 8：validateLinks 方法签名（第 271 行）

```javascript
async validateLinks(content, doc, langFile) {
  // ... 现有逻辑

  // 修改 validateInternalLink 调用
  await this.validateInternalLink(linkUrl, doc, linkText, langFile);
}
```

#### 修改 9：validateInternalLink 方法（第 305-358 行）

**替换为**：
```javascript
async validateInternalLink(linkUrl, doc, linkText, langFile) {
  let targetPath;

  // 链接预处理：移除语言文件名
  const cleanLinkUrl = linkUrl
    .replace(/\/[a-z]{2}(-[A-Z]{2})?\.md$/, '') // 移除 /zh.md 等
    .replace(/\.md$/, ''); // 移除 .md

  if (cleanLinkUrl.startsWith('/')) {
    targetPath = cleanLinkUrl;
  } else {
    const docDir = path.dirname(doc.path);
    const upLevels = (cleanLinkUrl.match(/\.\.\//g) || []).length;
    const currentDepth = docDir === '/' ? 0 : docDir.split('/').filter(p => p).length;

    if (upLevels > currentDepth) {
      this.stats.brokenLinks++;
      this.errors.fatal.push({
        type: 'BROKEN_LINK',
        path: doc.path,
        langFile,
        link: linkUrl,
        linkText,
        message: `内部链接路径超出根目录: [${linkText}](${linkUrl})`,
        suggestion: `链接向上 ${upLevels} 级，但当前文档只在第 ${currentDepth} 层`
      });
      return;
    }

    targetPath = path.posix.normalize(path.posix.join(docDir, cleanLinkUrl));
    if (!targetPath.startsWith('/')) {
      targetPath = `/${targetPath}`;
    }
  }

  if (!this.documentPaths.has(targetPath)) {
    this.stats.brokenLinks++;
    this.errors.fatal.push({
      type: 'BROKEN_LINK',
      path: doc.path,
      langFile,
      link: linkUrl,
      linkText,
      targetPath,
      message: `内部链接死链: [${linkText}](${linkUrl})`,
      suggestion: `目标文档 ${targetPath} 不存在`
    });
  }
}
```

#### 修改 10：validateImages 方法签名（第 363 行）

```javascript
async validateImages(content, doc, langFile, checkRemoteImages) {
  // ... 现有逻辑

  // 修改调用
  await this.validateLocalImage(imageUrl, doc, altText, langFile);
  await this.validateRemoteImage(imageUrl, doc, altText, langFile);
}
```

#### 修改 11：validateLocalImage 方法（第 395-430 行）

**在开头添加 langFile 参数并调整路径计算**：
```javascript
async validateLocalImage(imageUrl, doc, altText, langFile) {
  // 计算当前文档的完整路径（包含语言文件）
  const fullDocPath = path.join(doc.filePath, langFile);
  const docDir = path.dirname(path.join(this.docsDir, fullDocPath));
  const imagePath = path.resolve(docDir, imageUrl);

  try {
    await access(imagePath, constants.F_OK);

    // 验证相对路径层级
    const expectedRelativePath = this.calculateExpectedRelativePath(fullDocPath, imagePath);
    if (expectedRelativePath && imageUrl !== expectedRelativePath) {
      this.errors.warnings.push({
        type: 'IMAGE_PATH_LEVEL',
        path: doc.path,
        langFile,
        imageUrl,
        expectedPath: expectedRelativePath,
        message: `图片路径层级可能不正确: ${imageUrl}`,
        suggestion: `建议使用: ${expectedRelativePath}`
      });
    }
  } catch (_error) {
    this.stats.missingImages++;
    this.errors.fatal.push({
      type: 'MISSING_IMAGE',
      path: doc.path,
      langFile,
      imageUrl,
      altText,
      message: `本地图片不存在: ${imageUrl}`,
      suggestion: `检查图片路径或删除图片引用`
    });
  }
}
```

#### 修改 12：calculateExpectedRelativePath 方法（第 433-453 行）

**替换为**：
```javascript
calculateExpectedRelativePath(docFilePath, absoluteImagePath) {
  // docFilePath 示例：overview/zh.md → 2层
  //                  api/auth/zh.md → 3层
  const pathParts = docFilePath.split('/').filter(p => p);
  const depth = pathParts.length;

  // 生成回退路径
  const backPath = '../'.repeat(depth);

  // 计算相对路径
  const workspaceRoot = process.cwd();
  const relativeToWorkspace = path.relative(workspaceRoot, absoluteImagePath);

  return backPath + relativeToWorkspace.replace(/\\/g, '/');
}
```

#### 修改 13：validateRemoteImage 方法签名（第 458 行）

```javascript
async validateRemoteImage(imageUrl, doc, altText, langFile) {
  // ... 现有逻辑，错误信息中添加 langFile
}
```

---

## 五、实施步骤

### 阶段 1：更新文档（0.5 天）

1. 更新 `document-structure-schema.md`
   - 修改 path 字段说明
   - 更新示例代码

2. 更新 `document-content-guide.md`
   - 新增文档生成步骤章节
   - 更新图片路径层级对照表

3. 更新 `SKILL.md`
   - 替换步骤 6 的内容

### 阶段 2：修改校验代码（1 天）

1. 修改 `validate-structure.mjs`
   - 新增 path 格式校验规则

2. 修改 `structure-checker.mjs`
   - 调整 fixPath 方法

3. 修改 `validate-content.mjs`
   - 修改 validateDocumentFiles
   - 新增 validateMetaFile
   - 新增 validateLanguageFiles
   - 调整 validateDocument
   - 调整链接和图片校验方法

### 阶段 3：测试验证（0.5 天）

1. 创建测试 workspace
2. 生成测试文档
3. 运行 checkStructure 校验
4. 运行 checkContent 校验
5. 测试内部链接和图片路径

---

## 六、测试要点

### 6.1 文档生成测试

**测试用例 1：扁平结构**
```yaml
documents:
  - title: "概述"
    path: "/overview"
    sourcePaths: []
    icon: "lucide:home"
```

期望：
```
docs/overview/
  .meta.yaml (kind: doc, source: zh, default: zh)
  zh.md
```

**测试用例 2：嵌套结构（3 层）**
```yaml
documents:
  - title: "API"
    path: "/api"
    icon: "lucide:code"
    children:
      - title: "认证"
        path: "/api/authentication"
        sourcePaths: []
```

期望：
```
docs/api/
  .meta.yaml
  zh.md
docs/api/authentication/
  .meta.yaml
  zh.md
```

### 6.2 校验测试

| 测试场景 | 期望结果 |
|---------|---------|
| 缺少 .meta.yaml | 报错 MISSING_META_FILE |
| .meta.yaml 缺少 kind | 报错 INVALID_META |
| .meta.yaml 缺少 source | 报错 INVALID_META |
| .meta.yaml 缺少 default | 报错 INVALID_META |
| kind 不是 doc | 报错 INVALID_META |
| 缺少语言文件 | 报错 MISSING_LANGUAGE_FILE |
| default 语言文件缺失 | 报错 MISSING_DEFAULT_LANGUAGE |
| path 以 .md 结尾 | 报错 PATH_FORMAT |
| 文件夹不存在 | 报错 MISSING_DOCUMENT_FOLDER |
| path 是文件而非文件夹 | 报错 INVALID_DOCUMENT_FOLDER |

### 6.3 链接和图片测试

**内部链接**：
```markdown
<!-- docs/overview/zh.md 中 -->
[快速开始](../getting-started/zh.md)  ✓
[API 文档](/api/authentication/zh.md)  ✓
[不存在](../not-found/zh.md)  ✗ BROKEN_LINK
```

**图片路径**：
```markdown
<!-- docs/overview/zh.md (2层) -->
![截图](../../sources/project/screenshot.png)  ✓

<!-- docs/api/auth/zh.md (3层) -->
![架构](../../../sources/project/arch.png)  ✓

<!-- 层级错误 -->
![错误](../sources/project/img.png)  ✗ IMAGE_PATH_LEVEL
```

---

## 七、风险和注意事项

### 7.1 图片路径计算

**风险**：层级增加导致路径计算错误

**缓解措施**：
- 在 calculateExpectedRelativePath 方法中详细注释
- 提供清晰的层级对照表
- 校验时提供详细的错误提示和建议

### 7.2 内部链接格式

**风险**：链接需要包含语言文件名（如 `/overview/zh.md`）

**缓解措施**：
- validateInternalLink 方法支持自动移除语言文件名
- 同时支持 `/overview/zh.md` 和 `/overview` 两种格式

### 7.3 文件数量增加

**影响**：每个文档 2 个文件（.meta.yaml + 语言文件）

**评估**：可接受，现代文件系统性能良好

---

## 八、后续扩展

### 8.1 翻译功能

实现翻译功能时：
1. 读取 .meta.yaml 获取 source 语言
2. 基于源语言文件翻译到目标语言
3. 在文档文件夹中添加新的语言文件（如 `en.md`, `ja.md`）
4. 更新 .meta.yaml 的 languages 列表

### 8.2 发布系统适配

发布系统需要：
1. 读取 .meta.yaml 的 default 字段确定默认语言
2. 读取 languages 列表提供语言切换选项
3. 支持省略语言文件名的链接（如 `/overview` 自动解析为 `/overview/zh.md`）
