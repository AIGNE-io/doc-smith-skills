import { readFile, readdir, access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { parse as yamlParse } from "yaml";
import path from "node:path";
import {
  getPaths,
  ERROR_CODES,
  collectDocumentPaths,
  loadConfigFromFile,
} from "./utils.mjs";

const ASSETS_DIR_NAME = "assets";

/**
 * Document content validator class
 * Validates HTML files in dist/ and .meta.yaml in docs/
 */
class DocumentContentValidator {
  constructor(yamlPath, docsDir, distDir, docs = undefined, options = {}) {
    const PATHS = getPaths();
    this.yamlPath = yamlPath || PATHS.DOCUMENT_STRUCTURE;
    this.docsDir = docsDir || PATHS.DOCS_DIR;
    this.distDir = distDir || PATHS.DIST_DIR;
    this.PATHS = PATHS;
    this.docsFilter = docs ? new Set(docs) : null;
    this.checkSlots = options.checkSlots || false;
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
      unreplacedSlots: 0,
      invalidSlotPaths: 0,
      missingSlotImages: 0,
    };
    this.documents = [];
    this.documentPaths = new Set();
    this.remoteImageCache = new Map();
    this.workspaceConfig = null; // Cache workspace config
  }

  /**
   * Load workspace config (lazy loading)
   */
  async loadWorkspaceConfig() {
    if (this.workspaceConfig === null) {
      this.workspaceConfig = (await loadConfigFromFile()) || {};
    }
    return this.workspaceConfig;
  }

  /**
   * Load translateLanguages config (lazy loading)
   */
  async loadTranslateLanguages() {
    const config = await this.loadWorkspaceConfig();
    return config.translateLanguages || [];
  }

  /**
   * Get expected languages for a document from .meta.yaml + config
   */
  async getExpectedLanguages(docFolder) {
    const metaPath = path.join(docFolder, ".meta.yaml");
    let meta;
    try {
      const metaContent = await readFile(metaPath, "utf8");
      meta = yamlParse(metaContent);
    } catch (_error) {
      return null;
    }

    const langs = new Set();
    if (meta.default) langs.add(meta.default);
    if (meta.source) langs.add(meta.source);

    const translateLanguages = await this.loadTranslateLanguages();
    for (const lang of translateLanguages) {
      if (lang !== meta.source) langs.add(lang);
    }

    return { langs, meta, translateLanguages };
  }

  /**
   * Execute full validation
   */
  async validate(checkRemoteImages = true) {
    try {
      // Layer 1: Load document structure and validate file existence
      await this.loadDocumentStructure();
      await this.validateDocumentFiles();

      // Layer 2-4: Check document content one by one
      for (const doc of this.documents) {
        await this.validateDocument(doc, checkRemoteImages);
      }

      return this.getResult();
    } catch (error) {
      this.errors.fatal.push({
        type: "VALIDATION_ERROR",
        message: `Validation error: ${error.message}`,
      });
      return this.getResult();
    }
  }

  /**
   * Layer 1: Load document structure
   */
  async loadDocumentStructure() {
    try {
      const content = await readFile(this.yamlPath, "utf8");
      const data = yamlParse(content);

      if (!data.documents || !Array.isArray(data.documents)) {
        throw new Error(`${this.yamlPath} missing documents field or format error`);
      }

      // Use shared tool to collect document paths and metadata
      const docsWithMeta = collectDocumentPaths(data.documents, { collectMetadata: true });

      // Convert to internal format
      for (const doc of docsWithMeta) {
        // If docs filter is specified, only add matching documents
        if (this.docsFilter && !this.docsFilter.has(doc.displayPath)) {
          // Still need to add to documentPaths for link validation
          this.documentPaths.add(doc.displayPath);
          continue;
        }

        this.documents.push({
          path: doc.displayPath,
          filePath: doc.path,
          title: doc.title || "Unknown document",
        });
        this.documentPaths.add(doc.displayPath);
      }

      this.stats.totalDocs = this.documents.length;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`File not found: ${this.yamlPath}`);
      }
      throw error;
    }
  }

  /**
   * Layer 1: Validate document file existence
   * Checks .meta.yaml in docs/ and HTML files in dist/
   */
  async validateDocumentFiles() {
    for (const doc of this.documents) {
      const docFolder = path.join(this.docsDir, doc.filePath);

      // Check 1: docs/{path}/ folder exists (for .meta.yaml)
      let folderExists = false;
      try {
        const stats = await stat(docFolder);
        if (!stats.isDirectory()) {
          this.errors.fatal.push({
            type: "INVALID_DOCUMENT_FOLDER",
            path: doc.path,
            filePath: docFolder,
            message: `Path is not a folder: ${doc.path}`,
            suggestion: "Please ensure path points to a folder",
          });
          continue;
        }
        folderExists = true;
      } catch (_error) {
        this.errors.fatal.push({
          type: "MISSING_DOCUMENT_FOLDER",
          path: doc.path,
          filePath: docFolder,
          message: `Document folder missing: ${doc.path}`,
          suggestion: `Please generate this document folder in the specified format`,
        });
        continue;
      }

      // Check 2: .meta.yaml exists and has correct format
      if (folderExists) {
        await this.validateMetaFile(docFolder, doc);

        // Check 3: HTML files exist in dist/
        await this.validateLanguageFiles(docFolder, doc);
      }
    }
  }

  /**
   * Validate .meta.yaml
   */
  async validateMetaFile(docFolder, doc) {
    const metaPath = path.join(docFolder, ".meta.yaml");

    try {
      await access(metaPath, constants.F_OK | constants.R_OK);
    } catch (_error) {
      this.errors.fatal.push({
        type: "MISSING_META_FILE",
        path: doc.path,
        filePath: metaPath,
        message: `.meta.yaml missing: ${doc.path}`,
        suggestion: "Please create .meta.yaml in the document folder",
      });
      return;
    }

    // Read and validate content
    try {
      const content = await readFile(metaPath, "utf8");
      const meta = yamlParse(content);

      // Required field validation
      const requiredFields = ["kind", "source", "default"];
      for (const field of requiredFields) {
        if (!meta[field]) {
          this.errors.fatal.push({
            type: "INVALID_META",
            path: doc.path,
            field,
            message: `.meta.yaml missing required field "${field}": ${doc.path}`,
            suggestion: `Add ${field} field to .meta.yaml`,
          });
        }
      }

      // kind value validation
      if (meta.kind && meta.kind !== "doc") {
        this.errors.fatal.push({
          type: "INVALID_META",
          path: doc.path,
          field: "kind",
          message: `.meta.yaml kind should be "doc", currently "${meta.kind}"`,
          suggestion: "Change to kind: doc",
        });
      }

      // source and project locale consistency validation
      if (meta.source) {
        const config = await this.loadWorkspaceConfig();
        const projectLocale = config?.locale;
        if (projectLocale && meta.source !== projectLocale) {
          this.errors.fatal.push({
            type: ERROR_CODES.SOURCE_LOCALE_MISMATCH,
            path: doc.path,
            source: meta.source,
            locale: projectLocale,
            message: `Document source (${meta.source}) does not match project locale (${projectLocale}): ${doc.path}`,
            suggestion: `Change document source to "${projectLocale}", or regenerate the main language version of this document`,
          });
        }
      }
    } catch (error) {
      this.errors.fatal.push({
        type: "INVALID_META",
        path: doc.path,
        message: `.meta.yaml format error: ${error.message}`,
        suggestion: "Check if YAML syntax is correct",
      });
    }
  }

  /**
   * Validate language files - checks HTML files exist in dist/
   * Instead of scanning docs/{path}/ for *.md, checks dist/{lang}/docs/{path}.html
   */
  async validateLanguageFiles(docFolder, doc) {
    try {
      const langInfo = await this.getExpectedLanguages(docFolder);
      if (!langInfo) return; // .meta.yaml errors already reported

      const { langs, meta, translateLanguages } = langInfo;

      if (langs.size === 0) {
        this.errors.fatal.push({
          type: "MISSING_LANGUAGE_FILE",
          path: doc.path,
          message: `No expected language versions: ${doc.path}`,
          suggestion: "Check .meta.yaml default/source fields",
        });
        return;
      }

      // Check HTML files in dist/
      for (const lang of langs) {
        const htmlPath = path.join(this.distDir, lang, "docs", `${doc.filePath}.html`);
        try {
          await access(htmlPath, constants.F_OK);
        } catch (_error) {
          const isDefault = lang === meta.default;
          const isSource = lang === meta.source;
          const isTranslate = translateLanguages.includes(lang) && lang !== meta.source;

          let errorType = "MISSING_LANGUAGE_FILE";
          if (isDefault && isSource) errorType = "MISSING_DEFAULT_LANGUAGE";
          else if (isDefault) errorType = "MISSING_DEFAULT_LANGUAGE";
          else if (isSource) errorType = "MISSING_SOURCE_LANGUAGE";
          else if (isTranslate) errorType = ERROR_CODES.MISSING_TRANSLATE_LANGUAGE;

          this.errors.fatal.push({
            type: errorType,
            path: doc.path,
            lang,
            message: `HTML file missing for ${lang}: ${doc.path}`,
            suggestion: `Build HTML with: build.mjs --doc <md-file> --path ${doc.path}`,
          });
        }
      }
    } catch (error) {
      this.errors.fatal.push({
        type: "READ_FOLDER_ERROR",
        path: doc.path,
        message: `Cannot validate language files: ${error.message}`,
      });
    }
  }

  /**
   * Layer 2-4: Validate single document content (reads HTML from dist/)
   */
  async validateDocument(doc, checkRemoteImages) {
    const docFolder = path.join(this.docsDir, doc.filePath);

    // Check MD source files for old path format (if they still exist)
    await this.validatePathFormat(docFolder, doc);

    try {
      const langInfo = await this.getExpectedLanguages(docFolder);
      if (!langInfo) return;

      const { langs } = langInfo;

      // Check each language's HTML file
      for (const lang of langs) {
        const htmlPath = path.join(this.distDir, lang, "docs", `${doc.filePath}.html`);
        const langFile = `${lang}.html`;

        let htmlContent;
        try {
          htmlContent = await readFile(htmlPath, "utf8");
        } catch (_error) {
          // HTML file missing already reported in validateLanguageFiles
          continue;
        }

        this.stats.checkedDocs++;

        // Extract main content area for validation
        const bodyContent = this.extractMainContent(htmlContent);

        // Layer 2: Content parsing and checking
        this.checkEmptyDocument(bodyContent, doc, langFile);
        this.checkHeadingHierarchy(bodyContent, doc, langFile);

        // Layer 3: Link and image validation
        await this.validateLinks(bodyContent, doc, langFile);
        await this.validateImages(bodyContent, doc, langFile, lang, checkRemoteImages);

        // Layer 5: AFS image slot validation (check for escaped markers in HTML)
        if (this.checkSlots) {
          await this.validateImageSlots(htmlContent, doc, langFile);
        }
      }
    } catch (_error) {
      // Errors already reported in Layer 1
    }
  }

  // ============================================
  // HTML Content Extraction Helpers
  // ============================================

  /**
   * Extract main content from HTML (content inside data-ds="content")
   */
  extractMainContent(html) {
    // Extract content from <main data-ds="content">...</main>
    const contentMatch = html.match(/<main[^>]*data-ds="content"[^>]*>([\s\S]*?)<\/main>/i);
    if (contentMatch) return contentMatch[1];

    // Fallback: extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : html;
  }

  /**
   * Remove HTML code blocks (<pre><code>...</code></pre>)
   */
  removeHtmlCodeBlocks(content) {
    return content.replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, "");
  }

  /**
   * Get HTML code block position ranges
   */
  getHtmlCodeBlockRanges(content) {
    const ranges = [];
    const codeBlockRegex = /<pre[^>]*>[\s\S]*?<\/pre>/gi;
    for (const match of content.matchAll(codeBlockRegex)) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
    return ranges;
  }

  /**
   * Strip all HTML tags from content
   */
  stripHtmlTags(content) {
    return content.replace(/<[^>]+>/g, "");
  }

  // ============================================
  // Content Validation (adapted for HTML)
  // ============================================

  /**
   * Layer 4: Empty document detection (HTML version)
   */
  checkEmptyDocument(content, doc, langFile) {
    // Strip HTML tags and get text content
    let cleaned = this.stripHtmlTags(content);
    // Decode common HTML entities
    cleaned = cleaned.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    // Remove whitespace
    cleaned = cleaned.replace(/\s+/g, "");

    if (cleaned.length < 50) {
      this.errors.fatal.push({
        type: "EMPTY_DOCUMENT",
        path: doc.path,
        langFile,
        message: `Empty document: ${doc.path} (${langFile})`,
        suggestion: `Document content insufficient (less than 50 characters), please add substantial content or remove from structure`,
      });
    }
  }

  /**
   * Layer 4: Heading hierarchy check (HTML version)
   */
  checkHeadingHierarchy(content, doc, langFile) {
    // Remove code blocks first
    const contentWithoutCode = this.removeHtmlCodeBlocks(content);

    // Match HTML headings: <h1>...</h1> through <h6>...</h6>
    const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
    const headings = [];

    for (const match of contentWithoutCode.matchAll(headingRegex)) {
      headings.push({
        level: parseInt(match[1]),
        text: this.stripHtmlTags(match[2]).trim(),
      });
    }

    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1];
      const curr = headings[i];

      if (curr.level > prev.level + 1) {
        this.errors.fatal.push({
          type: "HEADING_SKIP",
          path: doc.path,
          langFile,
          message: `Heading skipped from H${prev.level} to H${curr.level}: "${curr.text}"`,
          suggestion: `Consider changing H${curr.level} to H${prev.level + 1}`,
        });
      }
    }
  }

  /**
   * Layer 3: Validate internal links (HTML version)
   * Extracts links from <a href="..."> tags
   */
  async validateLinks(content, doc, langFile) {
    const codeBlockRanges = this.getHtmlCodeBlockRanges(content);

    // Match <a href="...">...</a> tags
    const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const match of content.matchAll(linkRegex)) {
      // Skip links inside code blocks
      if (this.isInCodeBlock(match.index, codeBlockRanges)) {
        continue;
      }

      const linkUrl = match[1];
      const linkText = this.stripHtmlTags(match[2]).trim();

      this.stats.totalLinks++;

      // Ignore external links and anchor links
      if (
        linkUrl.startsWith("http://") ||
        linkUrl.startsWith("https://") ||
        linkUrl.startsWith("#")
      ) {
        continue;
      }

      // Ignore resource file links
      if (this.isResourceFile(linkUrl)) {
        continue;
      }

      // Validate as internal document link
      await this.validateInternalLink(linkUrl, doc, linkText, langFile);
    }
  }

  /**
   * Check if link points to a resource file (non-document)
   */
  isResourceFile(url) {
    const cleanUrl = url.split("?")[0].split("#")[0].toLowerCase();
    const resourceExtensions = [
      ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp",
      ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
      ".zip", ".tar", ".gz", ".rar", ".7z",
      ".mp3", ".mp4", ".wav", ".avi", ".mov", ".webm",
      ".json", ".xml", ".csv", ".txt",
      ".js", ".ts", ".css", ".scss", ".less",
      ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h",
      ".html",
    ];
    return resourceExtensions.some((ext) => cleanUrl.endsWith(ext));
  }

  /**
   * Check if position is inside a code block
   */
  isInCodeBlock(position, ranges) {
    return ranges.some((range) => position >= range.start && position < range.end);
  }

  /**
   * Validate internal link
   */
  async validateInternalLink(linkUrl, doc, linkText, langFile) {
    let targetPath;

    // Remove anchor part for format checking
    const urlWithoutAnchor = linkUrl.split("#")[0];

    // Check if link format is correct: internal links should not contain .md suffix
    const langSuffixPattern = /\/[a-z]{2}(-[A-Z]{2})?\.md$/;
    const mdSuffixPattern = /\.md$/;

    if (mdSuffixPattern.test(urlWithoutAnchor)) {
      const isLangSuffix = langSuffixPattern.test(urlWithoutAnchor);
      const suggestedLink = isLangSuffix
        ? urlWithoutAnchor.replace(langSuffixPattern, "")
        : urlWithoutAnchor.replace(mdSuffixPattern, "");

      this.stats.brokenLinks++;
      this.errors.fatal.push({
        type: ERROR_CODES.INVALID_LINK_FORMAT,
        path: doc.path,
        langFile,
        link: linkUrl,
        linkText,
        message: `Internal link format error: ${linkText} -> ${linkUrl}`,
        suggestion: `Link should not contain .md suffix, suggest changing to: ${suggestedLink}`,
      });
      return;
    }

    const cleanLinkUrl = urlWithoutAnchor;

    if (!cleanLinkUrl) {
      return;
    }

    if (cleanLinkUrl.startsWith("/")) {
      targetPath = cleanLinkUrl;
    } else {
      const docDir = path.dirname(doc.path);
      const upLevels = (cleanLinkUrl.match(/\.\.\//g) || []).length;
      const currentDepth = docDir === "/" ? 0 : docDir.split("/").filter((p) => p).length;

      if (upLevels > currentDepth) {
        this.stats.brokenLinks++;
        this.errors.fatal.push({
          type: "BROKEN_LINK",
          path: doc.path,
          langFile,
          link: linkUrl,
          linkText,
          message: `Internal link path exceeds root directory: ${linkText} -> ${linkUrl}`,
          suggestion: `Link goes up ${upLevels} levels, but current document's directory is only at level ${currentDepth}`,
        });
        return;
      }

      targetPath = path.posix.normalize(path.posix.join(docDir, cleanLinkUrl));
      if (!targetPath.startsWith("/")) {
        targetPath = `/${targetPath}`;
      }
    }

    if (!this.documentPaths.has(targetPath)) {
      this.stats.brokenLinks++;
      this.errors.fatal.push({
        type: "BROKEN_LINK",
        path: doc.path,
        langFile,
        link: linkUrl,
        linkText,
        targetPath,
        message: `Internal broken link: ${linkText} -> ${linkUrl}`,
        suggestion: `Target document ${targetPath} does not exist`,
      });
    }
  }

  /**
   * Layer 3: Validate images (HTML version)
   * Extracts images from <img src="..."> tags
   */
  async validateImages(content, doc, langFile, lang, checkRemoteImages) {
    const codeBlockRanges = this.getHtmlCodeBlockRanges(content);

    // Match <img> tags (both self-closing and not)
    const imageRegex = /<img[^>]+src="([^"]*)"[^>]*>/gi;

    for (const match of content.matchAll(imageRegex)) {
      if (this.isInCodeBlock(match.index, codeBlockRanges)) {
        continue;
      }

      const imageUrl = match[1];
      // Extract alt text
      const altMatch = match[0].match(/alt="([^"]*)"/i);
      const altText = altMatch ? altMatch[1] : "";

      this.stats.totalImages++;

      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        this.stats.remoteImages++;
        if (checkRemoteImages) {
          await this.validateRemoteImage(imageUrl, doc, altText, langFile);
        }
      } else {
        this.stats.localImages++;
        await this.validateLocalImage(imageUrl, doc, altText, langFile, lang);
      }
    }
  }

  /**
   * Validate local image in HTML context
   * Handles both absolute paths (/assets/images/...) and relative paths
   */
  async validateLocalImage(imageUrl, doc, altText, langFile, lang) {
    // Absolute paths starting with /assets/images/ are AFS-generated images
    // These resolve to dist/assets/images/...
    if (imageUrl.startsWith("/assets/images/")) {
      const imagePath = path.join(this.distDir, imageUrl);
      try {
        await access(imagePath, constants.F_OK);
        // When checkSlots is enabled, validate the image exists
        if (this.checkSlots) {
          await this.validateAssetImagePath(imageUrl, doc, langFile);
        }
      } catch (_error) {
        this.stats.missingImages++;
        this.errors.fatal.push({
          type: "MISSING_IMAGE",
          path: doc.path,
          langFile,
          imageUrl,
          altText,
          message: `Local image not found: ${imageUrl}`,
          suggestion: `Check image path or rebuild with --nav to copy assets`,
        });
      }
      return;
    }

    // Other absolute paths are not allowed
    if (imageUrl.startsWith("/")) {
      this.stats.missingImages++;
      this.errors.fatal.push({
        type: ERROR_CODES.ABSOLUTE_IMAGE_PATH_NOT_ALLOWED,
        path: doc.path,
        langFile,
        imageUrl,
        altText,
        message: `Image absolute path not allowed: ${imageUrl}`,
        suggestion: `Please use /assets/images/ prefix for generated images, or relative path for project images`,
      });
      return;
    }

    // Relative path: resolve from HTML file location
    // HTML file is at: dist/{lang}/docs/{filePath}.html
    const htmlDir = path.dirname(path.join(this.distDir, lang, "docs", `${doc.filePath}.html`));
    const imagePath = path.resolve(htmlDir, imageUrl);

    try {
      await access(imagePath, constants.F_OK);
    } catch (_error) {
      this.stats.missingImages++;
      this.errors.fatal.push({
        type: "MISSING_IMAGE",
        path: doc.path,
        langFile,
        imageUrl,
        altText,
        message: `Local image not found: ${imageUrl}`,
        suggestion: `Check image path or remove image reference`,
      });
    }
  }

  /**
   * Validate remote image
   */
  async validateRemoteImage(imageUrl, doc, altText, langFile) {
    if (this.remoteImageCache.has(imageUrl)) {
      const cached = this.remoteImageCache.get(imageUrl);
      if (!cached.accessible) {
        this.stats.inaccessibleRemoteImages++;
        this.errors.warnings.push({
          type: "REMOTE_IMAGE_INACCESSIBLE",
          path: doc.path,
          langFile,
          imageUrl,
          altText,
          statusCode: cached.statusCode,
          error: cached.error,
          message: `Remote image inaccessible: ${imageUrl}`,
          suggestion: `Check if URL is correct, or replace with accessible image`,
        });
      }
      return;
    }

    const result = await this.checkRemoteImage(imageUrl);
    this.remoteImageCache.set(imageUrl, result);

    if (!result.accessible) {
      this.stats.inaccessibleRemoteImages++;
      this.errors.warnings.push({
        type: "REMOTE_IMAGE_INACCESSIBLE",
        path: doc.path,
        langFile,
        imageUrl,
        altText,
        statusCode: result.statusCode,
        error: result.error,
        message: `Remote image inaccessible: ${imageUrl}`,
        suggestion: `Check if URL is correct, or replace with accessible image`,
      });
    }
  }

  /**
   * Check remote image (HTTP HEAD request)
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
   * Validate AFS image slots (HTML version)
   * In HTML, unreplaced slots appear as escaped text or raw comments
   */
  async validateImageSlots(htmlContent, doc, langFile) {
    const codeBlockRanges = this.getHtmlCodeBlockRanges(htmlContent);

    // Check for raw HTML comments (if markdown-it passes them through)
    const rawSlotRegex = /<!--\s*afs:image\s+id="([^"]+)"(?:\s+key="([^"]+)")?(?:\s+desc="([^"]+)")?\s*-->/g;
    for (const match of htmlContent.matchAll(rawSlotRegex)) {
      if (this.isInCodeBlock(match.index, codeBlockRanges)) continue;
      this.stats.unreplacedSlots++;
      this.errors.fatal.push({
        type: ERROR_CODES.UNREPLACED_IMAGE_SLOT,
        path: doc.path,
        langFile,
        slotId: match[1],
        message: `AFS image slot not replaced: ${match[1]}`,
        suggestion: `Please use generate-slot-image to generate image`,
      });
    }

    // Check for escaped slot markers (markdown-it html:false escapes them)
    const escapedSlotRegex = /&lt;!--\s*afs:image\s+id=(?:&quot;|")([^"&]+)(?:&quot;|")/g;
    for (const match of htmlContent.matchAll(escapedSlotRegex)) {
      if (this.isInCodeBlock(match.index, codeBlockRanges)) continue;
      this.stats.unreplacedSlots++;
      this.errors.fatal.push({
        type: ERROR_CODES.UNREPLACED_IMAGE_SLOT,
        path: doc.path,
        langFile,
        slotId: match[1],
        message: `AFS image slot not replaced (escaped in HTML): ${match[1]}`,
        suggestion: `Please use generate-slot-image to generate image before building HTML`,
      });
    }
  }

  /**
   * Validate AFS image path for images in /assets/images/ directory
   */
  async validateAssetImagePath(imageUrl, doc, langFile) {
    // Only check images in /assets/images/ (AFS-generated)
    if (!imageUrl.startsWith("/assets/images/")) {
      return;
    }

    // Extract key and filename: /assets/images/{key}/images/{locale}.ext
    const assetsMatch = imageUrl.match(/^\/assets\/images\/([^/]+)\/images\/([^/]+)$/);
    if (!assetsMatch) {
      return;
    }

    const key = assetsMatch[1];
    const imageName = assetsMatch[2];

    // Check if source image exists in workspace assets
    const assetsDir = path.join(this.PATHS.WORKSPACE_BASE, ASSETS_DIR_NAME);
    const sourcePath = path.join(assetsDir, key, "images", imageName);

    try {
      await access(sourcePath, constants.F_OK);
    } catch (_error) {
      this.stats.missingSlotImages++;
      this.errors.fatal.push({
        type: ERROR_CODES.MISSING_SLOT_IMAGE,
        path: doc.path,
        langFile,
        imageUrl,
        message: `Image file missing in workspace assets: ${imageUrl}`,
        suggestion: `Generate image or remove reference`,
      });
    }
  }

  /**
   * Validate path format in MD source files.
   * Warns about old ../../assets/ format; recommends /assets/ instead.
   */
  async validatePathFormat(docFolder, doc) {
    let entries;
    try {
      entries = await readdir(docFolder);
    } catch (_error) {
      return;
    }

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;

      const mdPath = path.join(docFolder, entry);
      let content;
      try {
        content = await readFile(mdPath, "utf8");
      } catch (_error) {
        continue;
      }

      // Remove fenced code blocks before checking
      const contentWithoutCode = content.replace(/```[\s\S]*?```/g, "");

      // Detect old ../../assets/ format in image references
      const oldFormatRegex = /!\[([^\]]*)\]\(((?:\.\.\/)+)assets\/([^)]+)\)/g;
      for (const match of contentWithoutCode.matchAll(oldFormatRegex)) {
        this.errors.warnings.push({
          type: "OLD_PATH_FORMAT",
          path: doc.path,
          langFile: entry,
          imageUrl: match[0],
          message: `Old path format: ${match[2]}assets/${match[3]} in ${doc.path} (${entry})`,
          suggestion: `Use /assets/${match[3]} instead`,
        });
      }
    }
  }

  /**
   * Get validation result
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
 * Format output
 * @param {Object} result - Validation result
 * @param {Object} options - Format options
 * @param {boolean} options.checkSlots - Whether AFS image slots were checked
 */
