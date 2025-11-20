/**
 * Normalize an anchor by stripping trailing 's' from each word segment
 * This allows matching singular/plural forms without complex pluralization rules
 *
 * @example
 * normalizeAnchorForMatching("potions-of-healing") // "potion-of-healing"
 * normalizeAnchorForMatching("spells") // "spell"
 * normalizeAnchorForMatching("staffs") // "staff"
 */
export function normalizeAnchorForMatching(anchor: string): string {
  return anchor
    .split("-")
    .map((word) => (word.endsWith("s") && word.length > 1 ? word.slice(0, -1) : word))
    .join("-");
}
