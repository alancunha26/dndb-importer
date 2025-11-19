/**
 * Resolver Module
 * Resolves D&D Beyond links to local markdown links
 *
 * This module runs AFTER processor has written all files to disk.
 * It reads the files, resolves links, and overwrites them.
 */

import { readFile, writeFile } from "fs/promises";
import type {
  ConversionContext,
  LinkResolutionIndex,
  FallbackLink,
} from "../types";

/**
 * Resolves cross-references in all written files
 *
 * Reads from context:
 * - files: Contains file descriptors with anchors (enriched by processor)
 * - urlMapping: Auto-discovered URL → file ID mapping from scanner
 * - entityIndex: Entity URL → file locations mapping from processor
 * - config.links: urlAliases, resolveInternal, fallbackToBold
 *
 * Process:
 * 1. Build LinkResolutionIndex from files (has all anchors)
 * 2. For each file, read markdown from disk
 * 3. Resolve D&D Beyond links:
 *    - Apply urlAliases to rewrite URLs to canonical form
 *    - Entity index for entity links (/spells/123, /monsters/456)
 *    - URL mapping + anchor validation for source links
 * 4. Overwrite files with resolved links
 *
 * Memory efficient:
 * - Only one file's content in memory at a time
 * - FileDescriptor contains only lightweight metadata + anchors
 */
