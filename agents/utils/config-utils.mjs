import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { join } from "node:path";
import { parse, stringify as yamlStringify } from "yaml";
import { SUPPORTED_LANGUAGES, DOC_SMITH_DIR, TMP_DIR } from "./constants.mjs";

/**
 * Load config from config.yaml file
 * @returns {Promise<Object|null>} - The config object or null if file doesn't exist
 */
export async function loadConfigFromFile() {
  const configPath = path.join(process.cwd(), "./.aigne/doc-smith", "config.yaml");

  try {
    if (!existsSync(configPath)) {
      return null;
    }

    const configContent = await fs.readFile(configPath, "utf8");
    return parse(configContent);
  } catch (error) {
    console.warn("Failed to read config file:", error.message);
    return null;
  }
}

/**
 * Handle string value formatting and updating in YAML config
 * @param {string} key - The configuration key
 * @param {string} value - The string value to save
 * @param {string} comment - Optional comment
 * @param {string} fileContent - Current file content
 * @returns {string} Updated file content
 */
function handleStringValueUpdate(key, value, comment, fileContent) {
  // Skip if key is empty to avoid "Empty regular expressions are not allowed" error
  if (!key || !key.trim()) {
    return fileContent;
  }

  const yamlObject = { [key]: value };
  const yamlContent = yamlStringify(yamlObject).trim();
  const formattedValue = yamlContent.substring(yamlContent.indexOf(":") + 1).trim();

  const lines = fileContent.split("\n");
  const keyRegex = new RegExp(`^${key}:\\s*`);
  const keyIndex = lines.findIndex((line) => line.match(keyRegex));

  if (keyIndex !== -1) {
    lines[keyIndex] = `${key}: ${formattedValue}`;
  } else {
    if (comment) {
      lines.push(`# ${comment}`);
    }
    lines.push(`${key}: ${formattedValue}`);
  }

  return lines.join("\n");
}

/**
 * Handle array value formatting and updating in YAML config
 * @param {string} key - The configuration key
 * @param {Array} value - The array value to save
 * @param {string} comment - Optional comment
 * @param {string} fileContent - Current file content
 * @returns {string} Updated file content
 */
function handleArrayValueUpdate(key, value, comment, fileContent) {
  if (!key || !key.trim()) {
    return fileContent;
  }

  const yamlObject = { [key]: value };
  const yamlContent = yamlStringify(yamlObject).trim();
  const formattedValue = yamlContent;

  const lines = fileContent.split("\n");
  const keyStartIndex = lines.findIndex((line) => line.match(new RegExp(`^${key}:\\s*`)));

  if (keyStartIndex !== -1) {
    let keyEndIndex = keyStartIndex;
    for (let i = keyStartIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === "" || line.startsWith("#") || (!line.startsWith("- ") && !line.match(/^\w+:/))) {
        if (!line.startsWith("- ")) {
          keyEndIndex = i - 1;
          break;
        }
      } else if (line.match(/^\w+:/)) {
        keyEndIndex = i - 1;
        break;
      } else if (line.startsWith("- ")) {
        keyEndIndex = i;
      }
    }

    if (keyEndIndex === keyStartIndex) {
      const keyLine = lines[keyStartIndex];
      if (keyLine.includes("[") || !keyLine.endsWith(":")) {
        keyEndIndex = keyStartIndex;
      } else {
        for (let i = keyStartIndex + 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith("- ")) {
            keyEndIndex = i;
          } else if (line !== "" && !line.startsWith("#")) {
            break;
          }
        }
      }
    }

    const replacementLines = formattedValue.split("\n");
    lines.splice(keyStartIndex, keyEndIndex - keyStartIndex + 1, ...replacementLines);

    if (comment && keyStartIndex > 0 && !lines[keyStartIndex - 1].trim().startsWith("# ")) {
      lines.splice(keyStartIndex, 0, `# ${comment}`);
    }
  } else {
    if (comment) {
      lines.push(`# ${comment}`);
    }
    const formattedLines = formattedValue.split("\n");
    lines.push(...formattedLines);
  }

  return lines.join("\n");
}

/**
 * Save value to config.yaml file
 * @param {string} key - The config key to save
 * @param {string|Array} value - The value to save (can be string or array)
 * @param {string} [comment] - Optional comment to add above the key
 */
export async function saveValueToConfig(key, value, comment) {
  if (value === undefined) {
    return;
  }

  try {
    const docSmithDir = path.join(process.cwd(), "./.aigne/doc-smith");
    if (!existsSync(docSmithDir)) {
      mkdirSync(docSmithDir, { recursive: true });
    }

    const configPath = path.join(docSmithDir, "config.yaml");
    let fileContent = "";

    if (existsSync(configPath)) {
      fileContent = await fs.readFile(configPath, "utf8");
    }

    let updatedContent;
    if (Array.isArray(value)) {
      updatedContent = handleArrayValueUpdate(key, value, comment, fileContent);
    } else {
      updatedContent = handleStringValueUpdate(key, value, comment, fileContent);
    }

    await fs.writeFile(configPath, updatedContent);
  } catch (error) {
    console.warn(`Failed to save ${key} to config.yaml:`, error.message);
  }
}