function formatOutput(result, options = {}) {
  const { checkSlots = false } = options;
  let output = "";

  if (result.valid) {
    output += "✅ PASS: Document content check passed\n\n";
    output += "Statistics:\n";
    output += `  Total documents: ${result.stats.totalDocs}\n`;
    output += `  Checked: ${result.stats.checkedDocs}\n`;
    output += `  Internal links: ${result.stats.totalLinks}\n`;
    output += `  Local images: ${result.stats.localImages}\n`;
    output += `  Remote images: ${result.stats.remoteImages}\n`;

    if (checkSlots) {
      output += `  AFS Image Slot check: Enabled\n`;
    }

    if (result.errors.warnings.length > 0) {
      output += `\nWarnings: ${result.errors.warnings.length}\n\n`;
      result.errors.warnings.forEach((warn, idx) => {
        output += `${idx + 1}. ${warn.message}\n`;
        if (warn.path) output += `   Document: ${warn.path}\n`;
        if (warn.langFile) output += `   Language file: ${warn.langFile}\n`;
        if (warn.suggestion) output += `   Suggestion: ${warn.suggestion}\n`;
        output += "\n";
      });
    }

    return output;
  }

  output += "❌ FAIL: Document content has errors\n\n";
  output += "Statistics:\n";
  output += `  Total documents: ${result.stats.totalDocs}\n`;
  output += `  Checked: ${result.stats.checkedDocs}\n`;
  output += `  Fatal errors: ${result.errors.fatal.length}\n`;
  output += `  Fixable errors: ${result.errors.fixable.length}\n`;
  output += `  Warnings: ${result.errors.warnings.length}\n`;

  if (checkSlots) {
    output += `  Unreplaced slots: ${result.stats.unreplacedSlots}\n`;
    output += `  Path level errors: ${result.stats.invalidSlotPaths}\n`;
    output += `  Missing images: ${result.stats.missingSlotImages}\n`;
  }

  output += "\n";

  // FATAL errors
  if (result.errors.fatal.length > 0) {
    output += "Fatal errors (must fix):\n\n";
    result.errors.fatal.forEach((err, idx) => {
      output += `${idx + 1}. ${err.message}\n`;
      if (err.path) output += `   Document: ${err.path}\n`;
      if (err.langFile) output += `   Language file: ${err.langFile}\n`;
      if (err.slotId) output += `   Slot ID: ${err.slotId}\n`;
      if (err.link) output += `   Link: ${err.link}\n`;
      if (err.imageUrl) output += `   Image: ${err.imageUrl}\n`;
      if (err.expectedPath) output += `   Expected path: ${err.expectedPath}\n`;
      if (err.suggestion) output += `   Action: ${err.suggestion}\n`;
      output += "\n";
    });
  }

  // FIXABLE errors
  if (result.errors.fixable.length > 0) {
    output += "Fixable errors (auto-fixed):\n";
    output += "(Fixes applied, files updated)\n\n";
  }

  // WARNINGS
  if (result.errors.warnings.length > 0) {
    output += "Warnings (non-blocking):\n\n";
    result.errors.warnings.forEach((warn, idx) => {
      output += `${idx + 1}. ${warn.message}\n`;
      if (warn.path) output += `   Document: ${warn.path}\n`;
      if (warn.suggestion) output += `   Suggestion: ${warn.suggestion}\n`;
      output += "\n";
    });
  }

  return output;
}

