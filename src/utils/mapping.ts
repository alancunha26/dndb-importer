/**
 * Mapping Persistence Utilities
 * Shared functions for loading/saving JSON mapping files
 */

import { readFile, writeFile, mkdir, access } from "fs/promises";
import { dirname, join } from "node:path";
import { constants } from "node:fs";

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load mapping from JSON file in output directory
 * Returns empty mapping if file doesn't exist
 *
 * @param outputDirectory - Output directory path
 * @param filename - Mapping filename (e.g., "images.json", "files.json")
 * @returns Mapping object (empty if file doesn't exist)
 */
export async function loadMapping(
  outputDirectory: string,
  filename: string,
): Promise<Record<string, string>> {
  const mappingPath = join(outputDirectory, filename);

  try {
    const exists = await fileExists(mappingPath);
    if (!exists) {
      return {};
    }

    const content = await readFile(mappingPath, "utf-8");
    return JSON.parse(content) as Record<string, string>;
  } catch (error) {
    console.warn(
      `Warning: Failed to load mapping from ${mappingPath}:`,
      error,
    );
    return {};
  }
}

/**
 * Save mapping to JSON file in output directory
 * Creates directory if it doesn't exist
 *
 * @param outputDirectory - Output directory path
 * @param filename - Mapping filename (e.g., "images.json", "files.json")
 * @param mapping - Mapping object to save
 */
export async function saveMapping(
  outputDirectory: string,
  filename: string,
  mapping: Record<string, string>,
): Promise<void> {
  const mappingPath = join(outputDirectory, filename);

  try {
    // Ensure output directory exists
    await mkdir(dirname(mappingPath), { recursive: true });

    // Write mapping with pretty formatting for readability
    await writeFile(mappingPath, JSON.stringify(mapping, null, 2), "utf-8");
  } catch (error) {
    console.error(`Failed to save mapping to ${mappingPath}:`, error);
  }
}
