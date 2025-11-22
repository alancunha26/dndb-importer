import { normalizeUrl } from "./normalize-url";

/**
 * Normalize URL and apply aliases to rewrite to canonical form
 *
 * @example
 * applyAliases("/sources/dnd/free-rules/foo", {
 *   "/sources/dnd/free-rules/foo": "/sources/dnd/phb-2024/foo"
 * })
 * // => "/sources/dnd/phb-2024/foo"
 */
export function applyAliases(
  url: string,
  aliases: Record<string, string>,
): string {
  const normalized = normalizeUrl(url);
  return aliases[normalized] || normalized;
}
