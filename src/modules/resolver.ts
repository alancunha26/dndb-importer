/**
 * Resolver Module
 * Resolves D&D Beyond links to local markdown links
 *
 * This module runs AFTER processor has written all files to disk.
 * It reads the files, resolves links, and overwrites them.
 */

import { readFile, writeFile } from "fs/promises";
import type { ConversionContext } from "../types";
import { LinkResolver } from "../utils";

// ============================================================================
// Main Resolver Function
// ============================================================================

/**
 * Resolves cross-references in all written files
 */
export async function resolve(ctx: ConversionContext): Promise<void> {
  if (!ctx.files) {
    throw new Error("Processor and scanner must run before resolver");
  }

  if (!ctx.config.links.resolveInternal) {
    return;
  }

  const { tracker } = ctx;
  const files = ctx.files.filter((f) => f.written);

  // Create LinkResolver and store in context for pipeline sharing
  // This also builds the entity index from file entities
  const linkResolver = ctx.linkResolver ?? new LinkResolver(ctx);
  if (!ctx.linkResolver) ctx.linkResolver = linkResolver;

  /**
   * Resolve all markdown links in content
   */
  function resolveContent(content: string, fileId: string): string {
    return content
      .split("\n")
      .map((line) =>
        // Find all markdown links and resolve them
        line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) =>
          linkResolver.resolve(url, text, { fileId }),
        ),
      )
      .join("\n");
  }

  // Process all written files
  for (const file of files) {
    try {
      const content = await readFile(file.outputPath, "utf-8");
      const resolvedContent = resolveContent(content, file.id);

      if (resolvedContent !== content) {
        await writeFile(file.outputPath, resolvedContent, "utf-8");
      }
    } catch (error) {
      tracker.trackError(file.outputPath, error, "file", "read");
    }
  }
}
