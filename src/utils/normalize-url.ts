/**
 * Normalize D&D Beyond URL
 * - Strips D&D Beyond domain
 * - Removes trailing slashes
 * - Ensures leading slash for relative paths
 *
 * @example
 * normalizeUrl("https://www.dndbeyond.com/sources/dnd/phb-2024/spells")
 * // => "/sources/dnd/phb-2024/spells"
 */
export function normalizeUrl(url: string): string {
  let normalized = url;

  // Strip D&D Beyond domain
  if (normalized.startsWith("https://www.dndbeyond.com/")) {
    normalized = normalized.replace("https://www.dndbeyond.com/", "");
  } else if (normalized.startsWith("http://www.dndbeyond.com/")) {
    normalized = normalized.replace("http://www.dndbeyond.com/", "");
  }

  // Remove trailing slashes
  normalized = normalized.replace(/\/(?=#)/, "");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  // Ensure leading slash
  if (normalized && !normalized.startsWith("/") && !normalized.startsWith("#")) {
    normalized = "/" + normalized;
  }

  return normalized;
}
