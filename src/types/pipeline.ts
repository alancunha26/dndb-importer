/**
 * Pipeline module data types
 */

import type { FileAnchors } from "./files";

// ============================================================================
// Resolver Module
// ============================================================================

export interface LinkResolutionIndex {
  // Maps file unique ID to anchor data for that file
  // Built by collecting FileAnchors from all FileDescriptors
  // Example: { "a3f9": { valid: [...], htmlIdToAnchor: {...} }, "b4x8": {...} }
  //
  // Usage:
  // - Same-page links: index["a3f9"].htmlIdToAnchor["Bell1GP"] → "bell-1-gp"
  // - Cross-file validation: index["a3f9"].valid.includes("fireball") → true
  // - Prefix matching: index["a3f9"].valid.find(a => a.startsWith("alchemists-fire"))
  [fileId: string]: FileAnchors;
}

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

// ============================================================================
// Stats Module
// ============================================================================

export interface ProcessingStats {
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  indexesCreated: number;
  imagesDownloaded: number;
  imagesFailed: number;
  linksResolved: number;
  linksFailed: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}
