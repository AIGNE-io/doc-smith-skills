# AFS Save File - 统一文件保存工具设计

## 一、目标

### 1.1 功能目标

创建一个系统级的文件保存工具 `afsSaveFile`，统一处理多语言文件结构和元信息管理，提供类似 `fs.writeFile` 的简洁接口。

**设计原则**：
- 接口简洁：与原生 `fs.writeFile` 参数风格一致
- Meta 透明：调用方无需关心元信息结构，自动管理
- 智能推导：自动识别文件类型、操作模式、路径转换
- 统一行为：所有保存操作使用相同的管理逻辑

### 1.2 背景

目前有 4 个不同的文件保存函数，存在以下问题：
- 代码重复：Meta 管理逻辑重复实现
- 行为不一致：同样的操作在不同场景处理方式不同
- 难以维护：修改 Meta 结构需要同步修改多处
- 职责不清：路径计算、Meta 更新分散在各处

## 二、接口设计

### 2.1 函数签名

```javascript
afsSaveFile(path, content, options)
```

**参数说明**：
- `path`：文件路径，**不包含语言信息**（如 `docs/overview.md`）
- `content`：文件内容（string | Buffer）
- `options`：配置选项

**Options 结构**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `language` | string | ✅ | 语言代码（zh, en, ja） |
| `type` | string | ❌ | 文件类型（document/image），默认自动推导 |
| `sourceHash` | string | 图片翻译时必需 | 源图片 hash |
| `slot` | object | 图片创建时必需 | Slot 信息 { id, desc } |
| `generation` | object | ❌ | 生成信息 { model, shared } |
| `documents` | array | 图片创建时必需 | 关联文档 [{ path, hash }] |

**返回值**：

```javascript
{
  success: boolean,
  mode: 'create' | 'translate' | 'update',  // 实际执行的模式
  type: 'document' | 'image',
  files: {
    content: string,  // 内容文件路径
    meta: string,     // Meta 文件路径
  },
  meta: {
    languages: string[],  // 更新后的语言列表
  },
  message: string,
}
```

### 2.2 使用示例

**保存新文档**：
```javascript
await afsSaveFile('docs/overview.md', '# 概览\n...', {
  language: 'zh',
});
// 自动创建 docs/overview/zh.md 和 .meta.yaml
```

**翻译文档**：
```javascript
await afsSaveFile('docs/overview.md', '# Overview\n...', {
  language: 'en',
});
// 创建 docs/overview/en.md，更新 .meta.yaml 的 languages
```

**生成图片**：
```javascript
await afsSaveFile('assets/hero.png', imageBuffer, {
  language: 'zh',
  slot: { id: 'hero-001', desc: '首页横幅' },
  generation: { model: 'claude-3-5-sonnet-20241022' },
  documents: [{ path: 'docs/overview', hash: 'abc123' }],
});
// 创建 assets/hero/images/zh.png 和 .meta.yaml
```

**翻译图片**：
```javascript
await afsSaveFile('assets/hero.png', translatedBuffer, {
  language: 'en',
  sourceHash: 'abc123',
});
// 创建 assets/hero/images/en.png，更新 .meta.yaml
```

## 三、核心机制

### 3.1 路径自动转换

**文档类型**：
```
输入: docs/overview.md, language: zh
输出:
  - 内容文件: docs/overview/zh.md
  - Meta 文件: docs/overview/.meta.yaml
```

**图片类型**：
```
输入: assets/hero.png, language: zh
输出:
  - 内容文件: assets/hero/images/zh.png
  - Meta 文件: assets/hero/.meta.yaml
```

**规则**：
- 移除原路径的扩展名
- 文档直接创建语言文件
- 图片在 `images/` 子目录下创建语言文件

### 3.2 类型自动推导

| 路径模式 | 推导类型 |
|---------|---------|
| `docs/**/*.md` | document |
| `assets/**/*.{png,jpg,svg}` | image |
| `.md` 扩展名 | document |
| 图片扩展名 | image |

如果无法推导，返回错误并建议手动指定 `type` 参数。

### 3.3 模式自动判断

```
判断逻辑：
  if (meta 文件不存在)
    → mode = 'create'
  else if (meta.languages 包含当前 language)
    → mode = 'update'
  else
    → mode = 'translate'
```

**各模式行为**：
- **create**：创建新 meta + 保存文件
- **translate**：更新 meta（添加语言） + 保存文件
- **update**：只保存文件，meta 不变

### 3.4 Meta 管理策略

#### 文档 Meta 结构

**创建模式**：
```yaml
kind: document
source: zh
default: zh
languages: [zh]
```

**翻译模式**（追加语言）：
```yaml
kind: document
source: zh
default: zh
languages: [zh, en]  # 追加新语言
```

#### 图片 Meta 结构

**创建模式**：
```yaml
kind: image
slot:
  id: hero-banner-001
  key: hero-banner
  desc: 首页英雄图
generation:
  model: claude-3-5-sonnet-20241022
  createdAt: 2026-01-08T10:00:00Z
  shared: false
documents:
  - path: docs/overview
    hash: abc123
languages: [zh]
```

