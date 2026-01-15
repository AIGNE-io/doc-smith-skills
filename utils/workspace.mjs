import { existsSync } from "node:fs";
import { access, readFile, mkdir, writeFile, appendFile } from "node:fs/promises";
import { constants } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";

const execAsync = promisify(exec);

/**
 * Workspace 模式常量
 */
export const WORKSPACE_MODES = {
  PROJECT: "project",
  STANDALONE: "standalone",
};

/**
 * 目录结构常量
 */
export const AIGNE_DIR = ".aigne";
export const DOC_SMITH_DIR = ".aigne/doc-smith";
export const SOURCES_DIR = "sources";
export const WORKSPACE_SUBDIRS = ["intent", "planning", "docs"];

/**
 * doc-smith workspace 的 .gitignore 内容
 */
export const GITIGNORE_CONTENT = `\
# Ignore sources directory
sources/

# Ignore temporary files
.tmp/
.temp/
temp/
`;

/**
 * 检查路径是否存在
 * @param {string} path - 路径
 * @returns {Promise<boolean>}
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
 * 检查路径是否存在（同步版本）
 * @param {string} path - 路径
 * @returns {boolean}
 */
export function pathExistsSync(path) {
  return existsSync(path);
}

/**
 * 检查是否在 git 仓库内（支持子目录）
 * @param {string} cwd - 工作目录
 * @returns {Promise<boolean>}
 */
export async function isGitRepo(cwd = ".") {
  const result = await gitExec("rev-parse --is-inside-work-tree", cwd);
  return result.success && result.output === "true";
}

/**
 * 执行 git 命令
 * @param {string} command - git 命令（不包含 git 前缀）
 * @param {string} cwd - 工作目录
 * @returns {Promise<{success: boolean, output?: string, error?: string}>}
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
 * 获取 git 仓库根目录
 * @param {string} cwd - 起始目录
 * @returns {Promise<string | null>}
 */
export async function getGitRoot(cwd = ".") {
  const result = await gitExec("rev-parse --show-toplevel", cwd);
  if (result.success) {
    return result.output;
  }
  return null;
}

/**
 * 向 .gitignore 添加忽略规则（如果不存在）
 * @param {string} gitRoot - git 仓库根目录
 * @param {string} pattern - 要忽略的模式
 * @returns {Promise<boolean>} 是否添加成功
 */