/**
 * Get GitHub repository URL
 * @returns {string} - GitHub repository URL or empty string
 */
export function getGithubRepoUrl() {
  try {
    const gitRemote = execSync("git remote get-url origin", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    if (gitRemote.includes("github.com")) {
      return gitRemote;
    }

    return "";
  } catch {
    return "";
  }
}

/**
 * Get GitHub repository information
 * @param {string} repoUrl - The repository URL
 * @returns {Promise<Object>} - Repository information
 */
export async function getGitHubRepoInfo(repoUrl) {
  try {
    const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (!match) return null;

    const [, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.warn("Failed to fetch GitHub repository info:", repoUrl, response.statusText);
      return null;
    }

    const data = await response.json();
    return {
      name: data.name,
      description: data.description || "",
      icon: data.owner?.avatar_url || "",
    };
  } catch (error) {
    console.warn("Failed to fetch GitHub repository info:", error.message);
    return null;
  }
}

/**
 * Get project information from Git or directory
 * @returns {Promise<Object>} - Project information
 */
export async function getProjectInfo() {
  let repoInfo = null;
  let defaultName = path.basename(process.cwd());
  let defaultDescription = "";
  let defaultIcon = "";
  let fromGitHub = false;

  try {
    const gitRemote = execSync("git remote get-url origin", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    const repoName = gitRemote.split("/").pop().replace(".git", "");
    defaultName = repoName;

    if (gitRemote.includes("github.com")) {
      repoInfo = await getGitHubRepoInfo(gitRemote);
      if (repoInfo) {
        defaultDescription = repoInfo.description;
        defaultIcon = repoInfo.icon;
        fromGitHub = true;
      }
    }
  } catch (_error) {
    console.warn("No git repository found, using current directory name");
  }

  return {
    name: defaultName,
    description: defaultDescription,
    icon: defaultIcon,
    fromGitHub,
  };
}

/**
 * Detect system language
 * @returns {string} - Language code (e.g., 'en', 'zh')
 */
export function detectSystemLanguage() {
  try {
    let systemLocale = null;

    systemLocale = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL;

    if (!systemLocale) {
      try {
        systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
      } catch (_error) {
        // Intl API failed
      }
    }

    if (!systemLocale) {
      return "en";
    }

    const languageCode = systemLocale.split(/[_.-]/)[0].toLowerCase();
    const supportedCode = SUPPORTED_LANGUAGES.find((lang) => lang.code === languageCode);

    return supportedCode ? supportedCode.code : "en";
  } catch (error) {
    console.warn("Failed to detect system language:", error.message);
    return "en";
  }
}

/**
 * Generate configuration YAML content
 * @param {Object} input - Input configuration object
 * @returns {string} - YAML configuration string
 */
/**
 * Ensure temporary directory exists
 * @returns {Promise<void>}
 */
export async function ensureTmpDir() {
  const { existsSync, mkdirSync } = await import("node:fs");
  const tmpDir = join(process.cwd(), DOC_SMITH_DIR, TMP_DIR);
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }
}

/**
 * Check if a file is a remote URL
 * @param {string} file - File path or URL
 * @returns {boolean}
 */
export function isRemoteFile(file) {
  return file && (file.startsWith("http://") || file.startsWith("https://"));
}

export function generateConfigYAML(input) {
  const config = {
    projectName: (input.projectName || "").trim(),
    projectDesc: (input.projectDesc || "").trim(),
    projectLogo: input.projectLogo || "",
    locale: input.locale || "en",
    translateLanguages: input.translateLanguages?.filter((lang) => lang.trim()) || [],
    docsDir: input.docsDir || "./.aigne/doc-smith/docs",
    sourcesPath: input.sourcesPath || [],
  };

  let yaml = "# Project information for documentation publishing\n";

  const projectSection = yamlStringify({
    projectName: config.projectName,
    projectDesc: config.projectDesc,
    projectLogo: config.projectLogo,
  }).trim();

  yaml += `${projectSection}\n\n`;

  yaml += "# Language settings\n";
  const localeSection = yamlStringify({ locale: config.locale }).trim();
  yaml += `${localeSection}\n`;

  if (config.translateLanguages.length > 0) {
    const translateLanguagesSection = yamlStringify({
      translateLanguages: config.translateLanguages,
    }).trim();
    yaml += `${translateLanguagesSection}\n`;
  } else {
    yaml += "# translateLanguages:  # A list of languages to translate the documentation to.\n";
    yaml += "#   - zh  # Example: Chinese translation\n";
    yaml += "#   - en  # Example: English translation\n";
  }

  yaml += "\n# Documentation directory and source paths\n";
  const docsDirSection = yamlStringify({ docsDir: config.docsDir }).trim();
  yaml += `${docsDirSection}  # The directory where the generated documentation will be saved.\n`;

  const sourcesPathSection = yamlStringify({ sourcesPath: config.sourcesPath }).trim();
  yaml += `${sourcesPathSection.replace(/^sourcesPath:/, "sourcesPath:  # The source code paths to analyze.")}\n`;

  return yaml;
}
