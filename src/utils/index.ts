/**
 * Utility exports
 */

// Anchor utilities
export { generateAnchor } from "./generate-anchor";
export { normalizeAnchorForMatching } from "./generate-anchor-variants";
export { findMatchingAnchor } from "./find-matching-anchor";
export type { AnchorMatch } from "./find-matching-anchor";

// Entity matching utilities
export { getEntityTypeFromUrl } from "./get-entity-type-from-url";

// URL utilities
export { isImageUrl } from "./is-image-url";
export { parseEntityUrl } from "./parse-entity-url";

// Path/filename utilities
export { extractIdFromFilename } from "./extract-id-from-filename";
export { filenameToTitle } from "./filename-to-title";

// Filesystem utilities
export { fileExists } from "./file-exists";
export { loadMapping } from "./load-mapping";
export { saveMapping } from "./save-mapping";
export {
  loadIndexesMapping,
  createEmptyIndexesMapping,
} from "./load-indexes-mapping";
export { saveIndexesMapping } from "./save-indexes-mapping";

// Network utilities
export { fetchListingPage } from "./fetch-listing-page";
export type { FetchOptions } from "./fetch-listing-page";

// Config utilities
export {
  loadConfig,
  getUserConfigPath,
  loadDefaultConfig,
} from "./load-config";

// Template utilities
export { loadTemplate } from "./load-template";
export { loadIndexTemplate } from "./load-index-template";
export { loadFileTemplate } from "./load-file-template";
export { getDefaultIndexTemplate } from "./get-default-index-template";
export { getDefaultFileTemplate } from "./get-default-file-template";
export { getDefaultEntityIndexTemplate } from "./get-default-entity-index-template";
export { getDefaultGlobalIndexTemplate } from "./get-default-global-index-template";

// Classes
export { IdGenerator } from "./id-generator";
export { Tracker } from "./tracker";
export { LinkResolver } from "./link-resolver";
