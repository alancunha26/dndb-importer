import type {
  ConversionConfig,
  ConversionContext,
  EntityMatch,
  FileDescriptor,
  SourcebookInfo,
  EntityType,
} from "../types";
import { ENTITY_TYPES } from "../types";
import type { Tracker } from "./tracker";
import { findMatchingAnchor } from "./find-matching-anchor";
import { getEntityTypeFromUrl } from "./get-entity-type-from-url";

// Patterns for URL classification
const ENTITY_PATH_PATTERN = new RegExp(`^\\/(${ENTITY_TYPES.join("|")})\\/`);
const SOURCE_URL_PATTERN = /^\/sources\//;
const LOCAL_MD_FILE_PATTERN = /^[a-z0-9]{4}\.md/;

/**
 * Unified link resolver for both entity and source URLs
 * Single source of truth for all link resolution, normalization, and formatting
 */
export class LinkResolver {
  private config: ConversionConfig;
  private tracker: Tracker;
  private files: FileDescriptor[];
  private fileUrlMap: Map<string, FileDescriptor>;
  private bookUrlMap: Map<string, SourcebookInfo>;
  private fileIdMap: Map<string, FileDescriptor>;
  private entityIndex: Map<string, EntityMatch>;
  private excludeUrls: Set<string>;

