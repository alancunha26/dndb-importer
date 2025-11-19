/**
 * Resolver Module
 * Resolves D&D Beyond links to local markdown links
 *
 * This module runs AFTER processor has written all files to disk.
 * It reads the files, resolves links, and overwrites them.
 */

import { readFile, writeFile } from "fs/promises";
import type { ConversionContext } from "../types";
import {
  normalizeDnDBeyondUrl,
  shouldResolveUrl,
  applyAliases,
  isEntityUrl,
} from "../utils/url";
import { parseEntityUrl } from "../utils/entity";
import { normalizeAnchor, findMatchingAnchor } from "../utils/anchor";

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

  const writtenFiles = ctx.files.filter((f) => f.written);

  // ============================================================================
  // Shared State (closure variables)
  // ============================================================================

  const fileMap = new Map(writtenFiles.map((f) => [f.uniqueId, f]));
  const urlMap = new Map(
    writtenFiles.filter((f) => f.canonicalUrl).map((f) => [f.canonicalUrl!, f]),
  );
  const { tracker, config, sourcebooks } = ctx;

  // Build entity index from file.entities
  const entityIndex = new Map<string, string[]>();
  for (const file of writtenFiles) {
    if (!file.entities) continue;

    for (const entity of file.entities) {
      // Skip entities without anchors (no slug in URL)
      if (!entity.anchor) {
        tracker.trackLinkIssue(entity.url, entity.type, "entity-not-found");
        continue;
      }

      if (!entityIndex.has(entity.url)) {
        entityIndex.set(entity.url, []);
      }
      entityIndex.get(entity.url)!.push(file.uniqueId);
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

    const fileIds = entityIndex.get(link.path);
    if (!fileIds || fileIds.length === 0) {
      tracker.trackLinkIssue(link.original, link.text, "entity-not-found");
      return null;
    }

    const fileId = fileIds[0];
    const parsed = parseEntityUrl(link.path);
    const targetAnchor = link.anchor || parsed?.anchor;

    if (!targetAnchor) {
      tracker.trackLinkIssue(link.original, link.text, "anchor-not-found");
      return null;
    }

    return `[${link.text}](${fileId}.md#${targetAnchor})`;
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
        return `**${link.text}**`;
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
    if (config.links.fallbackToBold) {
      return `**${text}**`;
    }

    return `[${text}](${url})`;
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

  for (const file of writtenFiles) {
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
