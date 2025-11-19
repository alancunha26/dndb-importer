/**
 * String Utilities
 * Shared string manipulation helper functions
 */

import path from "node:path";

/**
 * Extract unique ID from a filename
 * Removes the file extension to get the base ID
 *
 * @param filename - Filename with extension (e.g., "a3f9.md", "image.v2.png")
 * @returns ID without extension (e.g., "a3f9", "image.v2")
 *
 * @example
 * extractIdFromFilename("a3f9.md") // "a3f9"
 * extractIdFromFilename("image.png") // "image"
 * extractIdFromFilename("image.v2.png") // "image.v2" (handles multi-dot correctly)
 */
export function extractIdFromFilename(filename: string): string {
  // Remove extension using path utilities (handles multiple dots correctly)
  const parsed = path.parse(filename);
  return parsed.name;
}

/**
 * Check if a URL points to an image file
 * Tests for common image file extensions
 *
 * @param url - URL to check
 * @returns true if URL ends with an image extension
 *
 * @example
 * isImageUrl("https://example.com/image.jpg") // true
 * isImageUrl("https://example.com/map-player.png") // true
 * isImageUrl("https://example.com/document.pdf") // false
 */
export function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg)$/i.test(url);
}

/**
 * Convert a filename to a readable title
 * Removes numeric prefix, splits by hyphens/underscores, and capitalizes each word
 *
 * @param filename - Filename to convert (e.g., "01-chapter-one" or "character-classes")
 * @returns Title-cased string (e.g., "Chapter One" or "Character Classes")
 *
 * @example
 * filenameToTitle("01-introduction-welcome-to-adventure") // "Introduction Welcome To Adventure"
 * filenameToTitle("character-classes") // "Character Classes"
 * filenameToTitle("appendix_a_multiverse") // "Appendix A Multiverse"
 */
export function filenameToTitle(filename: string): string {
  return filename
    .replace(/^\d+-/, "") // Remove numeric prefix (e.g., "01-", "02-")
    .split(/[-_]/) // Split by hyphens or underscores
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter
    .join(" "); // Join with spaces
}
