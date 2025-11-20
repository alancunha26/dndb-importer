/**
 * Consolidated type definitions and Zod schemas
 */

import { z } from "zod";
import { Tracker } from "./utils/tracker";

// Re-export Tracker
export { Tracker };

// ============================================================================
// Configuration Types & Schemas
// ============================================================================

export const InputConfigSchema = z.object({
  directory: z.string(),
  pattern: z.string(),
  encoding: z.string() as z.ZodType<BufferEncoding>,
});

export const OutputConfigSchema = z.object({
  directory: z.string(),
  overwrite: z.boolean(),
  extension: z.string(),
  createIndex: z.boolean(),
});

export const IdConfigSchema = z.object({
  length: z.number().int().positive(),
  characters: z.string(),
});

export const MarkdownConfigSchema = z.object({
  headingStyle: z.enum(["atx", "setext"]),
  codeBlockStyle: z.enum(["fenced", "indented"]),
  emphasis: z.enum(["_", "*"]),
  strong: z.enum(["__", "**"]),
  bulletMarker: z.enum(["-", "+", "*"]),
  linkStyle: z.enum(["inlined", "referenced"]),
  linkReferenceStyle: z.enum(["full", "collapsed", "shortcut"]),
  horizontalRule: z.string(),
  lineBreak: z.string(),
  codeFence: z.enum(["```", "~~~"]),
  preformattedCode: z.boolean(),
});

export const HtmlConfigSchema = z.object({
  contentSelector: z.string(),
  removeSelectors: z.array(z.string()),
});

export const ImagesConfigSchema = z.object({
  download: z.boolean(),
  formats: z.array(z.string()),
  maxSize: z.number().int().positive(),
  timeout: z.number().int().positive(),
  retries: z.number().int().nonnegative(),
});

export const LinksConfigSchema = z.object({
  resolveInternal: z.boolean(),
  fallbackStyle: z.enum(["bold", "italic", "plain", "none"]),
  urlAliases: z.record(z.string(), z.string()),
  entityLocations: z.record(z.string(), z.array(z.string())),
});

export const LoggingConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]),
  showProgress: z.boolean(),
});

export const ConversionConfigSchema = z.object({
  input: InputConfigSchema,
  output: OutputConfigSchema,
  ids: IdConfigSchema,
  markdown: MarkdownConfigSchema,
  html: HtmlConfigSchema,
  images: ImagesConfigSchema,
  links: LinksConfigSchema,
  logging: LoggingConfigSchema,
});

export const PartialConversionConfigSchema = ConversionConfigSchema.partial().extend({
  input: InputConfigSchema.partial().optional(),
  output: OutputConfigSchema.partial().optional(),
  ids: IdConfigSchema.partial().optional(),
  markdown: MarkdownConfigSchema.partial().optional(),
  html: HtmlConfigSchema.partial().optional(),
  images: ImagesConfigSchema.partial().optional(),
  links: LinksConfigSchema.partial().optional(),
  logging: LoggingConfigSchema.partial().optional(),
});

export type InputConfig = z.infer<typeof InputConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
export type IdConfig = z.infer<typeof IdConfigSchema>;
export type MarkdownConfig = z.infer<typeof MarkdownConfigSchema>;
export type HtmlConfig = z.infer<typeof HtmlConfigSchema>;
export type ImagesConfig = z.infer<typeof ImagesConfigSchema>;
export type LinksConfig = z.infer<typeof LinksConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type ConversionConfig = z.infer<typeof ConversionConfigSchema>;

// ============================================================================
// File Types
// ============================================================================

export const SourcebookMetadataSchema = z.looseObject({
  title: z.string().optional(),
  edition: z.string().optional(),
  coverImage: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
});

export type SourcebookMetadata = z.infer<typeof SourcebookMetadataSchema>;

