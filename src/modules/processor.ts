/**
 * Processor Module
 * Processes files one at a time and writes immediately to avoid memory bloat
 *
 * Memory-efficient approach:
 * - Parse HTML (in memory briefly)
 * - Convert to Markdown (in memory briefly)
 * - Download images
 * - Write to disk immediately
 * - Store only lightweight WrittenFile
 * - HTML/markdown garbage collected before next file
 */

import type { ConversionContext } from "../types";

/**
 * Processes all scanned files and writes them to disk
 *
 * Reads from context:
 * - files
 * - sourcebooks (for navigation)
 * - config
 *
 * Writes to context:
 * - writtenFiles: Array of WrittenFile with paths and anchors (lightweight)
 */
export async function process(ctx: ConversionContext): Promise<void> {
  if (!ctx.files || !ctx.sourcebooks) {
    throw new Error("Scanner must run before processor");
  }

  console.log(`Processing ${ctx.files.length} files...`);

  ctx.writtenFiles = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _file of ctx.files) {
    // Process one file at a time to minimize memory usage

    // TODO: Implement per-file processing logic
    // 1. Parse HTML with Cheerio
    //    const { html, metadata, anchors } = await parseHtml(file, ctx.config)
    // 2. Extract main content using contentSelector
    // 3. Extract metadata (title, date)
    // 4. Build FileAnchors (valid anchors + HTML ID mappings)
    // 5. Convert HTML to Markdown using Turndown
    //    const markdown = await convertToMarkdown(html, ctx.config)
    // 6. Download images with retry logic
    //    const images = await downloadImages(html, file.sourcebook, ctx.config)
    // 7. Build navigation links (prev/index/next)
    //    const navigation = buildNavigation(file, ctx)
    // 8. Assemble final markdown (frontmatter + navigation + content)
    // 9. Write file to disk immediately
    //    const path = await writeMarkdownFile({ file, markdown, metadata, images, anchors, navigation }, ctx.config)
    // 10. Store lightweight WrittenFile (just path + anchors for link resolution)
    //     ctx.writtenFiles.push({ descriptor: file, path, anchors })
    // 11. HTML and markdown are garbage collected here before next iteration
  }

  // TODO: Generate index files for each sourcebook
}
