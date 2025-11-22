import { readFile, unlink } from "fs/promises";
import { fileExists } from "./file-exists";
import { IndexesMappingSchema, type IndexesMapping } from "../types";

/**
 * Create an empty indexes mapping
 */
export function createEmptyIndexesMapping(): IndexesMapping {
  return {
    mappings: {
      global: undefined,
      entities: {},
    },
    entities: {},
    cache: {},
  };
}

/**
 * Load indexes mapping from JSON file
 * Returns empty mapping if file doesn't exist or is invalid
 */
export async function loadIndexesMapping(
  filepath: string,
): Promise<IndexesMapping> {
  const exists = await fileExists(filepath);
  if (!exists) {
    return createEmptyIndexesMapping();
  }

  try {
    const content = await readFile(filepath, "utf-8");
    const { error, data } = IndexesMappingSchema.safeParse(JSON.parse(content));

    if (!error) {
      return data;
    }

    // Invalid schema - delete corrupted file
    await unlink(filepath).catch(() => {});
    return createEmptyIndexesMapping();
  } catch {
    // JSON parse error - delete corrupted file
    try {
      await unlink(filepath).catch(() => {});
    } catch {
      // Ignore unlink errors
    }
    return createEmptyIndexesMapping();
  }
}
