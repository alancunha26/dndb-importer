/**
 * Processor Module
 * Processes HTML files: parse → transform to markdown → download images
 */

import type { ConversionContext } from "../types";

/**
 * Processes all scanned files through the conversion pipeline
 *
 * Reads from context:
 * - files
 *
 * Writes to context:
 * - processedFiles: Array of ProcessedFile with HTML, markdown, metadata, images, and anchors
 */
export async function process(ctx: ConversionContext): Promise<void> {
  if (!ctx.files) {
    throw new Error("Scanner must run before processor");
  }

  console.log(`Processing ${ctx.files.length} files...`);

  // TODO: Implement processing logic
  // For each file:
  // 1. Parse HTML with Cheerio
  // 2. Extract main content using contentSelector
  // 3. Extract metadata (title, date)
  // 4. Build FileAnchors (valid anchors + HTML ID mappings)
  // 5. Convert HTML to Markdown using Turndown
  // 6. Download images with retry logic
  // 7. Return ProcessedFile

  ctx.processedFiles = [];
}
