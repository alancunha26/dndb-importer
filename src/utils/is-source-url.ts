const SOURCE_URL_PATTERN = /^\/sources\//;

/**
 * Check if a url path is a source url
 *
 * @example
 * isSourceUrl("/sources/dnd/phb-2024") // => true
 * isSourceUrl("/spells/123") // => false
 */
export function isSourceUrl(urlPath: string): boolean {
  return SOURCE_URL_PATTERN.test(urlPath);
}
