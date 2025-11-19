/**
 * Resolver Module
 * Resolves D&D Beyond links to local markdown links
 *
 * This module runs AFTER processor has written all files to disk.
 * It reads the files, resolves links, and overwrites them.
 */

import { readFile, writeFile } from "fs/promises";
import type { ConversionContext, FallbackLink, FileDescriptor } from "../types";
import {
  normalizeDnDBeyondUrl,
  shouldResolveUrl,
  applyAliases,
  isEntityUrl,
} from "../utils/url";

// ============================================================================
// Constants
// ============================================================================

/**
 * Regex to match markdown links: [text](url)
 */
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Regex to match image lines (start with whitespace + !)
 */
const IMAGE_LINE_PATTERN = /^\s*!/;

/**
 * Regex to match local markdown file links
 * Example: page.md, a3f9.md
 */
const LOCAL_MD_FILE_PATTERN = /^[a-z0-9]{4}\.md/;

// ============================================================================
// Main Resolver Function
// ============================================================================

/**
 * Resolves cross-references in all written files
 *
 * Reads from context:
 * - files: Contains file descriptors with anchors and canonicalUrl (enriched by processor)
 * - sourcebooks: Contains bookUrl for book-level link resolution
 * - entityIndex: Entity URL → file locations mapping from processor
 * - config.links: urlAliases, resolveInternal, fallbackToBold
 *
 * Process:
 * 1. Build fileMap (ID → file) and urlMap (canonicalUrl → file) from files
 * 2. For each file, read markdown from disk
 * 3. Resolve D&D Beyond links:
 *    - Apply urlAliases to rewrite URLs to canonical form
 *    - Entity index for entity links (/spells/123, /monsters/456)
 *    - Book URLs from sourcebooks for book-level links
 *    - Canonical URLs from files + anchor validation for page-level links
 * 4. Overwrite files with resolved links
 *
 * Memory efficient:
 * - Only one file's content in memory at a time
 * - Maps reference original FileDescriptor objects (no duplication)
 */
export async function resolve(ctx: ConversionContext): Promise<void> {
  if (!ctx.files) {
    throw new Error("Processor and scanner must run before resolver");
  }

  // Skip if link resolution is disabled
  if (!ctx.config.links.resolveInternal) {
    return;
  }

  const writtenFiles = ctx.files.filter((f) => f.written);

  // 1. Build fileMap for O(1) lookup of file descriptors by ID
  // This references the original FileDescriptor objects (no duplication)
  const fileMap = new Map(writtenFiles.map((f) => [f.uniqueId, f]));

  // 2. Build urlMap for O(1) lookup of files by canonical URL
  // Only includes files that have a canonicalUrl
  const urlMap = new Map(
    writtenFiles.filter((f) => f.canonicalUrl).map((f) => [f.canonicalUrl!, f]),
  );

  // 3. Initialize fallback tracking
  const fallbackLinks: FallbackLink[] = [];

  // 3. For each written file, resolve links
  // Note: URL aliases are applied in resolveLink() before entity/source resolution
  for (const file of writtenFiles) {
    try {
      // a. Read markdown content from disk
      const content = await readFile(file.outputPath, "utf-8");

      // b. Resolve all links in the content
      const resolvedContent = resolveLinksInContent(
        content,
        file.uniqueId,
        ctx,
        fileMap,
        urlMap,
        fallbackLinks,
      );

      // c. Overwrite file with resolved content
      if (resolvedContent !== content) {
        await writeFile(file.outputPath, resolvedContent, "utf-8");
      }
    } catch (error) {
      ctx.errors.files.push({
        path: file.outputPath,
        error: error as Error,
      });
    }
  }

  // 4. Store fallback links in stats
  if (!ctx.stats) {
    ctx.stats = {
      totalFiles: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      indexesCreated: 0,
      imagesDownloaded: 0,
      imagesFailed: 0,
      linksResolved: 0,
      linksFailed: 0,
      fallbackLinks: [],
      startTime: new Date(),
    };
  }
  ctx.stats.fallbackLinks = fallbackLinks;
}

/**
 * Resolve all markdown links in content
 * Only processes D&D Beyond links, preserves images and local navigation links
 */
