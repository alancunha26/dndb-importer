/**
 * Type definitions for the D&D Beyond HTML to Markdown Converter
 * All TypeScript interfaces and types are consolidated here
 */

// ============================================================================
// File Processing
// ============================================================================

export interface FileDescriptor {
  sourcePath: string; // Absolute path to source HTML
  relativePath: string; // Relative path from input root
  outputPath: string; // Target markdown file path
  sourcebook: string; // Sourcebook name (directory name)
  filename: string; // Base filename without extension
  uniqueId: string; // 4-character unique ID (e.g., "a3f9")
}

export interface FileProcessingResult {
  file: FileDescriptor;
  success: boolean;
  error?: Error;
  warnings?: string[];
}

export interface SourcebookIndex {
  id: string; // Unique ID for the index file
  title: string; // Sourcebook title
  sourcebook: string; // Sourcebook directory name
  files: FileDescriptor[]; // Ordered list of content files
  outputPath: string; // Path to index markdown file
}

export interface ImageDescriptor {
  originalUrl: string; // Original image URL from HTML
  uniqueId: string; // 4-character unique ID
  extension: string; // File extension (png, jpg, webp, etc.)
  localPath: string; // Filename in output (e.g., "m3x7.png")
  sourcebook: string; // Sourcebook directory name
  downloadStatus: "pending" | "success" | "failed";
  error?: Error;
}

// ============================================================================
// Configuration
// ============================================================================

export interface ConversionConfig {
  input: InputConfig;
  output: OutputConfig;
  parser: ParserConfig;
  media: MediaConfig;
  logging: LoggingConfig;
}

export interface InputConfig {
  directory: string;
  filePattern: string;
  encoding: BufferEncoding;
}

export interface OutputConfig {
  directory: string;
  fileExtension: string;
  preserveStructure: boolean;
  createIndex: boolean;
  overwrite: boolean;
}

export interface ParserConfig {
  html: HtmlParserConfig;
  markdown: MarkdownParserConfig;
  idGenerator: IdGeneratorConfig;
}

export interface HtmlParserConfig {
  // Content extraction - selector for the main content container
  contentSelector: string;
  // Optional selectors to remove from within the content
  removeSelectors: string[];
  // Convert internal D&D Beyond links to local markdown links
  // If false, all D&D Beyond links converted to bold text (Phase 2 skipped)
  convertInternalLinks: boolean;
  // Maps D&D Beyond URL paths to HTML file paths (relative to input directory)
  // Supports two types of mappings:
  // 1. Source book paths: "/sources/dnd/phb-2024/equipment" -> "players-handbook/08-equipment.html"
  // 2. Entity type paths: "/spells" -> "players-handbook/10-spell-descriptions.html"
  //    (for entity links like https://www.dndbeyond.com/spells/2619022-magic-missile)
  // The converter will resolve these to unique IDs at runtime
  urlMapping: Record<string, string>;
  // Fallback for unresolvable links: convert to bold text instead of broken links
  // Only applies when convertInternalLinks is true
  fallbackToBold: boolean;
}

export interface MarkdownParserConfig {
  // Turndown core options
  headingStyle: "atx" | "setext";
  codeBlockStyle: "fenced" | "indented";
  emDelimiter: "_" | "*";
  strongDelimiter: "__" | "**";
  bulletListMarker: "-" | "+" | "*";
  linkStyle: "inlined" | "referenced";
  // Output additions
  frontMatter: boolean;
  navigationHeader: boolean;
}

export interface IdGeneratorConfig {
  length: number;
  characters: string;
}

export interface MediaConfig {
  downloadImages: boolean;
  supportedFormats: string[];
  maxImageSize: number; // In bytes (default: 10MB)
  timeout: number; // In milliseconds
  retryAttempts: number;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  showProgress: boolean;
}

// ============================================================================
// Conversion Results
// ============================================================================

export interface DocumentMetadata {
  title: string;
  date: string; // ISO date string (YYYY-MM-DD)
  tags: string[]; // e.g., ["dnd5e/chapter", "dnd5e/source"]
}

export interface NavigationLinks {
  previous?: {
    title: string;
    id: string; // Unique ID of previous file
  };
  index: {
    title: string; // Sourcebook title
    id: string; // Unique ID of index file
  };
  next?: {
    title: string;
    id: string; // Unique ID of next file
  };
}

export interface ConversionResult {
  markdown: string;
  metadata: DocumentMetadata;
  navigation: NavigationLinks;
  images: ImageDescriptor[];
  warnings: string[];
  // Anchor data for this file, used in Phase 2 for link resolution
  anchors: FileAnchors;
}

export interface FileAnchors {
  // All valid markdown anchors in this file
  // Includes plural/singular variants for better matching
  // Example: ["fireball", "fireballs", "bell-1-gp", "alchemists-fire-50-gp"]
  valid: string[];
  // Maps HTML element IDs to markdown anchors (for same-page links)
  // Example: { "Bell1GP": "bell-1-gp", "Fireball": "fireball" }
  // Built during HTML processing using Cheerio to find elements with id attributes
  htmlIdToAnchor: Record<string, string>;
}

export interface ProcessingStats {
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  indexesCreated: number;
  imagesDownloaded: number;
  imagesFailed: number;
  linksResolved: number;
  linksFailed: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

// ============================================================================
// Link Resolution (Phase 2)
// ============================================================================

export interface LinkResolutionIndex {
  // Maps file unique ID to anchor data for that file
  // Built in Phase 2 by collecting FileAnchors from all ConversionResults
  // Example: { "a3f9": { valid: [...], htmlIdToAnchor: {...} }, "b4x8": {...} }
  //
  // Usage:
  // - Same-page links: index["a3f9"].htmlIdToAnchor["Bell1GP"] → "bell-1-gp"
  // - Cross-file validation: index["a3f9"].valid.includes("fireball") → true
  // - Prefix matching: index["a3f9"].valid.find(a => a.startsWith("alchemists-fire"))
  [fileId: string]: FileAnchors;
}

export interface LinkResolutionResult {
  resolved: boolean;
  reason?:
    | "url-not-mapped"
    | "file-not-found"
    | "anchor-not-found"
    | "header-link"; // Link without anchor, removed entirely
  targetFileId?: string;
  targetAnchor?: string;
}
