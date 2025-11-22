import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond monster listing pages
 * Pattern: Info Cards (div.info[data-slug])
 */
export const monstersParser: EntityParser = {
  parse(_html: string): ParsedEntity[] {
    // TODO: Implement in Phase 2
    // - Selector: div.info[data-slug] a.link
    // - Metadata: type, CR, size, alignment
    return [];
  },
};
