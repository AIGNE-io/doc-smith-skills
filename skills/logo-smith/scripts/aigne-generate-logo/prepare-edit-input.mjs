import { basename } from "node:path";
import { access, constants } from "node:fs/promises";

/**
 * 准备 Logo 编辑的输入参数
 * 将编辑请求转换为 generate-image.yaml 所需的 image-to-image 格式
 *
 * @param {Object} input - 输入参数
 * @param {string} input.desc - 编辑要求/修改说明
 * @param {string} input.sourcePath - 源 Logo 路径
 * @param {string} input.savePath - 输出文件路径
 * @param {string} input.style - 目标风格模板
 * @param {string} input.colorPreference - 颜色偏好
 * @param {string} input.aspectRatio - 宽高比
 * @param {string} input.size - 图片尺寸
 * @returns {Promise<Object>} - 准备好的输入参数
 */
export default async function prepareEditInput(input) {
  const {
    desc,
    sourcePath,
    savePath,
    style = "",
    colorPreference = "",
    aspectRatio = "1:1",
    size = "2K",
  } = input;

  try {
    // 验证源 Logo 存在
    await access(sourcePath, constants.R_OK);

    // 确定 MIME 类型
    const ext = sourcePath.toLowerCase();
    let mimeType = "image/png";
    if (ext.endsWith(".jpg") || ext.endsWith(".jpeg")) {
      mimeType = "image/jpeg";
    } else if (ext.endsWith(".webp")) {
      mimeType = "image/webp";
    }

    // 构建 existingImage 参数（mediaFile 格式）
    const existingImage = [
      {
        type: "local",
        path: sourcePath,
        filename: basename(sourcePath),
        mimeType,
      },
    ];

    // 构建编辑描述
    let editDesc = desc;

    // 如果指定了风格，增强描述
    if (style) {
      editDesc = `${desc}。应用 ${style} 风格。`;
    }

    return {
      success: true,
      // 传递给 generate-image.yaml 的参数
      desc: editDesc,
      name: "", // 编辑模式保持原有名称
      style,
      colorPreference,
      size,
      aspectRatio,
      existingImage,
      useImageToImage: true,
      feedback: desc, // 将编辑要求作为 feedback 传递
      // 传递给 save-image.mjs 的参数
      savePath,
      message: `准备编辑 Logo: ${sourcePath} → ${savePath}`,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        success: false,
        error: "SOURCE_NOT_FOUND",
        message: `源 Logo 不存在: ${sourcePath}`,
        suggestion: "请检查文件路径是否正确",
      };
    }
    return {
      success: false,
      error: "UNEXPECTED_ERROR",
      message: `准备 Logo 编辑输入时发生错误: ${error.message}`,
    };
  }
}

// 添加描述信息
prepareEditInput.description =
  "准备 Logo 编辑的输入参数，将编辑请求转换为 generate-image.yaml 所需的 image-to-image 格式。" +
  "支持配色调整、风格修改、重新设计等场景。";

// 定义输入 schema
prepareEditInput.input_schema = {
  type: "object",
  required: ["desc", "sourcePath", "savePath"],
  properties: {
    desc: {
      type: "string",
      description: "编辑要求/修改说明",
    },
    sourcePath: {
      type: "string",
      description: "源 Logo 路径（要编辑的 Logo）",
    },
    savePath: {
      type: "string",
      description: "输出文件路径",
    },
    style: {
      type: "string",
      description: "目标风格模板",
      default: "",
    },
    colorPreference: {
      type: "string",
      description: "颜色偏好",
      default: "",
    },
    aspectRatio: {
      type: "string",
      description: "宽高比",
      default: "1:1",
    },
    size: {
      type: "string",
      description: "图片尺寸",
      default: "2K",
    },
  },
};

// 定义输出 schema
prepareEditInput.output_schema = {
  type: "object",
  required: ["success"],
  properties: {
    success: {
      type: "boolean",
      description: "操作是否成功",
    },
    desc: {
      type: "string",
      description: "编辑描述（可能经过增强）",
    },
    name: {
      type: "string",
      description: "Logo 名称",
    },
    style: {
      type: "string",
      description: "风格模板",
    },
    colorPreference: {
      type: "string",
      description: "颜色偏好",
    },
    size: {
      type: "string",
      description: "图片尺寸",
    },
    aspectRatio: {
      type: "string",
      description: "宽高比",
    },
    existingImage: {
      type: "array",
      description: "源 Logo mediaFile 对象数组",
      items: { type: "object" },
    },
    useImageToImage: {
      type: "boolean",
      description: "是否使用 image-to-image 模式",
    },
    feedback: {
      type: "string",
      description: "用户反馈/编辑要求",
    },
    savePath: {
      type: "string",
      description: "输出文件路径",
    },
    message: {
      type: "string",
      description: "操作结果描述",
    },
    error: {
      type: "string",
      description: "错误代码（失败时存在）",
    },
    suggestion: {
      type: "string",
      description: "建议操作（失败时存在）",
    },
  },
};
