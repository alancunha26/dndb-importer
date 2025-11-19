/**
 * Conversion context - flows through the entire pipeline
 * Each module reads what it needs and writes its results back
 */

import type { ConversionConfig } from "./config";
import type { FileDescriptor, SourcebookInfo, TemplateSet } from "./files";

export interface ErrorStats {
  path: string;
  error: Error;
}

/**
 * Entity location - where an entity (spell, monster, etc.) can be found
 */
export interface EntityLocation {
  fileId: string; // Unique file ID (e.g., "a3f9")
  anchor: string; // Markdown anchor (e.g., "ape", "arcane-vigor")
}

export interface FallbackLink {
  url: string; // Original URL
  text: string; // Link text
  file: string; // File where link was found (relative path or ID)
  reason: string; // Why it fell back (e.g., "Entity not found", "Anchor not found", "URL not in mapping")
}

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
  fallbackLinks: FallbackLink[]; // Links that fell back to bold text
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface ConversionContext {
  // Input - provided at initialization
  config: ConversionConfig;

  // Error tracking (initialized in convert command, populated by all modules)
  errors: {
    files: ErrorStats[];
    images: ErrorStats[];
    resources: ErrorStats[];
  };

  files?: FileDescriptor[]; // All files (flat list) - primary data structure
  sourcebooks?: SourcebookInfo[]; // Sourcebook metadata only (no files array)
  fileIndex?: Map<string, FileDescriptor>; // Fast lookup: uniqueId → FileDescriptor
  pathIndex?: Map<string, string>; // Fast lookup: relativePath → uniqueId
  globalTemplates?: TemplateSet; // Global templates from input root
  entityIndex?: Map<string, EntityLocation[]>; // Entity URL → file locations (e.g., /spells/123 → [{fileId, anchor}])
  urlMapping?: Map<string, string>; // Auto-discovered URL mapping: URL path → file ID (e.g., /sources/dnd/phb-2024/spells → "abc1")
  stats?: ProcessingStats;
}
