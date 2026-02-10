#!/usr/bin/env node

/**
 * DocSmith HTML Build Script
 *
 * 将 Markdown 文档构建为静态 HTML 站点。
 *
 * Usage:
 *   node build.mjs --workspace .aigne/doc-smith --output .aigne/doc-smith/dist
 */

import { readFile, writeFile, mkdir, copyFile, access, readdir, stat, unlink } from "node:fs/promises";
import { constants, realpathSync } from "node:fs";
import { join, dirname, basename, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as yamlParse } from "yaml";
import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// CLI Argument Parsing
// ============================================

function parseArgs(args) {
  const options = {
    workspace: ".aigne/doc-smith",
    output: null, // 默认为 workspace/dist
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--workspace":
      case "-w":
        if (next && !next.startsWith("-")) {
          options.workspace = next;
          i++;
        }
        break;
      case "--output":
      case "-o":
        if (next && !next.startsWith("-")) {
          options.output = next;
          i++;
        }
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  // 默认输出到 workspace/dist
  if (!options.output) {
    options.output = join(options.workspace, "dist");
  }

  return options;
}

function printHelp() {
  console.log(`
DocSmith HTML Build Script

Usage:
  node build.mjs [options]

Options:
  --workspace, -w <path>  Doc-Smith workspace path (default: .aigne/doc-smith)
  --output, -o <path>     Output directory (default: <workspace>/dist)
  --help, -h              Show this help message

Examples:
  node build.mjs
  node build.mjs --workspace .aigne/doc-smith --output ./public
  node build.mjs -w .aigne/doc-smith -o dist
`);
}

// ============================================
// Markdown Configuration
// ============================================

const md = new MarkdownIt({
  html: false, // 禁用 HTML 标签，防止 XSS
  linkify: true,
  typographer: true,
}).use(markdownItAnchor, {
  permalink: markdownItAnchor.permalink.ariaHidden({
    placement: "after",
    class: "header-anchor",
    symbol: "#",
  }),
  slugify: (s) => encodeURIComponent(String(s).trim().toLowerCase().replace(/\s+/g, "-")),
});

// ============================================
// Utility Functions
// ============================================

/**
 * 确保目录存在
 */
async function ensureDir(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

/**
 * 检查路径是否存在
 */
async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 递归复制目录
 */
async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

/**
 * HTML 实体转义
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 防止路径穿越到用户主目录之外
 */
function isPathSafe(targetPath) {
  const resolvedTarget = resolve(targetPath);
  const homeDir = process.env.HOME || process.env.USERPROFILE || "/";
  // 只要在用户主目录下就是安全的
  return resolvedTarget.startsWith(homeDir);
}

/**
 * Recursively delete .md files in docs/ directory, preserving .meta.yaml
 */
async function cleanupMarkdownFiles(docsDir) {
  if (!(await exists(docsDir))) return 0;

  let count = 0;
  const entries = await readdir(docsDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(docsDir, entry.name);

    if (entry.isDirectory()) {
      count += await cleanupMarkdownFiles(fullPath);
    } else if (entry.name.endsWith(".md")) {
      await unlink(fullPath);
      count++;
    }
  }

  return count;
}

// ============================================
// Document Structure Reading
// ============================================

/**
 * 递归展开 documents 中的 children 为扁平列表
 */
function flattenDocuments(documents, result = []) {
  for (const doc of documents) {
    result.push({
      title: doc.title,
      description: doc.description,
      path: doc.path,
    });

    // 递归处理 children
    if (doc.children && Array.isArray(doc.children)) {
      flattenDocuments(doc.children, result);
    }
  }
  return result;
}

async function readDocumentStructure(workspace) {
  const structurePath = join(workspace, "planning", "document-structure.yaml");

  if (!(await exists(structurePath))) {
    throw new Error(`Document structure not found: ${structurePath}\nRun /doc-smith-create first.`);
  }

  const content = await readFile(structurePath, "utf-8");
  const structure = yamlParse(content);

  // 验证必需字段
  if (!structure.documents || !Array.isArray(structure.documents)) {
    throw new Error("Missing or invalid field: documents");
  }

  // 展开 children 为扁平列表
  structure.flatDocuments = flattenDocuments(structure.documents);

  return structure;
}

/**
 * 读取配置文件
 */
async function readConfig(workspace) {
  const configPath = join(workspace, "config.yaml");

  if (!(await exists(configPath))) {
    throw new Error(`Config not found: ${configPath}\nRun /doc-smith-create first.`);
  }

  const content = await readFile(configPath, "utf-8");
  const config = yamlParse(content) || {};

  // 验证必需字段
  if (!config.locale) {
    throw new Error("Missing required field in config.yaml: locale");
  }

  return config;
}

// ============================================
// Navigation Generation
// ============================================

/**
 * 从 Markdown 文件中提取标题（第一个 h1）
 */
function extractTitleFromMarkdown(mdContent) {
  const match = mdContent.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * 支持的图片扩展名
 */
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

/**
 * 生成 key（如果 slot 未提供）
 * @param {string} docPath - 文档路径（如 "/overview"）
 * @param {string} id - slot id
 * @returns {string} - 生成的 key
 */
function generateImageKey(docPath, id) {
  // 去掉开头的 /
  const normalizedPath = docPath.startsWith("/") ? docPath.slice(1) : docPath;
  // 将 / 替换为 -
  const pathPart = normalizedPath.replace(/\//g, "-");
  return `${pathPart}-${id}`;
}

/**
 * 查找图片文件（支持多种扩展名和语言回退）
 * @param {string} assetsDir - assets 目录路径
 * @param {string} key - 图片 key
 * @param {string} locale - 当前语言
 * @param {string} mainLocale - 主语言（用于回退）
 * @returns {Promise<string|null>} - 图片相对路径（相对于 assets/images），如果不存在返回 null
 */
async function findImageFile(assetsDir, key, locale, mainLocale) {
  const keyDir = join(assetsDir, key, "images");

  // 1. 尝试查找当前语言的图片
  for (const ext of IMAGE_EXTENSIONS) {
    const imagePath = join(keyDir, `${locale}${ext}`);
    if (await exists(imagePath)) {
      return `${key}/images/${locale}${ext}`;
    }
  }

  // 2. 如果当前语言不存在，回退到主语言
  if (mainLocale && locale !== mainLocale) {
    for (const ext of IMAGE_EXTENSIONS) {
      const imagePath = join(keyDir, `${mainLocale}${ext}`);
      if (await exists(imagePath)) {
        return `${key}/images/${mainLocale}${ext}`;
      }
    }
  }

  // 3. 图片不存在
  return null;
}

/**
 * 替换 Markdown 中的图片占位符为实际图片
 * 支持以下格式：
 * - <!-- afs:image id="..." key="..." desc="..." -->
 * - <!-- afs:image id="..." desc="..." -->  (key 可选，为空时自动生成)
 *
 * @param {string} mdContent - Markdown 内容
 * @param {string} docPath - 文档路径（用于生成 key）
 * @param {string} lang - 当前语言
 * @param {string} mainLocale - 主语言（用于图片回退）
 * @param {string} assetsDir - assets 目录路径
 * @returns {Promise<string>} - 替换后的内容
 */
async function replaceImagePlaceholders(mdContent, docPath, lang, mainLocale, assetsDir) {
  // 匹配 <!-- afs:image id="..." key="..." desc="..." --> 或 <!-- afs:image id="..." desc="..." -->
  // key 是可选的
  const pattern = /<!--\s*afs:image\s+id="([^"]*)"\s*(?:key="([^"]*)")?\s*desc="([^"]*)"\s*-->/g;

  const matches = [...mdContent.matchAll(pattern)];
  if (matches.length === 0) {
    return mdContent;
  }

  let result = mdContent;
  for (const match of matches) {
    const [raw, id, userKey, desc] = match;

    // 如果用户没提供 key 或 key 为空，自动生成
    const key = userKey || generateImageKey(docPath, id);

    // 查找图片文件
    const imagePath = await findImageFile(assetsDir, key, lang, mainLocale);

    if (imagePath) {
      // 替换为 Markdown 图片语法
      const imageMarkdown = `![${desc}](/assets/images/${imagePath})`;
      result = result.replace(raw, imageMarkdown);
    }
    // 如果图片不存在，保持原样（之后会被 filterOtherComments 清理）
  }

  return result;
}

/**
 * 移除其他 HTML 注释（非 afs:image 的）
 */
function filterOtherComments(mdContent) {
  // 移除非 afs:image 的 HTML 注释
  return mdContent.replace(/<!--(?!\s*afs:image)[\s\S]*?-->/g, "");
}

/**
 * 从 document-structure 生成导航数据（带标题映射）
 * @param {Array} documents - 扁平化的文档列表
 * @param {Object} titleMap - 路径到标题的映射 { path: title }
 */
function generateNavigation(documents, titleMap = {}) {
  const nav = [];
  const groups = {};
  const groupOrder = []; // 保持分组顺序

  for (const doc of documents) {
    const path = doc.path;
    const parts = path.split("/").filter(Boolean);
    // 优先使用 titleMap 中的标题（从 markdown 读取），否则用 structure 中的
    const title = titleMap[path] || doc.title;

    if (parts.length === 1) {
      // 顶级文档
      nav.push({
        title: title,
        path: path,
        href: `/docs${path}.html`,
      });
    } else {
      // 嵌套文档，按第一级分组
      const groupKey = parts[0];
      if (!groups[groupKey]) {
        // 查找父文档的标题作为分组标题
        const parentPath = `/${groupKey}`;
        const parentTitle = titleMap[parentPath] || groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
        groups[groupKey] = {
          title: parentTitle,
          path: parentPath,
          href: `/docs${parentPath}.html`,
          children: [],
        };
        groupOrder.push(groupKey);
      }
      groups[groupKey].children.push({
        title: title,
        path: path,
        href: `/docs${path}.html`,
      });
    }
  }

  // 将分组按原始顺序添加到导航
  for (const key of groupOrder) {
    nav.push(groups[key]);
  }

  return nav;
}

/**
 * 渲染导航 HTML
 */
function renderNavigation(nav, currentPath, lang) {
  let html = "<ul>";

  for (const item of nav) {
    if (item.children) {
      // 有子项的分组 - 父节点也可点击
      const isParentActive = item.path === currentPath;
      const parentHref = `/${lang}${item.href}`;
      html += `<li>`;
      html += `<a href="${parentHref}" class="nav-group-title${isParentActive ? ' active' : ''}">${escapeHtml(item.title)}</a>`;
      html += `<ul>`;
      for (const child of item.children) {
        const isActive = child.path === currentPath;
        const href = `/${lang}${child.href}`;
        html += `<li><a href="${href}"${isActive ? ' class="active"' : ""}>${escapeHtml(child.title)}</a></li>`;
      }
      html += "</ul></li>";
    } else {
      // 单项
      const isActive = item.path === currentPath;
      const href = `/${lang}${item.href}`;
      html += `<li><a href="${href}"${isActive ? ' class="active"' : ""}>${escapeHtml(item.title)}</a></li>`;
    }
  }

  html += "</ul>";
  return html;
}

// ============================================
// TOC Generation
// ============================================

/**
 * 从 HTML 内容生成目录
 */
function generateTOC(htmlContent) {
  const headingRegex = /<h([2-4])[^>]*id="([^"]*)"[^>]*>([^<]*)<a[^>]*class="header-anchor"[^>]*>[^<]*<\/a><\/h[2-4]>/g;
  const toc = [];
  let match;

  while ((match = headingRegex.exec(htmlContent)) !== null) {
    const level = parseInt(match[1], 10);
    const id = match[2];
    const text = match[3].trim();

    toc.push({ level, id, text });
  }

  return toc;
}

