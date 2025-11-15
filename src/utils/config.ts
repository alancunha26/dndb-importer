/**
 * Configuration Loader
 * Loads and merges configuration from defaults and user config
 */

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import envPaths from "env-paths";
import type { ConversionConfig } from "../types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get OS-specific paths using env-paths (follows XDG spec on Linux)
const paths = envPaths("dndbeyond-importer", { suffix: "" });

/**
 * Get the OS-specific config directory
 * - Linux: $XDG_CONFIG_HOME/dndbeyond-importer or ~/.config/dndbeyond-importer
 * - macOS: ~/Library/Preferences/dndbeyond-importer
 * - Windows: %APPDATA%\dndbeyond-importer
 */
function getConfigDirectory(): string {
  return paths.config;
}

/**
 * Load default configuration
 */
async function loadDefaultConfig(): Promise<ConversionConfig> {
  const defaultConfigPath = join(__dirname, "..", "config", "default.json");
  const content = await readFile(defaultConfigPath, "utf-8");
  return JSON.parse(content) as ConversionConfig;
}

/**
 * Load user configuration from OS-specific directory
 */
async function loadUserConfig(): Promise<Partial<ConversionConfig> | null> {
  const configDir = getConfigDirectory();
  const userConfigPath = join(configDir, "config.json");

  if (!existsSync(userConfigPath)) {
    return null;
  }

  try {
    const content = await readFile(userConfigPath, "utf-8");
    return JSON.parse(content) as Partial<ConversionConfig>;
  } catch (error) {
    console.warn(`Failed to load user config from ${userConfigPath}:`, error);
    return null;
  }
}

/**
 * Load configuration from custom path
 */
async function loadCustomConfig(
  configPath: string,
): Promise<Partial<ConversionConfig>> {
  const content = await readFile(configPath, "utf-8");
  return JSON.parse(content) as Partial<ConversionConfig>;
}

/**
 * Deep merge two objects
 */
function mergeConfig(
  base: ConversionConfig,
  override: Partial<ConversionConfig>,
): ConversionConfig {
  return {
    ...base,
    ...override,
    input: { ...base.input, ...override.input },
    output: { ...base.output, ...override.output },
    conversion: { ...base.conversion, ...override.conversion },
    dndbeyond: { ...base.dndbeyond, ...override.dndbeyond },
    media: { ...base.media, ...override.media },
    crossReferences: { ...base.crossReferences, ...override.crossReferences },
    logging: { ...base.logging, ...override.logging },
  };
}

/**
 * Load and merge configuration
 * Priority: custom path > user config > default config
 */
export async function loadConfig(
  customConfigPath?: string,
): Promise<ConversionConfig> {
  // Load default config
  let config = await loadDefaultConfig();

  // Merge with user config from OS-specific directory
  const userConfig = await loadUserConfig();
  if (userConfig) {
    config = mergeConfig(config, userConfig);
  }

  // Merge with custom config if provided
  if (customConfigPath) {
    const customConfig = await loadCustomConfig(customConfigPath);
    config = mergeConfig(config, customConfig);
  }

  return config;
}

/**
 * Get the path where user config should be stored
 */
export function getUserConfigPath(): string {
  return join(getConfigDirectory(), "config.json");
}