**翻译模式**（追加语言 + 翻译记录）：
```yaml
kind: image
slot: { ... }           # 保持不变
generation: { ... }     # 保持不变
documents: { ... }      # 保持不变
languages: [zh, en]     # 追加语言
translations:           # 新增翻译记录
  en:
    sourceHash: abc123
    translatedAt: 2026-01-08T11:00:00Z
```

**更新策略总结**：

| 模式 | 类型 | 操作 |
|-----|------|-----|
| create | document | 创建完整 meta |
| create | image | 创建完整 meta（需要 slot, generation, documents） |
| translate | document | 追加 languages |
| translate | image | 追加 languages + 添加 translations[lang] |
| update | document | 更新文件内容（meta 不变） |
| update | image | 更新文件内容（meta 不变） |

## 四、实现架构

### 4.1 目录结构

```
utils/afs/
├── index.mjs                 # 主入口 afsSaveFile
├── path-resolver.mjs         # 路径转换和类型推导
├── meta-manager.mjs          # Meta 文件读写和模式判断
├── file-operations.mjs       # 文件保存原子操作
└── strategies/
    ├── document-meta.mjs     # 文档 Meta 策略
    └── image-meta.mjs        # 图片 Meta 策略
```

### 4.2 主流程

```
1. 参数验证 (language, content)
2. 推导类型 (type = options.type || inferType(path))
3. 转换路径 (resolveFilePaths → contentPath, metaPath)
4. 加载 Meta (loadMeta → meta 对象或 null)
5. 判断模式 (determineMode → create/translate/update)
6. 根据模式执行:
   - create: 创建 meta + 保存文件
   - translate: 更新 meta + 保存文件
   - update: 保存文件 (meta 不变)
7. 返回结果
```

### 4.3 核心模块职责

**path-resolver.mjs**：
- `inferType(path)` - 推导文件类型
- `resolveFilePaths(path, language, type)` - 转换路径

**meta-manager.mjs**：
- `loadMeta(metaPath)` - 读取 Meta 文件
- `saveMeta(metaPath, meta)` - 保存 Meta 文件
- `determineMode(meta, language)` - 判断操作模式

**strategies/document-meta.mjs**：
- `createDocumentMeta(language)` - 创建文档 Meta
- `updateDocumentMetaForTranslation(meta, language)` - 更新文档 Meta

**strategies/image-meta.mjs**：
- `createImageMeta(language, options)` - 创建图片 Meta
- `updateImageMetaForTranslation(meta, language, options)` - 更新图片 Meta

**file-operations.mjs**：
- `saveContent(filePath, content)` - 保存内容（自动创建目录）

## 五、边界情况处理

### 5.1 首次保存缺少必需字段

**场景**：图片创建时缺少 `slot` 或 `documents`

**处理**：
```javascript
{
  success: false,
  error: 'MISSING_IMAGE_METADATA',
  message: '图片首次保存需要提供 slot 和 documents',
  suggestion: '请在 options 中添加 slot 和 documents 字段'
}
```

### 5.2 路径无法推导类型

**场景**：路径不在 `docs/` 或 `assets/` 下

**处理**：
```javascript
{
  success: false,
  error: 'UNKNOWN_FILE_TYPE',
  message: '无法推导文件类型',
  suggestion: '请在 options 中明确指定 type: "document" 或 "image"'
}
```

### 5.3 翻译图片缺少 sourceHash

**场景**：图片翻译时未提供 `sourceHash`

**处理**：
```javascript
{
  success: false,
  error: 'MISSING_SOURCE_HASH',
  message: '图片翻译需要提供 sourceHash',
  suggestion: '请在 options 中添加 sourceHash 字段'
}
```

### 5.4 更新已有语言版本

**场景**：保存已存在的语言版本

**行为**：直接覆盖文件内容，meta 不变

```javascript
{
  success: true,
  mode: 'update',
  message: '文档已更新: docs/overview/zh.md'
}
```

## 六、迁移方案

### 6.1 现有函数对比

| 现有函数 | 代码行数 | 新实现行数 | 减少 |
|---------|---------|-----------|-----|
| save-document | ~150 行 | ~20 行 | -87% |
| save-translation | ~80 行 | ~20 行 | -75% |
| save-image-result | ~150 行 | ~40 行 | -73% |
| save-image-translation | ~90 行 | ~30 行 | -67% |
| **总计** | **~470 行** | **~110 行** | **-77%** |

新增核心库：`utils/afs/` ~300 行（可复用）

### 6.2 迁移步骤

**阶段 1：实现核心库**
1. 实现 `utils/afs/` 下所有模块
2. 编写单元测试和集成测试
3. 验证所有场景

**阶段 2：保留旧函数作为适配层**
1. 现有函数内部调用 `afsSaveFile`
2. 保持接口向后兼容
3. 验证功能正常

