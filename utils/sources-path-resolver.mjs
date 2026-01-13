import { resolve } from "node:path";
import fs from "fs-extra";

/**
 * 判断是否为 /sources/... 绝对路径
 * @param {string} imagePath - 图片路径
 * @returns {boolean}
 */
export function isSourcesAbsolutePath(imagePath) {
  return imagePath.startsWith("/sources/");
}

/**
 * 解析 /sources/... 绝对路径，提取相对路径部分
 * @param {string} absolutePath - 绝对路径，格式: /sources/<relativePath>
 * @returns {string | null} - 相对路径，解析失败返回 null
 */
export function parseSourcesPath(absolutePath) {
  // /sources/assets/screenshot.png → assets/screenshot.png
  const match = absolutePath.match(/^\/sources\/(.+)$/);
  if (!match) return null;
  return match[1];
}

/**
 * 根据 config.yaml 的 sources 配置，将虚拟绝对路径解析为物理路径
 * 会依次在每个 source 中查找文件，返回第一个存在的路径
 *
 * 执行层视角（AFS 挂载后）：
 *   modules/workspace/ 和 modules/sources/ 平级
 *   文档中使用 /sources/<path> 格式引用
 *
 * 物理磁盘视角：
 *   - local-path: 相对于 workspace 的路径
 *   - git-clone: workspace/sources/<name>/ 目录
 *
 * @param {string} absolutePath - 虚拟绝对路径，格式: /sources/<relativePath>
 * @param {Array} sourcesConfig - config.yaml 中的 sources 配置数组
 * @param {string} workspaceBase - workspace 物理根目录
 * @returns {Promise<{physicalPath: string, sourceName: string} | null>} - 物理路径和 source 名称，解析失败返回 null
 */
export async function resolveSourcesPath(absolutePath, sourcesConfig, workspaceBase) {
  const relativePath = parseSourcesPath(absolutePath);
  if (!relativePath) return null;

  // 依次在每个 source 中查找
  for (const source of sourcesConfig) {
    let physicalPath;

    if (source.type === "local-path") {
      // local-path: 相对于 workspace 的路径
      physicalPath = resolve(workspaceBase, source.path, relativePath);
    } else if (source.type === "git-clone") {
      // git-clone: 克隆到 workspace/sources/<name>/ 目录
      physicalPath = resolve(workspaceBase, "sources", source.name, relativePath);
    } else {
      continue;
    }

    // 检查文件是否存在
    if (await fs.pathExists(physicalPath)) {
      return { physicalPath, sourceName: source.name };
    }
  }

  return null;
}

/**
 * 同步版本：根据配置解析路径（不检查文件存在性，返回第一个 source 的路径）
 * 用于需要同步处理的场景
 *
 * @param {string} absolutePath - 虚拟绝对路径
 * @param {Array} sourcesConfig - sources 配置数组
 * @param {string} workspaceBase - workspace 物理根目录
 * @returns {{physicalPath: string, sourceName: string} | null}
 */
export function resolveSourcesPathSync(absolutePath, sourcesConfig, workspaceBase) {
  const relativePath = parseSourcesPath(absolutePath);
  if (!relativePath) return null;

  // 返回第一个 source 的路径（不检查存在性）
  for (const source of sourcesConfig) {
    let physicalPath;

    if (source.type === "local-path") {
      physicalPath = resolve(workspaceBase, source.path, relativePath);
    } else if (source.type === "git-clone") {
      physicalPath = resolve(workspaceBase, "sources", source.name, relativePath);
    } else {
      continue;
    }

    return { physicalPath, sourceName: source.name };
  }

  return null;
}
