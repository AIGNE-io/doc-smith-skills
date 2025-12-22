# 文档结构 Schema

本参考定义了 `document_structure.yaml` 的完整 schema。

## 完整的 YAML 结构

```yaml
project:
  title: "项目名称"           # 必需：项目名称
  description: "项目概述"     # 必需：项目简要描述

documents:                    # 必需：文档对象数组
  - title: "文档标题"         # 必需：文档标题
    description: "简要摘要"   # 必需：此文档涵盖的内容
    path: "/filename.md"      # 必需：相对于 .aigne/doc-smith/docs/ 的路径
                              # 示例：/overview.md, /getting-started.md, /api/authentication.md
    sourcePaths:              # 必需：源文件路径数组（相对路径，不使用 'workspace:' 前缀）
      - "src/main.py"         # 为此文档内容提供信息的文件
      - "README.md"           # 如果没有特定源文件则使用空数组 []
    icon: "lucide:book-open"  # 仅顶层文档必需
                              # 必须是有效的 Lucide 图标名称："lucide:icon-name"
                              # 示例：lucide:book-open, lucide:settings, lucide:code
                              # 嵌套文档省略此字段
    children:                 # 可选：嵌套文档（相同结构）
      - title: "嵌套文档"
        description: "详细信息"
        path: "/section/nested.md"
        sourcePaths:
          - "src/utils.py"
        # 嵌套文档不需要 icon
```

## 字段详解

### project
- **title**：项目名称（字符串）
- **description**：项目简要概述（字符串）

### documents（数组）
每个文档对象包含：

- **title**（必需）：文档的显示标题
- **description**（必需）：内容简要摘要
- **path**（必需）：相对于 `.aigne/doc-smith/docs/` 的文件路径
  - 必须以 `/` 开头
  - 必须以 `.md` 结尾
  - 可以包含子目录：`/api/endpoints.md`
- **sourcePaths**（必需）：源文件路径数组
  - 相对于工作区根目录的路径
  - 不要包含 `workspace:` 前缀
  - 如果没有特定源文件则使用 `[]`
- **icon**（仅顶层文档必需）：Lucide 图标标识符
  - 格式：`lucide:icon-name`
  - 仅用于根级别的文档（不是子文档）
  - 示例：`lucide:home`, `lucide:file-text`, `lucide:settings`
  - 可用图标请参见 https://lucide.dev/icons
- **children**（可选）：具有相同结构的嵌套文档数组
  - 可以嵌套多层
  - 子文档不需要 icons

## 示例

### 简单扁平结构
```yaml
project:
  title: "API 文档"
  description: "REST API 参考和指南"

documents:
  - title: "概述"
    description: "API 介绍和快速开始"
    path: "/overview.md"
    sourcePaths:
      - "README.md"
    icon: "lucide:home"

  - title: "身份验证"
    description: "API 身份验证方法"
    path: "/auth.md"
    sourcePaths:
      - "src/auth/README.md"
      - "src/auth/oauth.py"
    icon: "lucide:key"
```

### 层次化结构
```yaml
project:
  title: "产品指南"
  description: "完整的产品文档"

documents:
  - title: "快速开始"
    description: "安装和设置"
    path: "/getting-started.md"
    sourcePaths:
      - "docs/installation.md"
    icon: "lucide:rocket"
    children:
      - title: "安装"
        description: "安装产品"
        path: "/getting-started/installation.md"
        sourcePaths:
          - "docs/install-guide.md"

      - title: "配置"
        description: "配置设置"
        path: "/getting-started/config.md"
        sourcePaths:
          - "config/default.yaml"
          - "docs/config-guide.md"

  - title: "API 参考"
    description: "完整的 API 文档"
    path: "/api.md"
    sourcePaths:
      - "src/api/"
    icon: "lucide:code"
```

## 最佳实践

1. **逻辑层次**：在父主题下组织相关文档
2. **清晰路径**：使用与文档标题匹配的描述性路径名称
3. **相关源文件**：包含所有为文档内容提供信息的文件
4. **合适的图标**：选择代表文档用途的图标
5. **平衡结构**：避免嵌套过深（建议最多 2-3 层）
6. **一致的描述**：保持描述简洁但信息丰富
