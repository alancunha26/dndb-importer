/**
 * Central type exports
 */

// Configuration
export type {
  ConversionConfig,
  InputConfig,
  OutputConfig,
  IdConfig,
  MarkdownConfig,
  HtmlConfig,
  ImagesConfig,
  LinksConfig,
  LoggingConfig,
} from "./config";

// Files
export type {
  FileDescriptor,
  SourcebookInfo,
  SourcebookMetadata,
  TemplateSet,
  ImageDescriptor,
  DocumentMetadata,
  NavigationLinks,
  FileAnchors,
  ImageMapping,
  FileMapping,
  IndexTemplateContext,
  FileTemplateContext,
} from "./files";

// Pipeline
export type {
  ProcessedFile,
  WrittenFile,
  LinkResolutionIndex,
  LinkResolutionResult,
  ProcessingStats,
} from "./pipeline";

// Context
export type { ConversionContext } from "./context";
