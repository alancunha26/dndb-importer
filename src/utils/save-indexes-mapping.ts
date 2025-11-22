import { writeFile, mkdir } from "fs/promises";
import { dirname } from "node:path";
import type { IndexesMapping } from "../types";

/**
 * Save indexes mapping to JSON file
 * Creates directory if it doesn't exist
 */
export async function saveIndexesMapping(
  filepath: string,
  mapping: IndexesMapping,
): Promise<void> {
  try {
    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, JSON.stringify(mapping, null, 2), "utf-8");
  } catch (error) {
    console.error(`Failed to save indexes mapping to ${filepath}:`, error);
  }
}
