/**
 * Stats Module
 * Builds final processing statistics
 */

import type { ConversionContext } from "../types";

/**
 * Builds final processing statistics
 *
 * Reads from context:
 * - files
 * - processedFiles
 * - writtenFiles
 *
 * Writes to context:
 * - stats: ProcessingStats with all metrics
 */
export async function build(ctx: ConversionContext): Promise<void> {
  if (!ctx.files || !ctx.processedFiles || !ctx.writtenFiles) {
    throw new Error("All pipeline stages must complete before building stats");
  }

  console.log("Building statistics...");

  // TODO: Implement stats building logic
  // 1. Count files (total, successful, failed, skipped)
  // 2. Count images (downloaded, failed)
  // 3. Count links (resolved, failed)
  // 4. Count indexes created
  // 5. Calculate duration
  // 6. Set endTime

  ctx.stats = {
    totalFiles: ctx.files.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    indexesCreated: 0,
    imagesDownloaded: 0,
    imagesFailed: 0,
    linksResolved: 0,
    linksFailed: 0,
    startTime: new Date(),
    endTime: new Date(),
    duration: 0,
  };
}
