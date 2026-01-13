import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 检测 workspace 基础路径
 * 根据 config.yaml 位置自动判断 workspace 模式
 */
function detectWorkspaceBase() {
  const cwd = process.cwd();

  // 检测 config.yaml 位置，确定 workspace 模式
  const projectConfigPath = join(cwd, ".aigne/doc-smith/config.yaml");

  if (existsSync(projectConfigPath)) {
    // project 模式：workspace 在 .aigne/doc-smith/
    return join(cwd, ".aigne/doc-smith");
  }

  // standalone 模式或未初始化：workspace 就是当前目录
  return cwd;
}

// 计算 workspace 基础路径
const WORKSPACE_BASE = detectWorkspaceBase();

/**
 * 路径常量定义
 * 所有路径都是基于 workspace 的绝对路径
 */
export const PATHS = {
  // Workspace 根目录
  WORKSPACE_BASE,

  // 临时目录
  TMP_DIR: resolve(WORKSPACE_BASE, ".tmp"),

  // 缓存目录
  CACHE: resolve(WORKSPACE_BASE, "cache"),

  // 文档结构文件
  DOCUMENT_STRUCTURE: resolve(WORKSPACE_BASE, "planning/document-structure.yaml"),

  // 文档目录
  DOCS_DIR: resolve(WORKSPACE_BASE, "docs"),

  // 资源目录（图片等）
  ASSETS_DIR: resolve(WORKSPACE_BASE, "assets"),

  // 配置文件
  CONFIG: resolve(WORKSPACE_BASE, "config.yaml"),

  // 术语表
  GLOSSARY: resolve(WORKSPACE_BASE, "intent/GLOSSARY.md"),

  // 规划目录
  PLANNING_DIR: resolve(WORKSPACE_BASE, "planning"),
};

/**
 * 错误代码常量
 * 统一管理错误类型
 */
export const ERROR_CODES = {
  // 文件系统相关
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_READ_ERROR: "FILE_READ_ERROR",
  FILE_WRITE_ERROR: "FILE_WRITE_ERROR",
  FILE_OPERATION_ERROR: "FILE_OPERATION_ERROR",

  // 文档结构相关
  MISSING_STRUCTURE_FILE: "MISSING_STRUCTURE_FILE",
  INVALID_STRUCTURE_FILE: "INVALID_STRUCTURE_FILE",

  // 配置相关
  MISSING_CONFIG_FILE: "MISSING_CONFIG_FILE",
  MISSING_LOCALE: "MISSING_LOCALE",

  // 内容相关
  EMPTY_CONTENT: "EMPTY_CONTENT",
  INVALID_CONTENT: "INVALID_CONTENT",

  // 路径相关
  INVALID_PATH: "INVALID_PATH",
  PATH_NOT_IN_STRUCTURE: "PATH_NOT_IN_STRUCTURE",
  INVALID_DOC_PATHS: "INVALID_DOC_PATHS",

  // 语言相关
  INVALID_LANGUAGE: "INVALID_LANGUAGE",
  MISSING_LANGS: "MISSING_LANGS",
  MISSING_SOURCE_FILE: "MISSING_SOURCE_FILE",

  // 其他
  SAVE_ERROR: "SAVE_ERROR",
  UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
};

/**
 * 文件类型常量
 */
export const FILE_TYPES = {
  META: ".meta.yaml",
  MARKDOWN: ".md",
  YAML: ".yaml",
};

/**
 * 文档元信息默认值
 */
export const DOC_META_DEFAULTS = {
  KIND: "doc",
};
