# Sources 图片绝对路径支持

## 功能概述

支持文档中使用绝对路径 `/sources/...` 引用数据源中的图片，解决 AFS 挂载场景下相对路径不可用的问题。

## 功能意图

### 背景

当前架构存在两种视角的差异：

**执行层视角**（AFS 挂载后，doc-smith SKILL 看到的）：
```
modules/
├── workspace/    # doc-smith 工作空间
└── sources/      # 数据源目录（与 workspace 平级，统一视图）
    └── xxx/      # 源仓库内容
```

**物理磁盘视角**（独立仓库模式下的实际位置）：
```
workspace/
├── config.yaml
├── sources/      # 物理上在 workspace 内部
│   └── <name>/   # git-clone 类型克隆到此
└── ...
```

数据源类型：
- **local-path 类型**：实际路径是 config.yaml 中配置的 `path`（相对于 workspace）
- **git-clone 类型**：克隆到物理磁盘的 `workspace/sources/<name>/` 目录

执行层看到的是统一的 `sources/` 目录视图，不关心具体来自哪个 source 配置。

### 解决方案

使用虚拟绝对路径 `/sources/...` 来引用图片，然后在校验和发布阶段根据 `config.yaml` 的 sources 配置自动查找实际物理路径。

## 工作流程

```
文档生成时
    ↓
使用绝对路径 /sources/assets/screenshot.png（直接使用 sources 目录下看到的路径）
    ↓
content-checker 校验时
    ├─ 读取 config.yaml 获取 sources 配置
    ├─ 依次在每个 source 中查找图片
    └─ 返回第一个存在的物理路径并验证
    ↓
publish-docs 发布时
    ├─ docs-converter 转换文档内容
    ├─ 识别 /sources/... 绝对路径
    ├─ 查找并复制源图片到临时目录
    └─ 替换为可访问的相对路径
```

## 核心能力

1. **绝对路径规范**：定义 `/sources/<path>` 格式
2. **自动查找**：依次在配置的 sources 中查找图片
3. **存在性校验**：content-checker 正确检查绝对路径图片
4. **发布转换**：publish-docs 将绝对路径转换为可访问的相对路径

## 输入输出

### 输入

**绝对路径格式**：
```
/sources/<path-to-image>
```

示例：
- `/sources/assets/screenshot.png`
- `/sources/docs/images/architecture.png`

**config.yaml sources 配置**：
```yaml
sources:
  - name: "main"
    type: local-path
    path: "../../"

  - name: "aigne-framework"
    type: git-clone
    url: "https://github.com/ArcBlock/aigne-framework.git"
    branch: "main"
```

### 输出

**content-checker**：正确的校验结果

**publish-docs**：转换后的文档，图片使用可访问的相对路径
```markdown
<!-- 原始 -->
![截图](/sources/assets/screenshot.png)

<!-- 转换后（根据文档深度） -->
![截图](../sources/assets/screenshot.png)
```

## 约束条件

### 必须遵循的规范

1. **路径格式**：必须以 `/sources/` 开头
2. **路径内容**：直接使用在 sources 目录下看到的路径
3. **大小写敏感**：路径区分大小写

### 职责边界

**必须执行**：
- ✅ 识别 `/sources/` 开头的绝对路径
- ✅ 依次在每个 source 中查找图片
- ✅ 检查图片文件是否存在
- ✅ 发布时复制图片并转换路径

**不应执行**：
- ❌ 不修改原始图片文件
- ❌ 不改变现有 assets 目录的处理逻辑
- ❌ 不影响远程图片 URL 的处理

## 预期结果

### 成功标准

1. 文档中可以使用 `/sources/...` 绝对路径引用图片
2. content-checker 能正确检查绝对路径图片的存在性
3. publish-docs 能正确转换绝对路径为可访问的相对路径
4. 发布后的文档图片能正常显示

## 错误处理

### 常见错误

1. **图片文件不存在**：所有 source 中都找不到该图片
2. **路径格式错误**：不符合 `/sources/...` 格式

### 处理策略

1. **校验阶段报错**：content-checker 报告具体错误信息
2. **发布阶段跳过**：无法解析的路径保持原样并警告

## 实现方式

### 涉及文件

1. **文档规范更新**：
   - `skills/doc-smith-docs-detail/SKILL.md`
   - `skills/doc-smith/references/document-content-guide.md`

2. **content-checker 修改**：
   - `agents/content-checker/validate-content.mjs`
   - 新增：`utils/sources-path-resolver.mjs`（路径解析工具）

3. **publish-docs 修改**：
   - `utils/docs-converter.mjs`

### 新增工具函数

**sources-path-resolver.mjs**：
- `parseSourcesPath(absolutePath)` - 解析绝对路径获取相对路径部分
- `resolveSourcesPath(absolutePath, config)` - 在各 source 中查找图片，返回物理路径
- `isSourcesAbsolutePath(path)` - 判断是否为 sources 绝对路径

---
**注意**：本文档描述功能意图，不包含具体实现细节。
