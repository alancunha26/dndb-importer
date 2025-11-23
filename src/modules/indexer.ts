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
  GlobalIndexTemplateContext,
} from "../types";
import {
  loadIndexesMapping,
  saveIndexesMapping,
  fetchListingPage,
  getEntityTypeFromUrl,
  loadTemplate,
  getDefaultEntityIndexTemplate,
  getDefaultGlobalIndexTemplate,
} from "../utils";
import { getParser } from "../parsers";

/**
 * Index file reference (title + filename)
 */
interface IndexInfo {
  title: string;
  filename: string;
}

/**
 * Resolved entity with local file link
 */
interface ResolvedEntity {
  name: string;
  url: string;
  metadata?: Record<string, string>;
  link: string;
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

  const { tracker, idGenerator, sourcebooks } = ctx;

  if (!ctx.linkResolver) {
    throw new Error("LinkResolver must be created by resolver before indexer");
  }

  const linkResolver = ctx.linkResolver;

  // Current date for frontmatter
  const date = new Date().toISOString().split("T")[0];

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
  const globalIndexTemplate = await loadTemplate(
    globalTemplates?.globalIndex ?? null,
    getDefaultGlobalIndexTemplate(config.markdown),
  );

  /**
   * Parse filter parameters from URL
   * Extracts all filter-* parameters and converts to camelCase keys
   */
  function parseUrlFilters(url: string): Record<string, string> {
    const urlObj = new URL(url);
    const filters: Record<string, string> = {};

    for (const [key, value] of urlObj.searchParams.entries()) {
      if (key.startsWith("filter-")) {
        // Convert filter-school to school, filter-partnered-content to partneredContent
        const filterName = key
          .replace("filter-", "")
          .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        filters[filterName] = value;
      }
    }

    return filters;
  }

