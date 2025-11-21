/**
 * CLI command for extracting entity URLs from HTML files
 * and identifying missing entries in urlAliases config.
 */

import * as fs from "fs";
import * as path from "path";
import fg from "fast-glob";
import chalk from "chalk";
import { loadConfig } from "../../utils/load-config";
import { ENTITY_TYPES } from "../../types";

// Regex to match entity URLs in href attributes
const ENTITY_URL_REGEX = new RegExp(
  `href="/(${ENTITY_TYPES.join("|")})/([^"]+)"`,
  "g",
);

interface ExtractedEntity {
  type: string;
  id: string;
  slug: string;
  url: string;
}

interface ExtractEntitiesOptions {
  update?: boolean;
  smart?: string; // Path to output directory with stats.json
}

interface StatsJson {
  unresolvedLinks: Array<{ path: string; text: string }>;
}

async function loadUnresolvedLinks(outputPath: string): Promise<Set<string>> {
  const statsPath = path.join(outputPath, "stats.json");

  if (!fs.existsSync(statsPath)) {
    throw new Error(
      `stats.json not found at ${statsPath}. Run the converter first.`,
    );
  }

  const content = await fs.promises.readFile(statsPath, "utf-8");
  const stats: StatsJson = JSON.parse(content);

  // Extract unique paths from unresolved links
  const unresolvedPaths = new Set<string>();
  for (const link of stats.unresolvedLinks) {
    unresolvedPaths.add(link.path);
  }

  return unresolvedPaths;
}

function parseEntityUrl(urlPath: string): ExtractedEntity | null {
  const match = urlPath.match(/^\/([^/]+)\/(.+)$/);
  if (!match) return null;

  const [, type, rest] = match;

  // Skip tooltip URLs
  if (rest.endsWith("-tooltip") || rest === "tooltip") {
    return null;
  }

  const idMatch = rest.match(/^(\d+)-(.+)$/);

  if (idMatch) {
    return {
      type,
      id: idMatch[1],
      slug: idMatch[2],
      url: urlPath,
    };
  }

  // Handle URLs without numeric IDs (rare)
  return {
    type,
    id: "",
    slug: rest,
    url: urlPath,
  };
}

async function extractEntitiesFromFile(
  filePath: string,
): Promise<ExtractedEntity[]> {
  const content = await fs.promises.readFile(filePath, "utf-8");
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = ENTITY_URL_REGEX.exec(content)) !== null) {
    const type = match[1];
    const rest = match[2];
    const url = `/${type}/${rest}`;

    if (seen.has(url)) continue;
    seen.add(url);

    const entity = parseEntityUrl(url);
    if (entity) {
      entities.push(entity);
    }
  }

  return entities;
}

async function saveConfig(
  configPath: string,
  config: Record<string, unknown>,
): Promise<void> {
  await fs.promises.writeFile(
    configPath,
    JSON.stringify(config, null, 2) + "\n",
  );
}

export async function extractCommand(
  inputPath: string,
  options: ExtractEntitiesOptions,
): Promise<void> {
  const shouldUpdate = options.update ?? false;
  const smartMode = options.smart;

  console.log(chalk.cyan("\nExtract Entity URLs"));
  console.log(chalk.gray("─".repeat(60)));
  console.log(`Scanning: ${chalk.white(inputPath)}`);
  if (smartMode) {
    console.log(
      `Smart mode: ${chalk.cyan("enabled")} (using ${smartMode}/stats.json)`,
    );
  }
  console.log(
    `Update config: ${shouldUpdate ? chalk.green("yes") : chalk.yellow("no (dry run)")}\n`,
  );

  // Load unresolved links if in smart mode
  let unresolvedPaths: Set<string> | null = null;
  if (smartMode) {
    try {
      unresolvedPaths = await loadUnresolvedLinks(smartMode);
      console.log(
        `Loaded ${chalk.white(unresolvedPaths.size)} unresolved link paths from stats.json\n`,
      );
    } catch (error) {
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  }

  // Find all HTML files
  const pattern = path.join(inputPath, "**/*.html").replace(/\\/g, "/");
  const htmlFiles = await fg(pattern, { absolute: true });

  if (htmlFiles.length === 0) {
    console.error(chalk.red(`No HTML files found in ${inputPath}`));
    process.exit(1);
  }

  console.log(`Found ${chalk.white(htmlFiles.length)} HTML files\n`);

  // Extract entities from all files
  const allEntities: ExtractedEntity[] = [];
  for (const file of htmlFiles) {
    const entities = await extractEntitiesFromFile(file);
    allEntities.push(...entities);
  }

  // Deduplicate by URL
  const uniqueEntities = new Map<string, ExtractedEntity>();
  for (const entity of allEntities) {
    if (!uniqueEntities.has(entity.url)) {
      uniqueEntities.set(entity.url, entity);
    }
  }

  // Load existing config
  const configResult = await loadConfig();
  const existingAliases = configResult.config.links.urlAliases;

  // Find missing entities
  const existingUrls = new Set([
    ...Object.keys(existingAliases),
    ...Object.values(existingAliases),
  ]);

  const missingEntities: ExtractedEntity[] = [];
  for (const entity of uniqueEntities.values()) {
    // Skip if already in urlAliases
    if (existingUrls.has(entity.url)) {
      continue;
    }

    // In smart mode, only include entities that actually failed to resolve
    if (unresolvedPaths) {
      if (unresolvedPaths.has(entity.url)) {
        missingEntities.push(entity);
      }
    } else {
      // In normal mode, include all entities not in urlAliases
      missingEntities.push(entity);
    }
  }

  // Sort by type and then by slug
  missingEntities.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.slug.localeCompare(b.slug);
  });

  // Group by type for display
  const byType = new Map<string, ExtractedEntity[]>();
  for (const entity of missingEntities) {
    if (!byType.has(entity.type)) {
      byType.set(entity.type, []);
    }
    byType.get(entity.type)!.push(entity);
  }

  // Display results
  console.log(chalk.gray("=".repeat(60)));
  console.log(
    `Total unique entities found: ${chalk.white(uniqueEntities.size)}`,
  );
  console.log(
    `Missing from urlAliases: ${missingEntities.length > 0 ? chalk.yellow(missingEntities.length) : chalk.green(missingEntities.length)}`,
  );
  console.log(chalk.gray("=".repeat(60)));

  if (missingEntities.length === 0) {
    console.log(chalk.green("\n✓ All entities are already in urlAliases!\n"));
    return;
  }

  console.log("\nMissing entities by type:\n");

  for (const [type, entities] of byType) {
    console.log(chalk.cyan(`\n## ${type} (${entities.length})\n`));
    for (const entity of entities) {
      console.log(chalk.gray(`  "${entity.url}": "",`));
    }
  }

  // Update config if requested
  if (shouldUpdate) {
    console.log(chalk.cyan("\n\nUpdating default.json...\n"));

    // Load raw config file to preserve structure
    const configPath = path.join(process.cwd(), "src/config/default.json");
    const rawConfig = JSON.parse(
      await fs.promises.readFile(configPath, "utf-8"),
    );

    for (const entity of missingEntities) {
      rawConfig.links.urlAliases[entity.url] = "";
    }

    await saveConfig(configPath, rawConfig);
    console.log(
      chalk.green(
        `✓ Added ${missingEntities.length} new entries to urlAliases\n`,
      ),
    );
  } else {
    console.log(
      chalk.yellow(
        "\nRun with --update to add these entries to default.json\n",
      ),
    );
  }
}
