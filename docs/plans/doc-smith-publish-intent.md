# doc-smith-publish 规格说明

::: locked {reason="核心定位"}
## 1. 概述

- **定位**：DocSmith 文档发布命令，将生成的 HTML 文档发布到 DocSmith Cloud
- **核心概念**：基于 myvibe-publish 改造，去除截图/标签等无关功能，专注文档发布场景
- **优先级**：高
- **目标用户**：使用 doc-smith-create 生成文档后需要在线预览的开发者
- **范围**：新建 `skills/doc-smith-publish/` skill，包含 SKILL.md 和 scripts/
:::

::: reviewed {by=lban date=2026-02-13}
## 2. 架构

### 数据流

```
用户调用 /doc-smith-publish
  ↓
检测 workspace（.aigne/doc-smith/dist 目录）
  ↓
读取 config.yaml → 提取 projectName, projectDesc
  ↓
读取发布历史（.aigne/doc-smith/cache/publish-history.yaml）→ 获取已有 DID
  ↓
授权（~/.aigne/docsmith-connected.yaml）
  ↓
ZIP 压缩 dist 目录 → TUS 上传 → 等待转换 → 执行 publish action
  ↓
获取 actionResult.vibeUrl → 展示给用户 + 写入 config.yaml 的 appUrl
```

### 文件结构

```
skills/doc-smith-publish/
├── SKILL.md                    # Skill 入口
└── scripts/
    ├── package.json
    ├── publish.mjs             # 发布主脚本
    └── utils/                  # 从 myvibe-publish 裁剪改造
```
:::

## 3. 详细行为

::: reviewed {by=lban date=2026-02-13}
### 3.1 输入源检测

优先级：
1. `--dir` 参数指定的目录
2. 自动查找 `.aigne/doc-smith/dist` 目录
3. 检查当前目录是否为 doc-smith 输出（包含 `assets/nav.js`）
4. 都找不到 → 报错提示用户

### 3.2 Metadata 获取

从 `.aigne/doc-smith/config.yaml` 自动读取：
- `projectName` → title
- `projectDesc` → description

不支持 `--title`/`--desc` 覆盖（自动场景，无需用户干预）。
:::

::: reviewed {by=lban date=2026-02-13}
### 3.3 发布历史

存储位置：`.aigne/doc-smith/cache/publish-history.yaml`

格式（与 myvibe 一致）：
```yaml
mappings:
  /abs/path/to/.aigne/doc-smith/dist:
    https://docsmith.aigne.io/mount-path:
      did: z2qaXXXX
      lastPublished: "2025-01-13T10:00:00Z"
      title: "My Project"
```

功能：首次发布创建新 Vibe，后续自动版本更新（使用已有 DID）。

### 3.4 授权凭证

- 存储文件：`~/.aigne/docsmith-connected.yaml`
- serviceName：`docsmith-publish`
- 环境变量：`DOCSMITH_ACCESS_TOKEN`
- 授权 source 标识：`DocSmith Publish Skill`
- appName：`DocSmith`
:::

::: reviewed {by=lban date=2026-02-13}
### 3.5 发布流程（无确认步骤）

1. 检测 dist 目录
2. 读取 config.yaml 获取 metadata
3. 获取授权 token
4. 查找发布历史（获取已有 DID）
5. ZIP 压缩 → 上传
6. 等待转换完成
7. 执行 publish action（title, description, visibility: public）
8. 获取 vibeUrl（从 `actionResult.vibeUrl`）
9. 展示 vibeUrl 给用户
10. 写入 vibeUrl 到 `config.yaml` 的 `appUrl` 字段
11. 保存发布历史

### 3.6 vibeUrl 处理

publish action 返回后：
- 使用 `actionResult.vibeUrl` 作为预览地址（与 contentUrl 平级）
- vibeUrl 写入 `.aigne/doc-smith/config.yaml` 的 `appUrl` 字段
- 同时在终端展示给用户

### 3.7 Hub URL

- 默认：`https://docsmith.aigne.io`
- 支持 `--hub` 参数覆盖（用于测试/私有部署）
:::

::: reviewed {by=lban date=2026-02-13}
## 4. SKILL.md 工作流

### Workflow

1. **检查依赖**：`test -d {skill_path}/scripts/node_modules || npm install --prefix {skill_path}/scripts`
2. **检测发布目标**：
   - 有 `--dir` → 使用指定目录
   - 无参数 → 查找 `.aigne/doc-smith/dist`
   - 都没有 → 检查当前目录是否为 doc-smith 输出
   - 找不到 → 报错
3. **读取 metadata**：从 `.aigne/doc-smith/config.yaml` 读取 projectName/projectDesc
4. **执行发布**：调用 publish.mjs
5. **展示结果**：显示 vibeUrl

### 脚本调用

```bash
node {skill_path}/scripts/publish.mjs --config-stdin <<'EOF'
{
  "source": { "type": "dir", "path": ".aigne/doc-smith/dist" },
  "hub": "https://docsmith.aigne.io",
  "workspace": ".aigne/doc-smith",
  "metadata": {
    "title": "Project Name",
    "description": "Project description",
    "visibility": "public"
  }
}
EOF
```

新增 `workspace` 字段用于：
- 读取/写入发布历史（`{workspace}/cache/publish-history.yaml`）
- 写入 appUrl 到 `{workspace}/config.yaml`
:::

::: reviewed {by=lban date=2026-02-13}
## 5. 错误处理

| 错误 | 处理 |
|------|------|
| dist 目录不存在 | 提示先运行 `/doc-smith-create` 生成文档 |
| config.yaml 不存在 | 提示非有效 doc-smith workspace |
| 依赖未安装 | 自动 `npm install` |
| 401/403 授权错误 | 自动清除 token，提示重新运行 |
| 网络错误 | 提示重试 |
| publish action 失败 | 提示用户重新运行 |
| Private mode 错误 | 提示改为 public 或升级 |
:::
