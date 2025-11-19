/**
 * Configuration type definitions with Zod schemas
 */

import { z } from "zod";

// Zod schemas
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
  maxSize: z.number().int().positive(), // In bytes (default: 10MB)
  timeout: z.number().int().positive(), // In milliseconds
  retries: z.number().int().nonnegative(),
});

export const LinksConfigSchema = z.object({
  resolveInternal: z.boolean(),
  // Fallback style for unresolved links: "bold", "italic", "plain", or "none" (keep original link)
  fallbackStyle: z.enum(["bold", "italic", "plain", "none"]),
  // Maps D&D Beyond URL paths to target URLs or file paths
  // Supports two types of mappings:
  // 1. URL aliases: "/sources/dnd/free-rules/foo" -> "/sources/dnd/phb-2024/foo" (canonical URL)
  // 2. File path mappings: "/sources/dnd/phb-2024/equipment" -> "players-handbook/08-equipment.html" (legacy)
  urlAliases: z.record(z.string(), z.string()),
  // Maps entity types to canonical URL paths where they are located
  // Example: { "equipment": ["/sources/dnd/phb-2024/equipment"] }
  // If not specified for an entity type, searches all files
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

// Partial schema for user/custom configs (top-level AND nested properties optional)
export const PartialConversionConfigSchema = ConversionConfigSchema.partial()
  .extend({
    input: InputConfigSchema.partial().optional(),
    output: OutputConfigSchema.partial().optional(),
    ids: IdConfigSchema.partial().optional(),
    markdown: MarkdownConfigSchema.partial().optional(),
    html: HtmlConfigSchema.partial().optional(),
    images: ImagesConfigSchema.partial().optional(),
    links: LinksConfigSchema.partial().optional(),
    logging: LoggingConfigSchema.partial().optional(),
  });

// Infer TypeScript types from Zod schemas
export type InputConfig = z.infer<typeof InputConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
export type IdConfig = z.infer<typeof IdConfigSchema>;
export type MarkdownConfig = z.infer<typeof MarkdownConfigSchema>;
export type HtmlConfig = z.infer<typeof HtmlConfigSchema>;
export type ImagesConfig = z.infer<typeof ImagesConfigSchema>;
export type LinksConfig = z.infer<typeof LinksConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type ConversionConfig = z.infer<typeof ConversionConfigSchema>;
