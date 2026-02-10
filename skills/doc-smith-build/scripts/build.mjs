#!/usr/bin/env node

/**
 * DocSmith HTML Build Script
 *
 * Dual-mode build:
 *   --nav               Generate nav.js + copy assets + create redirects
 *   --doc <file> --path  Build single MD file to HTML
 *
 * Usage:
 *   node build.mjs --nav --workspace .aigne/doc-smith --output .aigne/doc-smith/dist
 *   node build.mjs --doc docs/overview/zh.md --path /overview --workspace .aigne/doc-smith --output .aigne/doc-smith/dist
 */

import { readFile, writeFile, mkdir, copyFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname, basename, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as yamlParse } from "yaml";
import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// Language Maps
// ============================================

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

// ============================================
// CLI Argument Parsing
// ============================================

function parseArgs(args) {
  const options = {
    workspace: ".aigne/doc-smith",
    output: null,
    mode: null, // 'doc' | 'nav'
    doc: null, // MD file path (--doc mode)
    path: null, // doc path (--doc mode)
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--doc":
        options.mode = "doc";
        if (next && !next.startsWith("-")) {
          options.doc = next;
          i++;
        }
        break;
      case "--path":
        if (next && !next.startsWith("-")) {
          options.path = next;
          i++;
        }
        break;
      case "--nav":
        options.mode = "nav";
        break;
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

  if (!options.output) {
    options.output = join(options.workspace, "dist");
  }

  return options;
}

function printHelp() {
  console.log(`
DocSmith HTML Build Script

Usage:
  node build.mjs --nav [options]                      Generate nav.js + assets
  node build.mjs --doc <file> --path <p> [options]    Build single doc

Options:
  --nav                   Generate nav.js, copy assets, create redirects
  --doc <file>            Build single MD file to HTML
  --path <path>           Document path (e.g. /overview), required with --doc
  --workspace, -w <path>  Doc-Smith workspace path (default: .aigne/doc-smith)
  --output, -o <path>     Output directory (default: <workspace>/dist)
  --help, -h              Show this help message

Examples:
  node build.mjs --nav -w .aigne/doc-smith
  node build.mjs --doc .aigne/doc-smith/docs/overview/zh.md --path /overview -w .aigne/doc-smith
`);
}

// ============================================
// Markdown Configuration
// ============================================

const md = new MarkdownIt({
  html: false, // Disable HTML tags to prevent XSS
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

async function ensureDir(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

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

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isPathSafe(targetPath) {
  const resolvedTarget = resolve(targetPath);
  const homeDir = process.env.HOME || process.env.USERPROFILE || "/";
  return resolvedTarget.startsWith(homeDir);
}

// ============================================
// Document Structure & Config
// ============================================

function flattenDocuments(documents, result = []) {
  for (const doc of documents) {
    result.push({
      title: doc.title,
      description: doc.description,
      path: doc.path,
    });

    if (doc.children && Array.isArray(doc.children)) {
      flattenDocuments(doc.children, result);
    }
  }
  return result;
}

async function readDocumentStructure(workspace) {
  const structurePath = join(workspace, "planning", "document-structure.yaml");

  if (!(await exists(structurePath))) {
    throw new Error(`Document structure not found: ${relative(".", structurePath)}`);
  }

  const content = await readFile(structurePath, "utf-8");
  const structure = yamlParse(content);

  if (!structure.documents || !Array.isArray(structure.documents)) {
    throw new Error("Missing or invalid field: documents");
  }

  structure.flatDocuments = flattenDocuments(structure.documents);

  return structure;
}

async function readConfig(workspace) {
  const configPath = join(workspace, "config.yaml");

  if (!(await exists(configPath))) {
    throw new Error(`Config not found: ${relative(".", configPath)}`);
  }

  const content = await readFile(configPath, "utf-8");
  const config = yamlParse(content) || {};

  if (!config.locale) {
    throw new Error("Missing required field in config.yaml: locale");
  }

  return config;
}

// ============================================
// Image Processing
// ============================================

function extractTitleFromMarkdown(mdContent) {
  const match = mdContent.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function generateImageKey(docPath, id) {
  const normalizedPath = docPath.startsWith("/") ? docPath.slice(1) : docPath;
  const pathPart = normalizedPath.replace(/\//g, "-");
  return `${pathPart}-${id}`;
}

async function findImageFile(assetsDir, key, locale, mainLocale) {
  const keyDir = join(assetsDir, key, "images");

  for (const ext of IMAGE_EXTENSIONS) {
    const imagePath = join(keyDir, `${locale}${ext}`);
    if (await exists(imagePath)) {
      return `${key}/images/${locale}${ext}`;
    }
  }

  if (mainLocale && locale !== mainLocale) {
    for (const ext of IMAGE_EXTENSIONS) {
      const imagePath = join(keyDir, `${mainLocale}${ext}`);
      if (await exists(imagePath)) {
        return `${key}/images/${mainLocale}${ext}`;
      }
    }
  }

  return null;
}

async function replaceImagePlaceholders(mdContent, docPath, lang, mainLocale, assetsDir) {
  const pattern = /<!--\s*afs:image\s+id="([^"]*)"\s*(?:key="([^"]*)")?\s*desc="([^"]*)"\s*-->/g;

  const matches = [...mdContent.matchAll(pattern)];
  if (matches.length === 0) {
    return mdContent;
  }

  let result = mdContent;
  for (const match of matches) {
    const [raw, id, userKey, desc] = match;
    const key = userKey || generateImageKey(docPath, id);
    const imagePath = await findImageFile(assetsDir, key, lang, mainLocale);

    if (imagePath) {
      const imageMarkdown = `![${desc}](/assets/images/${imagePath})`;
      result = result.replace(raw, imageMarkdown);
    }
  }

  return result;
}

function filterOtherComments(mdContent) {
  return mdContent.replace(/<!--(?!\s*afs:image)[\s\S]*?-->/g, "");
}

// ============================================
// Navigation Data Generation
// ============================================

function generateNavigation(documents, titleMap = {}) {
  const nav = [];
  const groups = {};
  const groupOrder = [];

  for (const doc of documents) {
    const path = doc.path;
    const parts = path.split("/").filter(Boolean);
    const title = titleMap[path] || doc.title;

    if (parts.length === 1) {
      nav.push({
        title: title,
        path: path,
        href: `/docs${path}.html`,
      });
    } else {
      const groupKey = parts[0];
      if (!groups[groupKey]) {
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

  for (const key of groupOrder) {
    nav.push(groups[key]);
  }

  return nav;
}

// ============================================
// TOC Generation
// ============================================

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

function renderTOC(toc) {
  if (toc.length === 0) return "";

  let html = '<div class="toc-title">On this page</div><ul>';
  let prevLevel = 2;
  let openLists = 0;

  for (const item of toc) {
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

  while (openLists > 0) {
    html += "</ul>";
    openLists--;
  }

  html += "</ul>";
  return html;
}

// ============================================
// Nav.js Client-Side Rendering Script
// ============================================

const NAV_RENDER_SCRIPT = `
(function() {
  var nav = window.__DS_NAV__;
  if (!nav) return;

  var lang = document.documentElement.lang;
  var path = document.body.dataset.dsPath || '';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // Render sidebar
  var sb = document.querySelector('[data-ds="sidebar"]');
  if (sb) {
    var h = '<ul>';
    nav.documents.forEach(function(item) {
      if (item.children && item.children.length > 0) {
        var ph = '/' + lang + item.href;
        h += '<li>';
        h += '<a href="' + ph + '" class="nav-group-title' + (item.path === path ? ' active' : '') + '">' + esc(item.title) + '</a>';
        h += '<ul>';
        item.children.forEach(function(c) {
          var ch = '/' + lang + c.href;
          h += '<li><a href="' + ch + '"' + (c.path === path ? ' class="active"' : '') + '>' + esc(c.title) + '</a></li>';
        });
        h += '</ul></li>';
      } else {
        var ih = '/' + lang + item.href;
        h += '<li><a href="' + ih + '"' + (item.path === path ? ' class="active"' : '') + '>' + esc(item.title) + '</a></li>';
      }
    });
    h += '</ul>';
    sb.innerHTML = h;
  }

  // Render language dropdown
  if (nav.languages && nav.languages.length > 1) {
    var ctrl = document.querySelector('.header-controls');
    if (ctrl) {
      var cur = nav.languages.find(function(l) { return l.code === lang; }) || nav.languages[0];
      var mi = '';
      nav.languages.forEach(function(l) {
        var lh = '/' + l.code + '/docs' + path + '.html';
        mi += '<a href="' + lh + '"' + (l.code === lang ? ' class="active"' : '') + '>';
        mi += '<span class="lang-flag">' + l.flag + '</span>' + l.name + '</a>';
      });
      var dd = document.createElement('div');
      dd.className = 'lang-dropdown';
      dd.innerHTML =
        '<button class="lang-dropdown-trigger">' +
        '<span class="lang-flag">' + cur.flag + '</span>' + cur.name +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
        '</button>' +
        '<div class="lang-dropdown-menu">' + mi + '</div>';
      ctrl.insertBefore(dd, ctrl.firstChild);
    }
  }
})();
`;

// ============================================
// HTML Template
// ============================================

function renderTemplate(options) {
  const {
    lang,
    title,
    description,
    siteName,
    content,
    toc,
    assetPath,
    currentPath,
  } = options;

  // Theme toggle button
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
<body data-ds-path="${escapeHtml(currentPath)}">
  <header data-ds="header">
    <a href="/${lang}/index.html" class="site-title">${escapeHtml(siteName || "Documentation")}</a>
    <div class="header-controls">
      ${themeToggle}
    </div>
  </header>
  <div data-ds="layout">
    <aside data-ds="sidebar"><!-- nav.js 渲染 --></aside>
    <main data-ds="content">${content}</main>
    <nav data-ds="toc">${toc}</nav>
  </div>
  <footer data-ds="footer">
    Built with DocSmith
  </footer>
  <script src="${assetPath}/nav.js"></script>
  <script>${NAV_RENDER_SCRIPT}</script>
</body>
</html>`;
}

// ============================================
// --nav Mode: Generate navigation + assets
// ============================================

async function buildNav(options) {
  const { workspace, output } = options;

  console.log("DocSmith --nav: Generating navigation and assets");
  console.log(`  Workspace: ${workspace}`);
  console.log(`  Output: ${output}`);

  // Validate workspace
  if (!(await exists(workspace))) {
    throw new Error(`Workspace not found: ${workspace}`);
  }

  // Path safety check
  if (!isPathSafe(output)) {
    throw new Error("Output path is outside safe directories");
  }

  // Read config + structure
  const config = await readConfig(workspace);
  const structure = await readDocumentStructure(workspace);

  const locale = config.locale;
  const translateLanguages = config.translateLanguages || [];
  const languages = [locale, ...translateLanguages];
  const documents = structure.flatDocuments;

  console.log(`  Locale: ${locale}`);
  console.log(`  Languages: ${languages.join(", ")}`);
  console.log(`  Documents: ${documents.length}`);

  // Ensure output dirs
  await ensureDir(output);
  const assetsOutput = join(output, "assets");
  await ensureDir(assetsOutput);

  // Generate nav.js data
  const navData = {
    siteName: config.projectName || structure.name || "Documentation",
    locale,
    languages: languages.map((code) => ({
      code,
      name: langNames[code] || code.toUpperCase(),
      flag: langFlags[code] || "🌐",
    })),
    documents: generateNavigation(documents, {}),
  };

  const navJs = `window.__DS_NAV__ = ${JSON.stringify(navData, null, 2)};`;
  await writeFile(join(assetsOutput, "nav.js"), navJs);
  console.log("  Generated nav.js");

  // Copy built-in CSS
  const builtinCss = join(__dirname, "..", "assets", "docsmith.css");
  await copyFile(builtinCss, join(assetsOutput, "docsmith.css"));
  console.log("  Copied docsmith.css");

  // Copy theme CSS (or create empty placeholder)
  const themeCss = join(workspace, "theme.css");
  if (await exists(themeCss)) {
    await copyFile(themeCss, join(assetsOutput, "theme.css"));
    console.log("  Copied theme.css");
  } else {
    await writeFile(join(assetsOutput, "theme.css"), "/* Custom theme styles */\n");
    console.log("  Created empty theme.css");
  }

  // Copy document images
  const workspaceAssets = join(workspace, "assets");
  if (await exists(workspaceAssets)) {
    await copyDir(workspaceAssets, join(output, "assets", "images"));
    console.log("  Copied document images");
  }

  // Generate language index pages + root index
  for (const lang of languages) {
    const langDir = join(output, lang);
    await ensureDir(langDir);

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
      await writeFile(join(langDir, "index.html"), langIndexHtml);
    }
  }

  // Root index redirect
  if (documents.length > 0) {
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
    console.log("  Generated index.html redirect");
  }

  console.log("\n--nav complete!");
  return { success: true };
}

// ============================================
// --doc Mode: Build single document
// ============================================

async function buildSingleDoc(options) {
  const { workspace, output, doc: mdFile, path: docPath } = options;

  // Validate inputs
  if (!mdFile) {
    throw new Error("--doc requires a MD file path");
  }
  if (!docPath) {
    throw new Error("--doc requires --path <doc-path>");
  }
  if (!(await exists(mdFile))) {
    throw new Error(`MD file not found: ${mdFile}`);
  }
  if (!(await exists(workspace))) {
    throw new Error(`Workspace not found: ${workspace}`);
  }
  if (!isPathSafe(output)) {
    throw new Error("Output path is outside safe directories");
  }

  // Extract language from filename (e.g., zh.md → zh)
  const lang = basename(mdFile, ".md");

  // Read config for locale info (needed for image fallback + project name)
  const config = await readConfig(workspace);
  const mainLocale = config.locale;

  // Read MD content
  let mdContent = await readFile(mdFile, "utf-8");

  // Extract title
  const title = extractTitleFromMarkdown(mdContent) || docPath;

  // Replace image placeholders
  const workspaceAssets = join(workspace, "assets");
  mdContent = await replaceImagePlaceholders(mdContent, docPath, lang, mainLocale, workspaceAssets);
  mdContent = filterOtherComments(mdContent);

  // Convert to HTML
  const htmlContent = md.render(mdContent);

  // Generate TOC
  const toc = generateTOC(htmlContent);
  const tocHtml = renderTOC(toc);

  // Calculate asset path (relative from output/{lang}/docs/{path}.html)
  const depth = docPath.split("/").filter(Boolean).length;
  const assetPath = "../".repeat(depth + 1) + "assets";

  // Render full page
  const fullPage = renderTemplate({
    lang,
    title,
    description: "",
    siteName: config.projectName || "",
    content: htmlContent,
    toc: tocHtml,
    assetPath,
    currentPath: docPath,
  });

  // Write output
  const outputPath = join(output, lang, "docs", `${docPath.replace(/^\//, "")}.html`);
  await ensureDir(dirname(outputPath));
  await writeFile(outputPath, fullPage);

  console.log(`Built: ${lang}/docs${docPath}.html`);
  return { success: true };
}

// ============================================
// Main Entry
// ============================================

const args = process.argv.slice(2);
const options = parseArgs(args);

if (!options.mode) {
  console.error("Error: specify --nav or --doc mode. Use --help for usage.");
  process.exit(1);
}

const handler = options.mode === "nav" ? buildNav : buildSingleDoc;

handler(options)
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Build failed:", error.message);
    process.exit(1);
  });
