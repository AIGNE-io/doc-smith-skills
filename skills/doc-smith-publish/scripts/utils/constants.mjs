// DocSmith publish constants

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Default DocSmith Hub URL
export const DOCSMITH_HUB_URL_DEFAULT = "https://docsmith.aigne.io";

// Hub blocklet DID (shared infrastructure with the vibe platform)
export const HUB_BLOCKLET_DID = "z2qa3cy63otaA2A7zHADRichVkSGVyevtYhYQ";

// API endpoints
export const API_PATHS = {
  // Upload file (HTML or ZIP)
  UPLOAD: "/api/uploaded-blocklets/upload",
  // Convert uploaded blocklet
  CONVERT: (did) => `/api/uploaded-blocklets/${did}/convert`,
  // Conversion stream (SSE)
  CONVERT_STREAM: (did) => `/api/uploaded-blocklets/${did}/convert/stream`,
  // Conversion status
  CONVERSION_STATUS: (did) => `/api/uploaded-blocklets/${did}/conversion-status`,
  // Vibe action (publish/draft/abandon)
  VIBE_ACTION: (did) => `/api/vibes/${did}/action`,
  // Get vibe info
  VIBE_INFO: (did) => `/api/vibes/${did}`,
};

// Well-known service path for authorization
export const WELLKNOWN_SERVICE_PATH = "/.well-known/service";

// Authorization timeout (5 minutes)
export const AUTH_TIMEOUT_MINUTES = 5;
export const AUTH_FETCH_INTERVAL = 3000; // 3 seconds
export const AUTH_RETRY_COUNT = (AUTH_TIMEOUT_MINUTES * 60 * 1000) / AUTH_FETCH_INTERVAL;

/**
 * Check if the current module is the main entry point.
 * Handles symlinks by comparing real paths.
 * @param {string} metaUrl - import.meta.url of the calling module
 * @returns {boolean}
 */
export function isMainModule(metaUrl) {
  try {
    const scriptPath = fileURLToPath(metaUrl);
    const argvPath = resolve(process.argv[1]);
    return realpathSync(scriptPath) === realpathSync(argvPath);
  } catch {
    return false;
  }
}
