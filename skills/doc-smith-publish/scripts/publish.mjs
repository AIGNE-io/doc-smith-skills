#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import chalk from "chalk";
import { joinURL } from "ufo";
import yaml from "js-yaml";

import { DOCSMITH_HUB_URL_DEFAULT, API_PATHS, isMainModule } from "./utils/constants.mjs";
import { getAccessToken } from "./utils/auth.mjs";
import { getApiBaseUrl } from "./utils/blocklet-info.mjs";
import { apiPatch, subscribeToSSE, pollConversionStatus } from "./utils/http.mjs";
import { zipDirectory } from "./utils/zip.mjs";
import { uploadFile } from "./utils/upload.mjs";
import { getPublishHistory, savePublishHistory } from "./utils/history.mjs";

/**
 * Main publish function
 */
async function publish(options) {
  const {
    dir,
    hub = DOCSMITH_HUB_URL_DEFAULT,
    title,
    desc,
    visibility = "public",
    workspace,
  } = options;

  let cleanup = null;

  try {
    // Validate input - dir mode only
    if (!dir) {
      throw new Error("Please provide --dir to specify the directory to publish");
    }

    console.log(chalk.bold("\n🚀 DocSmith Publish\n"));
    console.log(chalk.gray(`Hub: ${hub}`));

    // Get authorization
    const accessToken = await getAccessToken(hub);

    // Resolve source path for history lookup
    const sourcePath = resolve(dir);

    // Check directory exists
    if (!existsSync(sourcePath)) {
      throw new Error(`Directory not found: ${sourcePath}`);
    }
    const dirStat = await stat(sourcePath);
    if (!dirStat.isDirectory()) {
      throw new Error(`Not a directory: ${sourcePath}`);
    }

    // Look up publish history for existing DID (version update)
    let existingDid = null;
    const history = await getPublishHistory(sourcePath, hub, workspace);
    if (history) {
      existingDid = history.did;
    }

    // Compress directory
    const zipResult = await zipDirectory(sourcePath);
    cleanup = zipResult.cleanup;

    // Upload file with optional existing DID for version update
    const uploadResult = await uploadFile(zipResult.zipPath, hub, accessToken, { did: existingDid });
    const did = uploadResult.did;
    const needsConversion = uploadResult.status === "PENDING";
    const versionHistoryEnabled = uploadResult.versionHistoryEnabled;

    // Wait for conversion if needed
    if (needsConversion) {
      console.log(chalk.cyan("\nWaiting for conversion..."));

      const apiBaseUrl = await getApiBaseUrl(hub);
      const streamUrl = joinURL(apiBaseUrl, API_PATHS.CONVERT_STREAM(did));
      const statusUrl = joinURL(apiBaseUrl, API_PATHS.CONVERSION_STATUS(did));

      try {
        // Try SSE stream first
        await subscribeToSSE(streamUrl, accessToken, hub, {
          onMessage: (message) => {
            console.log(chalk.gray(`  ${message}`));
          },
          onProgress: (data) => {
            if (data.message) {
              console.log(chalk.gray(`  ${data.message}`));
            }
          },
          onCompleted: (data) => {
            console.log(chalk.green("\n✅ Conversion completed!"));
          },
          onError: (error) => {
            console.log(chalk.red(`\n❌ Conversion error: ${error}`));
          },
        });
      } catch (sseError) {
        // Fallback to polling if SSE fails
        console.log(chalk.yellow("SSE connection failed, using polling..."));
        await pollConversionStatus(statusUrl, accessToken, hub, {
          onProgress: (status) => {
            console.log(chalk.gray(`  Status: ${status.status}`));
          },
          onCompleted: (status) => {
            console.log(chalk.green("\n✅ Conversion completed!"));
          },
          onError: (error) => {
            console.log(chalk.red(`\n❌ Conversion error: ${error}`));
          },
        });
      }
    }

    // Execute publish action
    console.log(chalk.cyan("\nPublishing..."));

    const apiBaseUrl = await getApiBaseUrl(hub);
    const actionUrl = joinURL(apiBaseUrl, API_PATHS.VIBE_ACTION(did));

    const actionData = {
      action: "publish",
    };

    if (title) actionData.title = title;
    if (desc) actionData.description = desc;
    if (visibility) actionData.visibility = visibility;

    let actionResult;
    try {
      actionResult = await apiPatch(actionUrl, actionData, accessToken, hub);
    } catch (actionError) {
      console.error(chalk.red(`\n❌ Publish action failed: ${actionError.message}`));
      console.error(chalk.yellow(`\n📌 Upload was successful. DID: ${did}`));
      console.error(chalk.yellow("Please run the publish command again to retry."));
      return {
        success: false,
        error: actionError.message,
        did,
      };
    }

    if (actionResult.success) {
      console.log(chalk.green.bold("\n✅ Published successfully!\n"));

      const vibeUrl = actionResult.vibeUrl;
      if (vibeUrl) {
        console.log(chalk.cyan(`🔗 ${vibeUrl}\n`));
      }

      // Write appUrl to workspace config.yaml
      if (vibeUrl && workspace) {
        try {
          const configPath = join(workspace, "config.yaml");
          if (existsSync(configPath)) {
            const configContent = readFileSync(configPath, "utf-8");
            const config = yaml.load(configContent) || {};
            config.appUrl = vibeUrl;
            writeFileSync(configPath, yaml.dump(config, { indent: 2, lineWidth: -1 }), "utf-8");
          }
        } catch (e) {
          // Ignore config write errors
        }
      }

      // Upgrade prompt: updating existing project + version history not enabled
      if (existingDid && versionHistoryEnabled === false) {
        const pricingUrl = joinURL(hub, "pricing");
        console.log(chalk.yellow("📦 Previous version overwritten. Want to keep version history?"));
        console.log(chalk.yellow(`   Upgrade to Creator → ${pricingUrl}\n`));
      }

      // Save publish history for future version updates
      try {
        await savePublishHistory(sourcePath, hub, did, title || "", workspace);
      } catch (e) {
        // Ignore history save errors
      }

      return {
        success: true,
        did,
        url: vibeUrl,
      };
    } else {
      throw new Error(actionResult.error || "Publish action failed");
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    return {
      success: false,
      error: error.message,
    };
  } finally {
    // Cleanup temp files
    if (cleanup) {
      await cleanup();
    }
  }
}

/**
 * Parse config object from JSON input
 * @param {Object} config - Parsed config object
 * @returns {Object} - Options object
 */
function parseConfig(config) {
  const options = {};

  // Parse source - dir mode only
  if (config.source) {
    if (config.source.type === "dir") {
      options.dir = config.source.path;
    } else {
      throw new Error(`Unsupported source type: ${config.source.type}. Only "dir" is supported.`);
    }
  }

  // Parse metadata
  if (config.metadata) {
    if (config.metadata.title) options.title = config.metadata.title;
    if (config.metadata.description) options.desc = config.metadata.description;
    if (config.metadata.visibility) options.visibility = config.metadata.visibility;
  }

  // Parse hub URL
  if (config.hub) options.hub = config.hub;

  // Parse workspace path
  if (config.workspace) options.workspace = config.workspace;

  return options;
}

/**
 * Load options from stdin (JSON format)
 * @returns {Promise<Object>} - Parsed options
 */
async function loadConfigFromStdin() {
  return new Promise((resolve, reject) => {
    let data = "";

    // Set encoding
    process.stdin.setEncoding("utf8");

    // Check if stdin has data (not a TTY)
    if (process.stdin.isTTY) {
      reject(new Error("No data provided via stdin. Use: echo '{...}' | node publish.mjs --config-stdin"));
      return;
    }

    process.stdin.on("data", (chunk) => {
      data += chunk;
    });

    process.stdin.on("end", () => {
      try {
        const config = JSON.parse(data);
        resolve(parseConfig(config));
      } catch (e) {
        reject(new Error(`Failed to parse JSON from stdin: ${e.message}`));
      }
    });

    process.stdin.on("error", (err) => {
      reject(new Error(`Failed to read from stdin: ${err.message}`));
    });

    // Timeout after 5 seconds if no data
    setTimeout(() => {
      if (!data) {
        reject(new Error("Timeout waiting for stdin data"));
      }
    }, 5000);
  });
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--dir":
      case "-d":
        options.dir = nextArg;
        i++;
        break;
      case "--hub":
      case "-h":
        options.hub = nextArg;
        i++;
        break;
      case "--title":
      case "-t":
        options.title = nextArg;
        i++;
        break;
      case "--desc":
        options.desc = nextArg;
        i++;
        break;
      case "--visibility":
      case "-v":
        options.visibility = nextArg;
        i++;
        break;
      case "--config-stdin":
        options.configStdin = true;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
${chalk.bold("DocSmith Publish")}

Publish documentation to DocSmith Cloud.

${chalk.bold("Usage:")}
  node publish.mjs [options]

${chalk.bold("Options:")}
  --config-stdin          Load options from stdin (JSON format)
  --dir, -d <path>        Directory to compress and publish
  --hub, -h <url>         DocSmith hub URL (default: ${DOCSMITH_HUB_URL_DEFAULT})
  --title, -t <title>     Project title
  --desc <desc>           Project description
  --visibility, -v <vis>  Visibility: public or private (default: public)
  --help                  Show this help message

${chalk.bold("Config Stdin Format (JSON):")}
  {
    "source": { "type": "dir", "path": "./dist" },
    "hub": "https://docsmith.aigne.io",
    "metadata": {
      "title": "My Docs",
      "description": "Documentation",
      "visibility": "public"
    }
  }

${chalk.bold("Examples:")}
  # Publish a directory
  node publish.mjs --dir ./dist --title "My Docs"

  # Publish using stdin config
  echo '{"source":{"type":"dir","path":"./dist"},"metadata":{"title":"My Docs"}}' | node publish.mjs --config-stdin
`);
}

// CLI entry point
if (isMainModule(import.meta.url)) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(1);
  }

  const options = parseArgs(args);

  // Handle --config-stdin asynchronously
  (async () => {
    try {
      if (options.configStdin) {
        const stdinOptions = await loadConfigFromStdin();
        Object.assign(options, stdinOptions);
        delete options.configStdin;
      }

      const result = await publish(options);
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    }
  })();
}

export default publish;
