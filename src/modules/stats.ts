/**
 * Stats Module
 * Displays processing statistics and issues with beautiful formatting
 */

import chalk from "chalk";
import type {
  Tracker,
  LinkIssue,
  ImageIssue,
  FileIssue,
  ResourceIssue,
  ProcessingStats,
} from "../types";

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format duration in a human-readable way
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(0);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Create a modern progress bar with percentage
 */
function progressBar(current: number, total: number, width: number = 24): string {
  if (total === 0) return chalk.dim("─".repeat(width));

  const percentage = current / total;
  const filled = Math.round(width * percentage);
  const empty = width - filled;
  const percentText = `${Math.round(percentage * 100)}%`;

  const filledBar = chalk.green("━".repeat(filled));
  const emptyBar = chalk.dim("━".repeat(empty));

  return `${filledBar}${emptyBar} ${chalk.dim(percentText)}`;
}

/**
 * Format a stat row with icon, label and value
 */
function statRow(
  icon: string,
  label: string,
  value: string | number,
  color: (s: string) => string = chalk.white,
): string {
  return `   ${icon} ${chalk.dim(label.padEnd(18))} ${color(String(value))}`;
}

/**
 * Section header with modern styling
 */
function sectionHeader(title: string): string {
  return `\n  ${chalk.bold.white(title)}`;
}

// ============================================================================
// Main Stats Display
// ============================================================================

/**
 * Display processing statistics to console with beautiful formatting
 */
export function stats(tracker: Tracker, verbose: boolean): void {
  const stats = tracker.getStats();
  const linkIssues = tracker.getIssues("link") as LinkIssue[];
  const hasWarnings = linkIssues.length > 0 || stats.failedImages > 0;
  const hasErrors = stats.failedFiles > 0;

  // Blank line for separation
  console.log("");

  // Main summary header with status indicator
  const statusIcon = hasErrors
    ? chalk.red("✖")
    : hasWarnings
      ? chalk.yellow("◆")
      : chalk.green("✔");

  console.log(
    `  ${statusIcon} ${chalk.bold("Conversion Complete")} ${chalk.dim("·")} ${chalk.dim(formatDuration(stats.duration))}`,
  );

  // Files section
  displayFilesSection(stats);

  // Images section
  displayImagesSection(stats);

  // Links section
  displayLinksSection(stats, tracker, verbose);

  // Issues section
  displayIssuesSection(tracker, verbose);

  console.log("");
}

// ============================================================================
// Section Displays
// ============================================================================

function displayFilesSection(stats: ProcessingStats): void {
  console.log(sectionHeader("Files"));

  // Progress bar
  const bar = progressBar(stats.successfulFiles, stats.totalFiles);
  console.log(`   ${bar}`);

  // Details
  console.log(statRow(chalk.green("◉"), "Processed", stats.successfulFiles, chalk.green));

  if (stats.failedFiles > 0) {
    console.log(statRow(chalk.red("◉"), "Failed", stats.failedFiles, chalk.red));
  }

  if (stats.skippedFiles > 0) {
    console.log(statRow(chalk.yellow("◉"), "Skipped", stats.skippedFiles, chalk.yellow));
  }

  if (stats.createdIndexes > 0) {
    console.log(statRow(chalk.cyan("◉"), "Indexes", stats.createdIndexes, chalk.cyan));
  }
}

function displayImagesSection(stats: ProcessingStats): void {
  const totalImages =
    stats.downloadedImages + stats.cachedImages + stats.failedImages;
  if (totalImages === 0) {
    return; // Skip if no images
  }

  console.log(sectionHeader("Images"));

  // Progress bar showing successful (downloaded + cached) vs total
  const successfulImages = stats.downloadedImages + stats.cachedImages;
  const bar = progressBar(successfulImages, totalImages);
  console.log(`   ${bar}`);

  if (stats.downloadedImages > 0) {
    console.log(statRow(chalk.green("◉"), "Downloaded", stats.downloadedImages, chalk.green));
  }

  if (stats.cachedImages > 0) {
    console.log(statRow(chalk.cyan("◉"), "Cached", stats.cachedImages, chalk.cyan));
  }

  if (stats.failedImages > 0) {
    console.log(statRow(chalk.red("◉"), "Failed", stats.failedImages, chalk.red));
  }
}

