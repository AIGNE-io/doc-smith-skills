import { join, relative, dirname, basename } from "node:path";
import fs from "fs-extra";

/**
 * 扫描文档目录，识别所有包含 .meta.yaml 的文档目录
 * @param {string} docsDir - 文档根目录路径
 * @returns {Promise<Array>} 文档列表，每个文档包含 {dirPath, dirName, locale, content, depth}
 */
export async function scanDocuments(docsDir) {
  const documents = [];

  async function scanDir(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    // 检查是否包含 .meta.yaml
    const hasMetaFile = entries.some((entry) => entry.isFile() && entry.name === ".meta.yaml");

    if (hasMetaFile) {
      // 这是一个文档目录，读取所有语言文件
      const markdownFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md"));

      // 计算文档深度（相对于 docs/ 的层级）
      const relativePath = relative(docsDir, currentPath);
      const depth = relativePath === "" ? 0 : relativePath.split("/").length;

      const dirName = basename(currentPath);

      for (const file of markdownFiles) {
        const locale = file.name.replace(".md", "");
        const filePath = join(currentPath, file.name);
        const content = await fs.readFile(filePath, "utf8");

        documents.push({
          dirPath: currentPath,
          dirName,
          locale,
          content,
          depth,
          relativePath,
        });
      }
    }

    // 递归扫描子目录
    const subDirs = entries.filter((entry) => entry.isDirectory());
    for (const subDir of subDirs) {
      await scanDir(join(currentPath, subDir.name));
    }
  }

  await scanDir(docsDir);
  return documents;
}

/**
 * 根据文档深度和语言计算目标路径
 * @param {string} relativePath - 相对于 docs/ 的路径
 * @param {string} dirName - 文档目录名
 * @param {string} locale - 语言代码
 * @param {number} depth - 文档深度
 * @returns {string} 目标文件路径（相对于目标目录）
 */
export function getTargetPath(relativePath, dirName, locale, depth) {
  // 英文文档不带语言后缀，其他语言带后缀
  const suffix = locale === "en" ? ".md" : `.${locale}.md`;
  const fileName = `${dirName}${suffix}`;

  if (depth === 1) {
    // 单级路径：文件移到根目录
    return fileName;
  }

  // 多级路径：保留父级目录，文件名使用目录名
  const parentPath = dirname(relativePath);
  return join(parentPath, fileName);
}

/**
 * 为内部链接添加 .md 后缀
 * @param {string} content - 文档内容
 * @returns {string} 处理后的内容
 */
export function addMarkdownSuffixToLinks(content) {
  // 匹配 Markdown 链接：[text](path)
  // 但不匹配图片：![alt](path)
  // 不匹配外部链接（http:// 或 https://）
  // 不匹配已有 .md 后缀的链接

  return content.replace(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    // 跳过外部链接
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return match;
    }

    // 跳过已有 .md 后缀的链接
    if (url.includes(".md")) {
      return match;
    }

    // 跳过非文档链接（如 mailto:, #anchor 等）
    if (url.includes(":") || url.startsWith("#")) {
      return match;
    }

    // 分离路径和锚点
    const hashIndex = url.indexOf("#");
    if (hashIndex !== -1) {
      const path = url.substring(0, hashIndex);
      const hash = url.substring(hashIndex);
      return `[${text}](${path}.md${hash})`;
    }

    // 添加 .md 后缀
    return `[${text}](${url}.md)`;
  });
}

/**
 * 调整图片路径（根据文档深度）
 * @param {string} content - 文档内容
 * @param {number} depth - 文档深度
 * @returns {string} 处理后的内容
 */
export function adjustImagePaths(content, depth) {
  // 深度 1 的文档向上移动一层，需要移除一个 ../
  // 深度 2+ 的文档路径保持不变

  if (depth !== 1) {
    return content;
  }

  // 匹配图片链接：![alt](path)
  return content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, path) => {
    // 只处理相对路径（包含 ../ 的路径）
    if (!path.startsWith("../")) {
      return match;
    }

    // 移除一个 ../
    const newPath = path.replace(/^\.\.\//, "");
    return `![${alt}](${newPath})`;
  });
}

/**
 * 复制文档到临时目录并进行转换
 * @param {string} sourceDir - 源文档目录
 * @param {string} targetDir - 目标目录
 * @returns {Promise<Object>} 转换统计信息
 */
export async function copyDocumentsToTemp(sourceDir, targetDir) {
  // 扫描所有文档
  const documents = await scanDocuments(sourceDir);

  if (documents.length === 0) {
    console.warn("⚠️  No documents found to convert.");
    return { total: 0, converted: 0 };
  }

  const stats = {
    total: documents.length,
    converted: 0,
    depth1: 0,
    depth2Plus: 0,
  };

  // 处理每个文档
  for (const doc of documents) {
    const { relativePath, dirName, locale, content, depth } = doc;

    // 计算目标路径
    const targetPath = getTargetPath(relativePath, dirName, locale, depth);
    const fullTargetPath = join(targetDir, targetPath);

    // 处理内容
    let processedContent = content;

    // 1. 为内部链接添加 .md 后缀
    processedContent = addMarkdownSuffixToLinks(processedContent);

    // 2. 调整图片路径
    processedContent = adjustImagePaths(processedContent, depth);

    // 创建目标目录并写入文件
    await fs.ensureDir(dirname(fullTargetPath));
    await fs.writeFile(fullTargetPath, processedContent, "utf8");

    stats.converted++;
    if (depth === 1) {
      stats.depth1++;
    } else {
      stats.depth2Plus++;
    }
  }

  return stats;
}
