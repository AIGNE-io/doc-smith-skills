# 文档翻译流程实施方案

## 一、目标

实现文档批量翻译功能，支持将文档翻译成多种语言，使用多语言文件夹结构。

**设计原则**：
- 支持批量并发翻译
- 自动处理目标语言过滤（跳过与源语言相同的语言）
- 覆盖式翻译（将已有翻译作为参考上下文）
- 更新 .meta.yaml 的 languages 字段

---

## 二、Agent 结构

### 2.1 位置

```
agents/
  localize/
    index.yaml                  # 主流程定义
    prepare-translation.mjs     # 参数检查和准备（function-agent）
    load-glossary.mjs           # 读取术语表
    translate-to-languages.yaml # 为单个文档翻译成多种语言
    translate-document.yaml     # 单个文档翻译（复用提示词）
    save-translation.mjs        # 保存翻译结果
prompts/
  translate/
    translate-document.md       # 翻译提示词（从参考项目复用）
```

### 2.2 主流程（index.yaml）

```yaml
type: team
name: localize
alias:
  - translate
description: 将文档翻译成多种语言
skills:
  - url: ./prepare-translation.mjs  # 检查和准备翻译任务
  - url: ./load-glossary.mjs        # 读取术语表（一次）
  - type: team
    name: processAllDocuments       # 处理所有文档
    skills:
      - url: ./translate-to-languages.yaml
    iterate_on: translationTasks
    concurrency: 5
input_schema:
  type: object
  properties:
    docs:
      type: array
      items:
        type: string
      description: 要翻译的文档路径列表（可选，不传则翻译所有文档）
    langs:
      type: array
      items:
        type: string
      description: 目标语言列表（必需，至少一个）
  required:
    - langs
mode: sequential
```

---

## 三、核心 Agent 设计

### 3.1 prepare-translation.mjs（Function Agent）

**功能**：检查参数、过滤语言、收集文档

**核心逻辑**：
1. 读取 `config.yaml` 获取 `locale` 作为源语言
2. 验证 `langs` 参数（必需且非空）
3. 过滤掉与源语言相同的语言
4. 加载 `planning/document-structure.yaml`
5. 如果 `docs` 为空，收集所有文档路径；否则验证指定路径
6. 为每个文档生成翻译任务：`{ path, sourceLanguage, targetLanguages }`

**返回值**：
- 成功：`{ success: true, translationTasks: [...], sourceLanguage, targetLanguages, totalDocs, message }`
- 跳过：`{ success: true, skipped: true, translationTasks: [], message }`
- 错误：`{ success: false, error, message, invalidPaths? }`

### 3.2 load-glossary.mjs

**功能**：读取术语表（可选，在主流程调用一次）

**核心逻辑**：
1. 检查 `intent/GLOSSARY.md` 是否存在
2. 如存在则读取内容作为 `glossary`
3. 如不存在则返回空字符串
4. 返回值在后续所有翻译任务中可用

### 3.3 translate-to-languages.yaml

**功能**：为单个文档翻译成多种语言

```yaml
type: team
name: translateToLanguages
skills:
  - url: ./prepare-doc-content.mjs # 读取源文档和旧翻译
  - url: ./translate-document.yaml # 执行翻译（使用 glossary）
  - url: ./save-translation.mjs    # 保存结果
iterate_on: targetLanguages
concurrency: 3
```

### 3.4 prepare-doc-content.mjs

**功能**：准备翻译所需的内容

**核心逻辑**：
1. 读取源文档：`docs/{path}/{sourceLanguage}.md`
2. 尝试读取旧翻译：`docs/{path}/{targetLanguage}.md`（作为参考）
3. 返回 `content`、`previousTranslation`、`targetFile`

### 3.5 translate-document.yaml

**功能**：使用提示词翻译文档（复用参考项目）

```yaml
name: translateDocument
instructions:
  url: ../../prompts/translate/translate-document.md
input_schema:
  type: object
  properties:
    language: { type: string }
    content: { type: string }
    glossary: { type: string }
    previousTranslation: { type: string }
  required: [language, content]
output_key: translation
```