  /**
   * Apply source filters to URL if not already present
   * When URL doesn't have filter-source, add filters for all converted sourcebooks
   * Always includes source 148 (Basic Rules 2024) for core entities
   */
  function applySourceFilters(url: string): string {
    const urlObj = new URL(url);

    // If URL already has filter-source, don't modify it
    if (urlObj.searchParams.has("filter-source")) {
      return url;
    }

    // Always include Basic Rules 2024 (148) plus available sourcebooks
    const sourceIds = new Set([148, ...availableSourceIds]);
    const sortedIds = [...sourceIds].sort((a, b) => a - b);

    // Add filter-source for each sourcebook (sorted for consistent cache keys)
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
   * Uses LinkResolver to handle aliasing, exclusions, and both entity/source URLs
   * Tracks resolved/unresolved statistics
   */
  function resolveEntities(entities: ParsedEntity[]): ResolvedEntity[] {
    return entities.map((entity) => {
      const link = linkResolver.resolve(entity.url, entity.name);
      const resolved = link.includes(".md");
      return { ...entity, link, resolved };
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
   * Generate markdown for an index using template
   * Supports both children (subcategories) and entities (from URL)
   */
  function generateIndexMarkdown(
    title: string,
    description: string | undefined,
    options: {
      entityType?: EntityType;
      entities?: ResolvedEntity[];
      filters?: Record<string, string>;
      children?: IndexInfo[];
      parent?: IndexInfo;
    },
  ): string {
    const context: EntityIndexTemplateContext = {
      date,
      title,
      description,
      filters: options.filters,
      parent: options.parent,
      children: options.children,
      type: options.entityType,
      entities: options.entities?.map((e) => ({
        url: e.url,
        name: e.name,
        link: e.link,
        metadata: e.metadata,
        resolved: e.resolved,
      })),
    };

    return entityIndexTemplate(context);
  }

  /**
   * Process an index configuration recursively
   * Handles both children (subcategories) and URL (entities)
   * Returns the processed index info, or null if failed
   */
  async function processIndex(
    index: EntityIndexConfig,
    parent?: IndexInfo,
  ): Promise<IndexInfo | null> {
    // Get or assign filename
    let filename = mapping.mappings.entities[index.title];
    if (!filename) {
      filename = `${idGenerator.generate()}.md`;
      mapping.mappings.entities[index.title] = filename;
    }

    // Process children recursively if any
    let childResults: IndexInfo[] | undefined;
    if (index.children && index.children.length > 0) {
      childResults = [];
      const currentAsParent: IndexInfo = { title: index.title, filename };
      for (const child of index.children) {
        const result = await processIndex(child, currentAsParent);
        if (result) childResults.push(result);
      }
    }

    // Process URL/entities if present
    let resolvedEntities: ResolvedEntity[] | undefined;
    let entityType: EntityType | undefined;
    let filters: Record<string, string> | undefined;

    if (index.url) {
      entityType = getEntityTypeFromUrl(index.url) ?? undefined;
      if (entityType) {
        // Parse filters from original URL (before adding source filters)
        filters = parseUrlFilters(index.url);

        // Apply source filters if not already present
        const fetchUrl = applySourceFilters(index.url);

        // Fetch and parse entities (use cache if available)
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

            // Track fetched entities
            tracker.incrementFetchedEntities(entities.length);
          } catch (error) {
            tracker.trackError(fetchUrl, error, "resource");
            // Continue with children only if URL fetch fails
            entities = [];
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

          // Track cached entities
          tracker.incrementCachedEntities(entities.length);
        }

        // Resolve entities to local files
        resolvedEntities = resolveEntities(entities);
      }
    }

    // Must have either children or entities
    if (!childResults && !resolvedEntities) {
      return null;
    }

    // Generate markdown with both children and entities
    const markdown = generateIndexMarkdown(index.title, index.description, {
      entityType,
      entities: resolvedEntities,
      filters,
      children: childResults,
      parent,
    });

    // Write file
    const outputPath = join(config.output, filename);
    try {
      await writeFile(outputPath, markdown, "utf-8");
      tracker.incrementEntityIndexes();
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
    entityIndexes: IndexInfo[],
  ): Promise<void> {
    // Use pre-assigned filename (set during parent determination)
    const filename = mapping.mappings.global;
    if (!filename) {
      // This shouldn't happen as filename is set before processing
      return;
    }

    // Build template context
    // Sort sourcebooks by sourceId for consistent ordering
    const sortedSourcebooks = [...(sourcebooks ?? [])].sort((a, b) => {
      const idA = a.metadata.sourceId ?? Infinity;
      const idB = b.metadata.sourceId ?? Infinity;
      return idA - idB;
    });

    const context: GlobalIndexTemplateContext = {
      title,
      date,
      entityIndexes,
      sourcebooks: sortedSourcebooks.map((sb) => ({
        title: sb.title,
        id: sb.id,
      })),
    };

    // Render template
    const markdown = globalIndexTemplate(context);

    // Write file
    const outputPath = join(config.output, filename);
    try {
      await writeFile(outputPath, markdown, "utf-8");
      tracker.incrementEntityIndexes();
    } catch (error) {
      tracker.trackError(outputPath, error, "file");
    }
  }

  /**
   * Get or create global index as parent for top-level entity indexes
   */
  function getGlobalParent(): IndexInfo | undefined {
    if (!config.indexes.global.enabled) {
      return undefined;
    }

    let filename = mapping.mappings.global;
    if (!filename) {
      filename = `${idGenerator.generate()}.md`;
      mapping.mappings.global = filename;
    }

    return { title: config.indexes.global.title, filename };
  }

  // ============================================================================
  // Main Orchestration
  // ============================================================================

  // Process all entity indexes
  const globalParent = getGlobalParent();
  const generatedIndexes: IndexInfo[] = [];

  for (const indexConfig of config.indexes.entities) {
    const result = await processIndex(indexConfig, globalParent);
    if (result) generatedIndexes.push(result);
  }

  // Generate global index if enabled
  if (globalParent && generatedIndexes.length > 0) {
    await generateGlobalIndex(globalParent.title, generatedIndexes);
  }

  // Save updated mapping
  await saveIndexesMapping(mappingPath, mapping);
}
