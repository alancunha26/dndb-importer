import { ENTITY_TYPES } from "../types";

const ENTITY_PATH_PATTERN = new RegExp(`^\\/(${ENTITY_TYPES.join("|")})\\/`);

/**
 * Check if a url path is an entity url
 *
 * @example
 * isEntityUrl("/spells/123") // => true
 * isEntityUrl("/sources/dnd/phb") // => false
 */
export function isEntityUrl(urlPath: string): boolean {
  return ENTITY_PATH_PATTERN.test(urlPath);
}
