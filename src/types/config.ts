/**
 * Configuration type definitions
 */

export interface ConversionConfig {
  input: InputConfig;
  output: OutputConfig;
  ids: IdConfig;
  markdown: MarkdownConfig;
  html: HtmlConfig;
  images: ImagesConfig;
  links: LinksConfig;
  logging: LoggingConfig;
}

export interface InputConfig {
  directory: string;
  pattern: string;
  encoding: BufferEncoding;
}

export interface OutputConfig {
  directory: string;
  overwrite: boolean;
  extension: string;
  createIndex: boolean;
}

export interface IdConfig {
  length: number;
  characters: string;
}

export interface MarkdownConfig {
  headingStyle: "atx" | "setext";
  codeBlockStyle: "fenced" | "indented";
  emphasis: "_" | "*";
  strong: "__" | "**";
  bulletMarker: "-" | "+" | "*";
  linkStyle: "inlined" | "referenced";
  frontmatter: boolean;
  navigation: boolean;
}

export interface HtmlConfig {
  contentSelector: string;
  removeSelectors: string[];
}

export interface ImagesConfig {
  download: boolean;
  formats: string[];
  maxSize: number; // In bytes (default: 10MB)
  timeout: number; // In milliseconds
  retries: number;
}

export interface LinksConfig {
  resolveInternal: boolean;
  fallbackToBold: boolean;
  // Maps D&D Beyond URL paths to HTML file paths (relative to input directory)
  // Supports two types of mappings:
  // 1. Source book paths: "/sources/dnd/phb-2024/equipment" -> "players-handbook/08-equipment.html"
  // 2. Entity type paths: "/spells" -> "players-handbook/10-spell-descriptions.html"
  //    (for entity links like https://www.dndbeyond.com/spells/2619022-magic-missile)
  urlMapping: Record<string, string>;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  showProgress: boolean;
}
