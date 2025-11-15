/**
 * File Scanner
 * Discovers HTML files, generates unique IDs, and creates processing queue
 */

import type { FileDescriptor } from "./types";

export class FileScanner {
  /**
   * Scan directory for HTML files and assign unique IDs
   */
  async scan(inputDir: string): Promise<FileDescriptor[]> {
    console.log("Scanning directory:", inputDir);
    // TODO: Implement file scanning logic
    return [];
  }
}