function resolveLinksInContent(
  content: string,
  currentFileId: string,
  ctx: ConversionContext,
  fileMap: Map<string, FileDescriptor>,
  urlMap: Map<string, FileDescriptor>,
  fallbackLinks: FallbackLink[],
): string {
  // Split content into lines to handle images properly
  const lines = content.split("\n");

  return lines
    .map((line) => {
      // Skip image lines (start with whitespace + !)
      if (IMAGE_LINE_PATTERN.test(line)) {
        return line;
      }

      return line.replace(MARKDOWN_LINK_REGEX, (_match, text, url) => {
        // Skip links that are already local markdown files (navigation links)
        if (url.endsWith(".md") || LOCAL_MD_FILE_PATTERN.test(url)) {
          return `[${text}](${url})`; // Keep as-is
        }

        // Only process D&D Beyond links
        if (shouldResolveUrl(url)) {
          const resolved = resolveLink(
            url,
            text,
            currentFileId,
            ctx,
            fileMap,
            urlMap,
            fallbackLinks,
          );
          return resolved;
        }

        // Keep all other links unchanged
        return `[${text}](${url})`;
      });
    })
    .join("\n");
}

/**
 * Resolve a single link
 */
function resolveLink(
  url: string,
  text: string,
  currentFileId: string,
  ctx: ConversionContext,
  fileMap: Map<string, FileDescriptor>,
  urlMap: Map<string, FileDescriptor>,
  fallbackLinks: FallbackLink[],
): string {
  const originalUrl = url; // Save for tracking

  // 1. Normalize URL (strips domain, trailing slashes, ensures leading slash)
  url = normalizeDnDBeyondUrl(url);

  // 2. Handle internal anchors (same-page links)
  if (url.startsWith("#")) {
    return resolveInternalAnchor(url, text, currentFileId, fileMap);
  }

  // 3. Split URL into path and anchor
  const [initialPath, urlAnchor] = url.split("#");

  // 4. Apply URL aliases (single point of URL rewriting)
  // Rewrites urlPath to canonical URL while preserving anchor
  // Works for both entity links (/magic-items/123) and source links (/sources/...)
  const urlPath = applyAliases(initialPath, ctx.config.links.urlAliases);

  // 5. Check if it's an entity link (priority check)
  if (ctx.entityIndex) {
    const entityResult = resolveEntityLink(
      urlPath,
      urlAnchor,
      text,
      currentFileId,
      ctx,
      fallbackLinks,
      originalUrl,
    );
    if (entityResult) return entityResult;
  }

  // 6. Check if it's a source book link
  const sourceResult = resolveSourceLink(
    urlPath,
    urlAnchor,
    text,
    currentFileId,
    ctx,
    urlMap,
    fallbackLinks,
    originalUrl,
  );
  if (sourceResult) return sourceResult;

  // 7. Fallback to bold text if configured
  if (ctx.config.links.fallbackToBold) {
    // Only track if not already tracked (entity/source functions track specific reasons)
    // This catches any remaining unresolved links
    return `**${text}**`;
  }

  // 8. Leave link as-is if no fallback
  return `[${text}](${url})`;
}

/**
 * Resolve internal anchor link (same-page)
 */
function resolveInternalAnchor(
  url: string,
  text: string,
  currentFileId: string,
  fileMap: Map<string, FileDescriptor>,
): string {
  const htmlId = url.slice(1); // Remove # prefix
  const fileAnchors = fileMap.get(currentFileId)?.anchors;

  if (!fileAnchors) {
    return `[${text}](${url})`; // Keep as-is if no anchors
  }

  // Look up HTML ID in the mapping
  const markdownAnchor = fileAnchors.htmlIdToAnchor[htmlId];
  if (markdownAnchor) {
    return `[${text}](#${markdownAnchor})`;
  }

  // Anchor not found - keep as-is
  return `[${text}](${url})`;
}

/**
 * Resolve entity link using entity index
 * Returns resolved link or null if not an entity link
 */
function resolveEntityLink(
  urlPath: string,
  urlAnchor: string | undefined,
  text: string,
  currentFileId: string,
  ctx: ConversionContext,
  fallbackLinks: FallbackLink[],
  originalUrl: string,
): string | null {
  // Check if it's an entity link pattern: /spells/123, /monsters/456, /classes/789, etc.
  if (!isEntityUrl(urlPath)) {
    return null; // Not an entity link
  }

  const entityIndex = ctx.entityIndex;
  if (!entityIndex) return null;

  // Look up entity in index
  const locations = entityIndex.get(urlPath);
  if (!locations || locations.length === 0) {
    // Track entity not found
    if (ctx.config.links.fallbackToBold) {
      fallbackLinks.push({
        url: originalUrl,
        text,
        file: currentFileId,
        reason: `Entity not found: ${urlPath}`,
      });
    }
    return null; // Entity not found in our files
  }

  // Use first location (could implement smart preference later)
  const location = locations[0];
  const targetAnchor = urlAnchor || location.anchor;

  // Build markdown link
  return `[${text}](${location.fileId}.md#${targetAnchor})`;
}

