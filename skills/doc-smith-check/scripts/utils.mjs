import { readFile, access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { parse as yamlParse } from "yaml";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

/**
 * 获取基础路径（基于执行目录下的 .aigne/doc-smith 目录）
 */
export function getPaths() {
  const workspaceBase = resolve(process.cwd(), ".aigne/doc-smith");
  return {
    WORKSPACE_BASE: workspaceBase,
    DOCUMENT_STRUCTURE: resolve(workspaceBase, "planning/document-structure.yaml"),
    DOCS_DIR: resolve(workspaceBase, "docs"),
    CONFIG: resolve(workspaceBase, "config.yaml"),
  };
}

/**
 * 错误代码常量
 */
export const ERROR_CODES = {
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  MISSING_STRUCTURE_FILE: "MISSING_STRUCTURE_FILE",
  INVALID_STRUCTURE_FILE: "INVALID_STRUCTURE_FILE",
  MISSING_CONFIG_FILE: "MISSING_CONFIG_FILE",
  MISSING_LOCALE: "MISSING_LOCALE",
  SOURCE_LOCALE_MISMATCH: "SOURCE_LOCALE_MISMATCH",
  MISSING_TRANSLATE_LANGUAGE: "MISSING_TRANSLATE_LANGUAGE",
  INVALID_LINK_FORMAT: "INVALID_LINK_FORMAT",
  UNREPLACED_IMAGE_SLOT: "UNREPLACED_IMAGE_SLOT",
  IMAGE_PATH_LEVEL_ERROR: "IMAGE_PATH_LEVEL_ERROR",
  MISSING_SLOT_IMAGE: "MISSING_SLOT_IMAGE",
};

/**
 * 解析命令行参数
 * @param {string[]} args - 命令行参数数组
 * @returns {Object} - 解析后的参数对象
 */
export function parseCliArgs(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      path: {
        type: "string",
        short: "p",
        multiple: true,
      },
      "check-slots": {
        type: "boolean",
        default: false,
      },
    },
    allowPositionals: false,
    strict: false,
  });

  return {
    paths: values.path || [],
    checkSlots: values["check-slots"] || false,
  };
}

/**
 * 递归收集文档路径
 * @param {Array} docs - 文档数组
 * @param {Object} options - 收集选项
 * @returns {Set|Array} - 路径集合或路径对象数组
 */
export function collectDocumentPaths(docs, options = {}) {
  const { includeBothFormats = false, collectMetadata = false } = options;

  const paths = collectMetadata ? [] : new Set();

  function collect(documents) {
    for (const doc of documents) {
      if (doc.path) {
        const normalized = doc.path.startsWith("/") ? doc.path.slice(1) : doc.path;

        if (collectMetadata) {
          paths.push({
            path: normalized,
            displayPath: `/${normalized}`,
            title: doc.title || "",
            description: doc.description || "",
          });
        } else {
          paths.add(normalized);
          if (includeBothFormats) {
            paths.add(`/${normalized}`);
          }
        }
      }

      if (doc.children && Array.isArray(doc.children)) {
        collect(doc.children);
      }
    }
  }

  collect(docs);
  return paths;
}

/**
 * 加载文档结构中的所有路径
 * @param {Object} options - 加载选项
 * @returns {Promise<Set|Array>} - 所有有效路径的集合
 */
export async function loadDocumentPaths(options = {}) {
  const PATHS = getPaths();
  const {
    yamlPath = PATHS.DOCUMENT_STRUCTURE,
    includeBothFormats = false,
    collectMetadata = false,
  } = options;

  try {
    await access(yamlPath, constants.F_OK | constants.R_OK);
  } catch (_error) {
    throw new Error(ERROR_CODES.MISSING_STRUCTURE_FILE);
  }

  const content = await readFile(yamlPath, "utf8");
  const data = yamlParse(content);

  if (!data.documents || !Array.isArray(data.documents)) {
    throw new Error(ERROR_CODES.INVALID_STRUCTURE_FILE);
  }

  return collectDocumentPaths(data.documents, {
    includeBothFormats,
    collectMetadata,
  });
}

/**
 * 加载配置文件
 * @returns {Promise<Object|null>} - 配置对象或 null
 */
export async function loadConfigFromFile() {
  const PATHS = getPaths();
  try {
    await access(PATHS.CONFIG, constants.F_OK);
    const configContent = await readFile(PATHS.CONFIG, "utf8");
    return yamlParse(configContent);
  } catch (_error) {
    return null;
  }
}

/**
 * 判断是否为 /sources/... 绝对路径
 * @param {string} imagePath - 图片路径
 * @returns {boolean}
 */
export function isSourcesAbsolutePath(imagePath) {
  return imagePath.startsWith("/sources/");
}

/**
 * 解析 /sources/... 绝对路径
 * @param {string} absolutePath - 绝对路径
 * @returns {string | null} - 相对路径
 */
export function parseSourcesPath(absolutePath) {
  const match = absolutePath.match(/^\/sources\/(.+)$/);
  if (!match) return null;

  const relativePath = match[1];

  // 安全检查：拒绝路径遍历
  if (relativePath.includes("..")) {
    return null;
  }

  return relativePath;
}

/**
 * 解析 sources 路径到物理路径
 * @param {string} absolutePath - 虚拟绝对路径
 * @param {Array} sourcesConfig - sources 配置
 * @param {string} workspaceBase - workspace 根目录
 * @returns {Promise<{physicalPath: string, sourceName: string} | null>}
 */
export async function resolveSourcesPath(absolutePath, sourcesConfig, workspaceBase) {
  const relativePath = parseSourcesPath(absolutePath);
  if (!relativePath) return null;

  for (const source of sourcesConfig) {
    let physicalPath;

    if (source.type === "local-path") {
      physicalPath = resolve(workspaceBase, source.path, relativePath);
    } else if (source.type === "git-clone") {
      physicalPath = resolve(workspaceBase, "sources", source.name, relativePath);
    } else {
      continue;
    }

    try {
      await stat(physicalPath);
      return { physicalPath, sourceName: source.name };
    } catch (_error) {}
  }

  return null;
}