/**
 * 渲染目录 HTML
 */
function renderTOC(toc) {
  if (toc.length === 0) return "";

  let html = '<div class="toc-title">On this page</div><ul>';
  let prevLevel = 2;
  let openLists = 0;

  for (const item of toc) {
    // 处理层级变化
    if (item.level > prevLevel) {
      html += "<ul>";
      openLists++;
    } else if (item.level < prevLevel) {
      const diff = prevLevel - item.level;
      for (let i = 0; i < diff && openLists > 0; i++) {
        html += "</ul>";
        openLists--;
      }
    }

    html += `<li><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`;
    prevLevel = item.level;
  }

  // 关闭所有打开的列表
  while (openLists > 0) {
    html += "</ul>";
    openLists--;
  }

  html += "</ul>";
  return html;
}

// ============================================
// HTML Template
// ============================================

/**
 * 渲染完整 HTML 页面
 */
function renderTemplate(options) {
  const {
    lang,
    title,
    description,
    siteName,
    content,
    navigation,
    toc,
    assetPath,
    languages,
    currentPath,
  } = options;

  // 语言名称映射
  const langNames = {
    zh: "简体中文",
    en: "English",
    ja: "日本語",
    ko: "한국어",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
    pt: "Português",
    ru: "Русский",
    ar: "العربية",
  };

  // 语言旗帜映射（使用 emoji）
  const langFlags = {
    zh: "🇨🇳",
    en: "🇺🇸",
    ja: "🇯🇵",
    ko: "🇰🇷",
    fr: "🇫🇷",
    de: "🇩🇪",
    es: "🇪🇸",
    pt: "🇧🇷",
    ru: "🇷🇺",
    ar: "🇸🇦",
  };

  // 语言下拉选择器
  let langDropdown = "";
  if (languages && languages.length > 1) {
    const currentLangName = langNames[lang] || lang.toUpperCase();
    const currentFlag = langFlags[lang] || "🌐";

    let menuItems = "";
    for (const l of languages) {
      const isActive = l === lang;
      const href = `/${l}/docs${currentPath}.html`;
      const name = langNames[l] || l.toUpperCase();
      const flag = langFlags[l] || "🌐";
      menuItems += `<a href="${href}"${isActive ? ' class="active"' : ""}><span class="lang-flag">${flag}</span>${name}</a>`;
    }

    langDropdown = `
    <div class="lang-dropdown">
      <button class="lang-dropdown-trigger">
        <span class="lang-flag">${currentFlag}</span>
        ${currentLangName}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div class="lang-dropdown-menu">${menuItems}</div>
    </div>`;
  }

  // 主题切换按钮
  const themeToggle = `
    <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
      <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
      <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    </button>`;

  // Header 控件组合
  const headerControls = `
    <div class="header-controls">
      ${langDropdown}
      ${themeToggle}
    </div>`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}${siteName ? ` - ${escapeHtml(siteName)}` : ""}</title>
  <meta name="description" content="${escapeHtml(description || "")}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description || "")}">
  <link rel="stylesheet" href="${assetPath}/docsmith.css">
  <link rel="stylesheet" href="${assetPath}/theme.css">
  <script>
    // Initialize theme from localStorage or system preference
    (function() {
      const stored = localStorage.getItem('docsmith-theme');
      if (stored) {
        document.documentElement.setAttribute('data-theme', stored);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    })();

    function toggleTheme() {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('docsmith-theme', next);
    }
  </script>
</head>
<body>
  <header data-ds="header">
    <a href="/${lang}/index.html" class="site-title">${escapeHtml(siteName || "Documentation")}</a>
    ${headerControls}
  </header>
  <div data-ds="layout">
    <aside data-ds="sidebar">${navigation}</aside>
    <main data-ds="content">${content}</main>
    <nav data-ds="toc">${toc}</nav>
  </div>
  <footer data-ds="footer">
    Built with DocSmith
  </footer>
</body>
</html>`;
}

// ============================================
// Build Process
// ============================================

async function build(options) {
  const { workspace, output } = options;

  console.log("DocSmith HTML Build");
  console.log("===================");
  console.log(`Workspace: ${workspace}`);
  console.log(`Output: ${output}`);
  console.log();

  // 1. 检查 workspace
  if (!(await exists(workspace))) {
    throw new Error(`Workspace not found: ${workspace}\nRun /doc-smith-create first.`);
  }

  // 2. 读取配置和文档结构
  console.log("Reading configuration...");
  const config = await readConfig(workspace);
  const structure = await readDocumentStructure(workspace);

  const locale = config.locale;
  const translateLanguages = config.translateLanguages || [];
  const languages = [locale, ...translateLanguages];
  // 使用展开后的扁平文档列表
  const documents = structure.flatDocuments;

  console.log(`  Locale: ${locale}`);
  console.log(`  Languages: ${languages.join(", ")}`);
  console.log(`  Documents: ${documents.length}`);
  console.log();

  // 4. 确保输出目录
  await ensureDir(output);

  // 路径安全检查
  if (!isPathSafe(output)) {
    throw new Error("Output path is outside safe directories");
  }

  // 5. 复制静态资源
  console.log("Copying assets...");
  const assetsOutput = join(output, "assets");
  await ensureDir(assetsOutput);

  // 复制内置 CSS
  const builtinCss = join(__dirname, "..", "assets", "docsmith.css");
  await copyFile(builtinCss, join(assetsOutput, "docsmith.css"));

  // 复制主题 CSS（如果存在）
  const themeCss = join(workspace, "theme.css");
  if (await exists(themeCss)) {
    await copyFile(themeCss, join(assetsOutput, "theme.css"));
    console.log("  Copied theme.css");
  } else {
    // 创建空的 theme.css 以避免 404
    await writeFile(join(assetsOutput, "theme.css"), "/* Custom theme styles */\n");
    console.log("  Created empty theme.css");
  }

  // 复制文档中的图片
  const workspaceAssets = join(workspace, "assets");
  if (await exists(workspaceAssets)) {
    await copyDir(workspaceAssets, join(output, "assets", "images"));
    console.log("  Copied document images");
  }

  console.log();

  // 6. 构建每种语言的文档
  const stats = {};

  for (const lang of languages) {
    console.log(`Building ${lang} pages...`);
    stats[lang] = 0;

    const langOutput = join(output, lang, "docs");
    await ensureDir(langOutput);

    // 6.1 第一遍：读取所有 markdown 标题建立 titleMap
    const titleMap = {};
    for (const doc of documents) {
      const docPath = doc.path;
      const mdPath = join(workspace, "docs", docPath.replace(/^\//, ""), `${lang}.md`);

      if (await exists(mdPath)) {
        const mdContent = await readFile(mdPath, "utf-8");
        const extractedTitle = extractTitleFromMarkdown(mdContent);
        if (extractedTitle) {
          titleMap[docPath] = extractedTitle;
        }
      }
    }

    // 6.2 用 titleMap 生成该语言的导航
    const navigation = generateNavigation(documents, titleMap);

    // 6.3 第二遍：构建每个文档
    for (const doc of documents) {
      const docPath = doc.path;
      const mdPath = join(workspace, "docs", docPath.replace(/^\//, ""), `${lang}.md`);

      // 检查文件是否存在
      if (!(await exists(mdPath))) {
        console.log(`  [SKIP] ${docPath} - ${lang}.md not found`);
        continue;
      }

      // 读取 Markdown
      let mdContent = await readFile(mdPath, "utf-8");

      // 替换图片占位符为实际图片
      mdContent = await replaceImagePlaceholders(mdContent, docPath, lang, locale, workspaceAssets);
      // 移除其他 HTML 注释
      mdContent = filterOtherComments(mdContent);

      // 转换为 HTML
      const htmlContent = md.render(mdContent);

      // 生成 TOC
      const toc = generateTOC(htmlContent);
      const tocHtml = renderTOC(toc);

      // 渲染导航
      const navHtml = renderNavigation(navigation, docPath, lang);

      // 计算资源路径（相对路径）
      const depth = docPath.split("/").filter(Boolean).length;
      const assetPath = "../".repeat(depth + 1) + "assets";

      // 使用从 markdown 读取的标题
      const pageTitle = titleMap[docPath] || doc.title;

      // 渲染完整页面
      const fullPage = renderTemplate({
        lang,
        title: pageTitle,
        description: doc.description || "",
        siteName: config.projectName,
        content: htmlContent,
        navigation: navHtml,
        toc: tocHtml,
        assetPath,
        languages,
        currentPath: docPath,
      });

      // 写入文件
      const outputPath = join(langOutput, `${docPath.replace(/^\//, "")}.html`);
      await ensureDir(dirname(outputPath));
      await writeFile(outputPath, fullPage);

      stats[lang]++;
    }

    // 创建语言首页（重定向到第一篇文档）
    if (documents.length > 0) {
      const firstDoc = documents[0];
      const firstDocUrl = `/${lang}/docs${firstDoc.path}.html`;
      const langIndexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=${firstDocUrl}">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="${firstDocUrl}">${escapeHtml(firstDoc.title)}</a>...</p>
</body>
</html>`;
      await writeFile(join(output, lang, "index.html"), langIndexHtml);
    }

    console.log(`  Generated ${stats[lang]} pages`);
  }

  // 7. 创建根目录 index.html（重定向到主语言首页）
  const firstDoc = documents[0];
  const defaultUrl = `/${locale}/docs${firstDoc.path}.html`;
  const rootIndexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=${defaultUrl}">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="${defaultUrl}">${locale.toUpperCase()}</a>...</p>
</body>
</html>`;
  await writeFile(join(output, "index.html"), rootIndexHtml);

  // 8. Cleanup intermediate .md files
  const docsDir = join(workspace, "docs");
  console.log("Cleaning up intermediate .md files...");
  const cleanedCount = await cleanupMarkdownFiles(docsDir);
  console.log(`  Removed ${cleanedCount} .md files`);

  console.log();
  console.log("Build complete!");
  console.log();
  console.log("Output:", output);
  for (const [lang, count] of Object.entries(stats)) {
    console.log(`  ${lang}: ${count} pages`);
  }

  return { success: true, stats };
}

// ============================================
// Main Entry
// ============================================

const args = process.argv.slice(2);
const options = parseArgs(args);

build(options)
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Build failed:", error.message);
    process.exit(1);
  });
