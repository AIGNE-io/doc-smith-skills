import {
  detectWorkspaceMode,
  loadConfig,
  DOC_SMITH_DIR,
  SOURCES_DIR,
} from "../doc-smith/utils.mjs";

// AIGNE framework placeholder for current working directory
const CWD = "$" + "{CWD}";

/**
 * Generate AFS modules based on workspace mode
 */
async function generateAfsModules() {
  const workspace = await detectWorkspaceMode();

  // If no workspace detected, use default standalone mode paths
  const mode = workspace
    ? (await loadConfig(workspace.configPath))?.mode || workspace.mode
    : "standalone";

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

  // Always add doc-smith-docs-detail skill module
  modules.push({
    module: "local-fs",
    options: {
      agentSkills: true,
      name: "doc-smith-docs-detail",
      localPath: "../../skills/doc-smith-docs-detail",
      description:
        "Agent skill for document detail generation\n" +
        "- Read-only access to skill definition files\n" +
        "- Do NOT modify files in this directory",
    },
  });

  return modules;
}

// Generate AFS modules at module load time
const afsModules = await generateAfsModules();

/**
 * Agent configuration for document detail generation
 */
export default {
  type: "@aigne/agent-library/agent-skill-manager",
  name: "generateDocumentDetail",
  description: "根据文档路径和用户要求生成单个文档的详细内容",
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

  skills: [
    "../../agents/save-document/index.mjs", // 保存文档工具
    "../../agents/content-checker/index.mjs", // 内容校验工具
  ],

  input_schema: {
    type: "object",
    required: ["path"],
    properties: {
      path: {
        type: "string",
        description:
          '文档路径，与 planning/document-structure.yaml 中的 path 字段一致（如 "/overview" 或 "/api/auth"）',
      },
      customRequirements: {
        type: "string",
        description: "用户在对话中提出的额外要求（可选），用于指导生成内容的侧重点",
      },
    },
  },

  output_schema: {
    type: "object",
    properties: {
      success: {
        type: "boolean",
        description: "操作是否成功",
      },
      path: {
        type: "string",
        description: "文档路径（成功时存在）",
      },
      summary: {
        type: "string",
        description: "文档摘要，200-300字（成功时存在）",
      },
      sections: {
        type: "array",
        items: {
          type: "string",
        },
        description: "主要章节列表（成功时存在）",
      },
      imageSlots: {
        type: "array",
        items: {
          type: "string",
        },
        description: "生成的 AFS image slots ID 列表（成功时存在）",
      },
      validationResult: {
        type: "object",
        description: "checkContent 的校验结果（成功时存在）",
      },
      error: {
        type: "string",
        description: "错误信息（失败时存在）",
      },
    },
  },

  afs: {
    modules: afsModules,
  },
};
