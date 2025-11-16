/**
 * Converter - Pipeline orchestrator
 * Coordinates the conversion pipeline with zero business logic
 */

import type { ConversionConfig, ConversionContext, ProcessingStats } from "./types";
import * as modules from "./modules";

export class Converter {
  constructor(private config: ConversionConfig) {}

  /**
   * Run the conversion pipeline
   * Pure orchestration - just calls modules in sequence
   */
  async run(): Promise<ProcessingStats> {
    // Initialize context with config
    const ctx: ConversionContext = {
      config: this.config,
    };

    // Execute pipeline
    await modules.scan(ctx);
    await modules.process(ctx);
    await modules.write(ctx);
    await modules.resolve(ctx);
    await modules.build(ctx);

    // Stats must be populated by stats module
    if (!ctx.stats) {
      throw new Error("Stats module failed to populate statistics");
    }

    return ctx.stats;
  }
}
