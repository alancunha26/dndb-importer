/**
 * Find matching anchor with smart matching:
 * 1. Exact match (including plural/singular variants in valid list)
 * 2. Prefix match for headers with suffixes
 *
 * @example
 * findMatchingAnchor("fireball", ["fireball", "fireballs"]) // "fireball"
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

  // 2. Try prefix matching
  const prefixMatches = validAnchors.filter((valid) =>
    valid.startsWith(anchor + "-"),
  );

  if (prefixMatches.length === 0) {
    return null;
  }

  // Filter out variants
  const primaryMatches = prefixMatches.filter((match) => {
    const isPluralExists = prefixMatches.includes(match + "s");
    return !isPluralExists;
  });

  const matchesToUse = primaryMatches.length > 0 ? primaryMatches : prefixMatches;

  // Return shortest match
  return matchesToUse.reduce((shortest, current) =>
    current.length < shortest.length ? current : shortest,
  );
}
