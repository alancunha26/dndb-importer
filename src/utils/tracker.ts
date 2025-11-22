/**
 * Conversion Tracker
 * Unified tracking for stats and issues
 */

import { writeFile } from "fs/promises";
import { join } from "path";
import { ZodError } from "zod";
import type {
  Issue,
  IssueType,
  FileIssueReason,
  ImageIssueReason,
  ResourceIssueReason,
  FileIssue,
  ImageIssue,
  ResourceIssue,
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
  private unresolvedLinksMap: Map<string, { text: string; count: number }> = new Map();
  private startTime = new Date();

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

  incrementCreatedIndexes(): void {
    this.createdIndexes++;
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

  trackUnresolvedLink(path: string, text: string): void {
    const existing = this.unresolvedLinksMap.get(path);
    if (existing) {
      existing.count++;
    } else {
      this.unresolvedLinksMap.set(path, { text, count: 1 });
    }
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

  // ============================================================================
  // Issue getters
  // ============================================================================

  getIssues(type?: IssueType): Issue[] {
    if (!type) return this.issues;
    return this.issues.filter((i) => i.type === type);
  }

  // ============================================================================
  // Results
  // ============================================================================

  getStats(): ProcessingStats {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    // Calculate total unresolved links (sum of all counts)
    let unresolvedLinksTotal = 0;
    for (const { count } of this.unresolvedLinksMap.values()) {
      unresolvedLinksTotal += count;
    }

    return {
      totalFiles: this.totalFiles,
      successfulFiles: this.successfulFiles,
      failedFiles: this.failedFiles,
      skippedFiles: this.skippedFiles,
      downloadedImages: this.downloadedImages,
      cachedImages: this.cachedImages,
      failedImages: this.failedImages,
      resolvedLinks: this.resolvedLinks,
      unresolvedLinks: unresolvedLinksTotal,
      unresolvedLinksUnique: this.unresolvedLinksMap.size,
      createdIndexes: this.createdIndexes,
      issues: this.issues,
      duration,
    };
  }

  // ============================================================================
  // Export
  // ============================================================================

  async exportStats(outputDir: string): Promise<void> {
    const stats = this.getStats();

    // Convert Map to array with count
    const unresolvedLinks: Array<{ path: string; text: string; count: number }> = [];
    for (const [path, { text, count }] of this.unresolvedLinksMap) {
      unresolvedLinks.push({ path, text, count });
    }

    const exported = {
      summary: {
        totalFiles: stats.totalFiles,
        successfulFiles: stats.successfulFiles,
        failedFiles: stats.failedFiles,
        skippedFiles: stats.skippedFiles,
        downloadedImages: stats.downloadedImages,
        cachedImages: stats.cachedImages,
        failedImages: stats.failedImages,
        resolvedLinks: stats.resolvedLinks,
        unresolvedLinks: stats.unresolvedLinks,
        createdIndexes: stats.createdIndexes,
        duration: stats.duration,
      },
      issues: this.groupIssuesByTypeAndReason(),
      unresolvedLinks,
    };

    const outputPath = join(outputDir, "stats.json");
    await writeFile(outputPath, JSON.stringify(exported, null, 2), "utf-8");
  }

  private groupIssuesByTypeAndReason(): {
    file: Record<string, FileIssue[]>;
    image: Record<string, ImageIssue[]>;
    resource: Record<string, ResourceIssue[]>;
  } {
    const grouped: {
      file: Record<string, FileIssue[]>;
      image: Record<string, ImageIssue[]>;
      resource: Record<string, ResourceIssue[]>;
    } = {
      file: {},
      image: {},
      resource: {},
    };

    for (const issue of this.issues) {
      switch (issue.type) {
        case "file": {
          if (!grouped.file[issue.reason]) {
            grouped.file[issue.reason] = [];
          }
          grouped.file[issue.reason].push(issue);
          break;
        }
        case "image": {
          if (!grouped.image[issue.reason]) {
            grouped.image[issue.reason] = [];
          }
          grouped.image[issue.reason].push(issue);
          break;
        }
        case "resource": {
          if (!grouped.resource[issue.reason]) {
            grouped.resource[issue.reason] = [];
          }
          grouped.resource[issue.reason].push(issue);
          break;
        }
      }
    }

    return grouped;
  }
}
