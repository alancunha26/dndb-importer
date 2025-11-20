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
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
