/**
 * Check if a URL points to an image file
 *
 * @example
 * isImageUrl("https://example.com/image.jpg") // true
 * isImageUrl("https://example.com/document.pdf") // false
 */
export function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg)$/i.test(url);
}
