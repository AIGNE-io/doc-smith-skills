import chalk from "chalk";
import { getMainLanguageFiles } from "../utils/docs-utils.mjs";

/**
 * Check if documents exist in the docs directory
 * @param {Object} params
 * @param {string} params.docsDir - Documentation directory
 * @param {string} params.locale - Main language locale
 * @param {Array} params.documentStructure - Document structure
 * @returns {Promise<Object>} - Result object
 */
export default async function checkDocs({ docsDir, locale, documentStructure }) {
  const mainLanguageFiles = await getMainLanguageFiles(docsDir, locale, documentStructure);

  if (mainLanguageFiles.length === 0) {
    console.log(
      `⚠️  No documents found in the docs directory.`,
    );
    console.log(
      `💡 Please generate documentation first before publishing.`,
    );
    process.exit(0);
  }

  return {
    message: `Found ${mainLanguageFiles.length} document(s) in the docs directory`,
  };
}

checkDocs.description = "Check if documents exist before publishing";

checkDocs.input_schema = {
  type: "object",
  properties: {
    docsDir: {
      type: "string",
      description: "Documentation directory",
    },
    locale: {
      type: "string",
      description: "Main language locale",
    },
    documentStructure: {
      type: "array",
      description: "Document structure",
    },
  },
};
