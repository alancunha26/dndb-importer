/**
 * Unique ID Generator
 * Generates 4-character unique IDs using short-unique-id
 */

import ShortUniqueId from "short-unique-id";

export class IdGenerator {
  private uid: ShortUniqueId;
  private usedIds = new Set<string>();

  constructor() {
    this.uid = new ShortUniqueId({
      length: 4,
      dictionary: "alphanum_lower", // lowercase alphanumeric only
    });
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
   * Reset the used IDs set (useful for testing or new conversion runs)
   */
  reset(): void {
    this.usedIds.clear();
  }
}
