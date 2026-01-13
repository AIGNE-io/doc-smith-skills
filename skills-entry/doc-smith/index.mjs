import {
  detectWorkspaceMode,
  loadConfig,
  isGitRepo,
  initProjectMode,
  initStandaloneMode,
  DOC_SMITH_DIR,
  SOURCES_DIR,
} from "./utils.mjs";

// AIGNE framework placeholder for current working directory
const CWD = "$" + "{CWD}";

/**
 * Detect directory state and initialize workspace if needed
 * @returns {{ mode: 'project' | 'standalone', configPath: string, workspacePath: string }}
 */
async function detectAndInitialize() {
  // Check if already initialized
  const existing = await detectWorkspaceMode();
  if (existing) {
    return existing;
  }

  // Check if it's a git repo (project mode)
  if (await isGitRepo()) {
    return await initProjectMode();
  }

  // Otherwise, initialize as standalone mode (empty or non-git directory)
  return await initStandaloneMode();
}

/**
 * Generate AFS modules based on workspace mode
 */
async function generateAfsModules(workspace) {
  const config = await loadConfig(workspace.configPath);
  const mode = config?.mode || workspace.mode;

  const modules = [
    {
      module: "history",
      options: {
        storage: {
          url: "file:./.aigne/history.db",
        },
      },
    },
  ];

  if (mode === "project") {
    // Project mode: workspace is .aigne/doc-smith, sources is CWD
    modules.push({
      module: "local-fs",
      options: {
        name: "workspace",
        localPath: `${CWD}/${DOC_SMITH_DIR}`,
        description:
          "Doc-smith workspace directory\n" +
          "- Read-write access to documentation files\n" +
          "- Use absolute path for file operations",
      },
    });

    modules.push({
      module: "local-fs",
      options: {
        name: "sources",
        localPath: CWD,
        description:
          "Source code directory (project root)\n" +
          "- Read-only access to source files\n" +
          "- Used for documentation generation",
      },
    });
  } else {
    // Standalone mode: workspace is CWD, sources is CWD/sources
    modules.push({
      module: "local-fs",
      options: {
        name: "workspace",
        localPath: CWD,
        description:
          "Doc-smith workspace directory\n" +
          "- Read-write access to documentation files\n" +
          "- Use absolute path for file operations",
      },
    });

    modules.push({
      module: "local-fs",
      options: {
        name: "sources",
        localPath: `${CWD}/${SOURCES_DIR}`,
        description:
          "Source code directory\n" +
          "- Read-only access to source files\n" +
          "- Used for documentation generation",
      },
    });
  }

  // Always add doc-smith skill module
  modules.push({
    module: "local-fs",
    options: {
      agentSkills: true,
      name: "doc-smith",
      localPath: "../../skills/doc-smith",
      description:
        "Agent skill for document operations\n" +
        "- Read-only access to skill definition files\n" +
        "- Do NOT modify files in this directory",
    },
  });

  return modules;
}

// Initialize workspace and generate config at module load time
console.log("\n🚀 Welcome to DocSmith!");

const workspace = await detectAndInitialize();
const afsModules = await generateAfsModules(workspace);

// Print workspace info
console.log(`Project: ${process.cwd()}`);
if (workspace.mode === "project") {
  console.log(`DocSmith workspace: ${DOC_SMITH_DIR}`);
  console.log(`Docs output: ${DOC_SMITH_DIR}/docs`);
} else {
  console.log(`DocSmith workspace: .`);
  console.log(`Docs output: ./docs`);
}

console.log("\n🎯 Ready for documentation generation...\n");

/**
 * Main agent configuration
 */
export default {
  type: "@aigne/agent-library/agent-skill-manager",
  name: "docsmith",
  task_render_mode: "collapse",
  instructions: {
    url: "./prompt.md",
  },

  model: {
    cache_config: {
      autoBreakpoints: {
        lastMessage: true,
      },
    },
  },

  session: {
    compact: {
      max_tokens: 150000,
    },
  },

  history_config: {
    enabled: true,
  },

  input_key: "message",
  skills: [
    { type: "@aigne/agent-library/ask-user-question" },
    "../../agents/publish/index.yaml",
    "../../agents/localize/index.yaml",
    "../../agents/generate-images/index.yaml",
    "../../agents/bash-executor/index.mjs",
    "../../agents/structure-checker/index.mjs",
    "../../agents/content-checker/index.mjs",
    "../../agents/update-image/index.yaml",
    "../../skills-entry/doc-smith-docs-detail/batch.yaml",
  ],
  afs: {
    modules: afsModules,
  },
};
