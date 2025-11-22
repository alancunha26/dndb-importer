import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond spell listing pages
 * Pattern: Info Cards (div.info[data-slug])
 */
export const spellsParser: EntityParser = {
  parse(_html: string): ParsedEntity[] {
    // TODO: Implement in Phase 2
    // - Selector: div.info[data-slug] a.link
    // - Metadata: level, school, casting time, range, components, duration
    return [];
  },
};
