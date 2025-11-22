/**
 * Indexer Module
 * Generates entity indexes by fetching entity lists from D&D Beyond
 *
 * This module runs AFTER resolver has processed all files.
 * It fetches entity listing pages, parses them, and generates index files.
 *
 * Uses factory pattern with closure variables to avoid prop drilling.
 * Inner functions have shared access to config, tracker, mapping, etc.
 */

import { join } from "path";
import { writeFile } from "fs/promises";
import * as cheerio from "cheerio";
import type {
  ConversionContext,
  EntityIndexConfig,
  ParsedEntity,
  EntityType,
} from "../types";
import {
  loadIndexesMapping,
  saveIndexesMapping,
  fetchListingPage,
  formatFallback,
  resolveEntityUrl,
  getEntityTypeFromUrl,
  applyAliases,
} from "../utils";
import { getParser } from "../parsers";

/**
 * Resolved entity with local file link
 */
interface ResolvedEntity {
  name: string;
  url: string;
  metadata?: Record<string, string>;
  fileId?: string;
  anchor?: string;
  resolved: boolean;
}

/**
 * Run the indexer module
 */
export async function indexer(ctx: ConversionContext): Promise<void> {
  const { config } = ctx;

  // Skip if indexing is disabled
  if (!config.indexes.generate) {
    return;
  }

  // Skip if no entity indexes configured
  if (config.indexes.entities.length === 0) {
    return;
  }

  // ============================================================================
  // Shared State (closure variables)
  // ============================================================================

  const { tracker, entityIndex, idGenerator, sourcebooks } = ctx;

  // Load existing mapping
  const mappingPath = join(config.output, "indexes.json");
  const mapping = await loadIndexesMapping(mappingPath);

  // Register existing index IDs with the context's generator
  for (const filename of Object.values(mapping.mappings.entities)) {
    const id = filename.replace(".md", "");
    idGenerator.register(id);
  }

  if (mapping.mappings.global) {
    const globalId = mapping.mappings.global.replace(".md", "");
    idGenerator.register(globalId);
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Resolve parsed entities to local file links
   * Applies aliases at entry point, then uses resolveEntityUrl
   */
  function resolveEntities(entities: ParsedEntity[]): ResolvedEntity[] {
    return entities.map((entity) => {
      const url = applyAliases(entity.url, config.links.urlAliases);
      const match = resolveEntityUrl(url, ctx);

      if (match) {
        entityIndex?.set(url, match);
        return { ...entity, ...match, resolved: true };
      }

      return {
        ...entity,
        resolved: false,
      };
    });
  }

  /**
   * Detect the last page number from pagination items
   * Returns 1 if no pagination found
   */
  function detectLastPage(html: string): number {
    const $ = cheerio.load(html);
    const paginationItems = $(".b-pagination-item");

    if (paginationItems.length < 2) {
      return 1;
    }

    // Last page number is in the penultimate pagination item
    const penultimate = paginationItems.eq(-2);
    const lastPageText = penultimate.text().trim();
    const lastPage = parseInt(lastPageText, 10);

    return isNaN(lastPage) ? 1 : lastPage;
  }

  /**
   * Add or update the page parameter in a URL
   */
  function setPageParam(url: string, page: number): string {
    const urlObj = new URL(url);
    urlObj.searchParams.set("page", page.toString());
    return urlObj.toString();
  }

  /**
   * Fetch all pages for a listing URL and combine parsed entities
   */
  async function fetchAllPages(
    url: string,
    entityType: EntityType,
  ): Promise<ParsedEntity[]> {
    const parser = getParser(entityType);
    const allEntities: ParsedEntity[] = [];

    // Fetch first page
    const firstPageHtml = await fetchListingPage(url, {
      timeout: config.images.timeout,
      retries: config.images.retries,
    });

    // Parse first page
    const firstPageEntities = parser.parse(firstPageHtml);
    allEntities.push(...firstPageEntities);

    // Detect total pages
    const lastPage = detectLastPage(firstPageHtml);

    // Fetch remaining pages
    for (let page = 2; page <= lastPage; page++) {
      const pageUrl = setPageParam(url, page);
      const pageHtml = await fetchListingPage(pageUrl, {
        timeout: config.images.timeout,
        retries: config.images.retries,
      });

      const pageEntities = parser.parse(pageHtml);
      allEntities.push(...pageEntities);
    }

    return allEntities;
  }

  /**
   * Generate markdown for an entity index
   */
  function generateEntityIndexMarkdown(
    title: string,
    entities: ResolvedEntity[],
  ): string {
    const lines: string[] = [];

    lines.push(`# ${title}`);
    lines.push("");

    if (entities.length === 0) {
      lines.push("_No entities found._");
      lines.push("");
      return lines.join("\n");
    }

    // Generate list of entities
    for (const entity of entities) {
      if (entity.resolved && entity.fileId && entity.anchor) {
        // Resolved: link to local file
        lines.push(`- [${entity.name}](${entity.fileId}.md#${entity.anchor})`);
      } else {
        // Unresolved: use fallback style
        const text = formatFallback(entity.name, config);
        lines.push(`- ${text}`);
      }
    }

    lines.push("");
    return lines.join("\n");
  }

  /**
   * Process a single entity index configuration
   */
  async function processEntityIndex(
    index: EntityIndexConfig,
  ): Promise<{ title: string; filename: string } | null> {
    // If it has children, it's a parent index (skip for now - Phase 3)
    if (index.children) {
      // TODO: Phase 3 - Handle nested indexes
      return null;
    }

    // Must have a URL for entity indexes
    if (!index.url) {
      return null;
    }

    // Get entity type from URL
    const entityType = getEntityTypeFromUrl(index.url);
    if (!entityType) return null;

    // Get or assign filename
    let filename = mapping.mappings.entities[index.title];
    if (!filename) {
      filename = `${idGenerator.generate()}.md`;
      mapping.mappings.entities[index.title] = filename;
    }

    // Fetch and parse entities (use cache if available)
    let entities: ParsedEntity[];
    const cached = mapping.cache[index.url];

    if (!cached) {
      try {
        // Fetch all pages and combine entities
        entities = await fetchAllPages(index.url, entityType);
        const fetchedAt = new Date().toISOString();
        mapping.cache[index.url] = { fetchedAt, entities };
      } catch (error) {
        tracker.trackError(index.url, error, "resource");
        return null;
      }
    } else {
      entities = cached.entities;
    }

    // Resolve entities to local files
    const resolvedEntities = resolveEntities(entities);

    // Generate markdown
    const markdown = generateEntityIndexMarkdown(index.title, resolvedEntities);

    // Write file
    const outputPath = join(config.output, filename);
    try {
      await writeFile(outputPath, markdown, "utf-8");
      tracker.incrementCreatedIndexes();
      return { title: index.title, filename };
    } catch (error) {
      tracker.trackError(outputPath, error, "file");
      return null;
    }
  }

  /**
   * Generate global index linking to all sourcebooks and entity indexes
   */
  async function generateGlobalIndex(
    title: string,
    entityIndexes: Array<{ title: string; filename: string }>,
  ): Promise<void> {
    // Get or assign filename for global index
    let filename = mapping.mappings.global;
    if (!filename) {
      filename = `${idGenerator.generate()}.md`;
      mapping.mappings.global = filename;
    }

    const lines: string[] = [];

    lines.push(`# ${title}`);
    lines.push("");

    // Sourcebooks section
    if (sourcebooks && sourcebooks.length > 0) {
      lines.push("## Sourcebooks");
      lines.push("");
      for (const sb of sourcebooks) {
        lines.push(`- [${sb.title}](${sb.id}.md)`);
      }
      lines.push("");
    }

    // Entity indexes section
    if (entityIndexes.length > 0) {
      lines.push("## Entity Indexes");
      lines.push("");
      for (const idx of entityIndexes) {
        lines.push(`- [${idx.title}](${idx.filename})`);
      }
      lines.push("");
    }

    // Write file
    const outputPath = join(config.output, filename);
    try {
      await writeFile(outputPath, lines.join("\n"), "utf-8");
      tracker.incrementCreatedIndexes();
    } catch (error) {
      tracker.trackError(outputPath, error, "file");
    }
  }

  // ============================================================================
  // Main Orchestration
  // ============================================================================

  // Process entity indexes
  const generatedIndexes: Array<{ title: string; filename: string }> = [];

  for (const indexConfig of config.indexes.entities) {
    const result = await processEntityIndex(indexConfig);
    if (result) generatedIndexes.push(result);
  }

  // Generate global index if enabled
  if (config.indexes.global.enabled && generatedIndexes.length > 0) {
    await generateGlobalIndex(config.indexes.global.title, generatedIndexes);
  }

  // Save updated mapping
  await saveIndexesMapping(mappingPath, mapping);
}
