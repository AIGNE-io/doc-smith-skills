import checkStructure from "../document-checker/structure-checker.mjs";
import checkContent from "../document-checker/content-checker.mjs";

/**
 * Check document structure and content before publishing
 * @returns {Promise<Object>} - Result object with valid flag and message
 */
export default async function checkDocs() {
  // 1. Check document structure
  const structureResult = await checkStructure();

  // If structure check failed and not fixed, return error
  if (!structureResult.valid && !structureResult.fixed) {
    return {
      valid: false,
      message: structureResult.message,
    };
  }

  // 2. Check document content
  const contentResult = await checkContent();

  // If content check failed and not fixed, return error
  if (!contentResult.valid && !contentResult.fixed) {
    return {
      valid: false,
      message: contentResult.message,
    };
  }

  return {
    valid: true,
    message: "✅ Document structure and content check passed.",
  };
}

checkDocs.description = "Check document structure and content before publishing";

checkDocs.input_schema = {
  type: "object",
  properties: {},
};
