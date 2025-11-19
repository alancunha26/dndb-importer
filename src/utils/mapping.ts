/**
 * Mapping Persistence Utilities
 * Shared functions for loading/saving JSON mapping files
 */

import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { fileExists } from "./fs";
import type { FileMapping } from "../types";

// Schema for mapping files (validates FileMapping)
const MappingSchema = z.record(z.string(), z.string());

/**
 * Load mapping from JSON file
 * Returns empty mapping if file doesn't exist or is invalid
 * Automatically deletes corrupted mapping files
 *
 * @param filepath - Full path to mapping file (e.g., "output/images.json")
 * @returns Mapping object (empty if file doesn't exist or is invalid)
 */
export async function loadMapping(filepath: string): Promise<FileMapping> {
  const exists = await fileExists(filepath);
  if (!exists) {
    return {};
  }

  const content = await readFile(filepath, "utf-8");
  const { error, data } = MappingSchema.safeParse(JSON.parse(content));

  if (!error) {
    return data;
  }

  try {
    await unlink(filepath).catch();
  } catch (err) {
    console.error(err);
  }

  return {};
}

/**
 * Save mapping to JSON file
 * Creates directory if it doesn't exist
 *
 * @param filepath - Full path to mapping file (e.g., "output/images.json")
 * @param mapping - Mapping object to save
 */
export async function saveMapping(
  filepath: string,
  mapping: FileMapping,
): Promise<void> {
  try {
    // Ensure output directory exists
    await mkdir(dirname(filepath), { recursive: true });

    // Write mapping with pretty formatting for readability
    await writeFile(filepath, JSON.stringify(mapping, null, 2), "utf-8");
  } catch (error) {
    console.error(`Failed to save mapping to ${filepath}:`, error);
  }
}
