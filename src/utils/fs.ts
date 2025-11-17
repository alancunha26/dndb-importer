/**
 * Filesystem Utilities
 * Shared filesystem helper functions
 */

import { access } from "fs/promises";
import { constants } from "node:fs";

/**
 * Check if a file or directory exists
 *
 * @param path - Path to check
 * @returns True if file/directory exists, false otherwise
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
