/**
 * Scanner Module
 * Discovers HTML files, assigns unique IDs, and builds file mappings
 */

import type { ConversionContext } from "../types";

/**
 * Scans input directory for HTML files and populates context
 *
 * Writes to context:
 * - files: Array of FileDescriptor with unique IDs
 * - sourcebooks: Grouped files by sourcebook
 * - mappings: Map of HTML path → unique ID
 */
export async function scan(ctx: ConversionContext): Promise<void> {
  console.log("Scanning directory:", ctx.config.input.directory);

  // TODO: Implement scanning logic
  // 1. Discover HTML files using fast-glob
  // 2. Generate unique IDs for each file
  // 3. Group files by sourcebook (directory)
  // 4. Build filename→ID mapping
  // 5. Sort files by numeric prefix

  ctx.files = [];
  ctx.sourcebooks = [];
  ctx.mappings = new Map();
}
