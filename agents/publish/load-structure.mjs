import { join } from "node:path";
import { loadDocumentStructure } from "../utils/docs-utils.mjs";

/**
 * Load document structure from output directory
 * @param {Object} params
 * @param {string} params.outputDir - Output directory (default: .aigne/doc-smith/output)
 * @param {string} params.docsDir - Documentation directory
 * @returns {Promise<Object>} - Document structure and docs directory
 */
export default async function loadStructure({
  outputDir = ".aigne/doc-smith/output",
  docsDir,
} = {}) {
  const documentStructure = await loadDocumentStructure(outputDir);

  if (!documentStructure || documentStructure.length === 0) {
    console.warn("⚠️  No document structure found. Sidebar generation may be limited.");
  }

  return {
    documentStructure: documentStructure || [],
    docsDir,
  };
}

loadStructure.description = "Load document structure from YAML file";

loadStructure.input_schema = {
  type: "object",
  properties: {
    outputDir: {
      type: "string",
      description: "Output directory containing document structure file",
    },
    docsDir: {
      type: "string",
      description: "Documentation directory",
    },
  },
};

loadStructure.output_schema = {
  type: "object",
  properties: {
    documentStructure: {
      type: "array",
      description: "Loaded document structure",
    },
    docsDir: {
      type: "string",
      description: "Documentation directory",
    },
  },
};
