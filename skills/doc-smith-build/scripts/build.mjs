#!/usr/bin/env node

/**
 * DocSmith HTML Build Script
 *
 * 将 Markdown 文档构建为静态 HTML 站点。
 *
 * Usage:
 *   node build.mjs --workspace .aigne/doc-smith --output .aigne/doc-smith/dist
 */

import { readFile, writeFile, mkdir, copyFile, access, readdir, stat } from "node:fs/promises";
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

// ============================================
// Document Structure Reading
// ============================================

async function readDocumentStructure(workspace) {
  const structurePath = join(workspace, "planning", "document-structure.yaml");

  if (!(await exists(structurePath))) {
    throw new Error(`Document structure not found: ${structurePath}\nRun /doc-smith-create first.`);
  }

  const content = await readFile(structurePath, "utf-8");
  const structure = yamlParse(content);

  // 验证必需字段
  if (!structure.locale) {
    throw new Error("Missing required field: locale");
  }
  if (!structure.documents || !Array.isArray(structure.documents)) {
    throw new Error("Missing or invalid field: documents");
  }

  return structure;
}

/**
 * 读取配置文件
 */
async function readConfig(workspace) {
  const configPath = join(workspace, "config.yaml");

  if (!(await exists(configPath))) {
    return { projectName: "Documentation", projectDesc: "" };
  }

  const content = await readFile(configPath, "utf-8");
  return yamlParse(content) || {};
}

// ============================================
// Navigation Generation
// ============================================

/**
 * 从 document-structure 生成导航数据
 */
function generateNavigation(documents) {
  const nav = [];
  const groups = {};

  for (const doc of documents) {
    const path = doc.path;
    const parts = path.split("/").filter(Boolean);

    if (parts.length === 1) {
      // 顶级文档
      nav.push({
        title: doc.title,
        path: path,
        href: `/docs${path}.html`,
      });
    } else {
      // 嵌套文档，按第一级分组
      const groupKey = parts[0];
      if (!groups[groupKey]) {
        groups[groupKey] = {
          title: groupKey.charAt(0).toUpperCase() + groupKey.slice(1),
          children: [],
        };
      }
      groups[groupKey].children.push({
        title: doc.title,
        path: path,
        href: `/docs${path}.html`,
      });
    }
  }

  // 将分组添加到导航
  for (const [, group] of Object.entries(groups)) {
    nav.push(group);
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
      // 分组
      html += `<li><div class="nav-group-title">${escapeHtml(item.title)}</div><ul>`;
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

  // 语言切换器
  let langSwitcher = "";
  if (languages && languages.length > 1) {
    langSwitcher = '<div class="lang-switcher">';
    for (const l of languages) {
      const isActive = l === lang;
      const href = `/${l}/docs${currentPath}.html`;
      const label = l.toUpperCase();
      langSwitcher += `<a href="${href}"${isActive ? ' class="active"' : ""}>${label}</a>`;
    }
    langSwitcher += "</div>";
  }

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
</head>
<body>
  <header data-ds="header">
    <a href="/${lang}/index.html" class="site-title">${escapeHtml(siteName || "Documentation")}</a>
    ${langSwitcher}
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

  // 2. 读取文档结构
  console.log("Reading document structure...");
  const structure = await readDocumentStructure(workspace);
  const config = await readConfig(workspace);

  const locale = structure.locale;
  const translateLanguages = structure.translateLanguages || [];
  const languages = [locale, ...translateLanguages];
  const documents = structure.documents;

  console.log(`  Locale: ${locale}`);
  console.log(`  Languages: ${languages.join(", ")}`);
  console.log(`  Documents: ${documents.length}`);
  console.log();

  // 3. 生成导航数据
  const navigation = generateNavigation(documents);

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

    for (const doc of documents) {
      const docPath = doc.path;
      const mdPath = join(workspace, "docs", docPath.replace(/^\//, ""), `${lang}.md`);

      // 检查文件是否存在
      if (!(await exists(mdPath))) {
        console.log(`  [SKIP] ${docPath} - ${lang}.md not found`);
        continue;
      }

      // 读取 Markdown
      const mdContent = await readFile(mdPath, "utf-8");

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

      // 渲染完整页面
      const fullPage = renderTemplate({
        lang,
        title: doc.title,
        description: doc.desc || "",
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
      const langIndexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=docs${firstDoc.path}.html">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="docs${firstDoc.path}.html">${escapeHtml(firstDoc.title)}</a>...</p>
</body>
</html>`;
      await writeFile(join(output, lang, "index.html"), langIndexHtml);
    }

    console.log(`  Generated ${stats[lang]} pages`);
  }

  // 7. 创建根目录 index.html（重定向到主语言）
  const rootIndexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=${locale}/index.html">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="${locale}/index.html">${locale.toUpperCase()}</a>...</p>
</body>
</html>`;
  await writeFile(join(output, "index.html"), rootIndexHtml);

  console.log();
  console.log("Build complete!");
  console.log();
  console.log("Output:", output);
  for (const [lang, count] of Object.entries(stats)) {
    console.log(`  ${lang}: ${count} pages`);
  }
  console.log();
  console.log("Preview:");
  console.log(`  open ${output}/index.html`);
  console.log(`  npx serve ${output}`);

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
