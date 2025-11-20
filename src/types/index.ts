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
export {
  ConversionConfigSchema,
  PartialConversionConfigSchema,
} from "./config";

// Files
export type {
  FileDescriptor,
  SourcebookInfo,
  SourcebookMetadata,
  TemplateSet,
  FileAnchors,
  FileMapping,
  IndexTemplateContext,
  FileTemplateContext,
} from "./files";
export { SourcebookMetadataSchema } from "./files";

// Context
export type {
  ConversionContext,
  Issue,
  IssueType,
  FileIssue,
  ImageIssue,
  ResourceIssue,
  LinkIssue,
  FileIssueReason,
  ImageIssueReason,
  ResourceIssueReason,
  LinkIssueReason,
  ProcessingStats,
} from "./context";

// Tracker
export { Tracker } from "../utils/conversion-tracker";

// Resolver
export type { LinkResolutionResult } from "./resolver";

// Turndown
export type { TurndownNode } from "./turndown";
