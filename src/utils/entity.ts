/**
 * Entity URL Utilities
 * Functions for parsing and validating D&D Beyond entity URLs
 */

import { ENTITY_TYPES } from "./url";

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed entity URL components
 */
export interface ParsedEntityUrl {
  /** Entity type (spells, monsters, magic-items, etc.) */
  type: string;
  /** Numeric ID */
  id: string;
  /** URL slug after the ID (e.g., "fireball" from "123-fireball") */
  slug?: string;
  /** Computed anchor from slug (kebab-case) */
  anchor?: string;
  /** Original URL */
  url: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Regex to parse entity URLs
 * Captures: type, id, and optional slug
 *
 * Examples:
 * - /spells/2619022-magic-missile → type: spells, id: 2619022, slug: magic-missile
 * - /monsters/123 → type: monsters, id: 123, slug: undefined
 * - /magic-items/456-bag-of-holding → type: magic-items, id: 456, slug: bag-of-holding
 */
const ENTITY_URL_REGEX = new RegExp(
  `^\\/(${ENTITY_TYPES.join("|")})\\/(\\d+)(?:-(.+))?$`
);

// ============================================================================
// Functions
// ============================================================================

/**
 * Parse an entity URL into its components
 *
 * @param url - Entity URL to parse
 * @returns Parsed entity URL or null if not a valid entity URL
 *
 * @example
 * parseEntityUrl("/spells/2619022-magic-missile")
 * // => { type: "spells", id: "2619022", slug: "magic-missile", anchor: "magic-missile", url: "..." }
 *
 * parseEntityUrl("/monsters/123")
 * // => { type: "monsters", id: "123", slug: undefined, anchor: undefined, url: "..." }
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
    anchor: slug, // Slug is already in kebab-case
    url,
  };
}

