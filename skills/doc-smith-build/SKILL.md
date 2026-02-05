---
name: doc-smith-build
description: Build Doc-Smith generated Markdown documentation into static HTML site. Use this skill when the user requests to build, compile, or convert documentation to HTML.
---

# Doc-Smith HTML 构建

将 Markdown 文档构建为静态 HTML 站点。

## Usage

```bash
# 构建 HTML 站点
/doc-smith-build

# 指定输出目录
/doc-smith-build --output ./public
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--output <path>` | `-o` | 输出目录（默认 `.aigne/doc-smith/dist`） |

## 工作流程

### 1. 检测 Workspace

检查当前目录是否为有效的 Doc-Smith workspace：
- 存在 `.aigne/doc-smith/docs/` 目录
- 存在 `.aigne/doc-smith/planning/document-structure.yaml` 文件

如果不存在，提示先运行 `/doc-smith-create`。

### 2. 检查主题文件

检查 `.aigne/doc-smith/theme.css` 是否存在：

**如果不存在**：使用 AskUserQuestion 询问用户：
```
需要自定义主题吗？
- 使用默认样式（推荐）
- 生成自定义主题
```

**如果用户选择生成自定义主题**：
1. 追问用户描述期望的风格（如 "Stripe 文档风格"、"简洁深色主题"）
2. 根据用户描述生成 `.aigne/doc-smith/theme.css`
3. 告知用户后续可随时修改样式，直接描述即可

**如果用户选择默认样式**：继续构建，不生成 theme.css。

### 3. 执行构建

调用构建脚本：

```bash
node skills/doc-smith-build/scripts/build.mjs \
  --workspace .aigne/doc-smith \
  --output .aigne/doc-smith/dist
```

### 4. 报告结果

构建完成后报告：
- 输出路径
- 生成的页面数量（按语言统计）
- 预览方式提示

**示例输出**：
```
✓ 构建完成

输出路径: .aigne/doc-smith/dist/
- 中文页面: 15 个
- 英文页面: 15 个

预览方式:
- 浏览器直接打开: open .aigne/doc-smith/dist/index.html
- 本地服务器: npx serve .aigne/doc-smith/dist
```

## 主题迭代

用户可以随时通过自然语言修改主题：

```
用户: 侧边栏太窄了，代码块背景深一点

AI: 好的，我来调整 theme.css：
    - 侧边栏宽度: 240px → 280px
    - 代码块背景: #f6f8fa → #1e293b

    重新构建中...

    ✓ 构建完成，刷新预览页面查看效果。
```

**修改主题后需要重新构建才能看到效果。**

## 恢复默认主题

```
用户: 主题改坏了，恢复默认

AI: 好的，删除 theme.css，重新构建。

    ✓ 已恢复默认样式
```

## 错误处理

| 错误类型 | 处理方式 |
|----------|----------|
| workspace 不存在 | 提示先运行 `/doc-smith-create` |
| document-structure.yaml 缺失 | 提示先运行 `/doc-smith-create` |
| 文档文件缺失 | 跳过并警告，继续构建其他文档 |
| 依赖未安装 | 在 scripts 目录执行 `npm install` |

### 依赖未安装

如果执行脚本时出现模块找不到的错误，需要先安装依赖：

```bash
cd skills/doc-smith-build/scripts && npm install
```

## 输出结构

```
.aigne/doc-smith/dist/
├── index.html              # 重定向到主语言
├── zh/
│   ├── index.html          # 中文首页
│   └── docs/
│       ├── overview.html
│       └── guide/
│           └── intro.html
├── en/
│   ├── index.html          # 英文首页
│   └── docs/
│       └── ...
└── assets/
    ├── docsmith.css        # 内置基础样式
    └── theme.css           # 用户主题（如果存在）
```
