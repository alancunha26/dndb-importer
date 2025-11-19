/**
 * Conversion context - flows through the entire pipeline
 * Each module reads what it needs and writes its results back
 */

import type { ConversionConfig } from "./config";
import type { FileDescriptor, SourcebookInfo, TemplateSet } from "./files";
import type { ConversionTracker } from "../utils/conversion-tracker";

// Re-export types from conversion-tracker
export type {
  Issue,
  IssueType,
  FileIssue,
  ImageIssue,
  ResourceIssue,
  LinkIssue,
  FileIssueReason,
  ImageIssueReason,
  ResourceIssueReason,
  LinkIssueReason,
  ProcessingStats,
} from "../utils/conversion-tracker";

/**
 * Entity location - where an entity (spell, monster, etc.) can be found
 */
export interface EntityLocation {
  fileId: string; // Unique file ID (e.g., "a3f9")
  anchor: string; // Markdown anchor (e.g., "ape", "arcane-vigor")
}

export interface ConversionContext {
  // Input - provided at initialization
  config: ConversionConfig;

  // Unified tracking for stats, errors, and fallback links
  tracker: ConversionTracker;

  files?: FileDescriptor[]; // All files (flat list) - primary data structure (includes canonicalUrl per file)
  sourcebooks?: SourcebookInfo[]; // Sourcebook metadata only (no files array)
  globalTemplates?: TemplateSet; // Global templates from input root
  entityIndex?: Map<string, EntityLocation[]>; // Entity URL → file locations (e.g., /spells/123 → [{fileId, anchor}])
}
