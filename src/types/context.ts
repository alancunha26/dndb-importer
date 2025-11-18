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
  stats?: ProcessingStats;
}
