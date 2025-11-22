import { findMatchingAnchor } from "./find-matching-anchor";
import { getEntityTypeFromUrl } from "./get-entity-type-from-url";
import type { EntityMatch, ConversionContext, FileDescriptor } from "../types";

/**
 * Find best anchor match for a slug across target files
 */
function findBestMatch(
  slug: string,
  targetFiles: FileDescriptor[],
  maxMatchStep?: number,
): EntityMatch | null {
  let bestMatch: { fileId: string; anchor: string; step: number } | null = null;

  for (const file of targetFiles) {
    if (!file.anchors) continue;

    const result = findMatchingAnchor(slug, file.anchors.valid, maxMatchStep);
    if (result && (!bestMatch || result.step < bestMatch.step)) {
      bestMatch = {
        fileId: file.uniqueId,
        anchor: result.anchor,
        step: result.step,
      };
      // Short-circuit if we found an exact match (step 1)
      if (result.step === 1) break;
    }
  }

  return bestMatch
    ? { fileId: bestMatch.fileId, anchor: bestMatch.anchor }
    : null;
}

/**
 * Get target files for an entity type based on entityLocations config
 */
function getTargetFiles(
  entityType: string,
  ctx: ConversionContext,
): FileDescriptor[] {
  const { config, files } = ctx;
  const { entityLocations } = config.links;
  const allowedPages = entityLocations[entityType];

  if (!files) return [];
  if (!allowedPages) return files;

  const result: FileDescriptor[] = [];
  for (const page of allowedPages) {
    for (const file of files) {
      if (!file.url) continue;
      if (file.url.startsWith(page)) {
        result.push(file);
      }
    }
  }

  return result;
}

/**
 * Resolve an entity URL to a file match
 * Then checks ctx.entityIndex or finds best match
 */
export function resolveEntityUrl(
  url: string,
  ctx: ConversionContext,
): EntityMatch | null {
  const { files, config } = ctx;
  const { maxMatchStep } = config.links;

  const entityType = getEntityTypeFromUrl(url);
  if (!files || !entityType) return null;

  // Check existing entityIndex first (optimization)
  const existing = ctx.entityIndex?.get(url);
  if (existing) return existing;

  // Extract slug from URL
  const slug = url.split("/").pop()?.replace(/^\d+-/, "");
  if (!slug) return null;

  // Find best match in target files
  const targetFiles = getTargetFiles(entityType, ctx);
  return findBestMatch(slug, targetFiles, maxMatchStep);
}
