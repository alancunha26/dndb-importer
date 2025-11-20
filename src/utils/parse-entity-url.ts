import { ENTITY_TYPES, type ParsedEntityUrl } from "../types";

const ENTITY_URL_REGEX = new RegExp(
  `^\\/(${ENTITY_TYPES.join("|")})\\/(\\d+)(?:-(.+))?$`
);

/**
 * Parse an entity URL into its components
 *
 * @example
 * parseEntityUrl("/spells/2619022-magic-missile")
 * // => { type: "spells", id: "2619022", slug: "magic-missile", anchor: "magic-missile", url: "..." }
 *
 * parseEntityUrl("/sources/dnd/phb")
 * // => null (not an entity URL)
 */
export function parseEntityUrl(url: string): ParsedEntityUrl | null {
  const match = url.match(ENTITY_URL_REGEX);
  if (!match) return null;

  const [, type, id, slug] = match;

  return {
    type,
    id,
    slug,
    anchor: slug,
    url,
  };
}
