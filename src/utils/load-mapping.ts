import { readFile, unlink } from "fs/promises";
import { z } from "zod";
import { fileExists } from "./file-exists";
import type { FileMapping } from "../types";

const MappingSchema = z.record(z.string(), z.string());

/**
 * Load mapping from JSON file
 * Returns empty mapping if file doesn't exist or is invalid
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
