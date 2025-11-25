/**
 * Generate GitHub-style anchor from heading text
 * GFM preserves Unicode letters in anchors
 *
 * @example
 * generateAnchor("Bell (1 GP)") // "bell-1-gp"
 * generateAnchor("Opportunity Attack") // "opportunity-attack"
 * generateAnchor("Blindness/Deafness") // "blindnessdeafness"
 * generateAnchor("Selûne") // "selûne"
 */
export function generateAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "") // Keep Unicode letters and numbers
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
