/**
 * Resolver Module
 * Resolves D&D Beyond links to local markdown links
 *
 * This module runs AFTER processor has written all files to disk.
 * It reads the files, resolves links, and overwrites them.
 */

import { readFile, writeFile } from "fs/promises";
import type { ConversionContext, FileDescriptor } from "../types";
import type { ConversionTracker } from "../utils/conversion-tracker";
import {
  normalizeDnDBeyondUrl,
  shouldResolveUrl,
  applyAliases,
  isEntityUrl,
} from "../utils/url";
import { normalizeAnchor, findMatchingAnchor } from "../utils/anchor";

// ============================================================================
// Entity Index Builder
// ============================================================================

/**
 * Entity location with matched anchor
 */
interface EntityMatch {
  fileId: string;
  anchor: string;
}

/**
 * Build entity index by matching entity slugs to file anchors
 */
function buildEntityIndex(
  files: FileDescriptor[],
  tracker: ConversionTracker,
  entityLocations: Record<string, string[]>,
  urlAliases: Record<string, string>,
): Map<string, EntityMatch> {
  const entityIndex = new Map<string, EntityMatch>();
  const seenUrls = new Set<string>();

  for (const file of files) {
    if (!file.entities) continue;

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
        tracker.trackLinkIssue(entity.url, entity.type, "entity-not-found");
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
const LOCAL_MD_FILE_PATTERN = /^[a-z0-9]{4}\.md/;

// ============================================================================
// Main Resolver Function
// ============================================================================

/**
 * Resolves cross-references in all written files
 *
 * Uses factory pattern with closure variables to avoid prop drilling.
 * Inner functions have shared access to fileMap, urlMap, tracker, etc.
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
  const fileMap = new Map(files.map((f) => [f.uniqueId, f]));
  const urlMap = new Map(files.filter((f) => f.url).map((f) => [f.url!, f]));

  const entityIndex = buildEntityIndex(
    files,
    tracker,
    config.links.entityLocations,
    config.links.urlAliases,
  );

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

  // ============================================================================
  // Resolution Functions
  // ============================================================================

  interface LinkInfo {
    path: string;
    anchor?: string;
    text: string;
    original: string;
  }

  /**
   * Resolve internal anchor link (same-page)
   */
  function resolveInternalAnchor(
    htmlId: string,
    text: string,
    fileId: string,
  ): string | null {
    const fileAnchors = fileMap.get(fileId)?.anchors;
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
   * Resolve a single link
   */
  function resolveLink(url: string, text: string, fileId: string): string {
    const original = url;
    url = normalizeDnDBeyondUrl(url);

    // Handle internal anchors
    if (url.startsWith("#")) {
      const result = resolveInternalAnchor(url.slice(1), text, fileId);
      if (result) {
        tracker.incrementLinksResolved();
        return result;
      }
      return `[${text}](${url})`;
    }

    // Parse URL and apply aliases
    const [initialPath, anchor] = url.split("#");
    const path = applyAliases(initialPath, config.links.urlAliases);
    const link: LinkInfo = { path, anchor, text, original };

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
      }
      return sourceResult;
    }

    // Fallback
    const fallback = formatFallback(text);
    return fallback || `[${text}](${url})`;
  }

  /**
   * Resolve all markdown links in content
   */
  function resolveLinksInContent(content: string, fileId: string): string {
    return content
      .split("\n")
      .map((line) => {
        if (IMAGE_LINE_PATTERN.test(line)) return line;

        return line.replace(MARKDOWN_LINK_REGEX, (_match, text, url) => {
          if (url.endsWith(".md") || LOCAL_MD_FILE_PATTERN.test(url)) {
            return `[${text}](${url})`;
          }
          if (shouldResolveUrl(url)) {
            return resolveLink(url, text, fileId);
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
      const resolvedContent = resolveLinksInContent(content, file.uniqueId);

      if (resolvedContent !== content) {
        await writeFile(file.outputPath, resolvedContent, "utf-8");
      }
    } catch (error) {
      tracker.trackError(file.outputPath, error, "file", "read");
    }
  }
}
