import path from "node:path";

/**
 * Extract unique ID from a filename
 * Removes the file extension to get the base ID
 *
 * @example
 * extractIdFromFilename("a3f9.md") // "a3f9"
 * extractIdFromFilename("image.v2.png") // "image.v2"
 */
export function extractIdFromFilename(filename: string): string {
  const parsed = path.parse(filename);
  return parsed.name;
}
