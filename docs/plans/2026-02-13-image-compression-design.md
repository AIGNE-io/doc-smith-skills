# AI 生成图片 PNG 压缩方案

## 背景

doc-smith-images 通过 Gemini 3 Pro 生成技术图表（架构图、流程图等），默认 1K 分辨率，输出 PNG 格式。当前 `save-image.mjs` 只做 `fs.copyFile`，未做任何压缩。AI 生成的 PNG 图片通常 300KB-1.5MB，对文档发布体积和加载速度有影响。

## 目标

在图片生成后立即压缩，保持展示质量不变，减小文件体积 60-80%。

## 方案选择

| 方案 | 工具 | 优点 | 缺点 |
|------|------|------|------|
| **A (选定)** | sharp (Node.js) | 跨平台、无需额外安装、生态成熟 | 增加约 30MB 依赖 |
| B | pngquant CLI | 压缩效果最佳 | 需用户手动安装 |
| C | pngquant-bin | npm 自动下载 | 平台兼容性不如 sharp |

选定方案 A：用 sharp 在 save-image.mjs 中做 PNG 压缩。

## 修改范围

仅 2 个文件：

1. `skills/doc-smith-images/scripts/aigne-generate/save-image.mjs` — 核心压缩逻辑
2. `skills/doc-smith-images/scripts/aigne-generate/package.json` — 添加 sharp 依赖

## 实现细节

### save-image.mjs 改动

将 `fs.copyFile(sourcePath, savePath)` 替换为 sharp 管道：

```js
import sharp from 'sharp';

// 压缩并保存
const result = await sharp(sourcePath)
  .png({ compressionLevel: 9, palette: true })
  .toFile(savePath);
```

关键参数：
- `compressionLevel: 9` — 最高无损压缩级别
- `palette: true` — 启用调色板量化，对色彩有限的技术图表效果极好

### 错误处理

sharp 压缩失败时，回退到 `fs.copyFile`，确保不阻断图片保存流程。

### 输出信息

返回压缩前后对比：

```
图片已保存到 ./images/arch.png（180.5 KB，压缩 65%）
```

## 不做的事

- 不改变输出格式（保持 PNG）
- 不改变调用方接口
- 不添加压缩开关参数（默认压缩，无需配置）
