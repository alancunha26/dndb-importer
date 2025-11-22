import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond class listing pages
 * Pattern: Card Grid (li.listing-card)
 */
export const classesParser: EntityParser = {
  parse(_html: string): ParsedEntity[] {
    // TODO: Implement in Phase 2
    // - Selector: li.listing-card a.listing-card__link
    // - Metadata: source
    // - Note: No pagination (all shown in grid)
    return [];
  },
};
