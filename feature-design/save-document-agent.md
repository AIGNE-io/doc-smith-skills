# 文档保存 Function Agent 设计方案

## 一、目标

创建一个专用的 function agent 来标准化文档保存流程，确保多语言文档结构的正确性。

**设计原则**：
- 仅用于**新增文档**时调用，编辑现有文档可直接编辑指定文件
- 自动创建文件夹、元信息文件和语言版本文件
- 校验 path 参数在文档结构中存在
- 提供清晰的错误信息，便于 LLM 理解和处理

---

## 二、Function Agent 设计

### 2.1 位置

```
agents/
  utils/
    save-document.mjs    # 新增
```

### 2.2 函数签名

```javascript
export default function saveDocument({
  path,      // 文档路径（如 "/overview" 或 "overview"）
  content,   // 文档内容（Markdown 格式）
  options    // { language: 'zh' }
}) {
  // ...
}
```

### 2.3 参数说明

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `path` | string | ✅ | 文档路径，可带或不带开头斜杠（如 `/overview` 或 `overview`）<br>**必须**在 `planning/document-structure.yaml` 中存在 |
| `content` | string | ✅ | 文档内容（Markdown 格式），**不能为空** |
| `options.language` | string | ✅ | 语言代码（如 `zh`, `en`），用于生成语言文件名和元信息 |

**重要提示**：
- `options.language` 必须从 `config.yaml` 的 `locale` 字段读取并传入
- 函数内部不直接读取 `config.yaml`，由调用方负责传入正确的语言代码

### 2.4 返回值说明

#### 成功响应
```javascript
{
  success: true,
  path: "/overview",              // 标准化后的路径
  folder: "docs/overview",        // 创建的文件夹路径
  files: {
    meta: "docs/overview/.meta.yaml",     // 元信息文件
    content: "docs/overview/zh.md"        // 语言文件
  },
  message: "文档保存成功: /overview (zh)"
}
```

#### 错误响应
```javascript
{
  success: false,
  error: "ERROR_CODE",
  message: "详细错误信息",
  suggestion: "建议操作"
}
```

### 2.5 错误类型

| 错误代码 | 触发条件 | 错误信息 | 建议操作 |
|---------|---------|---------|---------|
| `EMPTY_CONTENT` | `content` 为空或仅包含空白字符 | `文档内容不能为空` | `请提供有效的文档内容` |
| `PATH_NOT_IN_STRUCTURE` | `path` 不在 `document-structure.yaml` 中 | `文档路径 {path} 不存在于文档结构中` | `请先在 planning/document-structure.yaml 中添加此路径，或检查路径是否正确` |
| `INVALID_LANGUAGE` | `options.language` 为空或格式不正确 | `语言代码无效: {language}` | `请提供有效的语言代码（如 zh, en, ja）` |
| `MISSING_STRUCTURE_FILE` | `document-structure.yaml` 不存在 | `文档结构文件不存在: planning/document-structure.yaml` | `请先生成文档结构文件` |
| `FILE_OPERATION_ERROR` | 文件操作失败 | `文件操作失败: {详细错误}` | `检查文件系统权限或路径是否正确` |

---

## 三、实现细节

### 3.1 核心逻辑流程

```javascript
export default async function saveDocument({ path, content, options = {} }) {
  // 1. 参数校验
  //    - 校验 content 不为空
  //    - 校验 options.language 有效
  //    - 标准化 path（移除开头斜杠，统一格式）

  // 2. 加载并校验 document-structure.yaml
  //    - 检查文件是否存在
  //    - 递归遍历所有文档，收集有效路径
  //    - 校验 path 是否在文档结构中

  // 3. 创建文件夹
  //    - 计算目标文件夹路径：docs/{path}
  //    - 使用 mkdir -p 创建（包括父目录）

  // 4. 生成并保存 .meta.yaml
  //    - 内容：
  //      kind: doc
  //      source: {options.language}
  //      default: {options.language}

  // 5. 保存语言文件
  //    - 文件名：{options.language}.md
  //    - 内容：content 参数

  // 6. 返回成功响应
}
```

### 3.2 路径标准化

```javascript
function normalizePath(path) {
  // 移除开头和结尾的斜杠
  let normalized = path.trim();
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  // 返回标准化路径（不带斜杠）和显示路径（带斜杠）
  return {
    filePath: normalized,           // "overview"
    displayPath: `/${normalized}`   // "/overview"
  };
}
```

