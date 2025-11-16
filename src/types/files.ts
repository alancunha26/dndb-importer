/**
 * File-related type definitions
 */

export interface FileDescriptor {
  sourcePath: string; // Absolute path to source HTML
  relativePath: string; // Relative path from input root
  outputPath: string; // Target markdown file path
  sourcebook: string; // Sourcebook name (directory name)
  filename: string; // Base filename without extension
  uniqueId: string; // 4-character unique ID (e.g., "a3f9")
}

export interface SourcebookInfo {
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
