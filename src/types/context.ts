/**
 * Conversion context - flows through the entire pipeline
 * Each module reads what it needs and writes its results back
 */

import type { ConversionConfig } from "./config";
import type {
  FileDescriptor,
  SourcebookInfo,
} from "./files";
import type {
  WrittenFile,
  ProcessingStats,
} from "./pipeline";

export interface ConversionContext {
  // Input - provided at initialization
  config: ConversionConfig;

  // Accumulated by modules as pipeline progresses

  // Scanner module writes:
  files?: FileDescriptor[];
  sourcebooks?: SourcebookInfo[];
  mappings?: Map<string, string>; // HTML relative path → unique ID

  // Processor module writes (processes AND writes files immediately):
  // Note: processedFiles removed to avoid memory bloat
  // HTML and markdown are processed one file at a time and written immediately
  writtenFiles?: WrittenFile[];

  // Stats module writes:
  stats?: ProcessingStats;
}
