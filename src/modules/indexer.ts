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
  EntityIndexTemplateContext,
  ParentIndexTemplateContext,
  GlobalIndexTemplateContext,
} from "../types";
import {
  loadIndexesMapping,
  saveIndexesMapping,
  fetchListingPage,
  resolveEntityUrl,
  getEntityTypeFromUrl,
  applyAliases,
  loadTemplate,
  getDefaultEntityIndexTemplate,
  getDefaultParentIndexTemplate,
  getDefaultGlobalIndexTemplate,
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
  const { config, refetch } = ctx;

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

  // Collect sourceIds from converted sourcebooks for auto-filtering
  const availableSourceIds: number[] = [];
  if (sourcebooks) {
    for (const sb of sourcebooks) {
      if (sb.metadata.sourceId) {
        availableSourceIds.push(sb.metadata.sourceId);
      }
    }
  }

  // Load templates (global templates from context, or use defaults)
  const globalTemplates = ctx.globalTemplates;
  const entityIndexTemplate = await loadTemplate(
    globalTemplates?.entityIndex ?? null,
    getDefaultEntityIndexTemplate(config.markdown),
  );
  const parentIndexTemplate = await loadTemplate(
    globalTemplates?.parentIndex ?? null,
    getDefaultParentIndexTemplate(config.markdown),
  );
  const globalIndexTemplate = await loadTemplate(
    globalTemplates?.globalIndex ?? null,
    getDefaultGlobalIndexTemplate(config.markdown),
  );

  /**
   * Apply source filters to URL if not already present
   * When URL doesn't have filter-source, add filters for all converted sourcebooks
   */
  function applySourceFilters(url: string): string {
    const urlObj = new URL(url);

    // If URL already has filter-source, don't modify it
    if (urlObj.searchParams.has("filter-source")) {
      return url;
    }

    // If no sourceIds available, return original URL
    if (availableSourceIds.length === 0) {
      return url;
    }

    // Add filter-source for each available sourcebook (sorted for consistent cache keys)
    const sortedIds = [...availableSourceIds].sort((a, b) => a - b);
    for (const sourceId of sortedIds) {
      urlObj.searchParams.append("filter-source", sourceId.toString());
    }

    return urlObj.toString();
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Resolve parsed entities to local file links
   * Applies aliases at entry point, then uses resolveEntityUrl
   * Tracks resolved/unresolved statistics
   */
  function resolveEntities(entities: ParsedEntity[]): ResolvedEntity[] {
    return entities.map((entity) => {
      const url = applyAliases(entity.url, config.links.urlAliases);
      const match = resolveEntityUrl(url, ctx);

      if (match) {
        entityIndex?.set(url, match);
        tracker.incrementLinksResolved();
        return { ...entity, ...match, resolved: true };
      }

      tracker.trackUnresolvedLink(entity.url, entity.name);
      return { ...entity, resolved: false };
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
   * Generate markdown for an entity index using template
   */
  function generateEntityIndexMarkdown(
    title: string,
    description: string | undefined,
    entityType: EntityType,
    entities: ResolvedEntity[],
  ): string {
    const context: EntityIndexTemplateContext = {
      title,
      description,
      type: entityType,
      entities: entities.map((e) => ({
        name: e.name,
        url: e.url,
        metadata: e.metadata,
        fileId: e.fileId,
        anchor: e.anchor,
        resolved: e.resolved,
      })),
    };

    return entityIndexTemplate(context);
  }

  /**
   * Generate markdown for a parent index using template
   */
  function generateParentIndexMarkdown(
    title: string,
    description: string | undefined,
    children: Array<{ title: string; filename: string }>,
  ): string {
    const context: ParentIndexTemplateContext = {
      title,
      description,
      children,
    };

    return parentIndexTemplate(context);
  }

  /**
   * Process an index configuration recursively
   * Returns the processed index info, or null if failed
   */
  async function processIndexRecursive(
    index: EntityIndexConfig,
  ): Promise<{ title: string; filename: string } | null> {
    // Get or assign filename
    let filename = mapping.mappings.entities[index.title];
    if (!filename) {
      filename = `${idGenerator.generate()}.md`;
      mapping.mappings.entities[index.title] = filename;
    }

    // If it has children, it's a parent index
    if (index.children && index.children.length > 0) {
      // Process all children recursively
      const childResults: Array<{ title: string; filename: string }> = [];
      for (const child of index.children) {
        const result = await processIndexRecursive(child);
        if (result) childResults.push(result);
      }

      // Generate parent index markdown
      const markdown = generateParentIndexMarkdown(
        index.title,
        index.description,
        childResults,
      );

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

    // Must have a URL for entity indexes
    if (!index.url) {
      return null;
    }

    // It's an entity index - process it
    return processEntityIndex(index, filename);
  }

  /**
   * Process a single entity index configuration
   */
  async function processEntityIndex(
    index: EntityIndexConfig,
    filename: string,
  ): Promise<{ title: string; filename: string } | null> {
    // Must have a URL for entity indexes
    if (!index.url) {
      return null;
    }

    // Get entity type from URL
    const entityType = getEntityTypeFromUrl(index.url);
    if (!entityType) return null;

    // Apply source filters if not already present
    const fetchUrl = applySourceFilters(index.url);

    // Fetch and parse entities (use cache if available)
    // Cache key is the filtered URL to ensure consistency
    let entities: ParsedEntity[];
    const cached = mapping.cache[fetchUrl];

    if (!cached || refetch) {
      try {
        // Fetch all pages and combine entities
        entities = await fetchAllPages(fetchUrl, entityType);
        const fetchedAt = new Date().toISOString();

        // Store entities in global entities map (deduplicated by URL)
        const entityUrls: string[] = [];
        for (const entity of entities) {
          entityUrls.push(entity.url);
          mapping.entities[entity.url] = {
            name: entity.name,
            metadata: entity.metadata,
          };
        }

        // Cache stores only the URL references
        mapping.cache[fetchUrl] = { fetchedAt, entityUrls };
      } catch (error) {
        tracker.trackError(fetchUrl, error, "resource");
        return null;
      }
    } else {
      // Reconstruct entities from global entities map
      entities = [];
      for (const url of cached.entityUrls) {
        const stored = mapping.entities[url];
        if (stored) {
          entities.push({
            url,
            name: stored.name,
            metadata: stored.metadata,
          });
        }
      }
    }

    // Resolve entities to local files
    const resolvedEntities = resolveEntities(entities);

    // Generate markdown
    const markdown = generateEntityIndexMarkdown(
      index.title,
      index.description,
      entityType,
      resolvedEntities,
    );

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

    // Build template context
    const context: GlobalIndexTemplateContext = {
      title,
      sourcebooks: sourcebooks
        ? sourcebooks.map((sb) => ({
            title: sb.title,
            id: sb.id,
          }))
        : [],
      entityIndexes,
    };

    // Render template
    const markdown = globalIndexTemplate(context);

    // Write file
    const outputPath = join(config.output, filename);
    try {
      await writeFile(outputPath, markdown, "utf-8");
      tracker.incrementCreatedIndexes();
    } catch (error) {
      tracker.trackError(outputPath, error, "file");
    }
  }

  // ============================================================================
  // Main Orchestration
  // ============================================================================

  // Process entity indexes (only root-level indexes go to global index)
  const generatedIndexes: Array<{ title: string; filename: string }> = [];

  for (const indexConfig of config.indexes.entities) {
    const result = await processIndexRecursive(indexConfig);
    if (result) generatedIndexes.push(result);
  }

  // Generate global index if enabled
  if (config.indexes.global.enabled && generatedIndexes.length > 0) {
    await generateGlobalIndex(config.indexes.global.title, generatedIndexes);
  }

  // Save updated mapping
  await saveIndexesMapping(mappingPath, mapping);
}
