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
import {
  ConversionConfigSchema,
  PartialConversionConfigSchema,
} from "../types/config";
import { ErrorStats } from "../types/context";

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
 * Load default configuration with Zod validation
 */
export async function loadDefaultConfig(): Promise<ConversionConfig> {
  const defaultConfigPath = join(__dirname, "..", "config", "default.json");
  const content = await readFile(defaultConfigPath, "utf-8");
  const parsed = JSON.parse(content);
  return ConversionConfigSchema.parse(parsed);
}

/**
 * Load user configuration from OS-specific directory with Zod validation
 * Throws error if config exists but is invalid
 */
async function loadUserConfig(): Promise<Partial<ConversionConfig> | null> {
  const configDir = getConfigDirectory();
  const userConfigPath = join(configDir, "config.json");

  if (!existsSync(userConfigPath)) {
    return null;
  }

  const content = await readFile(userConfigPath, "utf-8");
  const parsed = JSON.parse(content);

  PartialConversionConfigSchema.parse(parsed);
  return parsed as Partial<ConversionConfig>;
}

/**
 * Load configuration from custom path with Zod validation
 * Throws error if config is invalid
 */
async function loadCustomConfig(
  configPath: string,
): Promise<Partial<ConversionConfig>> {
  const content = await readFile(configPath, "utf-8");
  const parsed = JSON.parse(content);

  PartialConversionConfigSchema.parse(parsed);
  return parsed as Partial<ConversionConfig>;
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
    ids: { ...base.ids, ...override.ids },
    markdown: { ...base.markdown, ...override.markdown },
    html: { ...base.html, ...override.html },
    images: { ...base.images, ...override.images },
    links: {
      ...base.links,
      ...override.links,
      // Deep merge urlMapping separately to allow adding/overriding individual mappings
      urlMapping: {
        ...base.links.urlMapping,
        ...override.links?.urlMapping,
      },
    },
    logging: { ...base.logging, ...override.logging },
  };
}

interface LoadConfigResult {
  config: ConversionConfig;
  errors: ErrorStats[];
}

/**
 * Load and merge configuration
 * Priority: custom path > user config > default config
 * Returns default config if any of the config files fail to load or validate
 */
export async function loadConfig(custom?: string): Promise<LoadConfigResult> {
  // Load default config
  let config = await loadDefaultConfig();
  let errors: ErrorStats[] = [];

  try {
    // Merge with user config from OS-specific directory
    const userConfig = await loadUserConfig();
    if (userConfig) config = mergeConfig(config, userConfig);
  } catch (error) {
    errors.push({ path: getUserConfigPath(), error: error as Error });
  }

  // Merge with custom config if provided
  if (custom) {
    try {
      const customConfig = await loadCustomConfig(custom);
      config = mergeConfig(config, customConfig);
    } catch (error) {
      errors.push({ path: custom, error: error as Error });
    }
  }

  return { config, errors };
}

/**
 * Get the path where user config should be stored
 */
export function getUserConfigPath(): string {
  return join(getConfigDirectory(), "config.json");
}
