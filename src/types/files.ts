/**
 * File-related type definitions
 */

import { z } from "zod";
import type { ParsedEntityUrl } from "../utils/entity";

export interface FileDescriptor {
  // Scanner fills these fields:
  sourcePath: string; // Absolute path to source HTML
  relativePath: string; // Relative path from input root
  outputPath: string; // Target markdown file path
  sourcebook: string; // Sourcebook directory name (for output path)
  sourcebookId: string; // ID of the SourcebookInfo this file belongs to
  filename: string; // Base filename without extension
  uniqueId: string; // 4-character unique ID (e.g., "a3f9")

  // Processor fills these fields (after processing):
  canonicalUrl?: string; // Canonical URL extracted from HTML (e.g., "/sources/dnd/phb-2024/spells")
  title?: string; // Extracted from first H1 in document
  anchors?: FileAnchors; // Valid anchors and HTML ID mappings
  entities?: ParsedEntityUrl[]; // Entity URLs found in headings (for resolver to index)
  written?: boolean; // True after file has been written to disk
}

/**
 * Sourcebook metadata from sourcebook.json
 * Optional file that users can provide to customize sourcebook output
 *
 * Fields:
 * - title: Display title (overrides directory name)
 * - edition: e.g., "5th Edition (2024)"
 * - coverImage: Filename of cover image in sourcebook directory
 * - description: Brief description for index page
 * - author: e.g., "Wizards of the Coast"
 * - Custom fields allowed for user templates
 */
export const SourcebookMetadataSchema = z.looseObject({
  title: z.string().optional(),
  edition: z.string().optional(),
  coverImage: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
});

export type SourcebookMetadata = z.infer<typeof SourcebookMetadataSchema>;

/**
 * Template file paths
 * Null means use built-in default template
 */
export interface TemplateSet {
  index: string | null; // Path to index.md.hbs
  file: string | null; // Path to file.md.hbs
}

export interface SourcebookInfo {
  id: string; // Unique ID for the index file
  title: string; // Sourcebook title (from metadata or directory name)
  sourcebook: string; // Sourcebook directory name
  outputPath: string; // Path to index markdown file
  metadata: SourcebookMetadata; // Metadata from sourcebook.json (or empty)
  templates: TemplateSet; // Sourcebook-specific templates (or null for global/default)
  bookUrl?: string; // Book-level URL extracted from first file (e.g., /sources/dnd/phb-2024)
  // Files are stored separately in ConversionContext.files with sourcebookId reference
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

/**
 * File mapping for persistence
 * Maps input HTML path -> output markdown filename
 * Example: { "players-handbook/01-intro.html": "a3f9.md" }
 * Saved to files.json in the output directory root
 */
export type FileMapping = Record<string, string>;

// ============================================================================
// Template Context Types
// ============================================================================

/**
 * Context passed to index templates
 * Available variables in index.md.hbs
 */
export interface IndexTemplateContext {
  // Sourcebook metadata
  title: string;
  date: string;
  edition?: string;
  description?: string;
  author?: string;
  coverImage?: string;
  metadata: SourcebookMetadata; // Full metadata object for custom fields

  // File list for navigation
  files: Array<{
    title: string;
    filename: string; // e.g., "a3f9.md"
    uniqueId: string;
  }>;
}

/**
 * Context passed to file templates
 * Available variables in file.md.hbs
 */
export interface FileTemplateContext {
  // Document metadata
  title: string;
  date: string;
  tags: string[];

  // Sourcebook info
  sourcebook: {
    title: string;
    edition?: string;
    author?: string;
    metadata: SourcebookMetadata; // Full metadata for custom fields
  };

  // Navigation links
  navigation: {
    prev?: string; // Markdown link: "[Previous Title](prev-id.md)"
    index: string; // Markdown link: "[Index](index-id.md)"
    next?: string; // Markdown link: "[Next Title](next-id.md)"
  };

  // Main content
  content: string; // Converted markdown content
}
