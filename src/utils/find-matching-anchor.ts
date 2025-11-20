import { normalizeAnchorForMatching } from "./generate-anchor-variants";

/**
 * Find matching anchor with smart matching:
 * 1. Exact match
 * 2. Normalized match (removes hyphens and all 's' characters)
 * 3. Prefix match for headers with suffixes
 *
 * @example
 * findMatchingAnchor("fireball", ["fireball"]) // "fireball"
 * findMatchingAnchor("potion-of-healing", ["potions-of-healing"]) // "potions-of-healing"
 * findMatchingAnchor("enlarge-reduce", ["enlargereduce"]) // "enlargereduce"
 * findMatchingAnchor("alchemists-fire", ["alchemists-fire-50-gp"]) // "alchemists-fire-50-gp"
 */
export function findMatchingAnchor(
  anchor: string,
  validAnchors: string[],
): string | null {
  // 1. Try exact match
  if (validAnchors.includes(anchor)) {
    return anchor;
  }

  // 2. Try normalized match
  const normalizedSearch = normalizeAnchorForMatching(anchor);
  for (const valid of validAnchors) {
    if (normalizeAnchorForMatching(valid) === normalizedSearch) {
      return valid;
    }
  }

  // 3. Try prefix matching (also with normalization)
  const prefixMatches = validAnchors.filter((valid) => {
    // Check if valid anchor starts with search term
    if (valid.startsWith(anchor + "-")) {
      return true;
    }
    // Also check normalized versions
    const normalizedValid = normalizeAnchorForMatching(valid);
    return normalizedValid.startsWith(normalizedSearch);
  });

  if (prefixMatches.length > 0) {
    // Return shortest match
    return prefixMatches.reduce((shortest, current) =>
      current.length < shortest.length ? current : shortest,
    );
  }

  return null;
}
