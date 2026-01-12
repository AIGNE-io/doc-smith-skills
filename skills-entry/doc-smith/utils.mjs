import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join, basename, resolve } from "node:path";
import { parse as yamlParse } from "yaml";

const execAsync = promisify(exec);

/**
 * Directory structure constants
 */
export const DOC_SMITH_DIR = ".doc-smith";

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
 * Extract source folder name from local-path source
 * @param {string} path - The path value from source config (e.g., "../")
 * @returns {string} - The folder name to use for registration
 */
export function getSourceFolderName(path) {
  // Resolve the path and get the folder name
  const resolved = resolve(path);
  return basename(resolved) || "source";
}