export interface FileDescriptor {
  sourcePath: string;
  relativePath: string;
  outputPath: string;
  sourcebook: string;
  sourcebookId: string;
  filename: string;
  uniqueId: string;
  url?: string;
  title?: string;
  anchors?: FileAnchors;
  entities?: ParsedEntityUrl[];
  written?: boolean;
}

export interface TemplateSet {
  index: string | null;
  file: string | null;
}

export interface SourcebookInfo {
  id: string;
  title: string;
  sourcebook: string;
  outputPath: string;
  metadata: SourcebookMetadata;
  templates: TemplateSet;
  bookUrl?: string;
}

export interface FileAnchors {
  valid: string[];
  htmlIdToAnchor: Record<string, string>;
}

export type FileMapping = Record<string, string>;

// ============================================================================
// Template Context Types
// ============================================================================

export interface IndexTemplateContext {
  title: string;
  date: string;
  edition?: string;
  description?: string;
  author?: string;
  coverImage?: string;
  metadata: SourcebookMetadata;
  files: Array<{
    title: string;
    filename: string;
    uniqueId: string;
  }>;
}

export interface FileTemplateContext {
  title: string;
  date: string;
  tags: string[];
  sourcebook: {
    title: string;
    edition?: string;
    author?: string;
    metadata: SourcebookMetadata;
  };
  navigation: {
    prev?: string;
    index: string;
    next?: string;
  };
  content: string;
}

// ============================================================================
// Context Types
// ============================================================================

export interface ConversionContext {
  config: ConversionConfig;
  tracker: Tracker;
  files?: FileDescriptor[];
  sourcebooks?: SourcebookInfo[];
  globalTemplates?: TemplateSet;
}

// ============================================================================
// Tracker Types
// ============================================================================

export type FileIssueReason = "parse-error" | "read-error" | "write-error";
export type ImageIssueReason =
  | "download-failed"
  | "timeout"
  | "not-found"
  | "invalid-response";
export type ResourceIssueReason =
  | "invalid-json"
  | "schema-validation"
  | "read-error";
export type LinkIssueReason =
  | "url-not-in-mapping"
  | "entity-not-found"
  | "anchor-not-found"
  | "header-link"
  | "no-anchors";

export interface FileIssue {
  type: "file";
  path: string;
  reason: FileIssueReason;
  details?: string;
}

export interface ImageIssue {
  type: "image";
  path: string;
  reason: ImageIssueReason;
  details?: string;
}

export interface ResourceIssue {
  type: "resource";
  path: string;
  reason: ResourceIssueReason;
  details?: string;
}

export interface LinkIssue {
  type: "link";
  path: string;
  reason: LinkIssueReason;
  text: string;
}

export type Issue = FileIssue | ImageIssue | ResourceIssue | LinkIssue;
export type IssueType = Issue["type"];

export interface ProcessingStats {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  skippedFiles: number;
  downloadedImages: number;
  cachedImages: number;
  failedImages: number;
  resolvedLinks: number;
  createdIndexes: number;
  issues: Issue[];
  duration: number;
}

// ============================================================================
// URL Types
// ============================================================================

export interface ParsedEntityUrl {
  type: string;
  id: string;
  slug?: string;
  anchor?: string;
  url: string;
}

export const ENTITY_TYPES = [
  "spells",
  "monsters",
  "magic-items",
  "equipment",
  "classes",
  "feats",
  "species",
  "backgrounds",
] as const;

// ============================================================================
// Resolver Types
// ============================================================================

export interface LinkResolutionResult {
  resolved: boolean;
  reason?:
    | "url-not-mapped"
    | "file-not-found"
    | "anchor-not-found"
    | "header-link";
  targetFileId?: string;
  targetAnchor?: string;
}

// ============================================================================
// Turndown Types
// ============================================================================

export interface TurndownNode {
  nodeName: string;
  childNodes: TurndownNode[];
  getAttribute?(name: string): string | null;
  textContent?: string;
  innerHTML?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ConfigError {
  path: string;
  error: unknown;
}

