/**
 * Conversion Tracker
 * Unified tracking for stats and issues
 */

import type { ConversionConfig } from "../types/config";
import { ZodError } from "zod";

// ============================================================================
// Types
// ============================================================================

// Type-safe reasons for each issue type
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

// Discriminated union - each type has its own subset of reasons
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
  // File counts
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  skippedFiles: number;

  // Image counts
  downloadedImages: number;
  cachedImages: number;
  failedImages: number;

  // Link counts
  resolvedLinks: number;

  // Other counts
  createdIndexes: number;

  // All issues
  issues: Issue[];

  // Timing
  duration: number;
}

// ============================================================================
// Error Mapping (private)
// ============================================================================

interface IssueInfo<T> {
  reason: T;
  details: string;
}

function mapResourceError(error: unknown): IssueInfo<ResourceIssueReason> {
  if (error instanceof ZodError) {
    return {
      reason: "schema-validation",
      details: error.issues.map((e) => e.message).join("; "),
    };
  }
  if (error instanceof SyntaxError) {
    return {
      reason: "invalid-json",
      details: error.message,
    };
  }
  if (error instanceof Error) {
    return {
      reason: "read-error",
      details: error.message,
    };
  }
  return {
    reason: "read-error",
    details: String(error),
  };
}

function mapImageError(error: unknown): IssueInfo<ImageIssueReason> {
  if (error instanceof Error) {
    // Timeout from AbortController
    if (error.name === "AbortError") {
      return {
        reason: "timeout",
        details: error.message,
      };
    }
    // HTTP errors (4xx, 5xx)
    if (error.message.startsWith("HTTP ")) {
      return {
        reason: "invalid-response",
        details: error.message,
      };
    }
    // File not found (for local copies)
    if ("code" in error && error.code === "ENOENT") {
      return {
        reason: "not-found",
        details: error.message,
      };
    }
    // Other errors (network, etc.)
    return {
      reason: "download-failed",
      details: error.message,
    };
  }
  return {
    reason: "download-failed",
    details: String(error),
  };
}

function mapFileError(
  error: unknown,
  context: "read" | "parse" | "write" = "parse",
): IssueInfo<FileIssueReason> {
  const details = error instanceof Error ? error.message : String(error);

  // Check for specific error types
  if (error instanceof Error && "code" in error) {
    if (error.code === "ENOENT") {
      return { reason: "read-error", details };
    }
    if (error.code === "EACCES" || error.code === "EPERM") {
      return {
        reason: context === "write" ? "write-error" : "read-error",
        details,
      };
    }
  }

  // Use context to determine reason
  return { reason: `${context}-error` as FileIssueReason, details };
}

// ============================================================================
// ConversionTracker - Main tracker class
// ============================================================================

export class ConversionTracker {
  private totalFiles = 0;
  private successfulFiles = 0;
  private failedFiles = 0;
  private skippedFiles = 0;
  private downloadedImages = 0;
  private cachedImages = 0;
  private failedImages = 0;
  private resolvedLinks = 0;
  private createdIndexes = 0;
  private issues: Issue[] = [];
  private startTime = new Date();

  constructor(private config: ConversionConfig) {}

  // ============================================================================
  // Stat counters
  // ============================================================================

  setTotalFiles(count: number): void {
    this.totalFiles = count;
  }

  incrementSuccessful(): void {
    this.successfulFiles++;
  }

  incrementFailed(): void {
    this.failedFiles++;
  }

  incrementSkipped(): void {
    this.skippedFiles++;
  }

  setIndexesCreated(count: number): void {
    this.createdIndexes = count;
  }

  incrementImagesDownloaded(): void {
    this.downloadedImages++;
  }

  incrementImagesCached(): void {
    this.cachedImages++;
  }

  incrementImagesFailed(): void {
    this.failedImages++;
  }

  incrementLinksResolved(): void {
    this.resolvedLinks++;
  }

  // ============================================================================
  // Issue tracking
  // ============================================================================

  /**
   * Track an issue from an error, auto-detecting the reason based on error type
   */
  trackError(
    path: string,
    error: unknown,
    type: "file" | "image" | "resource",
    context?: "read" | "parse" | "write",
  ): void {
    switch (type) {
      case "file": {
        const { reason, details } = mapFileError(error, context);
        this.issues.push({ type: "file", path, reason, details });
        break;
      }
      case "image": {
        const { reason, details } = mapImageError(error);
        this.issues.push({ type: "image", path, reason, details });
        break;
      }
      case "resource": {
        const { reason, details } = mapResourceError(error);
        this.issues.push({ type: "resource", path, reason, details });
        break;
      }
    }
  }

  /**
   * Track a link issue (only tracked when fallback is enabled)
   */
  trackLinkIssue(path: string, text: string, reason: LinkIssueReason): void {
    if (this.config.links.fallbackStyle === "none") return;
    this.issues.push({ type: "link", path, reason, text });
  }

  // ============================================================================
  // Issue getters
  // ============================================================================

  getIssues(type?: IssueType): Issue[] {
    if (!type) return this.issues;
    return this.issues.filter((i) => i.type === type);
  }

  getLinkIssuesByReason(reason: LinkIssueReason): Issue[] {
    return this.issues.filter((i) => i.type === "link" && i.reason === reason);
  }

  // ============================================================================
  // Results
  // ============================================================================

  /**
   * Get final processing statistics
   */
  getStats(): ProcessingStats {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    return {
      totalFiles: this.totalFiles,
      successfulFiles: this.successfulFiles,
      failedFiles: this.failedFiles,
      skippedFiles: this.skippedFiles,
      downloadedImages: this.downloadedImages,
      cachedImages: this.cachedImages,
      failedImages: this.failedImages,
      resolvedLinks: this.resolvedLinks,
      createdIndexes: this.createdIndexes,
      issues: this.issues,
      duration,
    };
  }
}