function displayLinksSection(
  stats: ProcessingStats,
  tracker: Tracker,
  verbose: boolean,
): void {
  const linkIssues = tracker.getIssues("link") as LinkIssue[];
  const unresolvedLinks = linkIssues.length;
  const totalLinks = stats.resolvedLinks + unresolvedLinks;

  if (totalLinks === 0) {
    return; // Skip if no links
  }

  console.log(sectionHeader("Links"));

  // Progress bar
  const bar = progressBar(stats.resolvedLinks, totalLinks);
  console.log(`   ${bar}`);

  console.log(statRow(chalk.green("◉"), "Resolved", stats.resolvedLinks, chalk.green));

  if (unresolvedLinks > 0) {
    console.log(statRow(chalk.yellow("◉"), "Unresolved", unresolvedLinks, chalk.yellow));

    // Show link issue breakdown
    displayLinkIssueBreakdown(linkIssues, verbose);
  }
}

function displayLinkIssueBreakdown(
  linkIssues: LinkIssue[],
  verbose: boolean,
): void {
  // Group by reason
  const reasonCounts = new Map<string, number>();
  for (const issue of linkIssues) {
    const count = reasonCounts.get(issue.reason) || 0;
    reasonCounts.set(issue.reason, count + 1);
  }

  // Sort by count (descending)
  const sortedReasons = Array.from(reasonCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  const reasonLabels: Record<string, string> = {
    "url-not-in-mapping": "URL not mapped",
    "entity-not-found": "Entity not found",
    "anchor-not-found": "Anchor not found",
    "header-link": "Header link",
    "no-anchors": "No anchors",
  };

  // Display breakdown inline
  console.log("");
  for (const [reason, count] of sortedReasons) {
    const label = reasonLabels[reason] || reason;
    console.log(`      ${chalk.dim("›")} ${chalk.dim(label.padEnd(18))} ${chalk.yellow(count)}`);
  }

  // Display examples in verbose mode
  if (verbose && linkIssues.length > 0) {
    console.log("");
    console.log(`      ${chalk.dim("Examples:")}`);

    linkIssues.slice(0, 3).forEach((issue) => {
      console.log(
        `      ${chalk.dim("·")} ${chalk.white(issue.text)} ${chalk.dim(`→ ${issue.path}`)}`,
      );
    });

    if (linkIssues.length > 3) {
      console.log(`      ${chalk.dim(`  +${linkIssues.length - 3} more`)}`);
    }
  }
}

function displayIssuesSection(
  tracker: Tracker,
  verbose: boolean,
): void {
  const fileIssues = tracker.getIssues("file") as FileIssue[];
  const imageIssues = tracker.getIssues("image") as ImageIssue[];
  const resourceIssues = tracker.getIssues("resource") as ResourceIssue[];

  const hasIssues =
    fileIssues.length > 0 ||
    imageIssues.length > 0 ||
    resourceIssues.length > 0;

  if (!hasIssues) {
    return;
  }

  console.log(sectionHeader(chalk.red("Errors")));

  // File issues
  if (fileIssues.length > 0) {
    console.log(statRow(chalk.red("✖"), "Files failed", fileIssues.length, chalk.red));
    if (verbose) {
      for (const issue of fileIssues) {
        console.log(`      ${chalk.dim("·")} ${issue.path}`);
        if (issue.details) {
          console.log(`        ${chalk.dim(issue.details)}`);
        }
      }
    }
  }

  // Image issues
  if (imageIssues.length > 0) {
    console.log(statRow(chalk.yellow("✖"), "Images failed", imageIssues.length, chalk.yellow));
    if (verbose) {
      for (const issue of imageIssues.slice(0, 5)) {
        console.log(`      ${chalk.dim("·")} ${issue.path}`);
      }
      if (imageIssues.length > 5) {
        console.log(`      ${chalk.dim(`  +${imageIssues.length - 5} more`)}`);
      }
    }
  }

  // Resource issues
  if (resourceIssues.length > 0) {
    console.log(statRow(chalk.yellow("✖"), "Resources failed", resourceIssues.length, chalk.yellow));
    if (verbose) {
      for (const issue of resourceIssues) {
        console.log(`      ${chalk.dim("·")} ${issue.path}`);
      }
    }
  }
}
