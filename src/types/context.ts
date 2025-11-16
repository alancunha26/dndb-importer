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
  ProcessedFile,
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

  // Processor module writes:
  processedFiles?: ProcessedFile[];

  // Writer module writes:
  writtenFiles?: WrittenFile[];

  // Stats module writes:
  stats?: ProcessingStats;
}
