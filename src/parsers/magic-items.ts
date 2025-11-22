import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond magic item listing pages
 * Pattern: Info Cards (div.info[data-slug])
 */
export const magicItemsParser: EntityParser = {
  parse(_html: string): ParsedEntity[] {
    // TODO: Implement in Phase 2
    // - Selector: div.info[data-slug] a.link
    // - Metadata: rarity, type, attunement
    return [];
  },
};
