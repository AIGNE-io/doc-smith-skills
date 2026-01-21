---
name: doc-smith-publish
description: 将 Doc-Smith 生成的文档发布到在线平台。当用户要求发布文档、上线、部署文档时使用此技能。
---

# Doc-Smith 文档发布

将生成的文档发布到在线平台。

## Usage

```bash
# 发布到上次使用的目标（从 config.yaml 读取）
/doc-smith-publish

# 指定发布目标 URL
/doc-smith-publish --url https://example.com/docs
/doc-smith-publish -u https://example.com/docs

# 跳过发布前检查（不推荐）
/doc-smith-publish --skip-check

# 组合使用
/doc-smith-publish --url https://example.com/docs --skip-check
```

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--url <url>` | `-u` | 发布目标 URL（默认使用 config.yaml 中的 appUrl） |
| `--skip-check` | | 跳过发布前的文档检查（不推荐） |

## 工作流程

### 1. 检测 Workspace

检查当前目录是否为有效的 Doc-Smith workspace（存在 `config.yaml` 文件）。

### 2. 检查发布条件

除非用户指定了 `--skip-check`，否则调用 `doc-smith-check` skill 确保文档完整：

```bash
/doc-smith-check
```

如果检查失败，提示用户先修复问题后再发布。

### 3. 翻译 Meta 信息

读取 `config.yaml` 中的配置：
- `projectName`: 项目名称
- `projectDesc`: 项目描述
- `locale`: 主语言
- `translateLanguages`: 翻译目标语言列表

如果存在多个目标语言，直接翻译项目名称和描述到所有目标语言。

**翻译要求**：
- 描述翻译必须控制在 100 字符以内
- 保持原意的同时确保语言流畅自然
- 将翻译结果保存到 `cache/translation-cache.yaml`

### 4. 执行发布

发布脚本会处理以下步骤：
- 确认发布目标（从命令行参数、config.yaml 或用户交互获取）
- 检查并获取站点授权
- 上传文档到目标站点

```bash
node skills/doc-smith-publish/scripts/publish-docs.mjs
```

**注意**：发布脚本内部会处理授权流程，如果没有授权会引导用户完成。

### 5. 返回结果

返回发布结果：
- 发布状态（成功/失败）
- 在线访问 URL

## 错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| 依赖未安装 | 在 scripts 目录执行 `npm install` 安装依赖 |
| 授权失败 | 引导用户重新授权 |
| 网络错误 | 提示重试 |
| 文档不完整 | 提示先运行 `/doc-smith-check` 并修复问题 |

### 依赖未安装

如果执行脚本时出现模块找不到的错误（如 `Cannot find module 'xxx'`），需要先安装依赖：

```bash
cd skills/doc-smith-publish/scripts && npm install
```
