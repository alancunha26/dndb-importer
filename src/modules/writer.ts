/**
 * Writer Module
 * Assembles final markdown files with navigation and writes to disk
 */

import type { ConversionContext } from "../types";

/**
 * Writes processed files to disk with navigation and front matter
 *
 * Reads from context:
 * - processedFiles
 * - sourcebooks (for navigation)
 * - files (for navigation ordering)
 *
 * Writes to context:
 * - writtenFiles: Array of WrittenFile with paths and anchors
 */
export async function write(ctx: ConversionContext): Promise<void> {
  if (!ctx.processedFiles || !ctx.sourcebooks || !ctx.files) {
    throw new Error("Processor and scanner must run before writer");
  }

  console.log(`Writing ${ctx.processedFiles.length} files...`);

  // TODO: Implement writing logic
  // For each processed file:
  // 1. Build navigation links (prev/index/next)
  // 2. Generate YAML front matter
  // 3. Assemble final markdown (frontmatter + navigation + content)
  // 4. Update image references to use unique IDs
  // 5. Write file to output directory
  // 6. Return WrittenFile
  //
  // Also:
  // 7. Generate index files for each sourcebook

  ctx.writtenFiles = [];
}
