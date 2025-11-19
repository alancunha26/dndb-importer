/**
 * Resolver Module
 * Resolves D&D Beyond links to local markdown links
 *
 * This module runs AFTER processor has written all files to disk.
 * It reads the files, resolves links, and overwrites them.
 */

import type { ConversionContext } from "../types";

/**
 * Resolves cross-references in all written files
 *
 * Reads from context:
 * - files: Contains file descriptors with anchors (enriched by processor)
 * - pathIndex: relativePath → uniqueId mapping from scanner
 * - config.links: urlMapping, resolveInternal, fallbackToBold
 *
 * Process:
 * 1. Build LinkResolutionIndex from files (has all anchors)
 * 2. For each file, read markdown from disk
 * 3. Resolve D&D Beyond links using URL mapping + anchor validation
 * 4. Overwrite files with resolved links
 *
 * Memory efficient:
 * - Only one file's content in memory at a time
 * - FileDescriptor contains only lightweight metadata + anchors
 */
export async function resolve(ctx: ConversionContext): Promise<void> {
  if (!ctx.files || !ctx.pathIndex) {
    throw new Error("Processor and scanner must run before resolver");
  }

  // Skip if link resolution is disabled
  if (!ctx.config.links.resolveInternal) {
    return;
  }

  // TODO: Implement link resolution logic
  // const writtenFiles = ctx.files.filter((f) => f.written);
  // 1. Build LinkResolutionIndex from all file anchors
  //    const index: LinkResolutionIndex = {}
  //    for (const file of writtenFiles) {
  //      if (file.anchors) {
  //        index[file.uniqueId] = file.anchors
  //      }
  //    }
  //
  // 2. For each written file:
  //    for (const file of writtenFiles) {
  //      a. Read markdown content from disk
  //         const content = await readFile(file.outputPath, 'utf-8')
  //
  //      b. Find all links (D&D Beyond URLs and internal anchors)
  //
  //      c. Resolve using:
  //         - URL mapping (config.links.urlMapping)
  //         - Path → ID mapping (ctx.pathIndex)
  //         - Anchor validation (index built above)
  //
  //      d. Replace links or fallback to bold text
  //
  //      e. Overwrite file with resolved content
  //         await writeFile(file.outputPath, resolvedContent, 'utf-8')
  //    }
  //
  // 3. Track resolution stats (resolved/failed)
  //    Update ctx.stats if needed or return stats
}
