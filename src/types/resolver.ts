/**
 * Resolver module types
 */

import type { FileAnchors } from "./files";

/**
 * Link resolution index
 * Maps file unique ID to anchor data for that file
 * Built by collecting FileAnchors from all FileDescriptors
 *
 * Usage:
 * - Same-page links: index["a3f9"].htmlIdToAnchor["Bell1GP"] → "bell-1-gp"
 * - Cross-file validation: index["a3f9"].valid.includes("fireball") → true
 * - Prefix matching: index["a3f9"].valid.find(a => a.startsWith("alchemists-fire"))
 *
 * Example: { "a3f9": { valid: [...], htmlIdToAnchor: {...} }, "b4x8": {...} }
 */
export interface LinkResolutionIndex {
  [fileId: string]: FileAnchors;
}

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
