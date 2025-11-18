/**
 * Conversion context - flows through the entire pipeline
 * Each module reads what it needs and writes its results back
 */

import type { ConversionConfig } from "./config";
import type {
  FileDescriptor,
  SourcebookInfo,
  TemplateSet,
} from "./files";
import type {
  ProcessingStats,
} from "./pipeline";

export interface ConversionContext {
  // Input - provided at initialization
  config: ConversionConfig;

  // Accumulated by modules as pipeline progresses

  // Scanner module writes:
  files?: FileDescriptor[]; // All files (flat list) - primary data structure
  sourcebooks?: SourcebookInfo[]; // Sourcebook metadata only (no files array)
  fileIndex?: Map<string, FileDescriptor>; // Fast lookup: uniqueId → FileDescriptor
  pathIndex?: Map<string, string>; // Fast lookup: relativePath → uniqueId
  globalTemplates?: TemplateSet; // Global templates from input root

  // Processor module enriches FileDescriptor objects in files array (adds title, anchors, written)
  // No separate collection needed - files are updated in place

  // Stats module writes:
  stats?: ProcessingStats;
}
