/**
 * Conversion context - flows through the entire pipeline
 * Each module reads what it needs and writes its results back
 */

import type { ConversionConfig } from "./config";
import type { FileDescriptor, SourcebookInfo, TemplateSet } from "./files";
import type { Tracker } from "../utils/conversion-tracker";

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

export interface ConversionContext {
  // Input - provided at initialization
  config: ConversionConfig;

  // Unified tracking for stats, errors, and fallback links
  tracker: Tracker;

  files?: FileDescriptor[]; // All files (flat list) - primary data structure
  sourcebooks?: SourcebookInfo[]; // Sourcebook metadata only (no files array)
  globalTemplates?: TemplateSet; // Global templates from input root
}
