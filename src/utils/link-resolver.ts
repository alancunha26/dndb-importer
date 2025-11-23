import type {
  ConversionConfig,
  ConversionContext,
  EntityMatch,
  FileDescriptor,
  SourcebookInfo,
} from "../types";
import type { Tracker } from "./tracker";
import { applyAliases } from "./apply-aliases";
import { isEntityUrl } from "./is-entity-url";
import { isSourceUrl } from "./is-source-url";
import { normalizeAnchor } from "./normalize-anchor";
import { findMatchingAnchor } from "./find-matching-anchor";
import { resolveEntityUrl } from "./resolve-entity-url";
import { shouldResolveUrl } from "./should-resolve-url";

/**
 * Unified link resolver for both entity and source URLs
 * Single source of truth for all link resolution, normalization, and formatting
 */
export class LinkResolver {
  private config: ConversionConfig;
  private tracker: Tracker;
  private files: FileDescriptor[];
  private sourcebooks: SourcebookInfo[];
  private urlMap: Map<string, FileDescriptor>;
  private fileIdMap: Map<string, FileDescriptor>;
  private excludeUrls: Set<string>;
  private entityIndex: Map<string, EntityMatch>;

  constructor(ctx: ConversionContext) {
    if (!ctx.files) {
      throw new Error(
        "Cannot create LinkResolver: files not available. " +
          "Processor must run before creating LinkResolver.",
      );
    }

    this.config = ctx.config;
    this.tracker = ctx.tracker;
    // Only use written files for resolution
    this.files = ctx.files.filter((f) => f.written);
    this.sourcebooks = ctx.sourcebooks ?? [];

    // Build URL map for source link resolution
    this.urlMap = new Map(
      this.files.filter((f) => f.url).map((f) => [f.url!, f]),
    );

    // Build file ID map for looking up files by uniqueId
    this.fileIdMap = new Map(this.files.map((f) => [f.uniqueId, f]));

    // Build exclude URLs set
    this.excludeUrls = new Set(this.config.links.excludeUrls);

    // Initialize and build entityIndex
    this.entityIndex = new Map();
    this.buildEntityIndex();
  }

  /**
   * Build entityIndex from all file entities
   * Called automatically in constructor
   */
  private buildEntityIndex(): void {
    for (const file of this.files) {
      if (!file.entities) continue;

      for (const entity of file.entities) {
        const match = this.resolveEntityInternal(entity.url);
        if (match) {
          this.entityIndex.set(entity.url, match);
        }
      }
    }
  }

  /**
   * Add an entity to the index
   * Used by indexer when resolving entities from listing pages
   */
  addEntity(url: string, match: EntityMatch): void {
    this.entityIndex.set(url, match);
  }

  /**
   * Get read-only access to the entity index
   */
  getEntityIndex(): ReadonlyMap<string, EntityMatch> {
    return this.entityIndex;
  }

  /**
   * Resolve a URL and return formatted markdown
   * Main method for resolving links
   * Also adds resolved entities to the entityIndex
   */
  resolveToMarkdown(url: string, text: string, fileId?: string): string {
    // Don't resolve external URLs, images, etc.
    if (!shouldResolveUrl(url)) {
      return `[${text}](${url})`;
    }

    // Handle internal anchors (same-page #links)
    if (url.startsWith("#") && fileId) {
      return this.resolveInternalAnchor(url.slice(1), text, fileId);
    }

    // Parse URL and apply aliases
    const { path, anchor } = this.parseAndAlias(url);

    // Check if URL is excluded
    if (this.excludeUrls.has(path)) {
      return this.formatUnresolvedMarkdown(url, text);
    }

    // Try to resolve the link
    let match: EntityMatch | null = null;

    if (isEntityUrl(path)) {
      match = this.resolveEntity(path, anchor);
    }

    if (isSourceUrl(path)) {
      match = this.resolveSource(path, anchor);
    }

    if (match) {
      this.entityIndex.set(path, match);
      return this.formatResolvedMarkdown(match, text, fileId);
    }

    return this.formatUnresolvedMarkdown(url, text);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Parse URL and apply aliases
   */
  private parseAndAlias(url: string): { path: string; anchor?: string } {
    let [path, anchor] = url.split("#");
    path = applyAliases(path, this.config.links.urlAliases);

    // Re-split in case alias value contains an anchor
    if (path.includes("#")) {
      const [newPath, newAnchor] = path.split("#");
      path = newPath;
      anchor = newAnchor;
    }

    return { path, anchor };
  }

  /**
   * Resolve internal anchor (same-page #link)
   */
  private resolveInternalAnchor(
    htmlId: string,
    text: string,
    fileId: string,
  ): string {
    const file = this.fileIdMap.get(fileId);
    if (!file?.anchors) {
      return `[${text}](#${htmlId})`;
    }

    const markdownAnchor = file.anchors.htmlIdToAnchor[htmlId];
    if (markdownAnchor) {
      this.tracker.incrementLinksResolved();
      // Convert internal --N notation to standard -N for markdown output
      const formattedAnchor = markdownAnchor.replace(/--(\d+)(?=\)|$)/g, "-$1");
      return `[${text}](#${formattedAnchor})`;
    }

    return `[${text}](#${htmlId})`;
  }

