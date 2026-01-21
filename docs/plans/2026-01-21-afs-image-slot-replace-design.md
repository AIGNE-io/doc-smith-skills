# AFS Image Slot 即时替换设计

## 背景

当前流程中，文档生成时只生成 `<!-- afs:image ... -->` 占位符，图片生成后占位符仍保留在文档中，直到发布时才在 tmp 目录中替换为真实图片路径。

**问题**：用户无法在发布前预览文档中的图片效果。

**目标**：图片生成后立即替换占位符，使文档「自包含」，可在任意环境预览。

## 设计决策

### 关于「占位符意图丢失」的顾虑

分析后认为这不是问题：

1. **意图已持久化**：`generate-slot-image` 在生成图片前创建 `.meta.yaml`，包含 `slot.id`、`slot.desc`、`generation.prompt` 等完整信息
2. **重复生成判断**：现有逻辑检查 `assets/{key}/images/` 目录是否存在图片，不依赖文档中的占位符
3. **重新生成机制**：用户可通过 `force=true` 或 `editRequirements` 参数触发重新生成

### 校验机制

由于 AI 执行的替换操作不能 100% 保证正确，需要程序化校验兜底：

- `doc-smith-check --content`：文档刚生成时，允许 slot 存在
- `doc-smith-check --content --check-slots`：图片生成后，要求 slot 必须已替换且路径正确

## 修改范围

| 组件 | 修改内容 |
|------|----------|
| `generate-slot-image` agent | 生成图片后替换文档中的占位符 |
| `doc-smith-check` skill | 新增 `--check-slots` 参数和校验逻辑 |
| `doc-smith` skill | 更新流程，图片生成后调用 `--check-slots` |

## 详细设计

### 1. generate-slot-image agent 修改

在步骤 7（调用 doc-smith-images 生成图片）之后，新增步骤 8：

#### 8. 替换文档中的占位符

图片生成成功后，更新文档中对应的 slot：

1. 读取文档文件：`.aigne/doc-smith/docs/{docPath}/{locale}.md`

2. 计算图片相对路径：
   - 根据文档深度计算 `../` 的数量
   - 深度 1（如 /overview）：`../assets/{key}/images/{locale}.png`
   - 深度 2（如 /api/auth）：`../../assets/{key}/images/{locale}.png`

3. 构建图片 Markdown：
   ```markdown
   ![{slotDesc}]({相对路径})
   ```

4. 替换占位符：
   - 查找：`<!-- afs:image id="{slotId}" ... -->`
   - 替换为：`![{slotDesc}]({相对路径})`

5. 写回文档文件

#### 返回摘要更新

```
成功生成图片:
- 文档: /overview
- Slot: architecture-overview
- Prompt: 电商系统微服务架构图...
- 图片: .aigne/doc-smith/assets/architecture-overview/images/zh.png
- 元文件: .aigne/doc-smith/assets/architecture-overview/.meta.yaml ✓
- 文档已更新: .aigne/doc-smith/docs/overview/zh.md ✓
```

### 2. doc-smith-check 修改

#### 新增参数

```bash
# 现有用法保持不变
/doc-smith-check --content

# 新增：要求 slot 必须已替换
/doc-smith-check --content --check-slots
/doc-smith-check -c --check-slots
```

#### 校验逻辑

当 `--check-slots` 启用时，执行以下检查：

| 检查项 | 说明 |
|--------|------|
| slot 已替换 | 文档中不应存在 `<!-- afs:image ... -->` 占位符（排除代码块中的示例） |
| 路径正确 | 图片引用路径相对于文档位置的层级正确 |
| 文件存在 | 对应的图片文件确实存在于 assets 目录 |

#### 代码块排除逻辑

复用现有的 `getCodeBlockRanges` 和 `isInCodeBlock` 方法，排除代码块中的 slot（示例代码）：

```javascript
async validateImageSlots(content, doc, langFile) {
  // 1. 获取代码块位置范围
  const codeBlockRanges = this.getCodeBlockRanges(content);

  // 2. 匹配所有 slot
  const slotRegex = /<!--\s*afs:image\s+id="([^"]+)".*?-->/g;

  for (const match of content.matchAll(slotRegex)) {
    // 3. 跳过代码块中的 slot
    if (this.isInCodeBlock(match.index, codeBlockRanges)) {
      continue;
    }

    // 4. 报错：未替换的 slot
    const slotId = match[1];
    this.errors.fatal.push({
      type: "UNREPLACED_IMAGE_SLOT",
      path: doc.path,
      langFile,
      slotId,
      message: `AFS image slot 未替换: ${slotId}`,
      suggestion: `请使用 generate-slot-image 生成图片`,
    });
  }
}
```

#### 错误报告格式

```
❌ AFS Image Slot 检查失败:

未替换的 slot (2):
  1. 文档: /overview
     Slot ID: architecture-overview
     操作: 请使用 generate-slot-image 生成图片

  2. 文档: /api/auth
     Slot ID: auth-flow
     操作: 请使用 generate-slot-image 生成图片

路径层级错误 (1):
  1. 文档: /guides/start
     图片: ![setup](../assets/setup/images/zh.png)
     期望: ../../assets/setup/images/zh.png
     操作: 修正相对路径层级

图片文件缺失 (1):
  1. 文档: /overview
     图片: ../assets/data-flow/images/zh.png
     操作: 生成图片或移除引用
```

### 3. doc-smith skill 流程更新

#### 任务规划模板更新

```markdown
生成新文档参考模板:
- [ ] 阶段 0: Workspace 检查
- [ ] 阶段 1: 分析数据源
- [ ] 阶段 2: 推断用户意图
- [ ] 阶段 3: 规划文档结构
- [ ] 阶段 4: 生成 document-structure.yaml
- [ ] 阶段 5: 确认文档结构
- [ ] 阶段 6: 生成文档内容
- [ ] 阶段 7: 生成 AFS Image Slot 图片
- [ ] 阶段 7.5: 校验图片 slot 已替换  ← 新增
- [ ] 阶段 8: 结束前确认

更新文档参考模板:
- [ ] 阶段 0: Workspace 检查
- [ ] 阶段 1: 分析更新需求
- [ ] 阶段 2: 检查是否需要修改文档结构
- [ ] 阶段 3: 应用文档内容更新
- [ ] 阶段 4: 处理文档中的 PATCH 标记
- [ ] 阶段 5: 生成新增的 AFS Image Slot 图片
- [ ] 阶段 5.5: 校验图片 slot 已替换  ← 新增
- [ ] 阶段 6: 执行文档结构和内容校验
- [ ] 阶段 7: 确认所有更新任务完成
```

#### 阶段 7.5 / 5.5 描述

```markdown
### 校验图片 slot 已替换

图片生成完成后，执行 slot 替换校验：

**调用方式**：
```bash
/doc-smith-check --content --check-slots
```

**校验内容**：
- 文档中不存在未替换的 `<!-- afs:image ... -->` 占位符
- 图片引用的相对路径层级正确
- 引用的图片文件存在

**失败处理**：
1. 分析错误报告
2. 对于未替换的 slot：重新调用 `generate-slot-image` 生成
3. 对于路径错误：手动修正文档中的图片路径
4. 修复后重新执行校验
```

## 实现顺序

1. **doc-smith-check**：先实现校验逻辑，便于测试
2. **generate-slot-image**：实现替换逻辑
3. **doc-smith**：更新流程文档

## 兼容性

- 发布流程的 `replaceImageSlots` 函数保留作为兜底，处理遗漏的 slot
- 现有文档中的 slot 在下次图片生成时会被替换