### 3.3 文档结构校验

```javascript
async function loadDocumentPaths(yamlPath = 'planning/document-structure.yaml') {
  // 1. 检查文件是否存在
  try {
    await access(yamlPath, constants.F_OK);
  } catch (error) {
    throw new Error('MISSING_STRUCTURE_FILE');
  }

  // 2. 读取并解析 YAML
  const content = await readFile(yamlPath, 'utf8');
  const data = yamlParse(content);

  // 3. 递归收集所有 path
  const paths = new Set();

  function collectPaths(docs) {
    for (const doc of docs) {
      if (doc.path) {
        // 同时存储带斜杠和不带斜杠的版本
        const normalized = doc.path.startsWith('/') ? doc.path.slice(1) : doc.path;
        paths.add(normalized);
        paths.add(`/${normalized}`);
      }
      if (doc.children) {
        collectPaths(doc.children);
      }
    }
  }

  collectPaths(data.documents || []);
  return paths;
}
```

### 3.4 文件操作

```javascript
import { mkdir, writeFile } from 'node:fs/promises';
import { stringify as yamlStringify } from 'yaml';
import path from 'node:path';

async function createDocumentFiles(filePath, language, content) {
  const docFolder = path.join('docs', filePath);

  // 1. 创建文件夹（递归创建，如果已存在则忽略）
  await mkdir(docFolder, { recursive: true });

  // 2. 生成 .meta.yaml
  const metaContent = yamlStringify({
    kind: 'doc',
    source: language,
    default: language
  });
  const metaPath = path.join(docFolder, '.meta.yaml');
  await writeFile(metaPath, metaContent, 'utf8');

  // 3. 保存语言文件
  const langFile = `${language}.md`;
  const langPath = path.join(docFolder, langFile);
  await writeFile(langPath, content, 'utf8');

  return {
    folder: docFolder,
    metaFile: metaPath,
    contentFile: langPath
  };
}
```

---

## 四、Schema 定义

### 4.1 Description

```javascript
saveDocument.description =
  "保存文档到 docs 目录，自动创建文件夹结构、元信息文件和语言版本文件。" +
  "【重要限制】此工具仅用于新增文档时调用。编辑已有文档时，请直接使用 Edit 工具修改对应的语言文件。" +
  "使用前必须确保 planning/document-structure.yaml 已存在且包含目标文档路径。" +
  "language 参数必须从 config.yaml 的 locale 字段读取并传入。";
```

### 4.2 Input Schema

```javascript
saveDocument.input_schema = {
  type: "object",
  required: ["path", "content", "options"],
  properties: {
    path: {
      type: "string",
      description: "文档路径，必须在 planning/document-structure.yaml 中存在。可以带或不带开头斜杠（如 '/overview' 或 'overview'）"
    },
    content: {
      type: "string",
      description: "文档内容（Markdown 格式），不能为空"
    },
    options: {
      type: "object",
      required: ["language"],
      properties: {
        language: {
          type: "string",
          description: "语言代码（如 zh, en, ja），必须从 config.yaml 的 locale 字段读取",
          pattern: "^[a-z]{2}(-[A-Z]{2})?$"
        }
      }
    }
  }
};
```

### 4.3 Output Schema

```javascript
saveDocument.output_schema = {
  type: "object",
  required: ["success"],
  properties: {
    success: {
      type: "boolean",
      description: "操作是否成功"
    },
    path: {
      type: "string",
      description: "标准化后的文档路径（成功时存在）"
    },
    folder: {
      type: "string",
      description: "创建的文件夹路径（成功时存在）"
    },
    files: {
      type: "object",
      description: "创建的文件路径（成功时存在）",
      properties: {
        meta: {
          type: "string",
          description: "元信息文件路径"
        },
        content: {
          type: "string",
          description: "语言文件路径"
        }
      }
    },
    message: {
      type: "string",
      description: "操作结果描述"
    },
    error: {
      type: "string",
      description: "错误代码（失败时存在）"
    },
    suggestion: {
      type: "string",
      description: "建议操作（失败时存在）"
    }
  }
};
```

---

## 五、使用示例

### 示例 1: 保存新文档

