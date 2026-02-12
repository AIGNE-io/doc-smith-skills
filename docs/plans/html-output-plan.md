# Implementation Plan for Doc-Smith HTML Output

Generated from: `docs/plans/html-output-intent.md`
Date: 2026-02-05

## Overview

- Total Phases: 3
- Estimated Complexity: Medium
- Key Dependencies: markdown-it, markdown-it-anchor, gray-matter, glob

## Phase 0: Skill Scaffold + Build Script Infrastructure

**Goal**: Create the `/doc-smith-build` Skill 基础结构和构建脚本框架

### Step 0.1: Skill Directory Structure

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - Skill 目录存在 `skills/doc-smith-build/` |
|            | - SKILL.md 存在且格式正确 |
|            | - scripts/build.mjs 存在 |
|            | - scripts/package.json 存在 |
|            | - assets/docsmith.css 存在 |
| Bad Path   | - 缺少 SKILL.md → 报错 |
|            | - 缺少 build.mjs → 报错 |
| Edge Cases | - 空目录处理 |

**Unit 2: Implementation**

- [x] 创建 `skills/doc-smith-build/SKILL.md`
- [x] 创建 `skills/doc-smith-build/scripts/package.json`
- [x] 创建 `skills/doc-smith-build/scripts/build.mjs` 空框架
- [x] 创建 `skills/doc-smith-build/assets/docsmith.css` 基础样式

### Step 0.2: Build Script CLI Interface

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - `node build.mjs --workspace .aigne/doc-smith` 解析正确 |
|            | - `node build.mjs --output dist` 解析正确 |
|            | - 默认值正确应用 |
| Bad Path   | - 无效参数 → 打印帮助信息 |
|            | - 缺少必需参数 → 报错 |
| Edge Cases | - 长短参数混用 |
|            | - 参数值包含空格 |

**Unit 2: Implementation**

- [x] 实现 CLI 参数解析（--workspace, --output）
- [x] 实现 --help 输出
- [x] 实现默认值逻辑

### Phase 0 Gate: E2E Verification

```bash
# 验证 Skill 目录结构
ls -la skills/doc-smith-build/
ls -la skills/doc-smith-build/scripts/
ls -la skills/doc-smith-build/assets/

# 验证 CLI 参数解析
cd skills/doc-smith-build/scripts && npm install
node build.mjs --help
node build.mjs --workspace .aigne/doc-smith --output dist
```

**Success Criteria**:
- [x] Skill 目录结构完整
- [x] CLI 参数解析正常工作
- [x] --help 输出帮助信息

---

## Phase 1: Core Build Pipeline

**Goal**: 实现 Markdown → HTML 构建核心流程

### Step 1.1: Document Structure Reading

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - 读取有效 document-structure.yaml |
|            | - 正确解析 documents 数组 |
|            | - 正确解析 languages 配置 |
| Bad Path   | - 文件不存在 → 明确错误信息 |
|            | - YAML 格式错误 → 明确错误信息 |
|            | - 缺少必需字段 → 明确错误信息 |
| Edge Cases | - 空 documents 数组 |
|            | - 单语言配置 |
|            | - 深层嵌套路径 |
| Security   | - YAML 注入防护（不执行代码） |
| Data Leak  | - 不在日志中暴露完整文件路径 |
| Data Damage| - 只读操作，不修改源文件 |

**Unit 2: Implementation**

- [x] 实现 readDocumentStructure() 函数
- [x] 实现 YAML 解析和验证
- [x] 实现错误处理和友好提示

### Step 1.2: Markdown to HTML Conversion

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - 基础 Markdown 正确转换 |
|            | - 代码块语法高亮 |
|            | - 标题自动生成锚点 |
|            | - 表格正确渲染 |
|            | - 图片路径正确处理 |
| Bad Path   | - 空 Markdown → 空 HTML body |
|            | - 无效 Markdown 语法 → 降级处理 |
| Edge Cases | - 超长行处理 |
|            | - 特殊字符转义 |
|            | - 中文标题锚点 |
|            | - 代码块内的 HTML |
| Security   | - XSS 防护：script 标签转义 |
|            | - XSS 防护：事件处理器转义 |
|            | - HTML 注入防护 |
| Data Leak  | - 不在输出中暴露源文件路径 |
| Data Damage| - 不修改源 Markdown 文件 |

**Unit 2: Implementation**

- [x] 配置 markdown-it 实例
- [x] 集成 markdown-it-anchor
- [x] 实现 convertMarkdown() 函数
- [x] 实现 XSS 防护

### Step 1.3: HTML Template Rendering

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - 正确插入 title |
|            | - 正确插入 description |
|            | - 正确插入 content |
|            | - 正确插入 navigation |
|            | - 正确插入 toc |
|            | - lang 属性正确设置 |
| Bad Path   | - 缺少 title → 使用默认值 |
|            | - 缺少 description → 留空 |
| Edge Cases | - title 包含特殊字符 |
|            | - description 超长截断 |
|            | - 空 navigation |
|            | - 空 toc |
| Security   | - title 中的 HTML 实体转义 |
|            | - description 中的 HTML 实体转义 |
| Data Leak  | - 不在 HTML 中暴露内部路径 |
| Data Damage| - 不覆盖已存在的非 dist 文件 |

