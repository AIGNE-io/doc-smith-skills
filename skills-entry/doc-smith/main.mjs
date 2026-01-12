import { detectWorkspaceMode, loadConfig, getSourceFolderName, DOC_SMITH_DIR } from "./utils.mjs";

/**
 * Generate AFS modules based on workspace mode
 */
async function generateAfsModules() {
  const workspace = await detectWorkspaceMode();

  // Default modules (always included)
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

  if (workspace?.mode === "project") {
    // Project mode: workspace is .doc-smith, add source from local-path
    modules.push({
      module: "local-fs",
      options: {
        name: "workspace",
        localPath: `\${CWD}/${DOC_SMITH_DIR}`,
        description:
          "Doc-smith workspace directory\n" +
          "- Read-write access to documentation files\n" +
          "- Use absolute path for file operations",
      },
    });

    // Load config to get source paths
    const config = await loadConfig(workspace.configPath);
    if (config?.sources) {
      for (const source of config.sources) {
        if (source.type === "local-path" && source.path) {
          const folderName = getSourceFolderName(source.path);
          modules.push({
            module: "local-fs",
            options: {
              name: `source/${folderName}`,
              localPath: `\${CWD}/${source.path.replace(/^\.\.\//, "")}`.replace(/\/$/, ""),
              description:
                `Source code directory: ${folderName}\n` +
                "- Read-only access to source files\n" +
                "- Used for documentation generation",
            },
          });
        }
      }
    }
  } else {
    // Standalone mode: workspace is current directory
    modules.push({
      module: "local-fs",
      options: {
        name: "workspace",
        localPath: "${CWD}",
        description:
          "Current working directory for the agent\n" +
          "- Read-write access to project files\n" +
          "- Use absolute path for file operations",
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

/**
 * Main agent configuration factory
 */
export default async function createMainConfig() {
  const afsModules = await generateAfsModules();

  return {
    type: "@aigne/agent-library/agent-skill-manager",
    name: "docsmith-main",
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
      // "../../agents/save-document/index.mjs",
      "../../agents/update-image/index.yaml",
      "../../skills-entry/doc-smith-docs-detail/batch.yaml",
    ],
    afs: {
      modules: afsModules,
    },
  };
}