```javascript
// 调用方需要先从 config.yaml 读取 locale
const configContent = await readFile('config.yaml', 'utf8');
const config = yamlParse(configContent);
const locale = config.locale; // 'zh'

// 调用 saveDocument
const result = await saveDocument({
  path: '/overview',
  content: '# 项目概述\n\n这是项目的概述文档...',
  options: { language: locale }
});

// 成功响应
{
  success: true,
  path: "/overview",
  folder: "docs/overview",
  files: {
    meta: "docs/overview/.meta.yaml",
    content: "docs/overview/zh.md"
  },
  message: "文档保存成功: /overview (zh)"
}
```

### 示例 2: content 为空

```javascript
const result = await saveDocument({
  path: '/overview',
  content: '   ',  // 仅包含空白
  options: { language: 'zh' }
});

// 错误响应
{
  success: false,
  error: "EMPTY_CONTENT",
  message: "文档内容不能为空",
  suggestion: "请提供有效的文档内容"
}
```

### 示例 3: path 不在文档结构中

```javascript
const result = await saveDocument({
  path: '/not-exist',
  content: '# Test',
  options: { language: 'zh' }
});

// 错误响应
{
  success: false,
  error: "PATH_NOT_IN_STRUCTURE",
  message: "文档路径 /not-exist 不存在于文档结构中",
  suggestion: "请先在 planning/document-structure.yaml 中添加此路径，或检查路径是否正确"
}
```

---

## 六、需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `agents/utils/save-document.mjs` | **新增** - 实现 saveDocument 函数 |
| `doc-smith/SKILL.md` | **修改** - 步骤 6 中强调使用 saveDocument 工具保存新文档 |
| `doc-smith/references/document-content-guide.md` | **修改** - 更新文档生成步骤，说明使用 saveDocument 工具 |

---

## 七、SKILL.md 修改说明

### 位置：`doc-smith/SKILL.md`

**修改步骤 6（约第 100-130 行）**：

```markdown
### 6. 生成文档内容

为文档结构中的每个文档生成内容并保存到 `docs/` 目录。

**重要提示**：
- **新增文档时，必须使用 `saveDocument` 工具**，不要手动创建文件夹和文件
- **编辑已有文档时，直接使用 Edit 工具**修改对应的语言文件（如 `docs/overview/zh.md`）

**详细步骤和要求**: 参考 `references/document-content-guide.md`
```

---

## 八、document-content-guide.md 修改说明

### 位置：`doc-smith/references/document-content-guide.md`

**替换现有的"文档生成步骤"章节（第 6 节）**：

```markdown
## 6. 文档生成步骤

### 6.1 读取配置

读取 `config.yaml` 获取输出语言：

```bash
# 读取文件
cat config.yaml

# 提取 locale 字段
locale: zh
```

### 6.2 使用 saveDocument 工具

**重要**：新增文档时，必须使用 `saveDocument` 工具，不要手动创建文件和文件夹。

**工具调用**：

```javascript
await saveDocument({
  path: "/overview",        // 文档路径（从 document-structure.yaml 读取）
  content: "# 概述\n...",   // 生成的 Markdown 内容
  options: {
    language: "zh"          // 从 config.yaml 的 locale 读取
  }
});
```

**工具功能**：
- 自动创建文档文件夹（`docs/overview/`）
- 自动生成 `.meta.yaml`：
  ```yaml
  kind: doc
  source: zh
  default: zh
  ```
- 自动保存语言文件（`docs/overview/zh.md`）

**错误处理**：
- 如果返回 `PATH_NOT_IN_STRUCTURE` 错误，检查路径是否在 `document-structure.yaml` 中
- 如果返回 `EMPTY_CONTENT` 错误，确保生成的内容不为空

### 6.3 编辑已有文档

**注意**：编辑已有文档时，不要使用 `saveDocument` 工具。

直接使用 Edit 工具修改对应的语言文件：

```javascript
// 编辑中文版本
await Edit({
  file_path: "docs/overview/zh.md",
  old_string: "旧内容",
  new_string: "新内容"
});
```

### 6.4 批量生成

为提高效率，批量生成多个文档内容，然后批量调用 saveDocument。
```

---

## 九、测试要点

### 9.1 正常流程测试

| 测试场景 | 输入 | 期望输出 |
|---------|------|---------|
| 保存新文档（带斜杠） | `path: "/overview"` | 成功，创建 `docs/overview/` |
| 保存新文档（不带斜杠） | `path: "overview"` | 成功，创建 `docs/overview/` |
| 保存嵌套文档 | `path: "/api/authentication"` | 成功，创建 `docs/api/authentication/` |
| 覆盖已有文档 | 文件夹已存在 | 成功，覆盖 `.meta.yaml` 和语言文件 |

