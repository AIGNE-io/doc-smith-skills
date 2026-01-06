import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { PATHS, ERROR_CODES } from "../../utils/agent-constants.mjs";

/**
 * 准备翻译所需的文档内容
 * @param {Object} input - 输入参数
 * @param {string} input.path - 文档路径
 * @param {string} input.sourceLanguage - 源语言代码
 * @param {string} input.language - 当前迭代的目标语言代码（来自 iterate_on）
 * @returns {Promise<Object>} - 包含源文档内容、旧翻译和目标文件路径
 */
export default async function prepareDocContent(input) {
  try {
    const { path: docPath, sourceLanguage, language } = input;

    // 当使用 iterate_on 时，对象属性会被展开，直接接收 language 字段
    const targetLanguage = language;

    // 1. 构建文件路径
    const docFolder = path.join(PATHS.DOCS_DIR, docPath);
    const sourceFile = path.join(docFolder, `${sourceLanguage}.md`);
    const targetFile = path.join(docFolder, `${targetLanguage}.md`);

    // 2. 读取源文档
    let content;
    try {
      await access(sourceFile, constants.F_OK | constants.R_OK);
      content = await readFile(sourceFile, "utf8");
    } catch (_error) {
      return {
        success: false,
        error: ERROR_CODES.MISSING_SOURCE_FILE,
        message: `源文档不存在: ${sourceFile}`,
        suggestion: "请确保源语言文档已创建",
      };
    }

    // 3. 尝试读取旧翻译（作为参考）
    let previousTranslation = "";
    try {
      await access(targetFile, constants.F_OK | constants.R_OK);
      previousTranslation = await readFile(targetFile, "utf8");
    } catch (_error) {
      // 旧翻译不存在，这是正常的
    }

    return {
      success: true,
      content,
      previousTranslation,
      targetFile,
      targetLanguage,
      language: targetLanguage, // 用于 translate-document.yaml
      message: previousTranslation
        ? `已加载源文档和旧翻译: ${docPath} (${sourceLanguage} -> ${targetLanguage})`
        : `已加载源文档: ${docPath} (${sourceLanguage} -> ${targetLanguage})`,
    };
  } catch (error) {
    return {
      success: false,
      error: "FILE_READ_ERROR",
      message: `读取文档时发生错误: ${error.message}`,
      suggestion: "请检查文件系统权限",
    };
  }
}

// 添加描述信息
prepareDocContent.description =
  "准备翻译所需的文档内容。" +
  "读取源语言文档，尝试读取已有的翻译版本作为参考上下文，" +
  "返回文档内容、旧翻译和目标文件路径。";

// 定义输入 schema
prepareDocContent.input_schema = {
  type: "object",
  required: ["path", "sourceLanguage", "language"],
  properties: {
    path: {
      type: "string",
      description: "文档路径",
    },
    sourceLanguage: {
      type: "string",
      description: "源语言代码",
    },
    language: {
      type: "string",
      description: "目标语言代码（来自 iterate_on，对象属性已展开）",
    },
  },
};

// 定义输出 schema
prepareDocContent.output_schema = {
  type: "object",
  required: ["success"],
  properties: {
    success: {
      type: "boolean",
      description: "操作是否成功",
    },
    content: {
      type: "string",
      description: "源文档内容（成功时存在）",
    },
    previousTranslation: {
      type: "string",
      description: "旧翻译内容（如存在，成功时存在）",
    },
    targetFile: {
      type: "string",
      description: "目标文件路径（成功时存在）",
    },
    targetLanguage: {
      type: "string",
      description: "目标语言代码（成功时存在）",
    },
    language: {
      type: "string",
      description: "目标语言代码（用于 translate-document.yaml，成功时存在）",
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
