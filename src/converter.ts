/**
 * Main Converter
 * Orchestrates the conversion process
 */

import type { ConversionConfig, ProcessingStats } from "./types";

export class Converter {
  constructor(private config: ConversionConfig) {}

  /**
   * Run the conversion process
   */
  async convert(): Promise<ProcessingStats> {
    console.log("Converting with config:", this.config);
    // TODO: Implement main conversion orchestration
    throw new Error("Not implemented");
  }
}
