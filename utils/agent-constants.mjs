/**
 * 路径常量定义
 * 集中管理项目中使用的文件路径
 */

// 文档相关路径
export const PATHS = {
  // 项目根目录
  DOC_SMITH_DIR: "./",

  // 临时目录
  TMP_DIR: ".tmp",

  // 缓存目录
  CACHE: "cache",

  // 文档结构文件
  DOCUMENT_STRUCTURE: "planning/document-structure.yaml",

  // 文档目录
  DOCS_DIR: "docs",

  // 资源目录（图片等）
  ASSETS_DIR: "assets",

  // 配置文件
  CONFIG: "config.yaml",

  // 术语表
  GLOSSARY: "intent/GLOSSARY.md",

  // 规划目录
  PLANNING_DIR: "planning",
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
