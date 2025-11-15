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
  conversion: TurndownConfig;
  dndbeyond: DndBeyondConfig;
  media: MediaConfig;
  crossReferences: CrossReferenceConfig;
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
  idLength: number;
  idCharacters: string;
}

export interface TurndownConfig {
  headingStyle: "atx" | "setext";
  codeBlockStyle: "fenced" | "indented";
  emDelimiter: "_" | "*";
  strongDelimiter: "__" | "**";
  bulletListMarker: "-" | "+" | "*";
  linkStyle: "inlined" | "referenced";
  frontMatter: boolean;
  navigationHeader: boolean;
}

export interface DndBeyondConfig {
  removeNavigation: boolean;
  removeBreadcrumbs: boolean;
  removeAds: boolean;
  preserveStatBlocks: boolean;
  preserveTables: boolean;
  detectMultiColumn: boolean;
  cleanupSelectors: string[];
}

export interface MediaConfig {
  downloadImages: boolean;
  supportedFormats: string[];
  maxImageSize: number; // In bytes (default: 10MB)
  timeout: number; // In milliseconds
  retryAttempts: number;
}

export interface CrossReferenceConfig {
  convertToText: boolean;
  boldEntities: boolean;
  entityTypes: string[]; // Types of entities to convert
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
}

export interface ProcessingStats {
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  indexesCreated: number;
  imagesDownloaded: number;
  imagesFailed: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}
