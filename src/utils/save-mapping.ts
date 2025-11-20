import { writeFile, mkdir } from "fs/promises";
import { dirname } from "node:path";
import type { FileMapping } from "../types";

/**
 * Save mapping to JSON file
 * Creates directory if it doesn't exist
 */
export async function saveMapping(
  filepath: string,
  mapping: FileMapping,
): Promise<void> {
  try {
    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, JSON.stringify(mapping, null, 2), "utf-8");
  } catch (error) {
    console.error(`Failed to save mapping to ${filepath}:`, error);
  }
}
