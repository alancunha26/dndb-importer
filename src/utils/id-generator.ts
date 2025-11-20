/**
 * Unique ID Generator
 * Generates 4-character unique IDs using short-unique-id
 */

import ShortUniqueId from "short-unique-id";
import { extractIdFromFilename } from "./extract-id-from-filename";
import type { FileMapping } from "../types";

export class IdGenerator {
  private uid: ShortUniqueId;
  private usedIds = new Set<string>();

  constructor() {
    this.uid = new ShortUniqueId({
      length: 4,
      dictionary: "alphanum_lower",
    });
  }

  /**
   * Create an IdGenerator from an existing mapping
   * Registers all IDs from the mapping to prevent collisions
   *
   * @param mapping - FileMapping object (e.g., URL -> "a3f9.png")
   * @returns IdGenerator instance with registered IDs
   *
   * @example
   * const mapping = { "url1": "a3f9.png", "url2": "b4x8.png" };
   * const generator = IdGenerator.fromMapping(mapping);
   * // generator won't generate "a3f9" or "b4x8" (already registered)
   */
  static fromMapping(mapping: FileMapping): IdGenerator {
    const generator = new IdGenerator();

    for (const filename of Object.values(mapping)) {
      const id = extractIdFromFilename(filename);
      generator.register(id);
    }

    return generator;
  }

  /**
   * Generate a unique ID, ensuring no collisions
   */
  generate(): string {
    let id: string;
    do {
      id = this.uid.rnd();
    } while (this.usedIds.has(id));

    this.usedIds.add(id);
    return id;
  }

  /**
   * Register an existing ID to prevent collisions
   * Used when loading IDs from persistent storage
   */
  register(id: string): void {
    this.usedIds.add(id);
  }

  /**
   * Reset the used IDs set (useful for testing or new conversion runs)
   */
  reset(): void {
    this.usedIds.clear();
  }
}
