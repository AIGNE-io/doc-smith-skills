import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import yaml from "js-yaml";

import { getApiBaseUrl } from "./blocklet-info.mjs";

const HISTORY_FILENAME = "publish-history.yaml";

/**
 * Get the history file path for a given workspace
 * @param {string} workspace - Workspace directory path (e.g. ".aigne/doc-smith")
 * @returns {string} - Absolute path to the history file
 */
function getHistoryFilePath(workspace) {
  return join(workspace, "cache", HISTORY_FILENAME);
}

/**
 * Load publish history from file
 * @param {string} workspace - Workspace directory path
 * @returns {Promise<Object>} History data with mappings
 */
async function loadHistory(workspace) {
  try {
    const historyFile = getHistoryFilePath(workspace);
    if (!existsSync(historyFile)) {
      return { mappings: {} };
    }
    const content = await readFile(historyFile, "utf-8");
    const data = yaml.load(content);
    return data || { mappings: {} };
  } catch {
    return { mappings: {} };
  }
}

/**
 * Save publish history to file
 * @param {Object} history - History data to save
 * @param {string} workspace - Workspace directory path
 */
async function saveHistory(history, workspace) {
  const historyFile = getHistoryFilePath(workspace);
  const historyDir = dirname(historyFile);

  if (!existsSync(historyDir)) {
    await mkdir(historyDir, { recursive: true });
  }

  const content = yaml.dump(history, { indent: 2, lineWidth: -1 });
  await writeFile(historyFile, content, "utf-8");
}

/**
 * Get publish history for a source path and hub
 * @param {string} sourcePath - Absolute path to source directory
 * @param {string} hubUrl - DocSmith hub URL
 * @param {string} workspace - Workspace directory path
 * @returns {Promise<{did: string, lastPublished: string, title: string} | null>}
 */
export async function getPublishHistory(sourcePath, hubUrl, workspace) {
  if (!workspace) {
    return null;
  }

  const history = await loadHistory(workspace);
  const hubKey = await getApiBaseUrl(hubUrl);

  const pathMappings = history.mappings[sourcePath];
  if (!pathMappings) {
    return null;
  }

  // Try new key format first, then fallback to legacy origin key
  let hubMapping = pathMappings[hubKey];
  if (!hubMapping) {
    const { origin } = new URL(hubUrl);
    hubMapping = pathMappings[origin];
  }
  if (!hubMapping) {
    return null;
  }

  return hubMapping;
}

/**
 * Save publish history for a source path and hub
 * @param {string} sourcePath - Absolute path to source directory
 * @param {string} hubUrl - DocSmith hub URL
 * @param {string} did - Vibe DID
 * @param {string} title - Vibe title (optional)
 * @param {string} workspace - Workspace directory path
 */
export async function savePublishHistory(sourcePath, hubUrl, did, title = "", workspace) {
  if (!workspace) {
    return;
  }

  const history = await loadHistory(workspace);
  const hubKey = await getApiBaseUrl(hubUrl);

  if (!history.mappings[sourcePath]) {
    history.mappings[sourcePath] = {};
  }

  history.mappings[sourcePath][hubKey] = {
    did,
    lastPublished: new Date().toISOString(),
    ...(title && { title }),
  };

  await saveHistory(history, workspace);
}