**Unit 2: Implementation**

- [x] 创建 HTML 模板（使用 data-ds 锚点）
- [x] 实现 renderTemplate() 函数
- [x] 实现 HTML 实体转义
- [x] 实现 meta 标签生成（SEO）

### Step 1.4: Navigation Generation

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - 从 document-structure.yaml 生成导航 |
|            | - 正确处理嵌套层级 |
|            | - 当前页面高亮标记 |
|            | - 正确生成链接 href |
| Bad Path   | - 空 documents → 空导航 |
|            | - 无效路径 → 跳过 |
| Edge Cases | - 单文档站点 |
|            | - 深层嵌套（3+ 层） |
|            | - 同名不同路径文档 |
| Security   | - 导航链接 XSS 防护 |
| Data Leak  | - 不暴露未发布文档 |
| Data Damage| - 只生成 HTML，不修改结构文件 |

**Unit 2: Implementation**

- [x] 实现 generateNavigation() 函数
- [x] 实现 renderNavigation() 函数
- [x] 实现当前页面高亮逻辑

### Step 1.5: TOC Generation

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - 从 HTML content 提取标题生成 TOC |
|            | - 正确处理 h2-h4 层级 |
|            | - 生成锚点链接 |
| Bad Path   | - 无标题 → 空 TOC |
|            | - 只有 h1 → 空 TOC（h1 是页面标题） |
| Edge Cases | - 跳级标题（h2 直接到 h4） |
|            | - 重复标题文本 |
|            | - 标题包含代码片段 |
| Security   | - TOC 链接 XSS 防护 |
| Data Leak  | - 无 |
| Data Damage| - 无 |

**Unit 2: Implementation**

- [x] 实现 generateTOC() 函数
- [x] 实现标题层级解析
- [x] 实现锚点链接生成

### Step 1.6: File Output

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - 正确创建 dist 目录结构 |
|            | - 正确写入 HTML 文件 |
|            | - 正确复制静态资源 |
|            | - 正确生成 index.html 重定向 |
| Bad Path   | - 目标目录无写权限 → 明确错误 |
|            | - 磁盘空间不足 → 明确错误 |
| Edge Cases | - 覆盖已存在的 dist |
|            | - 深层嵌套路径创建 |
|            | - 特殊字符文件名 |
| Security   | - 路径穿越防护（../） |
|            | - 只在 dist 目录内写入 |
| Data Leak  | - 不复制 .env 等敏感文件 |
| Data Damage| - 只操作 dist 目录 |
|            | - 失败时清理部分生成的文件 |

**Unit 2: Implementation**

- [x] 实现 ensureDir() 辅助函数
- [x] 实现 writeOutput() 函数
- [x] 实现 copyAssets() 函数
- [x] 实现 generateIndexRedirect() 函数
- [x] 实现路径穿越防护

### Phase 1 Gate: E2E Verification

```bash
# 准备测试数据
mkdir -p .aigne/doc-smith-test/docs/overview
mkdir -p .aigne/doc-smith-test/planning
cat > .aigne/doc-smith-test/planning/document-structure.yaml << 'EOF'
locale: zh
translateLanguages: [en]
documents:
  - path: /overview
    title: 概述
    desc: 项目概述
EOF
cat > .aigne/doc-smith-test/docs/overview/zh.md << 'EOF'
# 概述

这是概述文档。

## 快速开始

开始使用...
EOF

# 执行构建
cd skills/doc-smith-build/scripts
node build.mjs --workspace ../../../.aigne/doc-smith-test --output ../../../.aigne/doc-smith-test/dist

# 验证输出
ls -la ../../../.aigne/doc-smith-test/dist/
ls -la ../../../.aigne/doc-smith-test/dist/zh/docs/
cat ../../../.aigne/doc-smith-test/dist/zh/docs/overview.html | head -50

# 清理
rm -rf ../../../.aigne/doc-smith-test
```

**Success Criteria**:
- [x] 成功读取 document-structure.yaml
- [x] Markdown 正确转换为 HTML
- [x] HTML 包含正确的 data-ds 锚点
- [x] 导航和 TOC 正确生成
- [x] 文件输出到正确路径
- [x] index.html 重定向正常

---

## Phase 2: Theme System + Skill Integration

**Goal**: 实现主题系统并完成 Skill 集成

### Step 2.1: Base CSS (docsmith.css)

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - CSS Reset 生效 |
|            | - data-ds 布局正确 |
|            | - 响应式断点工作 |
|            | - 基础排版可读 |
| Bad Path   | - CSS 加载失败 → 页面仍可读 |
| Edge Cases | - 极窄屏幕（320px） |
|            | - 极宽屏幕（2560px） |
|            | - 无 JavaScript 环境 |
| Security   | - 无外部资源引用 |
| Data Leak  | - 无 |
| Data Damage| - 无 |

**Unit 2: Implementation**

