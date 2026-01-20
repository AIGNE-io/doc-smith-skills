import fs from "node:fs/promises";
import path from "node:path";

/**
 * 将 Image Agent 生成的图片保存到指定路径
 */
export default async function saveImage(input) {
  const { images, savePath } = input;

  // 验证输入
  if (!images || !Array.isArray(images) || images.length === 0) {
    return {
      success: false,
      error: "No images in input",
      ...input,
    };
  }

  if (!savePath) {
    return {
      success: false,
      error: "No savePath specified",
      ...input,
    };
  }

  const sourceImage = images[0];
  const sourcePath = sourceImage.path;

  // 检查源文件是否存在
  try {
    await fs.access(sourcePath);
  } catch {
    return {
      success: false,
      error: `Source image not found: ${sourcePath}`,
      ...input,
    };
  }

  // 确保输出目录存在
  const outputDir = path.dirname(savePath);
  await fs.mkdir(outputDir, { recursive: true });

  // 复制图片到目标路径
  try {
    await fs.copyFile(sourcePath, savePath);

    // 验证复制成功
    const stats = await fs.stat(savePath);

    return {
      success: true,
      savedPath: savePath,
      fileSize: stats.size,
      mimeType: sourceImage.mimeType,
      ...input,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to save image: ${err.message}`,
      ...input,
    };
  }
}

saveImage.description = "Save generated image to specified path";
saveImage.input_schema = {
  type: "object",
  properties: {
    images: {
      type: "array",
      description: "Image Agent output - array of generated images",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          filename: { type: "string" },
          mimeType: { type: "string" },
        },
      },
    },
    savePath: {
      type: "string",
      description: "Output file path to save the image",
    },
  },
  required: ["images", "savePath"],
};
saveImage.output_schema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    savedPath: { type: "string" },
    fileSize: { type: "number" },
    error: { type: "string" },
  },
};
