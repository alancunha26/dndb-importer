/**
 * Resolver Module
 * Resolves D&D Beyond links to local markdown links
 *
 * This module runs AFTER processor has written all files to disk.
 * It reads the files, resolves links, and overwrites them.
 */

import { readFile, writeFile } from "fs/promises";
import type { ConversionContext, EntityMatch, FileDescriptor } from "../types";
import {
  shouldResolveUrl,
  applyAliases,
  isEntityUrl,
  normalizeAnchor,
  findMatchingAnchor,
  formatFallback,
  resolveEntityUrl,
} from "../utils";

interface LinkInfo {
  path: string;
  anchor?: string;
  text: string;
  original: string;
}

// ============================================================================
// Main Resolver Function
// ============================================================================

/**
 * Resolves cross-references in all written files
 *
 * Uses factory pattern with closure variables to avoid prop drilling.
 * Inner functions have shared access to urlMap, tracker, etc.
 */
export async function resolve(ctx: ConversionContext): Promise<void> {
  if (!ctx.files) {
    throw new Error("Processor and scanner must run before resolver");
  }

  if (!ctx.config.links.resolveInternal) {
    return;
  }

  // ============================================================================
  // Shared State (Variables)
  // ============================================================================

  const { tracker, config, sourcebooks } = ctx;
  const files = ctx.files.filter((f) => f.written);

  // Build URL map keyed by canonical URLs
  const urlMap = new Map(files.filter((f) => f.url).map((f) => [f.url!, f]));
  const excludeUrls = new Set(config.links.excludeUrls);
  ctx.entityIndex = new Map<string, EntityMatch>();

  // Process all entities from all files
  for (const file of files) {
    if (!file.entities) continue;

    for (const entity of file.entities) {
      // Normalize and alias for consistent key
      const match = resolveEntityUrl(entity.url, ctx);
      if (match) ctx.entityIndex.set(entity.url, match);
    }
  }

  // ============================================================================
  // Shared State (Helpers)
  // ============================================================================

  /**
   * Convert internal --N notation to standard -N for markdown output
   * The --N notation is used internally to avoid conflicts with entity URL slugs
   */
  function formatAnchor(result: string): string {
    return result.replace(/--(\d+)(?=\)|$)/g, "-$1");
  }

  /**
   * Parse and normalize a URL into LinkInfo
   */
  function parseLink(url: string, text: string): LinkInfo {
    const original = url;
    let [path, anchor] = url.split("#");
    path = applyAliases(path, config.links.urlAliases);

    // Re-split in case alias value contains an anchor
    if (path.includes("#")) {
      const [newPath, newAnchor] = path.split("#");
      path = newPath;
      anchor = newAnchor;
    }

    return { path, anchor, text, original };
  }

  // ============================================================================
  // Resolution Functions
  // ============================================================================

  /**
   * Resolve internal anchor link (same-page)
   */
  function resolveInternalAnchor(
    htmlId: string,
    text: string,
    file: FileDescriptor,
  ): string | null {
    const fileAnchors = file.anchors;
    if (!fileAnchors) return null;

    const markdownAnchor = fileAnchors.htmlIdToAnchor[htmlId];
    return markdownAnchor ? `[${text}](#${markdownAnchor})` : null;
  }

  /**
   * Resolve entity link using entity index
   */
  function resolveEntityLink(
    link: LinkInfo,
    file: FileDescriptor,
  ): string | null {
    if (!isEntityUrl(link.path)) return null;

    const match = ctx.entityIndex!.get(link.path);
    if (!match) {
      return null;
    }

    // Use link's anchor if specified, otherwise use the matched anchor
    const targetAnchor = link.anchor || match.anchor;

    // If linking to same file, use just the anchor
    if (match.fileId === file.uniqueId) {
      return `[${link.text}](#${targetAnchor})`;
    }

    return `[${link.text}](${match.fileId}.md#${targetAnchor})`;
  }

  /**
   * Resolve source book link using canonical URLs
   */
  function resolveSourceLink(
    link: LinkInfo,
    file: FileDescriptor,
  ): string | null {
    // No anchor - could be book-level or header link
    if (!link.anchor) {
      const sourcebook = sourcebooks?.find((sb) => sb.bookUrl === link.path);
      if (sourcebook) {
        return `[${link.text}](${sourcebook.id}.md)`;
      }

      const targetFile = urlMap.get(link.path);
      if (targetFile) {
        const fallback = formatFallback(link.text, config);
        return fallback || `[${link.text}](${link.original})`;
      }

      return null;
    }

    // Has anchor - look up in URL mapping
    const targetFile = urlMap.get(link.path);
    if (!targetFile) {
      return null;
    }

    const fileAnchors = targetFile.anchors;
    if (!fileAnchors) {
      return null;
    }

    // Priority 1: Direct HTML ID lookup
    let matchedAnchor: string | null | undefined =
      fileAnchors.htmlIdToAnchor[link.anchor];

    // Priority 2: Smart matching
    if (!matchedAnchor) {
      const normalized = normalizeAnchor(link.anchor);
      const result = findMatchingAnchor(
        normalized,
        fileAnchors.valid,
        config.links.maxMatchStep,
      );
      matchedAnchor = result?.anchor;
    }

    if (!matchedAnchor) {
      return null;
    }

    // If linking to same file, use just the anchor
    if (targetFile.uniqueId === file.uniqueId) {
      return `[${link.text}](#${matchedAnchor})`;
    }

    return `[${link.text}](${targetFile.uniqueId}.md#${matchedAnchor})`;
  }

  /**
   * Resolve a single link (already parsed and aliased)
   */
  function resolveLink(link: LinkInfo, file: FileDescriptor): string {
    // Handle internal anchors
    if (link.original.startsWith("#") && link.anchor) {
      const result = resolveInternalAnchor(link.anchor, link.text, file);
      if (result) {
        tracker.incrementLinksResolved();
        return result;
      } else {
        return `[${link.text}](#${link.anchor})`;
      }
    }

    // Check if URL is excluded - apply fallback immediately
    if (excludeUrls.has(link.path)) {
      const fallback = formatFallback(link.text, config);
      if (fallback) {
        return fallback;
      } else {
        return `[${link.text}](${link.original})`;
      }
    }

    // Entity URLs and source URLs are mutually exclusive
    if (isEntityUrl(link.path)) {
      // Try entity link
      const entityResult = resolveEntityLink(link, file);
      if (entityResult) {
        tracker.incrementLinksResolved();
        return entityResult;
      }
    } else {
      // Try source link
      const sourceResult = resolveSourceLink(link, file);
      if (sourceResult) {
        // Check if result is an actual link (not a fallback like **text**)
        const isResolvedLink = sourceResult.includes("](");
        if (isResolvedLink) tracker.incrementLinksResolved();
        return sourceResult;
      }
    }

    // Fallback
    const fallback = formatFallback(link.text, config);
    if (fallback) {
      tracker.trackUnresolvedLink(link.original, link.text);
      return fallback;
    }
    return `[${link.text}](${link.original})`;
  }

  /**
   * Resolve all markdown links in content
   */
  function resolveContent(content: string, file: FileDescriptor): string {
    return content
      .split("\n")
      .map((line) => {
        // Find all markdown links
        return line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
          if (shouldResolveUrl(url)) {
            const link = parseLink(url, text);
            return formatAnchor(resolveLink(link, file));
          } else {
            return `[${text}](${url})`;
          }
        });
      })
      .join("\n");
  }

  // ============================================================================
  // Main Orchestration
  // ============================================================================

  for (const file of files) {
    try {
      const content = await readFile(file.outputPath, "utf-8");
      const resolvedContent = resolveContent(content, file);

      if (resolvedContent !== content) {
        await writeFile(file.outputPath, resolvedContent, "utf-8");
      }
    } catch (error) {
      tracker.trackError(file.outputPath, error, "file", "read");
    }
  }
}