### 3.6 save-translation.mjs

**功能**：保存翻译结果并更新 .meta.yaml

**核心逻辑**：
1. 保存翻译文件：`writeFile(targetFile, translation)`
2. 读取并更新 `.meta.yaml`：
   - 初始化 `languages` 为 `[meta.source]`（如不存在）
   - 添加目标语言到数组（避免重复）
3. 保存更新后的 `.meta.yaml`

---

## 四、输入输出定义

### 4.1 输入参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `docs` | array | ❌ | 文档路径列表（如 `["/overview", "/api/auth"]`）<br>不传则翻译所有文档 |
| `langs` | array | ✅ | 目标语言列表（如 `["en", "ja"]`）<br>至少一个语言，会自动过滤与源语言相同的语言 |

### 4.2 返回值类型

**成功**：`{ success: true, translationTasks: [...], sourceLanguage, targetLanguages, totalDocs, message }`
**跳过**：`{ success: true, skipped: true, translationTasks: [], message }`
**错误**：`{ success: false, error: "MISSING_LANGS" | "INVALID_DOC_PATHS", message, invalidPaths? }`

---

## 五、实施步骤

1. **复用翻译提示词**：复制 `/Users/lban/arcblock/code/aigne-doc-smith/prompts/translate/translate-document.md` 到 `prompts/translate/`
2. **创建 Agent 文件**：
   - `agents/localize/index.yaml`（主流程，调用 load-glossary 一次）
   - `agents/localize/prepare-translation.mjs`（参数检查、语言过滤、文档收集）
   - `agents/localize/load-glossary.mjs`（读取 `intent/GLOSSARY.md`，返回值全局可用）
   - `agents/localize/translate-to-languages.yaml`（为单个文档翻译多种语言）
   - `agents/localize/prepare-doc-content.mjs`（读取源文档和旧翻译）
   - `agents/localize/translate-document.yaml`（调用翻译提示词）
   - `agents/localize/save-translation.mjs`（保存文件、更新 .meta.yaml）
3. **测试验证**：参数检查、语言过滤、术语表、翻译覆盖、.meta.yaml 更新

---

## 六、关键技术点

1. **并发控制**：文档级并发 5（`processAllDocuments`），语言级并发 3（`translateToLanguages`）
2. **提示词复用**：使用参考项目的翻译提示词（`translate-document.md`）
3. **术语表优化**：在主流程中调用 `load-glossary.mjs` 一次，返回值在所有翻译任务中共享
4. **翻译参考**：将旧翻译作为 `previousTranslation` 传入提示词，改进翻译质量
5. **.meta.yaml 更新**：自动添加目标语言到 `languages` 数组

---

## 七、测试要点

| 场景 | 输入 | 期望 |
|------|------|------|
| 翻译单文档 | `docs: ["/overview"]`, `langs: ["en"]` | 创建 `docs/overview/en.md` |
| 翻译所有文档 | `docs: null`, `langs: ["en"]` | 翻译所有文档 |
| 跳过源语言 | `langs: ["zh"]`（源=zh） | 返回 `skipped: true` |
| 覆盖已有翻译 | 目标文件已存在 | 读取旧翻译参考，覆盖 |
| 术语表支持 | `intent/GLOSSARY.md` 存在 | 专有词汇不被翻译 |
| .meta.yaml 更新 | 翻译后 | `languages: [zh, en, ...]` |

---

## 八、错误处理

| 错误类型 | 场景 | 处理方式 |
|---------|------|---------|
| `MISSING_LANGS` | langs 为空或未传 | prepare-translation.mjs 返回错误 |
| `INVALID_DOC_PATHS` | docs 中的路径不存在 | prepare-translation.mjs 返回错误，列出无效路径 |
| `MISSING_SOURCE_FILE` | 源语言文件不存在 | translate-single.mjs 抛出错误 |
| `TRANSLATION_FAILED` | AFS i18n driver 失败 | 记录错误，继续翻译下一个文档/语言 |
| `META_UPDATE_FAILED` | .meta.yaml 更新失败 | save-translation.mjs 记录错误，但翻译文件已保存 |

