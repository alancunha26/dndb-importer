/**
 * URL Utilities
 * Reusable functions for URL manipulation and validation
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * D&D Beyond domain URL patterns
 */
const DNDBEYOND_HTTPS = "https://www.dndbeyond.com/";
const DNDBEYOND_HTTP = "http://www.dndbeyond.com/";
const LOCAL_MD_FILE_PATTERN = /^[a-z0-9]{4}\.md/;

/**
 * D&D Beyond entity types that can be linked
 */
export const ENTITY_TYPES = [
  "spells",
  "monsters",
  "magic-items",
  "equipment",
  "classes",
  "feats",
  "species",
  "backgrounds",
] as const;

/**
 * Regex pattern to match entity path prefixes
 * Example: /spells/, /monsters/
 */
const ENTITY_PATH_PATTERN = new RegExp(`^\\/(${ENTITY_TYPES.join("|")})\\/`);

/**
 * Source book URL pattern
 * Example: /sources/dnd/phb-2024
 */
const SOURCE_URL_PATTERN = /^\/sources\//;

// ============================================================================
// Functions
// ============================================================================

/**
 * Normalize D&D Beyond URL
 * - Strips D&D Beyond domain
 * - Removes trailing slashes (before # or at end)
 * - Ensures leading slash for relative paths
 *
 * @param url - URL to normalize
 * @returns Normalized URL path
 *
 * @example
 * normalizeDnDBeyondUrl("https://www.dndbeyond.com/sources/dnd/phb-2024/spells")
 * // => "/sources/dnd/phb-2024/spells"
 *
 * normalizeDnDBeyondUrl("/sources/dnd/phb-2024/spells/")
 * // => "/sources/dnd/phb-2024/spells"
 *
 * normalizeDnDBeyondUrl("/sources/dnd/phb-2024/spells/#fireball")
 * // => "/sources/dnd/phb-2024/spells#fireball"
 *
 * normalizeDnDBeyondUrl("sources/dnd/phb-2024/spells")
 * // => "/sources/dnd/phb-2024/spells"
 */
export function normalizeDnDBeyondUrl(url: string): string {
  let normalized = url;

  // 1. Strip D&D Beyond domain
  if (normalized.startsWith(DNDBEYOND_HTTPS)) {
    normalized = normalized.replace(DNDBEYOND_HTTPS, "");
  } else if (normalized.startsWith(DNDBEYOND_HTTP)) {
    normalized = normalized.replace(DNDBEYOND_HTTP, "");
  }

  // 2. Remove trailing slashes (before # or at end)
  // Handles: "/sources/.../spells/" -> "/sources/.../spells"
  // Handles: "/sources/.../spells/#anchor" -> "/sources/.../spells#anchor"
  normalized = normalized.replace(/\/(?=#)/, ""); // Remove / before #
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1); // Remove trailing / at end
  }

  // 3. Ensure leading slash for relative paths
  // Some links in HTML are relative (sources/...) but canonical URLs always have leading slash (/sources/...)
  if (
    normalized &&
    !normalized.startsWith("/") &&
    !normalized.startsWith("#")
  ) {
    normalized = "/" + normalized;
  }

  return normalized;
}

/**
 * Check if a URL should be resolved by the resolver module
 * Returns true only for D&D Beyond links (internal anchors, full URLs, or path-based URLs)
 *
 * @param url - URL to check
 * @returns True if URL should be resolved
 *
 * @example
 * shouldResolveUrl("#fireball") // => true (internal anchor)
 * shouldResolveUrl("https://www.dndbeyond.com/sources/...") // => true (full D&D Beyond URL)
 * shouldResolveUrl("/sources/dnd/phb-2024/spells") // => true (source path)
 * shouldResolveUrl("/spells/123") // => true (entity path)
 * shouldResolveUrl("https://example.com") // => false (external link)
 */
export function shouldResolveUrl(url: string): boolean {
  if (url.startsWith("#")) {
    return true;
  }

  if (url.endsWith(".md") || LOCAL_MD_FILE_PATTERN.test(url)) {
    return false;
  }

  // Full D&D Beyond URLs
  if (url.startsWith(DNDBEYOND_HTTPS) || url.startsWith(DNDBEYOND_HTTP)) {
    return true;
  }

  // D&D Beyond paths (sources or entities)
  if (isSourceUrl(url)) {
    return true;
  }

  if (isEntityUrl(url)) {
    return true;
  }

  // Not a D&D Beyond link
  return false;
}

/**
 * Apply URL aliases to rewrite URLs to canonical form
 *
 * @param urlPath - URL path to potentially rewrite
 * @param aliases - URL alias mapping (from config.links.urlAliases)
 * @returns Rewritten URL path if alias exists, otherwise original path
 *
 * @example
 * applyAliases("/sources/dnd/free-rules/foo", {
 *   "/sources/dnd/free-rules/foo": "/sources/dnd/phb-2024/foo"
 * })
 * // => "/sources/dnd/phb-2024/foo"
 *
 * applyAliases("/sources/dnd/phb-2024/spells", {})
 * // => "/sources/dnd/phb-2024/spells" (no alias, returns original)
 */
export function applyAliases(
  urlPath: string,
  aliases: Record<string, string>,
): string {
  return aliases[urlPath] || urlPath;
}

/**
 * Check if a url path is a entity url or not
 *
 * @param urlPath - URL path to potentially rewrite
 *
 * @example
 *
 * isEntityUrl("/spells/123")
 * // => true
 */
export function isEntityUrl(urlPath: string): boolean {
  return ENTITY_PATH_PATTERN.test(urlPath);
}

/**
 * Check if a url path is a source url
 *
 * @param urlPath - URL path to potentially rewrite
 *
 * @example
 *
 * isSourceUrl("/sources/dnd/phb-2024")
 * // => true
 */
export function isSourceUrl(urlPath: string): boolean {
  return SOURCE_URL_PATTERN.test(urlPath);
}
