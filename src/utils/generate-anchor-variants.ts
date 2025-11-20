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
    variants.push(anchor.slice(0, -1));
  } else {
    variants.push(anchor + "s");
  }

  return variants;
}
