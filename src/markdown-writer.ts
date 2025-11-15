/**
 * Markdown Writer
 * Handles file writing, index generation, and navigation
 */

import type { ConversionResult, SourcebookIndex } from "./types";

export class MarkdownWriter {
  /**
   * Write markdown file with front matter and navigation
   */
  async write(result: ConversionResult, outputPath: string): Promise<void> {
    console.log("Writing markdown to:", outputPath, result);
    // TODO: Implement markdown writing logic
  }

  /**
   * Generate sourcebook index file
   */
  async writeIndex(index: SourcebookIndex): Promise<void> {
    console.log("Writing index for:", index.title);
    // TODO: Implement index generation logic
  }
}
