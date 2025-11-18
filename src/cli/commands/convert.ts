/**
 * Convert command - Loads config and runs conversion pipeline
 */

import ora from "ora";
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
  const spinner = ora("Initializing...").start();

  try {
    // Load configuration (default → user → custom)
    const { config, errors } = await loadConfig(options.config);

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

    // Initialize context with config errors
    const ctx: ConversionContext = {
      config,
      errors: {
        files: [],
        images: [],
        resources: [...errors],
      },
    };

    // Run conversion pipeline with spinner updates
    spinner.text = "Scanning files...";
    await modules.scan(ctx);

    spinner.text = "Processing files...";
    await modules.process(ctx);

    spinner.text = "Resolving links...";
    await modules.resolve(ctx);

    spinner.text = "Building statistics...";
    await modules.stats(ctx);

    // Stats must be populated by stats module
    if (!ctx.stats) {
      throw new Error("Stats module failed to populate statistics");
    }

    // Complete spinner
    spinner.succeed("Conversion complete!");

    // Display summary
    console.log(
      `\nFiles processed: ${ctx.stats.successful}/${ctx.stats.totalFiles}`,
    );
    console.log(`Images downloaded: ${ctx.stats.imagesDownloaded}`);
    console.log(`Links resolved: ${ctx.stats.linksResolved}`);
    if (ctx.stats.duration) {
      console.log(`Duration: ${(ctx.stats.duration / 1000).toFixed(2)}s`);
    }

    // Display errors if any
    if (ctx.errors && ctx.errors.images.length > 0) {
      console.warn(
        `\n⚠️  ${ctx.errors.images.length} image(s) failed to download:`,
      );
      ctx.errors.images.forEach((err) => {
        console.warn(`  - ${err.path}`);
      });
    }

    if (ctx.errors && ctx.errors.files.length > 0) {
      console.error(
        `\n❌ ${ctx.errors.files.length} file(s) failed to process:`,
      );
      ctx.errors.files.forEach((err) => {
        console.error(`  - ${err.path}: ${err.error.message}`);
      });
    }

    if (ctx.errors && ctx.errors.resources.length > 0) {
      console.warn(
        `\n⚠️  ${ctx.errors.resources.length} resources(s) failed to load:`,
      );
      ctx.errors.resources.forEach((err) => {
        console.warn(`  - ${err.path}: ${err.error.message}`);
      });
    }
  } catch (error) {
    spinner.fail("Conversion failed");
    console.error(error);
    process.exit(1);
  }
}