  constructor(ctx: ConversionContext) {
    if (!ctx.files) {
      throw new Error(
        "Cannot create LinkResolver: files not available. " +
          "Processor must run before creating LinkResolver.",
      );
    }

    this.config = ctx.config;
    this.tracker = ctx.tracker;
    this.files = ctx.files.filter((f) => f.written);

    // Build lookup maps with aliased URLs (normalize all URLs upfront)
    this.fileIdMap = new Map(this.files.map((f) => [f.uniqueId, f]));
    this.excludeUrls = new Set(this.config.links.excludeUrls);

    // URL map: aliased page URL -> file
    const filesUrl = this.files.filter((f) => f.url);
    this.fileUrlMap = new Map(filesUrl.map((f) => [this.getAlias(f.url!), f]));

    // Book URL map: aliased book URL -> sourcebook
    const books = (ctx.sourcebooks ?? []).filter((sb) => sb.bookUrl);
    this.bookUrlMap = new Map(books.map((b) => [this.getAlias(b.bookUrl!), b]));

    // Build entityIndex from file entities
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
        const aliased = this.getAlias(entity.url);
        const match = this.resolveEntityInternal(aliased);
        if (match) this.entityIndex.set(aliased, match);
      }
    }
  }

  /**
   * Resolve a URL and return formatted markdown
   * Main method for resolving links
   * Also adds resolved entities to the entityIndex
   */
  resolve(url: string, text: string, fileId?: string): string {
    // Don't resolve external URLs, images, etc.
    if (!this.shouldResolveUrl(url)) {
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

    if (this.isEntityUrl(path)) {
      match = this.resolveEntity(path, anchor);
    } else if (this.isSourceUrl(path)) {
      match = this.resolveSource(path, anchor);
    }

    if (match) {
      this.entityIndex.set(path, match);
      return this.formatResolvedMarkdown(match, text, fileId);
    }

    return this.formatUnresolvedMarkdown(url, text);
  }

  // ============================================================================
  // URL Classification Methods
  // ============================================================================

  /**
   * Check if a URL should be resolved
   */
  private shouldResolveUrl(url: string): boolean {
    if (url.startsWith("#")) {
      return true;
    }

    if (url.endsWith(".md") || LOCAL_MD_FILE_PATTERN.test(url)) {
      return false;
    }

    if (this.isImageUrl(url)) {
      return false;
    }

    if (this.isDndBeyondUrl(url)) {
      return true;
    }

    if (this.isSourceUrl(url) || this.isEntityUrl(url)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a URL is an entity URL
   */
  private isEntityUrl(urlPath: string): boolean {
    return ENTITY_PATH_PATTERN.test(urlPath);
  }

  /**
   * Check if a URL is a source URL
   */
  private isSourceUrl(urlPath: string): boolean {
    return SOURCE_URL_PATTERN.test(urlPath);
  }

  /**
   * Check if a URL points to an image
   */
  private isImageUrl(url: string): boolean {
    return /\.(jpe?g|png|gif|webp|svg)$/i.test(url);
  }

  /**
   * Check if a URL is a D&D Beyond URL
   */
  private isDndBeyondUrl(url: string): boolean {
    return (
      url.startsWith("https://www.dndbeyond.com") ||
      url.startsWith("http://www.dndbeyond.com")
    );
  }

  // ============================================================================
  // URL Normalization Methods
  // ============================================================================

  /**
   * Normalize D&D Beyond URL
   */
  private normalizeUrl(url: string): string {
    let normalized = url;

    // Strip D&D Beyond domain
    if (normalized.startsWith("https://www.dndbeyond.com/")) {
      normalized = normalized.replace("https://www.dndbeyond.com/", "");
    } else if (normalized.startsWith("http://www.dndbeyond.com/")) {
      normalized = normalized.replace("http://www.dndbeyond.com/", "");
    }

    // Remove trailing slashes
    normalized = normalized.replace(/\/(?=#)/, "");
    if (normalized.length > 1 && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }

    // Ensure leading slash
    if (
      normalized &&
      !normalized.startsWith("/") &&
      !normalized.startsWith("#")
    ) {
      normalized = "/" + normalized;
    }

    return normalized;
  }

  /**
   * Apply URL aliases
   */
  private getAlias(url: string): string {
    const normalized = this.normalizeUrl(url);
    return this.config.links.urlAliases[normalized] || normalized;
  }

  /**
   * Normalize anchor to markdown format
   */
  private normalizeAnchor(anchor: string): string {
    return anchor
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /**
   * Parse URL and apply aliases
   */
  private parseAndAlias(url: string): { path: string; anchor?: string } {
    let [path, anchor] = url.split("#");
    path = this.getAlias(path);

    // Re-split in case alias value contains an anchor
    if (path.includes("#")) {
      const [newPath, newAnchor] = path.split("#");
      path = newPath;
      anchor = newAnchor;
    }

    return { path, anchor };
  }

  // ============================================================================
  // Formatting Methods
  // ============================================================================

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
    const entityType = getEntityTypeFromUrl(url);
    if (!entityType) return null;

    // Extract slug from URL
    const slug = url.split("/").pop()?.replace(/^\d+-/, "");
    if (!slug) return null;

    // Get target files for this entity type
    const targetFiles = this.getTargetFiles(entityType);

    // Find best match
    return this.findBestMatch(slug, targetFiles);
  }

  /**
   * Get target files for an entity type based on entityLocations config
   */
  private getTargetFiles(entityType: EntityType): FileDescriptor[] {
    const { entityLocations } = this.config.links;
    const allowedPages = entityLocations[entityType];

    if (!allowedPages) return this.files;

    const result: FileDescriptor[] = [];
    for (const page of allowedPages) {
      for (const file of this.files) {
        if (!file.url) continue;
        const url = this.getAlias(file.url);

        if (url.startsWith(page)) {
          result.push(file);
        }
      }
    }

    return result;
  }

  /**
   * Find best anchor match for a slug across target files
   */
  private findBestMatch(
    slug: string,
    targetFiles: FileDescriptor[],
  ): EntityMatch | null {
    const maxMatchStep = this.config.links.maxMatchStep;
    let bestMatch: { fileId: string; anchor: string; step: number } | null =
      null;

    for (const file of targetFiles) {
      if (!file.anchors) continue;

      const result = findMatchingAnchor(slug, file.anchors.valid, maxMatchStep);
      if (result && (!bestMatch || result.step < bestMatch.step)) {
        bestMatch = {
          fileId: file.uniqueId,
          anchor: result.anchor,
          step: result.step,
        };
        // Short-circuit if we found an exact match (step 1)
        if (result.step === 1) break;
      }
    }

    return bestMatch
      ? { fileId: bestMatch.fileId, anchor: bestMatch.anchor }
      : null;
  }

  /**
   * Resolve a source URL
   */
  private resolveSource(path: string, anchor?: string): EntityMatch | null {
    // No anchor - check for book-level or page-level match
    if (!anchor) {
      // Check if it's a sourcebook URL
      const sourcebook = this.bookUrlMap.get(path);

      if (sourcebook) {
        return {
          fileId: sourcebook.id,
          anchor: "",
        };
      }

      // Check URL map for page
      const targetFile = this.fileUrlMap.get(path);
      if (targetFile) {
        return {
          fileId: targetFile.uniqueId,
          anchor: "",
        };
      }

      return null;
    }

    // Has anchor - look up in URL mapping
    const targetFile = this.fileUrlMap.get(path);
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
      const normalized = this.normalizeAnchor(anchor);
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
