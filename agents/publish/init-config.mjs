import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import chalk from "chalk";
import { loadConfigFromFile, generateConfigYAML } from "../../utils/config.mjs";
import { getProjectInfo, detectSystemLanguage } from "../../utils/project.mjs";

/**
 * Initialize configuration for publishing
 * @param {Object} params
 * @param {string} params.outputPath - Output path for config file
 * @param {string} params.fileName - Config file name
 * @param {boolean} params.skipIfExists - Skip if config file exists
 * @param {boolean} params.checkOnly - Only check if config exists
 * @param {string} params.appUrl - Optional app URL
 * @returns {Promise<Object>} - Configuration object
 */
export default async function initConfig(
  {
    fileName = "config.yaml",
    skipIfExists = false,
    appUrl,
    checkOnly = false,
  } = {},
  options
) {
  // Detect workspace mode (new structure with config.yaml in root)
  const configPath = "./";

  // Check only mode
  if (checkOnly) {
    const filePath = join(configPath, fileName);
    const configContent = await readFile(filePath, "utf8").catch(() => null);

    if (!configContent || configContent.trim() === "") {
      console.log("⚠️  No configuration file found.");
      console.log(
        `🚀 Configuration will be created automatically when you run the publish command.`
      );
      process.exit(0);
    }

    const config = await loadConfigFromFile();
    return { ...config, appUrl };
  }

  // Skip if exists mode
  if (skipIfExists) {
    const filePath = join(configPath, fileName);
    const configContent = await readFile(filePath, "utf8").catch(() => null);

    if (configContent && configContent.trim() !== "") {
      const config = await loadConfigFromFile();
      return { ...config, appUrl };
    }
  }

  // Create new config with default values
  const input = {};

  // Detect system language
  input.locale = detectSystemLanguage();

  // Get project info
  const projectInfo = await getProjectInfo();
  input.projectName = projectInfo.name.trim();
  input.projectDesc = projectInfo.description.trim();
  input.projectLogo = projectInfo.icon;

  input.docsDir = "./docs";
  input.sourcesPath = ["sources/"];
  input.translateLanguages = [];

  // Generate YAML content
  const yamlContent = generateConfigYAML(input);

  // Save file
  try {
    const filePath = join(configPath, fileName);
    const dirPath = dirname(filePath);

    await mkdir(dirPath, { recursive: true });
    await writeFile(filePath, yamlContent, "utf8");

    console.log(
      `\n✅ Configuration created successfully: ${chalk.cyan(filePath)}`
    );
    console.log(
      "💡 You can edit this file to customize your publishing settings.\n"
    );

    if (skipIfExists) {
      const config = await loadConfigFromFile();
      return { ...config, appUrl };
    }

    return {};
  } catch (error) {
    console.error(`❌ Failed to create configuration file: ${error.message}`);
    return {
      inputGeneratorStatus: false,
      inputGeneratorError: error.message,
    };
  }
}

initConfig.description = "Initialize configuration for document publishing";

initConfig.input_schema = {
  type: "object",
  properties: {
    outputPath: {
      type: "string",
      description: "Output path for config file",
    },
    fileName: {
      type: "string",
      description: "Config file name",
    },
    skipIfExists: {
      type: "boolean",
      description: "Skip if config file exists",
    },
    checkOnly: {
      type: "boolean",
      description: "Only check if config exists",
    },
    appUrl: {
      type: "string",
      description: "App URL for publishing",
    },
  },
};
