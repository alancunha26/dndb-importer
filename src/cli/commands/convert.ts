/**
 * Convert command - Loads config and runs converter
 */

import { loadConfig } from "../../utils/config";
import { Converter } from "../../converter";

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

    // Run conversion pipeline
    const converter = new Converter(config);
    const stats = await converter.run();

    // Display summary
    console.log("\n✅ Conversion complete!");
    console.log(`Files processed: ${stats.successful}/${stats.totalFiles}`);
    console.log(`Images downloaded: ${stats.imagesDownloaded}`);
    console.log(`Links resolved: ${stats.linksResolved}`);
    if (stats.duration) {
      console.log(`Duration: ${(stats.duration / 1000).toFixed(2)}s`);
    }
  } catch (error) {
    console.error("\n❌ Conversion failed:");
    console.error(error);
    process.exit(1);
  }
}