export async function addToGitignore(gitRoot, pattern) {
  const gitignorePath = join(gitRoot, ".gitignore");

  try {
    // 检查 .gitignore 是否存在
    if (await pathExists(gitignorePath)) {
      // 读取现有内容，检查是否已包含该模式
      const content = await readFile(gitignorePath, "utf8");
      if (content.includes(pattern)) {
        return true; // 已存在，无需添加
      }
      // 追加到文件末尾（确保换行）
      const prefix = content.endsWith("\n") ? "" : "\n";
      await appendFile(gitignorePath, `${prefix}${pattern}\n`, "utf8");
    } else {
      // 创建新的 .gitignore
      await writeFile(gitignorePath, `${pattern}\n`, "utf8");
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 检测 workspace 模式（同步版本）
 * 用于需要在模块加载时同步判断的场景
 * @returns {{ mode: string, workspaceBase: string }}
 */
export function detectWorkspaceModeSync() {
  const cwd = process.cwd();
  const projectConfigPath = join(cwd, DOC_SMITH_DIR, "config.yaml");

  if (existsSync(projectConfigPath)) {
    return {
      mode: WORKSPACE_MODES.PROJECT,
      workspaceBase: join(cwd, DOC_SMITH_DIR),
    };
  }

  return {
    mode: WORKSPACE_MODES.STANDALONE,
    workspaceBase: cwd,
  };
}

/**
 * 检测 workspace 模式（异步版本）
 * @returns {Promise<{ mode: string, configPath: string, workspacePath: string } | null>}
 */
export async function detectWorkspaceMode() {
  const configInDocSmith = join(DOC_SMITH_DIR, "config.yaml");
  const configInRoot = "config.yaml";

  if (await pathExists(configInDocSmith)) {
    return {
      mode: WORKSPACE_MODES.PROJECT,
      configPath: configInDocSmith,
      workspacePath: `./${DOC_SMITH_DIR}`,
    };
  }

  if (await pathExists(configInRoot)) {
    return {
      mode: WORKSPACE_MODES.STANDALONE,
      configPath: configInRoot,
      workspacePath: ".",
    };
  }

  return null;
}

/**
 * 加载并解析 config.yaml
 * @param {string} configPath - 配置文件路径
 * @returns {Promise<Object | null>}
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
 * 生成 config.yaml 内容
 * @param {{ mode: string, sources: Array }} options - 配置选项
 * @returns {string}
 */
export function generateConfig(options) {
  const { mode, sources } = options;
  return yamlStringify({ mode, sources });
}

/**
 * 创建目录结构
 * @param {string} baseDir - 基础目录
 * @param {boolean} includeSources - 是否创建 sources 目录
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
 * 初始化 project 模式 workspace
 * 在项目根目录下创建 .aigne/doc-smith/ 目录结构
 * @returns {Promise<{ mode: string, configPath: string, workspacePath: string }>}
 */
export async function initProjectMode() {
  console.log("\n📂 Initializing doc-smith workspace...\n");

  // 创建 .aigne/doc-smith 目录
  await mkdir(DOC_SMITH_DIR, { recursive: true });

  // 在 .aigne/doc-smith 中初始化 git
  await gitExec("init", DOC_SMITH_DIR);

  // 创建目录结构
  await createDirectoryStructure(DOC_SMITH_DIR);

  // 创建 .gitignore
  await writeFile(join(DOC_SMITH_DIR, ".gitignore"), GITIGNORE_CONTENT, "utf8");

  // 生成 config.yaml
  const configContent = generateConfig({
    mode: WORKSPACE_MODES.PROJECT,
    sources: [
      {
        type: "local-path",
        path: "../../",
      },
    ],
  });
  await writeFile(join(DOC_SMITH_DIR, "config.yaml"), configContent, "utf8");

  // 在 doc-smith repo 中创建初始提交
  await gitExec("add .", DOC_SMITH_DIR);
  const commitResult = await gitExec(
    'commit -m "Initial commit: doc-smith workspace"',
    DOC_SMITH_DIR,
  );
  if (commitResult.success) {
    console.log(`✅ Created initial commit in ${DOC_SMITH_DIR}`);
  }

  // 如果外层是 git 仓库，在其 .gitignore 中添加忽略规则
  const gitRoot = await getGitRoot(".");

  if (gitRoot) {
    // 计算相对于 git 根目录的忽略路径
    const cwd = process.cwd();
    const relativePath = cwd.startsWith(gitRoot)
      ? cwd.slice(gitRoot.length + 1) // 去掉 gitRoot 和 /
      : "";
    const ignorePattern = relativePath ? `${relativePath}/${DOC_SMITH_DIR}/` : `${DOC_SMITH_DIR}/`;

    const added = await addToGitignore(gitRoot, ignorePattern);
    if (added) {
      console.log(`✅ Added ${ignorePattern} to .gitignore`);
    }
  }

  console.log("✅ Workspace initialized successfully!\n");

  return {
    mode: WORKSPACE_MODES.PROJECT,
    configPath: join(DOC_SMITH_DIR, "config.yaml"),
    workspacePath: `./${DOC_SMITH_DIR}`,
  };
}

/**
 * 初始化 standalone 模式 workspace
 * 在当前目录下创建 workspace 结构
 * @returns {Promise<{ mode: string, configPath: string, workspacePath: string }>}
 */
export async function initStandaloneMode() {
  console.log("\n📂 Initializing doc-smith workspace...\n");

  // 在当前目录初始化 git
  await gitExec("init");

  // 创建 .gitignore
  await writeFile(".gitignore", GITIGNORE_CONTENT, "utf8");

  // 创建目录结构（包括 sources/）
  await createDirectoryStructure(".", true);

  // 生成 config.yaml（sources 为空，在对话中添加）
  const configContent = generateConfig({
    mode: WORKSPACE_MODES.STANDALONE,
    sources: [],
  });
  await writeFile("config.yaml", configContent, "utf8");

  console.log("✅ Workspace initialized successfully!\n");

  return {
    mode: WORKSPACE_MODES.STANDALONE,
    configPath: "config.yaml",
    workspacePath: ".",
  };
}

/**
 * 检测目录状态并在需要时初始化 workspace
 * @returns {Promise<{ mode: string, configPath: string, workspacePath: string }>}
 */
export async function detectAndInitialize() {
  // 检查是否已初始化
  const existing = await detectWorkspaceMode();
  if (existing) {
    return existing;
  }

  // 检查是否是 git 仓库（project 模式）
  if (await isGitRepo()) {
    return await initProjectMode();
  }

  // 否则，初始化为 standalone 模式
  return await initStandaloneMode();
}