export async function resolve(ctx: ConversionContext): Promise<void> {
  if (!ctx.files || !ctx.pathIndex) {
    throw new Error("Processor and scanner must run before resolver");
  }

  // Skip if link resolution is disabled
  if (!ctx.config.links.resolveInternal) {
    return;
  }

  const writtenFiles = ctx.files.filter((f) => f.written);

  // 1. Build LinkResolutionIndex from all file anchors
  const index: LinkResolutionIndex = {};
  for (const file of writtenFiles) {
    if (file.anchors) {
      index[file.uniqueId] = file.anchors;
    }
  }

  // 2. Initialize fallback tracking
  const fallbackLinks: FallbackLink[] = [];

  // 3. For each written file, resolve links
  // Note: URL aliases are applied in resolveLink() before entity/source resolution
  for (const file of writtenFiles) {
    try {
      // a. Read markdown content from disk
      const content = await readFile(file.outputPath, "utf-8");

      // b. Resolve all links in the content
      const resolvedContent = await resolveLinksInContent(
        content,
        file.uniqueId,
        ctx,
        index,
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
async function resolveLinksInContent(
  content: string,
  currentFileId: string,
  ctx: ConversionContext,
  index: LinkResolutionIndex,
  fallbackLinks: FallbackLink[],
): Promise<string> {
  // Split content into lines to handle images properly
  const lines = content.split("\n");

  return lines
    .map((line) => {
      // Skip image lines (start with whitespace + !)
      if (/^\s*!/.test(line)) {
        return line;
      }

      // Regex to match markdown links: [text](url)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

      return line.replace(linkRegex, (_match, text, url) => {
        // Skip links that are already local markdown files (navigation links)
        if (url.endsWith(".md") || url.match(/^[a-z0-9]{4}\.md/)) {
          return `[${text}](${url})`; // Keep as-is
        }

        // Only process D&D Beyond links
        if (shouldResolveLink(url)) {
          const resolved = resolveLink(
            url,
            text,
            currentFileId,
            ctx,
            index,
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
 * Determine if a link should be resolved
 * Returns true only for D&D Beyond links
 */
function shouldResolveLink(url: string): boolean {
  // Internal anchors (same-page)
  if (url.startsWith("#")) return true;

  // Full D&D Beyond URLs
  if (
    url.startsWith("https://www.dndbeyond.com/") ||
    url.startsWith("http://www.dndbeyond.com/")
  ) {
    return true;
  }

  // D&D Beyond paths (sources or entities)
  if (url.startsWith("/sources/")) return true;
  if (/^\/(spells|monsters|magic-items|equipment|classes|feats|species|backgrounds)\//.test(url)) {
    return true;
  }

  // Not a D&D Beyond link
  return false;
}

/**
 * Resolve a single link
 */
function resolveLink(
  url: string,
  text: string,
  currentFileId: string,
  ctx: ConversionContext,
  index: LinkResolutionIndex,
  fallbackLinks: FallbackLink[],
): string {
  const originalUrl = url; // Save for tracking
  // 1. Handle full D&D Beyond URLs - strip domain
  if (url.startsWith("https://www.dndbeyond.com/")) {
    url = url.replace("https://www.dndbeyond.com", "");
  } else if (url.startsWith("http://www.dndbeyond.com/")) {
    url = url.replace("http://www.dndbeyond.com", "");
  }

  // 2. Normalize URL - strip trailing slashes (before # or at end)
  // Handles: "/sources/.../spells/" -> "/sources/.../spells"
  // Handles: "/sources/.../spells/#anchor" -> "/sources/.../spells#anchor"
  url = url.replace(/\/(?=#)/, ""); // Remove / before #
  if (url.length > 1 && url.endsWith("/")) {
    url = url.slice(0, -1); // Remove trailing / at end
  }

  // 3. Handle internal anchors (same-page links)
  if (url.startsWith("#")) {
    return resolveInternalAnchor(url, text, currentFileId, index);
  }

  // 4. Split URL into path and anchor
  let [urlPath, urlAnchor] = url.split("#");

  // 5. Apply URL aliases (single point of URL rewriting)
  // Rewrites urlPath to canonical URL while preserving anchor
  // Works for both entity links (/magic-items/123) and source links (/sources/...)
  if (ctx.config.links.urlAliases[urlPath]) {
    urlPath = ctx.config.links.urlAliases[urlPath];
  }

  // 6. Check if it's an entity link (priority check)
  if (ctx.entityIndex) {
    const entityResult = resolveEntityLink(
      urlPath,
      urlAnchor,
      text,
      ctx,
      fallbackLinks,
      currentFileId,
      originalUrl,
    );
    if (entityResult) return entityResult;
  }

  // 7. Check if it's a source book link
  const sourceResult = resolveSourceLink(
    urlPath,
    urlAnchor,
    text,
    ctx,
    index,
    fallbackLinks,
    currentFileId,
    originalUrl,
  );
  if (sourceResult) return sourceResult;

  // 8. Fallback to bold text if configured
  if (ctx.config.links.fallbackToBold) {
    // Only track if not already tracked (entity/source functions track specific reasons)
    // This catches any remaining unresolved links
    return `**${text}**`;
  }

  // 9. Leave link as-is if no fallback
  return `[${text}](${url})`;
}

/**
 * Resolve internal anchor link (same-page)
 */
function resolveInternalAnchor(
  url: string,
  text: string,
  currentFileId: string,
  index: LinkResolutionIndex,
): string {
  const htmlId = url.slice(1); // Remove # prefix
  const fileAnchors = index[currentFileId];

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
  ctx: ConversionContext,
  fallbackLinks: FallbackLink[],
  currentFileId: string,
  originalUrl: string,
): string | null {
  // Check if it's an entity link pattern: /spells/123, /monsters/456, /classes/789, etc.
  if (!/^\/(spells|monsters|magic-items|equipment|classes|feats|species|backgrounds)\/\d+/.test(urlPath)) {
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
 * Resolve source book link using URL mapping
 * Returns resolved link or null if not a source link
 */
function resolveSourceLink(
  urlPath: string,
  urlAnchor: string | undefined,
  text: string,
  ctx: ConversionContext,
  index: LinkResolutionIndex,
  fallbackLinks: FallbackLink[],
  currentFileId: string,
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
    const fileId = ctx.urlMapping?.get(urlPath);
    if (fileId) {
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
  const fileId = ctx.urlMapping?.get(urlPath);
  if (!fileId) {
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
  const fileAnchors = index[fileId];
  if (!fileAnchors) {
    if (ctx.config.links.fallbackToBold) {
      fallbackLinks.push({
        url: originalUrl,
        text,
        file: currentFileId,
        reason: `No anchors found in target file: ${fileId}`,
      });
    }
    return null; // No anchors for this file
  }

  // Try to find matching anchor
  // Priority 1: Check if HTML ID exists in htmlIdToAnchor mapping (e.g., "FlySpeed" -> "fly-speed")
  let matchedAnchor: string | null | undefined = fileAnchors.htmlIdToAnchor[urlAnchor];

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
        reason: `Anchor not found in ${fileId}: #${urlAnchor}`,
      });
    }
    return null; // Anchor not found
  }

  // Build markdown link
  return `[${text}](${fileId}.md#${matchedAnchor})`;
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
