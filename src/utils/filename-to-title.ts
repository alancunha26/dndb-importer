/**
 * Convert a filename to a readable title
 * Removes numeric prefix, splits by hyphens/underscores, and capitalizes each word
 *
 * @example
 * filenameToTitle("01-introduction-welcome") // "Introduction Welcome"
 * filenameToTitle("character-classes") // "Character Classes"
 */
export function filenameToTitle(filename: string): string {
  return filename
    .replace(/^\d+-/, "")
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
