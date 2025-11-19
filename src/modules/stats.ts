/**
 * Stats Module
 * Builds final processing statistics
 */

import type { ConversionContext } from "../types";

/**
 * Builds final processing statistics
 *
 * Reads from context:
 * - files (enriched with written flag by processor)
 * - sourcebooks
 *
 * Writes to context:
 * - stats: ProcessingStats with all metrics
 */
export async function stats(ctx: ConversionContext): Promise<void> {
  if (!ctx.files) {
    throw new Error("All pipeline stages must complete before building stats");
  }

  // TODO: Implement stats building logic
  // 1. Count files (total, successful = written, failed, skipped)
  //    const writtenFiles = ctx.files.filter(f => f.written)
  //    const successful = writtenFiles.length
  // 2. Count images (downloaded, failed)
  // 3. Count links (resolved, failed)
  // 4. Count indexes created (= ctx.sourcebooks.length)
  // 5. Calculate duration
  // 6. Set endTime

  const writtenFiles = ctx.files.filter((f) => f.written);

  ctx.stats = {
    totalFiles: ctx.files.length,
    successful: writtenFiles.length,
    failed: 0,
    skipped: ctx.files.length - writtenFiles.length,
    indexesCreated: ctx.sourcebooks?.length || 0,
    imagesDownloaded: 0,
    imagesFailed: 0,
    linksResolved: 0,
    linksFailed: 0,
    fallbackLinks: ctx.stats?.fallbackLinks || [],
    startTime: new Date(),
    endTime: new Date(),
    duration: 0,
  };
}