**期望结果验证**：
```bash
# 检查文件夹
ls -la docs/overview/

# 检查 .meta.yaml
cat docs/overview/.meta.yaml
# 期望：
# kind: doc
# source: zh
# default: zh

# 检查语言文件
cat docs/overview/zh.md
# 期望：包含传入的 content
```

### 9.2 错误处理测试

| 测试场景 | 输入 | 期望错误 |
|---------|------|---------|
| content 为空字符串 | `content: ""` | `EMPTY_CONTENT` |
| content 仅包含空白 | `content: "   \n  "` | `EMPTY_CONTENT` |
| path 不在结构中 | `path: "/not-exist"` | `PATH_NOT_IN_STRUCTURE` |
| language 为空 | `options: {}` | `INVALID_LANGUAGE` |
| language 格式错误 | `options: { language: "invalid" }` | `INVALID_LANGUAGE` |
| 结构文件不存在 | 删除 `document-structure.yaml` | `MISSING_STRUCTURE_FILE` |

### 9.3 集成测试

**测试流程**：
1. 初始化 workspace
2. 生成 `document-structure.yaml`：
   ```yaml
   documents:
     - title: "概述"
       path: "/overview"
       sourcePaths: []
   ```
3. 创建 `config.yaml`：
   ```yaml
   locale: zh
   ```
4. 调用 `saveDocument`：
   ```javascript
   await saveDocument({
     path: '/overview',
     content: '# 概述\n\n这是测试内容。',
     options: { language: 'zh' }
   });
   ```
5. 验证文件结构：
   ```
   docs/
     overview/
       .meta.yaml
       zh.md
   ```
6. 验证内容正确性

---

## 十、实施步骤

### 阶段 1: 实现 Function Agent（1 天）

1. 创建 `agents/utils/` 目录
2. 实现 `save-document.mjs`：
   - 参数校验逻辑
   - 路径标准化
   - 文档结构加载和校验
   - 文件创建逻辑
   - 错误处理
   - Schema 定义

### 阶段 2: 更新文档（0.5 天）

1. 修改 `doc-smith/SKILL.md` 步骤 6
2. 修改 `doc-smith/references/document-content-guide.md` 第 6 节

### 阶段 3: 测试验证（0.5 天）

1. 单元测试：参数校验、路径标准化、错误处理
2. 集成测试：完整的文档生成流程
3. 边界测试：各种错误场景

---

## 十一、风险和注意事项

### 11.1 文件覆盖风险

**风险**：覆盖模式可能导致已有内容丢失

**缓解措施**：
- 在 description 中明确说明"仅用于新增文档"
- 在 SKILL.md 中强调编辑已有文档应使用 Edit 工具
- LLM 应在生成文档前检查文件夹是否已存在，谨慎调用

### 11.2 路径校验的严格性

**风险**：路径必须在文档结构中存在，可能影响灵活性

**缓解措施**：
- 提供清晰的错误信息，指导用户先更新文档结构
- 错误信息中包含具体的操作建议

### 11.3 语言参数传递

**风险**：LLM 可能直接硬编码语言代码，而不是从 config.yaml 读取

**缓解措施**：
- 在 description 中明确要求从 config.yaml 读取
- 在 SKILL.md 的示例中展示正确的读取方式
- 在 input_schema 的 description 中再次强调

---

## 十二、后续扩展

### 12.1 批量保存支持

未来可以扩展支持批量保存多个文档：

```javascript
await saveDocuments({
  documents: [
    { path: '/overview', content: '...', language: 'zh' },
    { path: '/getting-started', content: '...', language: 'zh' }
  ]
});
```

### 12.2 增量更新支持

支持仅更新特定文件（如仅更新 .meta.yaml 或仅更新语言文件）：

```javascript
await saveDocument({
  path: '/overview',
  content: '...',
  options: {
    language: 'zh',
    updateOnly: 'content'  // 或 'meta'
  }
});
```

### 12.3 翻译流程支持

当实现翻译功能时，扩展支持添加新语言版本：

```javascript
await saveDocument({
  path: '/overview',
  content: '...',
  options: {
    language: 'en',
    mode: 'add-translation'  // 不覆盖 .meta.yaml
  }
});
```
