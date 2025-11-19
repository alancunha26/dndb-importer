/**
 * Resolver Module
 * Resolves D&D Beyond links to local markdown links
 *
 * This module runs AFTER processor has written all files to disk.
 * It reads the files, resolves links, and overwrites them.
 */

import { readFile, writeFile } from "fs/promises";
import type { ConversionContext, LinkResolutionIndex } from "../types";

/**
 * Resolves cross-references in all written files
 *
 * Reads from context:
 * - files: Contains file descriptors with anchors (enriched by processor)
 * - pathIndex: relativePath → uniqueId mapping from scanner
 * - entityIndex: Entity URL → file locations mapping from processor
 * - config.links: urlMapping, resolveInternal, fallbackToBold
 *
 * Process:
 * 1. Build LinkResolutionIndex from files (has all anchors)
 * 2. For each file, read markdown from disk
 * 3. Resolve D&D Beyond links using:
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

  // 2. For each written file, resolve links
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
          const resolved = resolveLink(url, text, currentFileId, ctx, index);
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
  if (/^\/(spells|monsters|magic-items|equipment|conditions|senses|skills|actions|lore-glossary|rules-glossary)\//.test(url)) {
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
): string {
  // 1. Handle full D&D Beyond URLs - strip domain
  if (url.startsWith("https://www.dndbeyond.com/")) {
    url = url.replace("https://www.dndbeyond.com", "");
  } else if (url.startsWith("http://www.dndbeyond.com/")) {
    url = url.replace("http://www.dndbeyond.com", "");
  }

  // 2. Handle internal anchors (same-page links)
  if (url.startsWith("#")) {
    return resolveInternalAnchor(url, text, currentFileId, index);
  }

  // 3. Split URL into path and anchor
  const [urlPath, urlAnchor] = url.split("#");

  // 4. Check if it's an entity link (priority check)
  if (ctx.entityIndex) {
    const entityResult = resolveEntityLink(urlPath, urlAnchor, text, ctx);
    if (entityResult) return entityResult;
  }

  // 5. Check if it's a source book link
  const sourceResult = resolveSourceLink(
    urlPath,
    urlAnchor,
    text,
    ctx,
    index,
  );
  if (sourceResult) return sourceResult;

  // 6. Fallback to bold text if configured
  if (ctx.config.links.fallbackToBold) {
    return `**${text}**`;
  }

  // 7. Leave link as-is if no fallback
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
): string | null {
  // Check if it's an entity link pattern: /spells/123, /monsters/456, etc.
  if (!/^\/(spells|monsters|magic-items|equipment)\/\d+/.test(urlPath)) {
    return null; // Not an entity link
  }

  const entityIndex = ctx.entityIndex;
  if (!entityIndex) return null;

  // Look up entity in index
  const locations = entityIndex.get(urlPath);
  if (!locations || locations.length === 0) {
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
): string | null {
  // Look up URL path in mapping
  const htmlPath = ctx.config.links.urlMapping[urlPath];
  if (!htmlPath) {
    return null; // Not in URL mapping
  }

  // Find file ID from HTML path
  const fileId = ctx.pathIndex?.get(htmlPath);
  if (!fileId) {
    return null; // File not found
  }

  // If no anchor, it's a header link - remove it entirely
  if (!urlAnchor) {
    return `**${text}**`; // Convert to bold text
  }

  // Validate anchor exists in target file
  const fileAnchors = index[fileId];
  if (!fileAnchors) {
    return null; // No anchors for this file
  }

  // Try to find matching anchor
  const matchedAnchor = findMatchingAnchor(urlAnchor, fileAnchors.valid);
  if (!matchedAnchor) {
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
