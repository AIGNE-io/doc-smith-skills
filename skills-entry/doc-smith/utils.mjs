import { access, readFile, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";

const execAsync = promisify(exec);

/**
 * Directory structure constants
 */
export const AIGNE_DIR = ".aigne";
export const DOC_SMITH_DIR = ".aigne/doc-smith";
export const SOURCES_DIR = "sources";
export const WORKSPACE_SUBDIRS = ["intent", "planning", "docs"];

/**
 * Check if a path exists
 */
export async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if directory is empty
 */
export async function isDirectoryEmpty(path) {
  try {
    const { stdout } = await execAsync(`ls -A "${path}" 2>/dev/null | head -1`);
    return stdout.trim() === "";
  } catch {
    return false;
  }
}

/**
 * Check if directory is a git repository
 */
export async function isGitRepo(path = ".") {
  return pathExists(join(path, ".git"));
}

/**
 * Execute git command
 */
export async function gitExec(command, cwd = ".") {
  try {
    const { stdout } = await execAsync(`git ${command}`, { cwd });
    return { success: true, output: stdout.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Detect workspace mode based on config location
 * @returns {{ mode: 'project' | 'standalone', configPath: string, workspacePath: string } | null}
 */
export async function detectWorkspaceMode() {
  const configInDocSmith = join(DOC_SMITH_DIR, "config.yaml");
  const configInRoot = "config.yaml";

  if (await pathExists(configInDocSmith)) {
    return {
      mode: "project",
      configPath: configInDocSmith,
      workspacePath: `./${DOC_SMITH_DIR}`,
    };
  }

  if (await pathExists(configInRoot)) {
    return {
      mode: "standalone",
      configPath: configInRoot,
      workspacePath: ".",
    };
  }

  return null;
}

/**
 * Load and parse config.yaml
 */
export async function loadConfig(configPath) {
  try {
    const content = await readFile(configPath, "utf8");
    return yamlParse(content);
  } catch {
    return null;
  }
}

/**
 * Generate config.yaml content
 */
export function generateConfig(options) {
  const { mode, sources } = options;
  return yamlStringify({ mode, sources });
}

/**
 * Create directory structure
 */
export async function createDirectoryStructure(baseDir, includeSources = false) {
  await mkdir(baseDir, { recursive: true });

  for (const dir of WORKSPACE_SUBDIRS) {
    await mkdir(join(baseDir, dir), { recursive: true });
  }

  if (includeSources) {
    await mkdir(join(baseDir, SOURCES_DIR), { recursive: true });
  }
}

/**
 * Create .gitignore file
 */
export async function createGitignore(path, content) {
  await writeFile(path, content, "utf8");
}

/**
 * Initialize project mode workspace
 * Creates .aigne/doc-smith/ directory structure
 */
export async function initProjectMode() {
  console.log("\n📂 Initializing doc-smith workspace...\n");

  // Create .aigne/doc-smith directory
  await mkdir(DOC_SMITH_DIR, { recursive: true });

  // Initialize git in .aigne/doc-smith
  await gitExec("init", DOC_SMITH_DIR);

  // Create directory structure
  await createDirectoryStructure(DOC_SMITH_DIR);

  // Create .gitignore
  const gitignoreContent = "# Ignore sources directory\nsources/\n";
  await createGitignore(join(DOC_SMITH_DIR, ".gitignore"), gitignoreContent);

  // Generate config.yaml
  const configContent = generateConfig({
    mode: "project",
    sources: [
      {
        type: "local-path",
        path: "../../",
      },
    ],
  });
  await writeFile(join(DOC_SMITH_DIR, "config.yaml"), configContent, "utf8");

  // Add as submodule if outer is git repo
  if (await isGitRepo(".")) {
    const result = await gitExec(`submodule add ./${DOC_SMITH_DIR} ${DOC_SMITH_DIR}`);
    if (result.success) {
      console.log(`✅ Added ${DOC_SMITH_DIR} as git submodule`);
    }
  }

  console.log("✅ Workspace initialized successfully!\n");

  return {
    mode: "project",
    configPath: join(DOC_SMITH_DIR, "config.yaml"),
    workspacePath: `./${DOC_SMITH_DIR}`,
  };
}

/**
 * Initialize standalone mode workspace
 * Creates workspace in current directory
 */
export async function initStandaloneMode() {
  console.log("\n📂 Initializing doc-smith workspace...\n");

  // Initialize git in current directory
  await gitExec("init");

  // Create .gitignore
  const gitignoreContent = "# Ignore sources directory\nsources/\n";
  await createGitignore(".gitignore", gitignoreContent);

  // Create directory structure (including sources/)
  await createDirectoryStructure(".", true);

  // Generate config.yaml (empty sources, to be added in conversation)
  const configContent = generateConfig({
    mode: "standalone",
    sources: [],
  });
  await writeFile("config.yaml", configContent, "utf8");

  console.log("✅ Workspace initialized successfully!\n");

  return {
    mode: "standalone",
    configPath: "config.yaml",
    workspacePath: ".",
  };
}
