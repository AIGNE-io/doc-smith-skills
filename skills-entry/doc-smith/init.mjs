import { mkdir, readFile, writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import { pathExists, isDirectoryEmpty, isGitRepo, DOC_SMITH_DIR } from "./utils.mjs";

const execAsync = promisify(exec);

/**
 * Supported languages for documentation
 */
const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "it", label: "Italiano" },
  { code: "ar", label: "العربية" },
];

/**
 * Directory structure subdirectories
 */
const DIRECTORIES = ["intent", "planning", "docs"];

/**
 * Execute git command
 */
async function gitExec(command, cwd = ".") {
  try {
    const { stdout } = await execAsync(`git ${command}`, { cwd });
    return { success: true, output: stdout.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Detect directory state
 * @returns {'initialized' | 'git-repo' | 'empty' | 'invalid'}
 */
async function detectDirectoryState() {
  // Check if already initialized (config.yaml exists)
  const configInDocSmith = join(DOC_SMITH_DIR, "config.yaml");
  const configInRoot = "config.yaml";

  if (await pathExists(configInDocSmith)) {
    return { state: "initialized", configPath: configInDocSmith, mode: "project" };
  }

  if (await pathExists(configInRoot)) {
    return { state: "initialized", configPath: configInRoot, mode: "standalone" };
  }

  // Check if it's a git repo (potential project mode)
  if (await isGitRepo()) {
    return { state: "git-repo" };
  }

  // Check if it's an empty directory (potential standalone mode)
  if (await isDirectoryEmpty(".")) {
    return { state: "empty" };
  }

  return { state: "invalid" };
}

/**
 * Show language selection prompt
 */
async function selectLanguage(prompts) {
  const language = await prompts.select({
    message: "🌐 Select the language for your documentation:",
    choices: SUPPORTED_LANGUAGES.map((lang) => ({
      name: `${lang.label} (${lang.code})`,
      value: lang.code,
    })),
    default: "en",
  });
  return language;
}

/**
 * Create directory structure
 */
async function createDirectoryStructure(baseDir) {
  // Create base directory
  await mkdir(baseDir, { recursive: true });

  // Create subdirectories
  for (const dir of DIRECTORIES) {
    await mkdir(join(baseDir, dir), { recursive: true });
  }
}

/**
 * Create .gitignore file
 */
async function createGitignore(path, content) {
  await writeFile(path, content, "utf8");
}

/**
 * Generate config.yaml content
 */
function generateConfig(options) {
  const { language, sources } = options;

  const config = {
    language,
    sources,
  };

  return yamlStringify(config);
}

/**
 * Flow A: Project mode initialization
 * Triggered when current directory is a git repo without .doc-smith/
 */
async function initProjectMode(prompts) {
  console.log("\n📂 Initializing doc-smith workspace...\n");

  // 1. Language selection
  const language = await selectLanguage(prompts);

  // 2. Create .doc-smith directory
  const docSmithPath = DOC_SMITH_DIR;
  await mkdir(docSmithPath, { recursive: true });

  // 3. Initialize git in .doc-smith
  await gitExec("init", docSmithPath);

  // 4. Create directory structure
  await createDirectoryStructure(docSmithPath);

  // 5. Create .gitignore (for future source additions)
  const gitignoreContent = "# Ignore source directories\nsource/\n";
  await createGitignore(join(docSmithPath, ".gitignore"), gitignoreContent);

  // 6. Generate config.yaml
  const configContent = generateConfig({
    language,
    sources: [
      {
        type: "local-path",
        path: "../",
      },
    ],
  });
  await writeFile(join(docSmithPath, "config.yaml"), configContent, "utf8");

  // 7. Check if outer directory is a git repo and add as submodule
  const outerIsGitRepo = await isGitRepo(".");
  if (outerIsGitRepo) {
    const result = await gitExec(`submodule add ./${DOC_SMITH_DIR} ${DOC_SMITH_DIR}`);
    if (result.success) {
      console.log(`✅ Added ${DOC_SMITH_DIR} as git submodule`);
    }
  }

  console.log(`\n✅ Workspace initialized successfully!`);
  console.log(`   Language: ${language}\n`);

  return {
    success: true,
    language,
    mode: "project",
    workspace: `./${DOC_SMITH_DIR}`,
    message: "Project mode initialization complete",
  };
}

/**
 * Flow B: Standalone mode initialization
 * Triggered when current directory is empty
 */
async function initStandaloneMode(prompts) {
  console.log("\n📂 Initializing doc-smith workspace...\n");

  // 1. Ask for git repository URL
  const repoUrl = await prompts.input({
    message: "🔗 Enter the source repository URL:",
    validate: (input) => {
      if (!input || input.trim() === "") {
        return "Repository URL is required";
      }
      // Basic URL validation
      if (!input.includes("://") && !input.includes("@")) {
        return "Please enter a valid git repository URL";
      }
      return true;
    },
  });

  // 2. Language selection
  const language = await selectLanguage(prompts);

  // 3. Initialize git in current directory
  await gitExec("init");

  // 4. Create .gitignore with source/
  const gitignoreContent = "# Ignore cloned source repository\nsource/\n";
  await createGitignore(".gitignore", gitignoreContent);

  // 5. Clone source repository
  console.log("\n📥 Cloning source repository...");
  const cloneResult = await gitExec(`clone "${repoUrl}" source`);
  if (!cloneResult.success) {
    return {
      success: false,
      error: "clone_failed",
      message: `Failed to clone repository: ${cloneResult.error}`,
    };
  }

  // 6. Get HEAD commit SHA
  const headResult = await gitExec("rev-parse HEAD", "source");
  const headSha = headResult.success ? headResult.output : "unknown";

  // 7. Create directory structure
  await createDirectoryStructure(".");

  // 8. Generate config.yaml
  const configContent = generateConfig({
    language,
    sources: [
      {
        type: "git-clone",
        url: repoUrl.trim(),
        ref: headSha,
        cachePath: "source",
      },
    ],
  });
  await writeFile("config.yaml", configContent, "utf8");

  console.log(`\n✅ Workspace initialized successfully!`);
  console.log(`   Language: ${language}\n`);

  return {
    success: true,
    language,
    mode: "standalone",
    workspace: "/",
    sourceUrl: repoUrl.trim(),
    sourceSha: headSha,
    message: "Standalone mode initialization complete",
  };
}

/**
 * Flow C: Already initialized
 * Triggered when config.yaml already exists
 */
async function handleAlreadyInitialized(configPath, mode) {
  console.log("\n✅ Workspace ready\n");

  // Read existing config
  const config = {};
  try {
    const configContent = await readFile(configPath, "utf8");
    // Parse YAML (basic parsing for language field)
    const languageMatch = configContent.match(/^language:\s*(.+)$/m);
    if (languageMatch) {
      config.language = languageMatch[1].trim();
    }
  } catch {
    // Ignore read errors
  }

  return {
    success: true,
    mode,
    language: config.language || "en",
    workspace: mode === "project" ? `./${DOC_SMITH_DIR}` : "/",
    message: "Workspace already initialized",
  };
}

/**
 * Main init function
 * Entry point for doc-smith workspace initialization
 */
export default async function init(_input, options) {
  const { prompts, context } = options;

  console.log("\n🚀 Welcome to Doc-Smith!");

  // Detect directory state
  const dirState = await detectDirectoryState();

  let result;

  switch (dirState.state) {
    case "initialized":
      // Flow C: Already initialized
      result = await handleAlreadyInitialized(dirState.configPath, dirState.mode);
      break;

    case "git-repo":
      // Flow A: Project mode
      result = await initProjectMode(prompts);
      break;

    case "empty":
      // Flow B: Standalone mode
      result = await initStandaloneMode(prompts);
      break;

    default:
      return {
        success: false,
        error: "invalid_directory",
        message:
          "❌ Cannot initialize workspace here.\n\n" +
          "Please run doc-smith in one of the following:\n" +
          "1. Your project's git repository\n" +
          "2. An empty directory\n\n" +
          "Then try again.",
      };
  }

  if (!result.success) {
    return result;
  }

  // Set global context for subsequent agents
  context.userContext.docSmithWorkspace = result.workspace;

  console.log("🎯 Ready for documentation generation...\n");

  // Return result with message for next agent in team
  return {
    ...result,
    message: `Workspace initialized. Language: ${result.language}. Ready for documentation generation.`,
  };
}

init.description = "Initialize doc-smith workspace and enter documentation generation mode";

init.input_schema = {
  type: "object",
  properties: {},
};
