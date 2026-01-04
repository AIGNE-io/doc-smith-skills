import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { parse as yamlParse } from "yaml";
import path from "node:path";

/**
 * 文档内容校验器类
 */
class DocumentContentValidator {
  constructor(yamlPath = "planning/document-structure.yaml", docsDir = "docs") {
    this.yamlPath = yamlPath;
    this.docsDir = docsDir;
    this.errors = {
      fatal: [],
      fixable: [],
      warnings: [],
    };
    this.stats = {
      totalDocs: 0,
      checkedDocs: 0,
      totalLinks: 0,
      totalImages: 0,
      localImages: 0,
      remoteImages: 0,
      brokenLinks: 0,
      missingImages: 0,
      inaccessibleRemoteImages: 0,
    };
    this.documents = [];
    this.documentPaths = new Set();
    this.remoteImageCache = new Map();
  }

  /**
   * 执行完整校验
   */
  async validate(checkRemoteImages = true) {
    try {
      // Layer 1: 加载文档结构并验证文件存在性
      await this.loadDocumentStructure();
      await this.validateDocumentFiles();

      // Layer 2-4: 逐个检查文档内容
      for (const doc of this.documents) {
        await this.validateDocument(doc, checkRemoteImages);
      }

      return this.getResult();
    } catch (error) {
      this.errors.fatal.push({
        type: "VALIDATION_ERROR",
        message: `校验过程出错: ${error.message}`,
      });
      return this.getResult();
    }
  }

