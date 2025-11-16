/**
 * Convert command - Loads config and runs conversion pipeline
 */

import { loadConfig } from "../../utils/config";
import * as modules from "../../modules";
import type { ConversionContext } from "../../types";

interface ConvertOptions {
  input?: string;
  output?: string;
  config?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export async function convertCommand(options: ConvertOptions): Promise<void> {
  try {
    // Load configuration (default → user → custom)
    const config = await loadConfig(options.config);

    // Override with CLI options
    if (options.input) {
      config.input.directory = options.input;
    }
    if (options.output) {
      config.output.directory = options.output;
    }
    if (options.verbose) {
      config.logging.level = "debug";
    }

    // TODO: Handle dry-run mode

    // Initialize context
    const ctx: ConversionContext = {
      config,
    };

    // Run conversion pipeline
    await modules.scan(ctx);
    await modules.process(ctx);
    await modules.resolve(ctx);
    await modules.stats(ctx);

    // Stats must be populated by stats module
    if (!ctx.stats) {
      throw new Error("Stats module failed to populate statistics");
    }

    // Display summary
    console.log("\n✅ Conversion complete!");
    console.log(`Files processed: ${ctx.stats.successful}/${ctx.stats.totalFiles}`);
    console.log(`Images downloaded: ${ctx.stats.imagesDownloaded}`);
    console.log(`Links resolved: ${ctx.stats.linksResolved}`);
    if (ctx.stats.duration) {
      console.log(`Duration: ${(ctx.stats.duration / 1000).toFixed(2)}s`);
    }
  } catch (error) {
    console.error("\n❌ Conversion failed:");
    console.error(error);
    process.exit(1);
  }
}
