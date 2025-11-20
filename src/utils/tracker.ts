/**
 * Conversion Tracker
 * Unified tracking for stats and issues
 */

import { ZodError } from "zod";
import type {
  ConversionConfig,
  Issue,
  IssueType,
  FileIssueReason,
  ImageIssueReason,
  ResourceIssueReason,
  LinkIssueReason,
  ProcessingStats,
} from "../types";

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
    if (error.name === "AbortError") {
      return {
        reason: "timeout",
        details: error.message,
      };
    }
    if (error.message.startsWith("HTTP ")) {
      return {
        reason: "invalid-response",
        details: error.message,
      };
    }
    if ("code" in error && error.code === "ENOENT") {
      return {
        reason: "not-found",
        details: error.message,
      };
    }
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

  return { reason: `${context}-error` as FileIssueReason, details };
}

// ============================================================================
// Tracker Class
// ============================================================================

export class Tracker {
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
