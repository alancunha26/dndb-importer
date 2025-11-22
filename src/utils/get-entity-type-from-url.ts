import { ENTITY_TYPES, EntityType } from "../types";

/**
 * Extract entity type from a D&D Beyond URL (full or relative path)
 * Examples:
 *   "https://www.dndbeyond.com/spells?filter..." -> "spells"
 *   "/spells/2619116-invisibility" -> "spells"
 */
export function getEntityTypeFromUrl(url: string): EntityType | null {
  // Try full URL first
  let match = url.match(/dndbeyond\.com\/([\w-]+)/);

  // Fall back to relative path
  if (!match) {
    match = url.match(/^\/([\w-]+)/);
  }

  if (!match) return null;

  const type = match[1];
  return ENTITY_TYPES.includes(type as EntityType)
    ? (type as EntityType)
    : null;
}
