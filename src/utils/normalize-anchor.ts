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
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
