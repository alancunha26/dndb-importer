/**
 * Writer Module
 *
 * NOTE: This module is now merged into the Processor module to avoid memory bloat.
 * Writing happens immediately after processing each file, so we don't accumulate
 * large HTML/markdown content in memory.
 *
 * This file is kept for reference but is no longer used in the pipeline.
 * See src/modules/processor.ts for the merged implementation.
 */

import type { ConversionContext } from "../types";

/**
 * @deprecated - Merged into processor.ts
 */
export async function write(_ctx: ConversionContext): Promise<void> {
  console.log("Writer module is deprecated - functionality merged into processor");
  // No-op - processor handles writing now
}
