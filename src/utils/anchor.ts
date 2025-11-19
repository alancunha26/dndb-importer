/**
 * Anchor Utilities
 * Functions for generating, normalizing, and matching markdown anchors
 */

/**
 * Generate GitHub-style anchor from heading text
 *
 * @example
 * generateAnchor("Bell (1 GP)") // "bell-1-gp"
 * generateAnchor("Opportunity Attack") // "opportunity-attack"
 */
export function generateAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special chars except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Normalize URL anchor to markdown format
 * Converts CamelCase HTML IDs to kebab-case markdown anchors
 *
 * @example
 * normalizeAnchor("OpportunityAttack") // "opportunity-attack"
 * normalizeAnchor("FlySpeed") // "fly-speed"
 */
export function normalizeAnchor(anchor: string): string {
  return anchor
    .replace(/([a-z])([A-Z])/g, "$1-$2") // CamelCase -> kebab-case
    .toLowerCase() // Convert to lowercase AFTER splitting camelCase
    .replace(/[^a-z0-9-]/g, "-") // Replace special chars with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Generate plural and singular variants of an anchor
 *
 * @example
 * generateAnchorVariants("spell") // ["spell", "spells"]
 * generateAnchorVariants("spells") // ["spells", "spell"]
 */
export function generateAnchorVariants(anchor: string): string[] {
  const variants = [anchor];

  if (anchor.endsWith("s")) {
    variants.push(anchor.slice(0, -1)); // singular
  } else {
    variants.push(anchor + "s"); // plural
  }

  return variants;
}

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

  // When multiple prefix matches, prefer original anchors over generated variants.
  // Variants differ by just 's' at the end. Between "arcane-focus-varies" and "arcane-focus-varie",
  // prefer "arcane-focus-varies" because "arcane-focus-varie" is a generated singular variant.

  // Filter out variants - a match is a variant if its base form (adding or removing 's') exists
  const primaryMatches = prefixMatches.filter((match) => {
    // Check if this is a singular variant (adding 's' gives another match)
    const isPluralExists = prefixMatches.includes(match + "s");

    // Keep if it's not a singular variant (where plural exists)
    // This means: keep "arcane-focus-varies", discard "arcane-focus-varie"
    return !isPluralExists;
  });

  const matchesToUse = primaryMatches.length > 0 ? primaryMatches : prefixMatches;

  // Return shortest match if multiple prefix matches
  return matchesToUse.reduce((shortest, current) =>
    current.length < shortest.length ? current : shortest,
  );
}
