/**
 * Normalize an anchor for matching by:
 * 1. Removing all hyphens (handles "/" in headings becoming no separator)
 * 2. Removing all 's' characters (handles plurals anywhere in the string)
 *
 * @example
 * normalizeAnchorForMatching("potions-of-healing") // "potionofhealing"
 * normalizeAnchorForMatching("blindness-deafness") // "blindnedafne"
 * normalizeAnchorForMatching("enlargereduce") // "enlargereduce"
 */
export function normalizeAnchorForMatching(anchor: string): string {
  return anchor.replace(/-/g, "").replace(/s/g, "");
}
