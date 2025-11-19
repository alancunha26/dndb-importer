/**
 * Resolver module types
 */

/**
 * Link resolution result
 * Contains resolution status and optional target information
 */
export interface LinkResolutionResult {
  resolved: boolean;
  reason?:
    | "url-not-mapped"
    | "file-not-found"
    | "anchor-not-found"
    | "header-link"; // Link without anchor, removed entirely
  targetFileId?: string;
  targetAnchor?: string;
}
