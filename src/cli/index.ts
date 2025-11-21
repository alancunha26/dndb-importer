#!/usr/bin/env node

/**
 * CLI entry point for the D&D Beyond HTML to Markdown Converter
 * Handles command-line argument parsing and user interaction
 */

import { Command } from "commander";
import { convertCommand } from "./commands/convert";
import { configCommand } from "./commands/config";
import { extractCommand } from "./commands/extract";

const program = new Command();

program
  .name("dndb-convert")
  .description("Convert D&D Beyond HTML sourcebooks to Markdown")
  .version("0.1.0");

// Main conversion command (default action)
program
  .option("-i, --input <path>", "Input directory containing HTML files")
  .option("-o, --output <path>", "Output directory for Markdown files")
  .option("-c, --config <path>", "Path to custom config file")
  .option("--dry-run", "Preview conversion without writing files")
  .option("-v, --verbose", "Verbose output")
  .action(convertCommand);

// Config command - show config location
program
  .command("config")
  .description("Show configuration file location")
  .action(configCommand);

// Extract command - find entity URLs in HTML files
program
  .command("extract <input>")
  .description("Extract entity URLs from HTML files and add to urlAliases config")
  .option("--update", "Update default.json with missing entities")
  .option("--smart <output>", "Only show entities that failed to resolve (uses stats.json from output directory)")
  .option("--exclude <types...>", "Exclude specific entity types (e.g., --exclude monsters spells)")
  .action(extractCommand);

program.parse();
