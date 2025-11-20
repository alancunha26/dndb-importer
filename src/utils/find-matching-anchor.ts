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

  // 3. Try prefix matching with consistent normalization
  const searchWords = anchor.split("-").map((w) => w.replace(/s/g, ""));
  const prefixMatches = validAnchors.filter((valid) => {
    // Normalized prefix check (handles plurals and "/" characters)
    // Only for multi-word searches to avoid "cart" matching "cartographers-tools"
    // "potions-of-healing" matches "potion-of-healing-50-gp"
    // "enlarge-reduce" matches "enlargereduce-spell"
    if (searchWords.length >= 2) {
      const normalizedValid = normalizeAnchorForMatching(valid);
      if (normalizedValid.startsWith(normalizedSearch)) {
        return true;
      }
    }

    // Word-by-word matching for additional precision
    // "alchemists-fire" matches "alchemists-fire-50-gp"
    // "cart" does NOT match "cartographers-tools"
    const validWords = valid.split("-").map((w) => w.replace(/s/g, ""));
    if (searchWords.length > validWords.length) return false;

    // Each search word must match corresponding anchor word
    for (let i = 0; i < searchWords.length; i++) {
      if (searchWords[i] !== validWords[i]) return false;
    }

    return true;
  });

  if (prefixMatches.length > 0) {
    // Return shortest match
    return prefixMatches.reduce((shortest, current) =>
      current.length < shortest.length ? current : shortest,
    );
  }

  // 4. Try unordered word matching (fallback for reversed word order)
  // "travelers-clothes" matches "clothes-travelers-2-gp"
  // Only for multi-word searches to avoid false positives like "bolt" matching "crossbow-bolt"
  if (searchWords.length < 2) {
    return null;
  }

  const unorderedMatches = validAnchors.filter((valid) => {
    const validWords = valid.split("-").map((w) => w.replace(/s/g, ""));
    return searchWords.every((searchWord) =>
      validWords.some((validWord) => validWord === searchWord),
    );
  });

  if (unorderedMatches.length > 0) {
    // Return shortest match
    return unorderedMatches.reduce((shortest, current) =>
      current.length < shortest.length ? current : shortest,
    );
  }

  return null;
}
