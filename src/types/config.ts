/**
 * Configuration type definitions
 */

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
  // If false, all D&D Beyond links converted to bold text
  convertInternalLinks: boolean;
  // Maps D&D Beyond URL paths to HTML file paths (relative to input directory)
  // Supports two types of mappings:
  // 1. Source book paths: "/sources/dnd/phb-2024/equipment" -> "players-handbook/08-equipment.html"
  // 2. Entity type paths: "/spells" -> "players-handbook/10-spell-descriptions.html"
  //    (for entity links like https://www.dndbeyond.com/spells/2619022-magic-missile)
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
