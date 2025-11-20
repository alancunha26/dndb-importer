/**
 * Apply URL aliases to rewrite URLs to canonical form
 *
 * @example
 * applyAliases("/sources/dnd/free-rules/foo", {
 *   "/sources/dnd/free-rules/foo": "/sources/dnd/phb-2024/foo"
 * })
 * // => "/sources/dnd/phb-2024/foo"
 */
export function applyAliases(
  urlPath: string,
  aliases: Record<string, string>,
): string {
  return aliases[urlPath] || urlPath;
}
