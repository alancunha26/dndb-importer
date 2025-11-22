import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond feat listing pages
 * Pattern: List Rows (div.list-row[data-slug])
 */
export const featsParser: EntityParser = {
  parse(_html: string): ParsedEntity[] {
    // TODO: Implement in Phase 2
    // - Selector: div.list-row[data-slug] a.link
    // - Metadata: prerequisite, category
    return [];
  },
};
