import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond equipment listing pages
 * Pattern: List Rows (div.list-row[data-slug])
 */
export const equipmentParser: EntityParser = {
  parse(_html: string): ParsedEntity[] {
    // TODO: Implement in Phase 2
    // - Selector: div.list-row[data-slug] a.link
    // - Metadata: cost, weight, type
    return [];
  },
};
