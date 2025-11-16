/**
 * Resolver Module
 * Resolves D&D Beyond links to local markdown links
 */

import type { ConversionContext } from "../types";

/**
 * Resolves cross-references in all written files
 *
 * Reads from context:
 * - writtenFiles
 * - mappings
 * - config.parser.html (urlMapping, convertInternalLinks, fallbackToBold)
 *
 * Modifies:
 * - Overwrites markdown files with resolved links
 */
export async function resolve(ctx: ConversionContext): Promise<void> {
  if (!ctx.writtenFiles || !ctx.mappings) {
    throw new Error("Writer and scanner must run before resolver");
  }

  // Skip if link resolution is disabled
  if (!ctx.config.parser.html.convertInternalLinks) {
    console.log("Link resolution disabled, skipping...");
    return;
  }

  console.log(`Resolving links in ${ctx.writtenFiles.length} files...`);

  // TODO: Implement link resolution logic
  // 1. Build LinkResolutionIndex from all writtenFiles anchors
  // 2. For each written file:
  //    a. Read markdown content
  //    b. Find all links (D&D Beyond URLs and internal anchors)
  //    c. Resolve using:
  //       - URL mapping (config.parser.html.urlMapping)
  //       - ID mapping (ctx.mappings)
  //       - Anchor validation (LinkResolutionIndex)
  //    d. Replace links or fallback to bold text
  //    e. Overwrite file with resolved content
  // 3. Track resolution stats (resolved/failed)
}
