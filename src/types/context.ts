/**
 * Conversion context - flows through the entire pipeline
 * Each module reads what it needs and writes its results back
 */

import type { ConversionConfig } from "./config";
import type { FileDescriptor, SourcebookInfo, TemplateSet } from "./files";
import type { ProcessingStats } from "./pipeline";

export interface ConversionContext {
  // Input - provided at initialization
  config: ConversionConfig;

  // Error tracking (initialized in convert command, populated by all modules)
  errors: {
    files: Array<{ file: string; error: Error }>;
    images: Array<{ url: string; error: Error }>;
    resources: Array<{ path: string; error: Error }>;
  };

  files?: FileDescriptor[]; // All files (flat list) - primary data structure
  sourcebooks?: SourcebookInfo[]; // Sourcebook metadata only (no files array)
  fileIndex?: Map<string, FileDescriptor>; // Fast lookup: uniqueId → FileDescriptor
  pathIndex?: Map<string, string>; // Fast lookup: relativePath → uniqueId
  globalTemplates?: TemplateSet; // Global templates from input root
  stats?: ProcessingStats;
}
