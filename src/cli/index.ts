#!/usr/bin/env node

/**
 * CLI entry point for the D&D Beyond HTML to Markdown Converter
 * Handles command-line argument parsing and user interaction
 */

import { Command } from "commander";
import { convertCommand } from "./commands/convert";
import { configCommand } from "./commands/config";

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

program.parse();
