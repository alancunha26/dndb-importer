/**
 * Resolver Module
 * Resolves D&D Beyond links to local markdown links
 *
 * This module runs AFTER processor has written all files to disk.
 * It reads the files, resolves links, and overwrites them.
 */

import { readFile, writeFile } from "fs/promises";
import type { ConversionContext, FileDescriptor } from "../types";
import {
  normalizeDnDBeyondUrl,
  shouldResolveUrl,
  applyAliases,
  isEntityUrl,
} from "../utils/url";
import { normalizeAnchor, findMatchingAnchor } from "../utils/anchor";

/**
 * Entity location with matched anchor
 */
interface EntityMatch {
  fileId: string;
  anchor: string;
}

interface LinkInfo {
  path: string;
  anchor?: string;
  text: string;
  original: string;
}

/**
 * Build entity index by matching entity slugs to file anchors
 *
 * @param files - Files to process
 * @param ctx - Conversion context
 */
function buildEntityIndex(
  files: FileDescriptor[],
  ctx: ConversionContext,
): Map<string, EntityMatch> {
  const { entityLocations, urlAliases } = ctx.config.links;
  const entityIndex = new Map<string, EntityMatch>();
  const seenUrls = new Set<string>();

  for (const file of files) {
    if (!file.entities) {
      continue;
    }

    for (const entity of file.entities) {
      if (!entity.slug || seenUrls.has(entity.url)) continue;
      seenUrls.add(entity.url);

      // Filter target files by entity type if configured
      const allowedPages = entityLocations[entity.type];
      const targetFiles = allowedPages
        ? files.filter((f) => {
            if (!f.url) return false;
            // Apply aliases to get canonical form of the URL
            const canonicalUrl = applyAliases(f.url, urlAliases);
            return allowedPages.some((page) => canonicalUrl.startsWith(page));
          })
        : files;

      for (const targetFile of targetFiles) {
        if (!targetFile.anchors) continue;

        const matchedAnchor = findMatchingAnchor(
          entity.slug,
          targetFile.anchors.valid,
        );

        if (matchedAnchor) {
          entityIndex.set(entity.url, {
            fileId: targetFile.uniqueId,
            anchor: matchedAnchor,
          });
          break;
        }
      }

      if (!entityIndex.has(entity.url)) {
        ctx.tracker.trackLinkIssue(entity.url, entity.type, "entity-not-found");
      }
    }
  }

  return entityIndex;
}

// ============================================================================
// Constants
// ============================================================================

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
const IMAGE_LINE_PATTERN = /^\s*!/;

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
  // Shared State (closure variables)
  // ============================================================================

  const { tracker, config, sourcebooks } = ctx;
  const files = ctx.files.filter((f) => f.written);

  // Build URL map keyed by canonical URLs
  const urlMap = new Map(files.filter((f) => f.url).map((f) => [f.url!, f]));
  const entityIndex = buildEntityIndex(files, ctx);

  /**
   * Format text using the configured fallback style
   */
  function formatFallback(text: string): string {
    switch (config.links.fallbackStyle) {
      case "bold":
        return `${config.markdown.strong}${text}${config.markdown.strong}`;
      case "italic":
        return `${config.markdown.emphasis}${text}${config.markdown.emphasis}`;
      case "plain":
        return text;
      case "none":
        return ""; // Signal to keep original link
      default:
        return `${config.markdown.strong}${text}${config.markdown.strong}`;
    }
  }

  /**
   * Parse and normalize a URL into LinkInfo
   */
  function parseLink(url: string, text: string): LinkInfo {
    const original = url;
    const normalized = normalizeDnDBeyondUrl(url);
    let [path, anchor] = normalized.split("#");
    path = applyAliases(path, config.links.urlAliases);
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
  function resolveEntityLink(link: LinkInfo): string | null {
    if (!isEntityUrl(link.path)) return null;

    const match = entityIndex.get(link.path);
    if (!match) {
      tracker.trackLinkIssue(link.original, link.text, "entity-not-found");
      return null;
    }

    // Use link's anchor if specified, otherwise use the matched anchor
    const targetAnchor = link.anchor || match.anchor;
    return `[${link.text}](${match.fileId}.md#${targetAnchor})`;
  }

  /**
   * Resolve source book link using canonical URLs
   */
  function resolveSourceLink(link: LinkInfo): string | null {
    // No anchor - could be book-level or header link
    if (!link.anchor) {
      const sourcebook = sourcebooks?.find((sb) => sb.bookUrl === link.path);
      if (sourcebook) {
        return `[${link.text}](${sourcebook.id}.md)`;
      }

      const targetFile = urlMap.get(link.path);
      if (targetFile) {
        tracker.trackLinkIssue(link.original, link.text, "header-link");
        const fallback = formatFallback(link.text);
        return fallback || `[${link.text}](${link.original})`;
      }

      tracker.trackLinkIssue(link.original, link.text, "url-not-in-mapping");
      return null;
    }

    // Has anchor - look up in URL mapping
    const targetFile = urlMap.get(link.path);
    if (!targetFile) {
      tracker.trackLinkIssue(link.original, link.text, "url-not-in-mapping");
      return null;
    }

    const fileAnchors = targetFile.anchors;
    if (!fileAnchors) {
      tracker.trackLinkIssue(link.original, link.text, "no-anchors");
      return null;
    }

    // Priority 1: Direct HTML ID lookup
    let matchedAnchor: string | null | undefined =
      fileAnchors.htmlIdToAnchor[link.anchor];

    // Priority 2: Smart matching
    if (!matchedAnchor) {
      matchedAnchor = findMatchingAnchor(
        normalizeAnchor(link.anchor),
        fileAnchors.valid,
      );
    }

    if (!matchedAnchor) {
      tracker.trackLinkIssue(link.original, link.text, "anchor-not-found");
      return null;
    }

    return `[${link.text}](${targetFile.uniqueId}.md#${matchedAnchor})`;
  }

  /**
   * Resolve a single link (already parsed and aliased)
   */
  function resolveLink(link: LinkInfo, file: FileDescriptor): string {
    // Handle internal anchors
    if (link.path.startsWith("#")) {
      const result = resolveInternalAnchor(link.path.slice(1), link.text, file);
      if (result) {
        tracker.incrementLinksResolved();
        return result;
      } else {
        return `[${link.text}](${link.path})`;
      }
    }

    // Try entity link
    const entityResult = resolveEntityLink(link);
    if (entityResult) {
      tracker.incrementLinksResolved();
      return entityResult;
    }

    // Try source link
    const sourceResult = resolveSourceLink(link);
    if (sourceResult) {
      if (sourceResult.endsWith(".md)") || sourceResult.includes(".md#")) {
        tracker.incrementLinksResolved();
      } else {
        return sourceResult;
      }
    }

    // Fallback
    const fallback = formatFallback(link.text);
    return fallback || `[${link.text}](${link.original})`;
  }

  /**
   * Resolve all markdown links in content
   */
  function resolveContent(content: string, file: FileDescriptor): string {
    return content
      .split("\n")
      .map((line) => {
        if (IMAGE_LINE_PATTERN.test(line)) return line;

        return line.replace(MARKDOWN_LINK_REGEX, (_match, text, url) => {
          if (shouldResolveUrl(url)) {
            const link = parseLink(url, text);
            return resolveLink(link, file);
          }

          return `[${text}](${url})`;
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