- [x] 实现 CSS Reset
- [x] 实现 data-ds 布局（Grid）
- [x] 实现响应式断点
- [x] 实现基础排版样式

### Step 2.2: Theme CSS Integration

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - theme.css 存在 → 自动引入 |
|            | - theme.css 不存在 → 使用默认 |
|            | - theme.css 覆盖 docsmith.css |
| Bad Path   | - theme.css 语法错误 → 构建继续，警告 |
| Edge Cases | - 空 theme.css |
|            | - 超大 theme.css |
| Security   | - CSS 中无 JavaScript |
|            | - 无外部 @import |
| Data Leak  | - 无 |
| Data Damage| - 不修改源 theme.css |

**Unit 2: Implementation**

- [x] 实现 theme.css 检测
- [x] 实现 theme.css 复制
- [x] 实现 CSS 引用顺序（docsmith.css 先，theme.css 后）

### Step 2.3: SKILL.md Completion

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - /doc-smith-build 命令可识别 |
|            | - 工作流程完整执行 |
|            | - AI 主题询问正常 |
| Bad Path   | - workspace 不存在 → 明确提示 |
|            | - documents 为空 → 明确提示 |
| Edge Cases | - 用户拒绝生成主题 |
|            | - 用户多次修改主题 |

**Unit 2: Implementation**

- [x] 完善 SKILL.md 工作流程描述
- [x] 添加 workspace 检测逻辑
- [x] 添加主题询问流程
- [x] 添加构建结果报告

### Step 2.4: Multi-language Support

**Unit 1: Tests** (Do First)

| Category | Test Cases |
|----------|------------|
| Happy Path | - 每种语言独立输出目录 |
|            | - 语言切换链接正确 |
|            | - lang 属性正确设置 |
| Bad Path   | - 某语言文件缺失 → 跳过并警告 |
| Edge Cases | - 只有主语言 |
|            | - 多于 5 种语言 |
|            | - RTL 语言（如阿拉伯语） |
| Security   | - 无 |
| Data Leak  | - 无 |
| Data Damage| - 无 |

**Unit 2: Implementation**

- [x] 实现多语言遍历
- [x] 实现语言切换器
- [ ] 实现 RTL 支持（CSS dir 属性）（延后）

### Phase 2 Gate: E2E Verification

```bash
# 准备多语言测试数据
mkdir -p .aigne/doc-smith-test/docs/overview
mkdir -p .aigne/doc-smith-test/planning
cat > .aigne/doc-smith-test/planning/document-structure.yaml << 'EOF'
locale: zh
translateLanguages: [en]
documents:
  - path: /overview
    title: 概述
    desc: 项目概述
EOF
cat > .aigne/doc-smith-test/docs/overview/zh.md << 'EOF'
# 概述
中文内容
EOF
cat > .aigne/doc-smith-test/docs/overview/en.md << 'EOF'
# Overview
English content
EOF

# 创建自定义主题
cat > .aigne/doc-smith-test/theme.css << 'EOF'
[data-ds="content"] { background: #f5f5f5; }
EOF

# 执行构建
cd skills/doc-smith-build/scripts
node build.mjs --workspace ../../../.aigne/doc-smith-test --output ../../../.aigne/doc-smith-test/dist

# 验证多语言输出
ls ../../../.aigne/doc-smith-test/dist/zh/docs/
ls ../../../.aigne/doc-smith-test/dist/en/docs/

# 验证主题引入
grep "theme.css" ../../../.aigne/doc-smith-test/dist/zh/docs/overview.html

# 验证 CSS 存在
ls ../../../.aigne/doc-smith-test/dist/assets/

# 清理
rm -rf ../../../.aigne/doc-smith-test
```

**Success Criteria**:
- [x] 多语言独立构建正常
- [x] theme.css 正确引入
- [x] docsmith.css 基础样式生效
- [x] SKILL.md 完整可执行

---

## Final Verification

```bash
# 在真实 doc-smith workspace 中测试（如果存在）
if [ -d ".aigne/doc-smith/docs" ]; then
  cd skills/doc-smith-build/scripts
  node build.mjs --workspace ../../../.aigne/doc-smith --output ../../../.aigne/doc-smith/dist

  # 本地预览
  echo "构建完成，使用以下命令预览："
  echo "npx serve .aigne/doc-smith/dist"
fi
```

## Risk Mitigation

| Risk | Mitigation | Contingency |
|------|------------|-------------|
| markdown-it 输出不符合预期 | 使用 markdown-it-anchor 等成熟插件 | 切换到其他 Markdown 解析器 |
| CSS 在不同浏览器表现不一致 | 使用现代 CSS（Grid/Flex），避免 hack | 添加浏览器特定前缀 |
| 大量文档构建性能问题 | 并行处理多文件 | 添加增量构建 |
| theme.css 破坏布局 | docsmith.css 使用 !important 保护关键布局 | 提供 CSS 校验工具 |

## Notes

- 所有测试使用 Node.js 原生断言，不引入额外测试框架
- 构建脚本保持单文件，复杂度膨胀后再拆分
- 遵循现有 doc-smith-check 脚本的代码风格