  /**
   * Layer 1: 加载文档结构
   */
  async loadDocumentStructure() {
    try {
      const content = await readFile(this.yamlPath, "utf8");
      const data = yamlParse(content);

      if (!data.documents || !Array.isArray(data.documents)) {
        throw new Error("document-structure.yaml 缺少 documents 字段或格式错误");
      }

      // 递归收集所有文档路径
      this.collectDocuments(data.documents);
      this.stats.totalDocs = this.documents.length;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`文件不存在: ${this.yamlPath}`);
      }
      throw error;
    }
  }

  /**
   * 递归收集文档路径
   */
  collectDocuments(docs, _parentPath = "") {
    for (const doc of docs) {
      if (doc.path) {
        // 移除开头的斜杠用于文件系统路径
        const filePath = doc.path.startsWith("/") ? doc.path.slice(1) : doc.path;
        this.documents.push({
          path: doc.path,
          filePath,
          title: doc.title || "未知文档",
        });
        this.documentPaths.add(doc.path);
      }

      // 递归处理子文档
      if (doc.children && Array.isArray(doc.children)) {
        this.collectDocuments(doc.children, doc.path);
      }
    }
  }

  /**
   * Layer 1: 验证文档文件存在性
   */
  async validateDocumentFiles() {
    for (const doc of this.documents) {
      const fullPath = path.join(this.docsDir, doc.filePath);
      try {
        await access(fullPath, constants.F_OK | constants.R_OK);
      } catch (_error) {
        this.errors.fatal.push({
          type: "MISSING_DOCUMENT",
          path: doc.path,
          filePath: fullPath,
          message: `文档文件缺失: ${doc.path}`,
          suggestion: `请生成此文档或从 document-structure.yaml 中移除`,
        });
      }
    }
  }

  /**
   * Layer 2-4: 验证单个文档内容
   */
  async validateDocument(doc, checkRemoteImages) {
    const fullPath = path.join(this.docsDir, doc.filePath);

    try {
      const content = await readFile(fullPath, "utf8");
      this.stats.checkedDocs++;

      // Layer 2: 内容解析和检查
      this.checkEmptyDocument(content, doc);
      this.checkHeadingHierarchy(content, doc);

      // Layer 3: 链接和图片验证
      await this.validateLinks(content, doc);
      await this.validateImages(content, doc, checkRemoteImages);
    } catch (error) {
      // 文件不存在的错误已在 Layer 1 报告，这里跳过
      if (error.code !== "ENOENT") {
        this.errors.fatal.push({
          type: "READ_ERROR",
          path: doc.path,
          message: `无法读取文档: ${error.message}`,
        });
      }
    }
  }

  /**
   * Layer 4: 空文档检测
   */
  checkEmptyDocument(content, doc) {
    // 移除所有标题
    let cleaned = content.replace(/^#{1,6}\s+.+$/gm, "");
    // 移除空白字符
    cleaned = cleaned.replace(/\s+/g, "");

    if (cleaned.length < 50) {
      this.errors.fatal.push({
        type: "EMPTY_DOCUMENT",
        path: doc.path,
        message: `空文档: ${doc.path}`,
        suggestion: `文档内容不足（少于50字符），请补充实质内容或从结构中移除`,
      });
    }
  }

  /**
   * Layer 4: 标题层级检查
   */
  checkHeadingHierarchy(content, doc) {
    // 先移除代码块中的内容，避免误判
    const contentWithoutCodeBlocks = this.removeCodeBlocks(content);

    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings = [];

    for (const match of contentWithoutCodeBlocks.matchAll(headingRegex)) {
      headings.push({
        level: match[1].length,
        text: match[2],
        line: contentWithoutCodeBlocks.substring(0, match.index).split("\n").length,
      });
    }

    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1];
      const curr = headings[i];

      // 检查是否跳级
      if (curr.level > prev.level + 1) {
        this.errors.fatal.push({
          type: "HEADING_SKIP",
          path: doc.path,
          line: curr.line,
          message: `标题从 H${prev.level} 跳到 H${curr.level}`,
          suggestion: `考虑将 "${"#".repeat(curr.level)} ${curr.text}" 改为 "${"#".repeat(prev.level + 1)} ${curr.text}"`,
        });
      }
    }
  }

  /**
   * 移除 Markdown 代码块中的内容
   */
  removeCodeBlocks(content) {
    // 移除围栏代码块（```...```）
    let result = content.replace(/^```[\s\S]*?^```$/gm, "");

    // 移除缩进代码块（4个空格或1个tab开头的行）
    result = result.replace(/^( {4}|\t).+$/gm, "");

    return result;
  }

  /**
   * 获取代码块的位置范围
   * @returns {Array<{start: number, end: number}>} 代码块的起止位置数组
   */
  getCodeBlockRanges(content) {
    const ranges = [];

    // 匹配围栏代码块（```...```）
    const fencedCodeRegex = /^```[\s\S]*?^```$/gm;

    for (const match of content.matchAll(fencedCodeRegex)) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    // 匹配行内代码块（`...`）
    const inlineCodeRegex = /`[^`\n]+`/g;
    for (const match of content.matchAll(inlineCodeRegex)) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    // 匹配缩进代码块（4个空格或1个tab开头的行）
    const indentedCodeRegex = /^( {4}|\t).+$/gm;
    for (const match of content.matchAll(indentedCodeRegex)) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return ranges;
  }

  /**
   * 检查位置是否在代码块中
   * @param {number} position - 要检查的位置
   * @param {Array<{start: number, end: number}>} ranges - 代码块范围数组
   * @returns {boolean} 是否在代码块中
   */
  isInCodeBlock(position, ranges) {
    return ranges.some((range) => position >= range.start && position < range.end);
  }

  /**
   * Layer 3: 验证内部链接
   */
  async validateLinks(content, doc) {
    // 获取代码块位置范围
    const codeBlockRanges = this.getCodeBlockRanges(content);

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    for (const match of content.matchAll(linkRegex)) {
      // 检查链接是否在代码块中，如果是则跳过
      if (this.isInCodeBlock(match.index, codeBlockRanges)) {
        continue;
      }

      const linkText = match[1];
      const linkUrl = match[2];

      this.stats.totalLinks++;

      // 忽略外部链接和锚点链接
      if (
        linkUrl.startsWith("http://") ||
        linkUrl.startsWith("https://") ||
        linkUrl.startsWith("#")
      ) {
        continue;
      }

      // 识别内部文档链接（.md 结尾）
      if (linkUrl.endsWith(".md")) {
        await this.validateInternalLink(linkUrl, doc, linkText);
      }
    }
  }

  /**
   * 验证内部链接
   */
  async validateInternalLink(linkUrl, doc, linkText) {
    let targetPath;

    // 如果链接以 / 开头，说明是相对于 docs 目录的绝对路径
    if (linkUrl.startsWith("/")) {
      targetPath = linkUrl;
    } else {
      // 相对路径，需要根据当前文档目录计算
      const docDir = path.dirname(doc.path);

      // 检查相对路径是否试图超出根目录
      // 计算向上的层级数
      const upLevels = (linkUrl.match(/\.\.\//g) || []).length;
      // 计算当前文档的层级深度（根目录为0层）
      const currentDepth = docDir === "/" ? 0 : docDir.split("/").filter((p) => p).length;

      if (upLevels > currentDepth) {
        this.stats.brokenLinks++;
        this.errors.fatal.push({
          type: "BROKEN_LINK",
          path: doc.path,
          link: linkUrl,
          linkText,
          message: `内部链接路径超出根目录: [${linkText}](${linkUrl})`,
          suggestion: `链接向上 ${upLevels} 级，但当前文档只在第 ${currentDepth} 层，请修正链接路径`,
        });
        return;
      }

      targetPath = path.posix.join(docDir, linkUrl);
      targetPath = path.posix.normalize(targetPath);

      // 确保以 / 开头
      if (!targetPath.startsWith("/")) {
        targetPath = `/${targetPath}`;
      }
    }

    // 检查目标文档是否在 document-structure 中
    if (!this.documentPaths.has(targetPath)) {
      this.stats.brokenLinks++;
      this.errors.fatal.push({
        type: "BROKEN_LINK",
        path: doc.path,
        link: linkUrl,
        linkText,
        targetPath,
        message: `内部链接死链: [${linkText}](${linkUrl})`,
        suggestion: `目标文档 ${targetPath} 不存在于 document-structure 中，请检查链接路径或生成目标文档`,
      });
    }
  }

  /**
   * Layer 3: 验证图片
   */
  async validateImages(content, doc, checkRemoteImages) {
    // 获取代码块位置范围
    const codeBlockRanges = this.getCodeBlockRanges(content);

    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

    for (const match of content.matchAll(imageRegex)) {
      // 检查图片是否在代码块中，如果是则跳过
      if (this.isInCodeBlock(match.index, codeBlockRanges)) {
        continue;
      }

      const altText = match[1];
      const imageUrl = match[2];

      this.stats.totalImages++;

      // 分类：本地 vs 远程
      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        // 远程图片
        this.stats.remoteImages++;
        if (checkRemoteImages) {
          await this.validateRemoteImage(imageUrl, doc, altText);
        }
      } else {
        // 本地图片
        this.stats.localImages++;
        await this.validateLocalImage(imageUrl, doc, altText);
      }
    }
  }

  /**
   * 验证本地图片
   */
  async validateLocalImage(imageUrl, doc, altText) {
    // 计算图片的绝对路径
    const docDir = path.dirname(path.join(this.docsDir, doc.filePath));
    const imagePath = path.resolve(docDir, imageUrl);

    // 检查文件是否存在
    try {
      await access(imagePath, constants.F_OK);

      // 验证相对路径层级是否正确
      const expectedRelativePath = this.calculateExpectedRelativePath(doc.filePath, imagePath);
      if (expectedRelativePath && imageUrl !== expectedRelativePath) {
        this.errors.fatal.push({
          type: "IMAGE_PATH_LEVEL",
          path: doc.path,
          imageUrl,
          expectedPath: expectedRelativePath,
          message: `图片路径层级可能不正确: ${imageUrl}`,
          suggestion: `根据层级对照表，建议使用: ${expectedRelativePath}`,
        });
      }
    } catch (_error) {
      this.stats.missingImages++;
      this.errors.fatal.push({
        type: "MISSING_IMAGE",
        path: doc.path,
        imageUrl,
        altText,
        message: `本地图片不存在: ${imageUrl}`,
        suggestion: `根据文件名查找图片，检查图片路径是否正确，如果图片不存在则删除图片的使用`,
      });
    }
  }

  /**
   * 计算期望的相对路径
   */
  calculateExpectedRelativePath(docFilePath, absoluteImagePath) {
    // 计算文档层级（docs/ 目录下的层级）
    // 例如：introduction.md → ['introduction.md'] → 1层 → ../
    //       api/auth.md → ['api', 'auth.md'] → 2层 → ../../
    const pathParts = docFilePath.split("/");
    const depth = pathParts.length;

    // 生成回退路径
    const backPath = "../".repeat(depth);

    // 获取工作区根目录
    const workspaceRoot = process.cwd();

    // 计算图片相对于工作区的路径
    const relativeToWorkspace = path.relative(workspaceRoot, absoluteImagePath);

    // 组合完整相对路径
    return backPath + relativeToWorkspace.replace(/\\/g, "/");
  }

  /**
   * 验证远程图片
   */
  async validateRemoteImage(imageUrl, doc, altText) {
    // 检查缓存
    if (this.remoteImageCache.has(imageUrl)) {
      const cached = this.remoteImageCache.get(imageUrl);
      if (!cached.accessible) {
        this.stats.inaccessibleRemoteImages++;
        this.errors.warnings.push({
          type: "REMOTE_IMAGE_INACCESSIBLE",
          path: doc.path,
          imageUrl,
          altText,
          statusCode: cached.statusCode,
          error: cached.error,
          message: `远程图片无法访问: ${imageUrl}`,
          suggestion: `检查 URL 是否正确，或替换为可访问的图片`,
        });
      }
      return;
    }

    // 检查远程图片可访问性
    const result = await this.checkRemoteImage(imageUrl);
    this.remoteImageCache.set(imageUrl, result);

    if (!result.accessible) {
      this.stats.inaccessibleRemoteImages++;
      this.errors.warnings.push({
        type: "REMOTE_IMAGE_INACCESSIBLE",
        path: doc.path,
        imageUrl,
        altText,
        statusCode: result.statusCode,
        error: result.error,
        message: `远程图片无法访问: ${imageUrl}`,
        suggestion: `检查 URL 是否正确，或替换为可访问的图片`,
      });
    }
  }

  /**
   * 检查远程图片（HTTP HEAD 请求）
   */
  async checkRemoteImage(url, timeout = 3000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "DocSmith-Content-Checker/1.0",
        },
      });

      clearTimeout(timeoutId);

      return {
        accessible: response.ok,
        statusCode: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      return {
        accessible: false,
        error: error.message,
        isTimeout: error.name === "AbortError",
      };
    }
  }

  /**
   * 获取校验结果
   */
  getResult() {
    const hasErrors = this.errors.fatal.length > 0 || this.errors.fixable.length > 0;

    return {
      valid: !hasErrors,
      errors: this.errors,
      stats: this.stats,
    };
  }
}

/**
 * 格式化输出
 */
function formatOutput(result) {
  let output = "";

  if (result.valid) {
    output += "✅ PASS: 文档内容检查通过\n\n";
    output += "统计信息:\n";
    output += `  总文档数: ${result.stats.totalDocs}\n`;
    output += `  已检查: ${result.stats.checkedDocs}\n`;
    output += `  内部链接: ${result.stats.totalLinks}\n`;
    output += `  本地图片: ${result.stats.localImages}\n`;
    output += `  远程图片: ${result.stats.remoteImages}\n`;

    if (result.errors.warnings.length > 0) {
      output += `\n警告: ${result.errors.warnings.length}\n`;
    }

    return output;
  }

  output += "❌ FAIL: 文档内容存在错误\n\n";
  output += "统计信息:\n";
  output += `  总文档数: ${result.stats.totalDocs}\n`;
  output += `  已检查: ${result.stats.checkedDocs}\n`;
  output += `  致命错误: ${result.errors.fatal.length}\n`;
  output += `  可修复错误: ${result.errors.fixable.length}\n`;
  output += `  警告: ${result.errors.warnings.length}\n\n`;

  // FATAL 错误
  if (result.errors.fatal.length > 0) {
    output += "致命错误（必须修复）:\n\n";
    result.errors.fatal.forEach((err, idx) => {
      output += `${idx + 1}. ${err.message}\n`;
      if (err.path) output += `   文档: ${err.path}\n`;
      if (err.link) output += `   链接: ${err.link}\n`;
      if (err.imageUrl) output += `   图片: ${err.imageUrl}\n`;
      if (err.suggestion) output += `   操作: ${err.suggestion}\n`;
      output += "\n";
    });
  }

  // FIXABLE 错误
  if (result.errors.fixable.length > 0) {
    output += "可修复错误（已自动修复）:\n";
    output += "（已应用修复，文件已更新）\n\n";
  }

  // WARNING
  if (result.errors.warnings.length > 0) {
    output += "警告（不阻断）:\n\n";
    result.errors.warnings.forEach((warn, idx) => {
      output += `${idx + 1}. ${warn.message}\n`;
      if (warn.path) output += `   文档: ${warn.path}\n`;
      if (warn.suggestion) output += `   建议: ${warn.suggestion}\n`;
      output += "\n";
    });
  }

  return output;
}

/**
 * 主函数 - Function Agent
 * @param {Object} params
 * @param {string} params.yamlPath - 文档结构 YAML 文件路径
 * @param {string} params.docsDir - 文档目录路径
 * @param {boolean} params.checkRemoteImages - 是否检查远程图片
 * @returns {Promise<Object>} - 校验结果
 */
export default async function validateDocumentContent({
  yamlPath = "planning/document-structure.yaml",
  docsDir = "docs",
  checkRemoteImages = true,
} = {}) {
  try {
    const validator = new DocumentContentValidator(yamlPath, docsDir);
    const result = await validator.validate(checkRemoteImages);

    const formattedOutput = formatOutput(result);

    return {
      valid: result.valid,
      errors: result.errors,
      stats: result.stats,
      message: formattedOutput,
    };
  } catch (error) {
    return {
      valid: false,
      message: `❌ FAIL: ${error.message}`,
    };
  }
}

// 注意：此函数仅供内部使用，不直接暴露为 skill
// 外部通过 content-checker.mjs 的 checkContent 函数调用
