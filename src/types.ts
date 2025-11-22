/**
 * Consolidated type definitions and Zod schemas
 */

import { z } from "zod";
import { Tracker } from "./utils/tracker";
import { IdGenerator } from "./utils/id-generator";

// Re-export classes
export { Tracker, IdGenerator };

// ============================================================================
// Configuration Types & Schemas
// ============================================================================

export const InputConfigSchema = z.string();

export const OutputConfigSchema = z.string();

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
  titleSelector: z.string(),
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
  maxMatchStep: z.number().min(1).max(12).optional(),
  urlAliases: z.record(z.string(), z.string()),
  excludeUrls: z.array(z.string()),
  entityLocations: z.record(z.string(), z.array(z.string())),
});

export const GlobalIndexConfigSchema = z.object({
  enabled: z.boolean(),
  title: z.string(),
});

// Base schema for entity index entries (without children for recursion)
const EntityIndexBaseSchema = z.object({
  title: z.string(),
  url: z.string().url().optional(),
  description: z.string().optional(),
});

// Recursive schema for entity index with nested children
export type EntityIndexConfig = z.infer<typeof EntityIndexBaseSchema> & {
  children?: EntityIndexConfig[];
};

export const EntityIndexConfigSchema: z.ZodType<EntityIndexConfig> =
  EntityIndexBaseSchema.extend({
    children: z.lazy(() => z.array(EntityIndexConfigSchema)).optional(),
  }).refine((data) => data.url || data.children, {
    message: "Entity index must have either 'url' or 'children'",
  });

export const IndexesConfigSchema = z.object({
  generate: z.boolean(),
  global: GlobalIndexConfigSchema,
  entities: z.array(EntityIndexConfigSchema),
});

export const ConversionConfigSchema = z.object({
  input: InputConfigSchema,
  output: OutputConfigSchema,
  ids: IdConfigSchema,
  markdown: MarkdownConfigSchema,
  html: HtmlConfigSchema,
  images: ImagesConfigSchema,
  links: LinksConfigSchema,
  indexes: IndexesConfigSchema,
});

export const PartialConversionConfigSchema =
  ConversionConfigSchema.partial().extend({
    ids: IdConfigSchema.partial().optional(),
    markdown: MarkdownConfigSchema.partial().optional(),
    html: HtmlConfigSchema.partial().optional(),
    images: ImagesConfigSchema.partial().optional(),
    links: LinksConfigSchema.partial().optional(),
    indexes: IndexesConfigSchema.partial()
      .extend({
        global: GlobalIndexConfigSchema.partial().optional(),
        entities: z.array(EntityIndexConfigSchema).optional(),
      })
      .optional(),
  });

export type InputConfig = z.infer<typeof InputConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
export type IdConfig = z.infer<typeof IdConfigSchema>;
export type MarkdownConfig = z.infer<typeof MarkdownConfigSchema>;
export type HtmlConfig = z.infer<typeof HtmlConfigSchema>;
export type ImagesConfig = z.infer<typeof ImagesConfigSchema>;
export type LinksConfig = z.infer<typeof LinksConfigSchema>;
export type GlobalIndexConfig = z.infer<typeof GlobalIndexConfigSchema>;
// EntityIndexConfig is already exported as a type above (for recursion)
export type IndexesConfig = z.infer<typeof IndexesConfigSchema>;
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
  titles: z.array(z.string()).optional(),
  sourceId: z.number().optional(),
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
  content?: string;
  images?: string[];
  written?: boolean;
}

export interface TemplateSet {
  index: string | null;
  file: string | null;
  entityIndex: string | null;
  parentIndex: string | null;
  globalIndex: string | null;
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
// Indexes Mapping & Cache Types
// ============================================================================

export const ParsedEntitySchema = z.object({
  name: z.string(),
  url: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
});

// Entity stored by URL key (without url field to avoid duplication)
export const StoredEntitySchema = z.object({
  name: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const CachedEntityListSchema = z.object({
  fetchedAt: z.string(),
  entityUrls: z.array(z.string()),
});

export const IndexesMappingSchema = z.object({
  mappings: z.object({
    global: z.string().optional(),
    entities: z.record(z.string(), z.string()),
  }),
  entities: z.record(z.string(), StoredEntitySchema),
  cache: z.record(z.string(), CachedEntityListSchema),
});

export type ParsedEntity = z.infer<typeof ParsedEntitySchema>;
export type StoredEntity = z.infer<typeof StoredEntitySchema>;
export type CachedEntityList = z.infer<typeof CachedEntityListSchema>;
export type IndexesMapping = z.infer<typeof IndexesMappingSchema>;

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

export interface EntityIndexTemplateContext {
  title: string;
  description?: string;
  type: EntityType;
  entities: Array<{
    name: string;
    url: string;
    metadata?: Record<string, string>;
    fileId?: string;
    anchor?: string;
    resolved: boolean;
  }>;
}

export interface ParentIndexTemplateContext {
  title: string;
  description?: string;
  children: Array<{
    title: string;
    filename: string;
  }>;
}

export interface GlobalIndexTemplateContext {
  title: string;
  sourcebooks: Array<{
    title: string;
    id: string;
  }>;
  entityIndexes: Array<{
    title: string;
    filename: string;
  }>;
}

// ============================================================================
// Context Types
// ============================================================================

export interface ConversionContext {
  config: ConversionConfig;
  tracker: Tracker;
  idGenerator: IdGenerator;
  files?: FileDescriptor[];
  sourcebooks?: SourcebookInfo[];
  globalTemplates?: TemplateSet;
  entityIndex?: Map<string, EntityMatch>;
  verbose?: boolean;
  refetch?: boolean;
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

export type Issue = FileIssue | ImageIssue | ResourceIssue;
export type IssueType = Issue["type"];

export interface UnresolvedLink {
  path: string;
  text: string;
  count?: number;
}

export interface ProcessingStats {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  skippedFiles: number;
  downloadedImages: number;
  cachedImages: number;
  failedImages: number;
  resolvedLinks: number;
  unresolvedLinks: number;
  unresolvedLinksUnique: number;
  createdIndexes: number;
  entityIndexes: number;
  fetchedEntities: number;
  cachedEntities: number;
  issues: Issue[];
  duration: number;
}

// ============================================================================
// URL Types
// ============================================================================

export interface ParsedEntityUrl {
  type: EntityType;
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

export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Parser interface for entity listing pages
 */
export interface EntityParser {
  /**
   * Parse HTML from a D&D Beyond listing page and extract entities
   */
  parse(html: string): ParsedEntity[];
}

// ============================================================================
// Resolver Types
// ============================================================================

export interface EntityMatch {
  fileId: string;
  anchor: string;
}

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
