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

检查当前目录是否为有效的 Doc-Smith workspace。

### 2. 检查发布条件

调用 `doc-smith-check` 确保文档完整：

```bash
/doc-smith-check
```

如果检查失败，提示用户先修复问题。

### 3. 确认发布目标

- 如果指定了 `--url`，使用指定的 URL
- 如果未指定且 `config.yaml` 有 `appUrl`，询问是否使用
- 如果都没有，要求用户提供发布目标 URL

### 4. 检查授权

检查是否有有效的站点授权（存储在系统 keyring 中）。

如果没有授权：
1. 提示用户需要授权
2. 引导用户完成授权流程
3. 保存授权信息

### 5. 翻译 Meta 信息

确保文档的 meta 信息（标题、描述）已翻译到所有目标语言。

### 6. 执行发布

调用发布脚本上传文档：

```bash
node skills/doc-smith-publish/scripts/publish-docs.mjs
```

### 7. 返回结果

返回发布结果：
- 发布状态（成功/失败）
- 发布的文档数量
- 在线访问 URL

## 错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| 授权失败 | 引导用户重新授权 |
| 网络错误 | 提示重试 |
| 文档不完整 | 提示先运行 `/doc-smith-check` 并修复问题 |
