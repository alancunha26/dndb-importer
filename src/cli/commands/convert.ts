/**
 * Convert command - Loads config and runs conversion pipeline
 */

import ora from "ora";
import { z } from "zod";
import { loadConfig, Tracker, IdGenerator } from "../../utils";
import * as modules from "../../modules";
import type { ConversionContext } from "../../types";

const ConvertOptionsSchema = z.object({
  input: z.string().optional(),
  output: z.string().optional(),
  config: z.string().optional(),
  dryRun: z.boolean().optional(),
  verbose: z.boolean().optional(),
  refetch: z.boolean().optional(),
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
      config.input = options.input;
    }
    if (options.output) {
      config.output = options.output;
    }

    // Initialize tracker and ID generator
    const tracker = new Tracker();
    const idGenerator = new IdGenerator();

    // Add any config loading errors to tracker
    for (const err of errors) {
      tracker.trackError(err.path, err.error, "resource");
    }

    const ctx: ConversionContext = {
      config,
      tracker,
      idGenerator,
      verbose: options.verbose,
      refetch: options.refetch,
    };

    // Run conversion pipeline with spinner updates
    spinner.text = "Scanning files...";
    await modules.scan(ctx);

    spinner.text = "Processing files...";
    await modules.process(ctx);

    spinner.text = "Generating indexes...";
    await modules.indexer(ctx);

    spinner.text = "Resolving links...";
    await modules.resolve(ctx);

    // Clear and stop spinner before displaying stats
    spinner.clear();
    spinner.stop();

    // Export and display stats
    await modules.stats(ctx);
  } catch (error) {
    spinner.fail("Conversion failed");
    console.error(error);
    process.exit(1);
  }
}