/**
 * Resolve source book link using canonical URLs from files
 * Returns resolved link or null if not a source link
 */
function resolveSourceLink(
  urlPath: string,
  urlAnchor: string | undefined,
  text: string,
  currentFileId: string,
  ctx: ConversionContext,
  urlMap: Map<string, FileDescriptor>,
  fallbackLinks: FallbackLink[],
  originalUrl: string,
): string | null {
  // Check if there's no anchor - could be book-level or header link
  if (!urlAnchor) {
    // First check if this is a book-level URL that maps to an index file
    const sourcebook = ctx.sourcebooks?.find((sb) => sb.bookUrl === urlPath);
    if (sourcebook) {
      // Link to index file
      return `[${text}](${sourcebook.id}.md)`;
    }

    // Not a book-level URL, check if it's in the URL mapping (header link)
    const targetFile = urlMap.get(urlPath);
    if (targetFile) {
      // It's a header link (page-level URL with no anchor) - convert to bold
      if (ctx.config.links.fallbackToBold) {
        fallbackLinks.push({
          url: originalUrl,
          text,
          file: currentFileId,
          reason: `Header link (no anchor): ${urlPath}`,
        });
      }
      return `**${text}**`; // Convert to bold text
    }

    // URL not in any mapping
    if (ctx.config.links.fallbackToBold) {
      fallbackLinks.push({
        url: originalUrl,
        text,
        file: currentFileId,
        reason: `URL not in mapping: ${urlPath}`,
      });
    }
    return null; // Not in URL mapping
  }

  // Has anchor - look up in URL mapping
  const targetFile = urlMap.get(urlPath);
  if (!targetFile) {
    // Track URL not in mapping
    if (ctx.config.links.fallbackToBold) {
      fallbackLinks.push({
        url: originalUrl,
        text,
        file: currentFileId,
        reason: `URL not in mapping: ${urlPath}`,
      });
    }
    return null; // Not in URL mapping
  }

  // Validate anchor exists in target file
  const fileAnchors = targetFile.anchors;
  if (!fileAnchors) {
    if (ctx.config.links.fallbackToBold) {
      fallbackLinks.push({
        url: originalUrl,
        text,
        file: currentFileId,
        reason: `No anchors found in target file: ${targetFile.uniqueId}`,
      });
    }
    return null; // No anchors for this file
  }

  // Try to find matching anchor
  // Priority 1: Check if HTML ID exists in htmlIdToAnchor mapping (e.g., "FlySpeed" -> "fly-speed")
  let matchedAnchor: string | null | undefined =
    fileAnchors.htmlIdToAnchor[urlAnchor];

  // Priority 2: Use smart matching against valid anchors list
  if (!matchedAnchor) {
    // Normalize URL anchor to markdown format for comparison
    // Convert "OpportunityAttack" -> "opportunity-attack" to match against valid anchors
    const normalizedAnchor = urlAnchor
      .replace(/([a-z])([A-Z])/g, "$1-$2") // CamelCase -> kebab-case
      .toLowerCase() // Convert to lowercase AFTER splitting camelCase
      .replace(/[^a-z0-9-]/g, "-") // Replace special chars with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

    matchedAnchor = findMatchingAnchor(normalizedAnchor, fileAnchors.valid);
  }

  if (!matchedAnchor) {
    if (ctx.config.links.fallbackToBold) {
      fallbackLinks.push({
        url: originalUrl,
        text,
        file: currentFileId,
        reason: `Anchor not found in ${targetFile.uniqueId}: #${urlAnchor}`,
      });
    }
    return null; // Anchor not found
  }

  // Build markdown link
  return `[${text}](${targetFile.uniqueId}.md#${matchedAnchor})`;
}

/**
 * Find matching anchor with smart matching:
 * 1. Exact match (including plural/singular variants in valid list)
 * 2. Prefix match for headers with suffixes
 */
function findMatchingAnchor(
  anchor: string,
  validAnchors: string[],
): string | null {
  // 1. Try exact match (validAnchors already includes plural/singular variants)
  if (validAnchors.includes(anchor)) {
    return anchor;
  }

  // 2. Try prefix matching (e.g., "alchemists-fire" matches "alchemists-fire-50-gp")
  const prefixMatches = validAnchors.filter((valid) =>
    valid.startsWith(anchor + "-"),
  );

  if (prefixMatches.length === 0) {
    return null; // No match found
  }

  // Return shortest match if multiple prefix matches
  return prefixMatches.reduce((shortest, current) =>
    current.length < shortest.length ? current : shortest,
  );
}
