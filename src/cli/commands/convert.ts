/**
 * Convert command - Loads config and runs conversion pipeline
 */

import ora from "ora";
import { z } from "zod";
import { loadConfig, Tracker } from "../../utils";
import * as modules from "../../modules";
import type { ConversionContext } from "../../types";

const ConvertOptionsSchema = z.object({
  input: z.string().optional(),
  output: z.string().optional(),
  config: z.string().optional(),
  dryRun: z.boolean().optional(),
  verbose: z.boolean().optional(),
});

type Options = z.infer<typeof ConvertOptionsSchema>;

export async function convertCommand(opts: Options): Promise<void> {
  const spinner = ora({ text: "Initializing...", indent: 2 }).start();

  try {
    // Validate CLI options
    const options = ConvertOptionsSchema.parse(opts);

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

    // Initialize tracker and context
    const tracker = new Tracker(config);

    // Add any config loading errors to tracker
    for (const err of errors) {
      tracker.trackError(err.path, err.error, "resource");
    }

    const ctx: ConversionContext = {
      config,
      tracker,
    };

    // Run conversion pipeline with spinner updates
    spinner.text = "Scanning files...";
    await modules.scan(ctx);

    spinner.text = "Processing files...";
    await modules.process(ctx);

    spinner.text = "Resolving links...";
    await modules.resolve(ctx);

    // Clear and stop spinner before displaying stats
    spinner.clear();
    spinner.stop();

    // Display stats
    modules.stats(tracker, options.verbose ?? false);
  } catch (error) {
    spinner.fail("Conversion failed");
    console.error(error);
    process.exit(1);
  }
}