/**
 * Main function - Function Agent
 * @param {Object} params
 * @param {string} params.yamlPath - Document structure YAML file path
 * @param {string} params.docsDir - Document directory path (for .meta.yaml)
 * @param {string} params.distDir - Dist directory path (for HTML files)
 * @param {string[]} params.docs - Array of document paths to check
 * @param {boolean} params.checkRemoteImages - Whether to check remote images
 * @param {boolean} params.checkSlots - Whether to check AFS image slots are replaced
 * @returns {Promise<Object>} - Validation result
 */
export default async function validateDocumentContent({
  yamlPath,
  docsDir,
  distDir,
  docs = undefined,
  checkRemoteImages = true,
  checkSlots = false,
} = {}) {
  const PATHS = getPaths();
  yamlPath = yamlPath || PATHS.DOCUMENT_STRUCTURE;
  docsDir = docsDir || PATHS.DOCS_DIR;
  distDir = distDir || PATHS.DIST_DIR;
  try {
    const validator = new DocumentContentValidator(yamlPath, docsDir, distDir, docs, { checkSlots });
    const result = await validator.validate(checkRemoteImages);

    const formattedOutput = formatOutput(result, { checkSlots });

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

// Note: This function is for internal use only, not directly exposed as skill
// External calls through checkContent function in content-checker.mjs