  /**
   * Format a resolved match as markdown
   */
  private formatResolvedMarkdown(
    match: EntityMatch,
    text: string,
    fileId?: string,
  ): string {
    this.tracker.incrementLinksResolved();

    // Convert internal --N notation to standard -N for markdown output
    const anchor = match.anchor.replace(/--(\d+)(?=\)|$)/g, "-$1");

    // If linking to same file, use just the anchor
    if (fileId && match.fileId === fileId) {
      return anchor ? `[${text}](#${anchor})` : `[${text}](#)`;
    }

    return anchor
      ? `[${text}](${match.fileId}.md#${anchor})`
      : `[${text}](${match.fileId}.md)`;
  }

  /**
   * Format an unresolved link using fallback style
   */
  private formatUnresolvedMarkdown(url: string, text: string): string {
    const fallback = this.formatFallback(text);
    if (fallback) {
      this.tracker.trackUnresolvedLink(url, text);
      return fallback;
    }
    // fallbackStyle: "none" - keep original link
    return `[${text}](${url})`;
  }

  /**
   * Format text using the configured fallback style
   */
  private formatFallback(text: string): string {
    switch (this.config.links.fallbackStyle) {
      case "bold":
        return `${this.config.markdown.strong}${text}${this.config.markdown.strong}`;
      case "italic":
        return `${this.config.markdown.emphasis}${text}${this.config.markdown.emphasis}`;
      case "plain":
        return text;
      case "none":
        return ""; // Signal to keep original link
      default:
        return `${this.config.markdown.strong}${text}${this.config.markdown.strong}`;
    }
  }

  // ============================================================================
  // Entity/Source Resolution Methods
  // ============================================================================

  /**
   * Resolve an entity URL (checks entityIndex first)
   */
  private resolveEntity(path: string, anchor?: string): EntityMatch | null {
    // First check entityIndex
    const existing = this.entityIndex.get(path);
    if (existing) {
      return {
        fileId: existing.fileId,
        anchor: anchor || existing.anchor,
      };
    }

    // Fall back to internal resolution
    const match = this.resolveEntityInternal(path);
    if (match) {
      return {
        fileId: match.fileId,
        anchor: anchor || match.anchor,
      };
    }

    return null;
  }

  /**
   * Internal entity resolution without checking entityIndex
   */
  private resolveEntityInternal(url: string): EntityMatch | null {
    // Create a minimal context for resolveEntityUrl
    const ctx: ConversionContext = {
      config: this.config,
      tracker: this.tracker,
      idGenerator: null as never,
      files: this.files,
    };

    return resolveEntityUrl(url, ctx);
  }

  /**
   * Resolve a source URL
   */
  private resolveSource(path: string, anchor?: string): EntityMatch | null {
    // No anchor - check for book-level or page-level match
    if (!anchor) {
      // Check if it's a sourcebook URL
      const sourcebook = this.sourcebooks.find((sb) => sb.bookUrl === path);
      if (sourcebook) {
        return {
          fileId: sourcebook.id,
          anchor: "",
        };
      }

      // Check URL map for page
      const targetFile = this.urlMap.get(path);
      if (targetFile) {
        return {
          fileId: targetFile.uniqueId,
          anchor: "",
        };
      }

      return null;
    }

    // Has anchor - look up in URL mapping
    const targetFile = this.urlMap.get(path);
    if (!targetFile) {
      return null;
    }

    const fileAnchors = targetFile.anchors;
    if (!fileAnchors) {
      return null;
    }

    // Priority 1: Direct HTML ID lookup
    let matchedAnchor: string | null | undefined =
      fileAnchors.htmlIdToAnchor[anchor];

    // Priority 2: Smart matching
    if (!matchedAnchor) {
      const normalized = normalizeAnchor(anchor);
      const result = findMatchingAnchor(
        normalized,
        fileAnchors.valid,
        this.config.links.maxMatchStep,
      );
      matchedAnchor = result?.anchor;
    }

    if (!matchedAnchor) {
      return null;
    }

    return {
      fileId: targetFile.uniqueId,
      anchor: matchedAnchor,
    };
  }
}