**阶段 3：逐步迁移调用方**
1. 更新调用方直接使用 `afsSaveFile`
2. 标记旧函数为 deprecated
3. 最终移除旧函数

### 6.3 迁移示例

**save-document/index.mjs**（内部调用新方法）：

```javascript
import afsSaveFile from '../../utils/afs/index.mjs';

export default async function saveDocument({ path, content, options = {} }) {
  // 直接转发到 afsSaveFile
  const result = await afsSaveFile(path, content, {
    language: options.language,
    type: 'document',
  });

  // 适配返回格式（保持向后兼容）
  if (!result.success) return result;

  return {
    success: true,
    path,
    folder: path.dirname(result.files.content),
    files: result.files,
    message: result.message,
  };
}
```

## 七、核心改进

### 7.1 统一的 Meta 管理

✅ 所有场景使用相同的 meta 更新逻辑
✅ 自动判断创建/翻译/更新模式
✅ 正确维护 languages 数组
✅ Meta 结构变更只需修改一处

### 7.2 简化的接口

✅ 调用者不需要计算路径
✅ 调用者不需要关心 meta 结构
✅ 参数接近原生 `fs.writeFile`
✅ 返回值统一且明确

### 7.3 自动化行为

✅ 自动创建目录
✅ 自动推导文件类型
✅ 自动判断操作模式
✅ 自动转换路径

### 7.4 更好的可维护性

✅ 代码量减少 77%
✅ 业务逻辑与文件操作解耦
✅ 策略模式便于扩展新类型
✅ 单元测试覆盖率高

## 八、测试策略

### 8.1 测试分类

**单元测试**：
- 各模块独立测试（path-resolver, meta-manager, strategies）
- 不依赖实际文件系统
- 使用 mock 和 stub

**集成测试**：
- 完整流程测试（create → translate → update）
- 使用临时文件系统
- 验证实际文件创建

**边界情况测试**：
- 异常输入处理
- 并发访问
- 文件系统错误

### 8.2 测试覆盖率目标

- **行覆盖率**: ≥ 90%
- **分支覆盖率**: ≥ 85%
- **函数覆盖率**: 100%

### 8.3 关键测试场景

**文档场景**：
- TC1: 创建第一个语言版本
- TC2: 添加第二个语言版本（翻译）
- TC3: 更新已有语言版本
- TC4: 添加第三个语言版本

**图片场景**：
- TC5: 创建图片（提供完整 metadata）
- TC6: 翻译图片（提供 sourceHash）
- TC7: 创建图片时缺少 slot（错误）
- TC8: 翻译图片时缺少 sourceHash（错误）

**边界情况**：
- TC9: 无效的 language 格式
- TC10: 空的 content
- TC11: 无法推导的路径类型
- TC12: Meta 文件损坏
- TC13: 并发保存同一文件

## 九、实施计划

### Phase 1: 基础工具模块（2-3 小时）
- ✅ path-resolver.mjs
- ✅ file-operations.mjs
- ✅ meta-manager.mjs

### Phase 2: Meta 策略（1-2 小时）
- ✅ strategies/document-meta.mjs
- ✅ strategies/image-meta.mjs

### Phase 3: 主入口（1 小时）
- ✅ index.mjs (afsSaveFile)

### Phase 4: 测试（2-3 小时）
- 单元测试
- 集成测试
- 边界情况测试

### Phase 5: 迁移（2-3 小时）
- 更新现有函数
- 验证功能
- 移除旧代码

**总计**：8-12 小时

## 十、风险和注意事项

### 10.1 迁移风险

⚠️ **save-document 移除了 document-structure.yaml 校验**
- 该校验应在调用前完成
- 需要更新调用方代码

⚠️ **返回值格式略有差异**
- 需要适配层处理
- 保持向后兼容

⚠️ **错误代码可能不同**
- 需要统一错误代码
- 更新错误处理逻辑

### 10.2 最佳实践

✅ 先实现和测试 afsSaveFile
✅ 保留现有函数作为适配层（短期）
✅ 逐步迁移调用方（中期）
✅ 最终移除旧函数（长期）

## 十一、总结

### 核心设计要点

1. **极致简化** - 调用接口与 `fs.writeFile` 几乎一致
2. **零配置** - 不需要手动管理 meta 和路径
3. **统一行为** - 所有保存操作使用相同逻辑
4. **向后兼容** - 现有函数可作为适配层渐进迁移

### 关键特性

✅ **Meta 完全隐藏** - 调用方不需要知道 meta 结构
✅ **自动路径转换** - 输入路径不含语言信息，自动推导
✅ **智能模式判断** - 首次=创建，已有其他语言=翻译
✅ **类型自动推导** - 从路径识别文档/图片

### 预期收益

📊 **代码简化**：减少 77% 的业务代码
🔧 **易于维护**：Meta 管理逻辑集中在一处
🚀 **易于扩展**：新增文件类型只需添加策略
✨ **用户友好**：接口简洁，使用方便

---

**下一步**：开始实现 Phase 1 - 基础工具模块
