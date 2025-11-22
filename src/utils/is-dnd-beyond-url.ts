/**
 * Check if a URL points to an image file
 *
 * @example
 * isDndBeyondUrl("https://www.dndbeyond.com/") // true
 * isDndBeyondUrl("http://www.dndbeyond.com") // true
 * isDndBeyondUrl("http://www.google.com") // false
 */
export function isDndBeyondUrl(url: string): boolean {
  return (
    url.startsWith("https://www.dndbeyond.com") ||
    url.startsWith("http://www.dndbeyond.com")
  );
}
