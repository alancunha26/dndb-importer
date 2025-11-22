import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import envPaths from "env-paths";
import type { ConversionConfig, ConfigError } from "../types";
import {
  ConversionConfigSchema,
  PartialConversionConfigSchema,
} from "../types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const paths = envPaths("dndb-importer", { suffix: "" });

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

async function loadCustomConfig(
  configPath: string,
): Promise<Partial<ConversionConfig>> {
  const content = await readFile(configPath, "utf-8");
  const parsed = JSON.parse(content);

  PartialConversionConfigSchema.parse(parsed);
  return parsed as Partial<ConversionConfig>;
}

function mergeConfig(
  base: ConversionConfig,
  override: Partial<ConversionConfig>,
): ConversionConfig {
  return {
    ...base,
    ...override,
    input: override.input ?? base.input,
    output: override.output ?? base.output,
    ids: { ...base.ids, ...override.ids },
    markdown: { ...base.markdown, ...override.markdown },
    html: { ...base.html, ...override.html },
    images: { ...base.images, ...override.images },
    links: {
      ...base.links,
      ...override.links,
      urlAliases: {
        ...base.links.urlAliases,
        ...override.links?.urlAliases,
      },
    },
    indexes: {
      ...base.indexes,
      ...override.indexes,
      global: {
        ...base.indexes.global,
        ...override.indexes?.global,
      },
      entities: override.indexes?.entities ?? base.indexes.entities,
    },
  };
}

interface LoadConfigResult {
  config: ConversionConfig;
  errors: ConfigError[];
}

/**
 * Load and merge configuration
 * Priority: custom path > user config > default config
 */
export async function loadConfig(custom?: string): Promise<LoadConfigResult> {
  let config = await loadDefaultConfig();
  let errors: ConfigError[] = [];

  try {
    const userConfig = await loadUserConfig();
    if (userConfig) config = mergeConfig(config, userConfig);
  } catch (error) {
    errors.push({ path: getUserConfigPath(), error });
  }

  if (custom) {
    try {
      const customConfig = await loadCustomConfig(custom);
      config = mergeConfig(config, customConfig);
    } catch (error) {
      errors.push({ path: custom, error });
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
