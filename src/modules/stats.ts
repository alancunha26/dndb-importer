/**
 * Stats Module
 * Displays processing statistics and issues with beautiful formatting
 */

import chalk from "chalk";
import type {
  ConversionTracker,
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
 * Create a visual progress bar
 */
function progressBar(
  current: number,
  total: number,
  width: number = 20,
): string {
  if (total === 0) return chalk.dim("─".repeat(width));

  const percentage = current / total;
  const filled = Math.round(width * percentage);
  const empty = width - filled;

  const filledBar = chalk.green("█".repeat(filled));
  const emptyBar = chalk.dim("░".repeat(empty));

  return filledBar + emptyBar;
}

/**
 * Format a stat line with label and value aligned
 */
function statLine(
  label: string,
  value: string | number,
  color?: (s: string) => string,
): string {
  const formattedValue = color ? color(String(value)) : String(value);
  return `  ${chalk.dim("│")} ${label.padEnd(20)} ${formattedValue}`;
}

/**
 * Section header with decorative border
 */
function sectionHeader(title: string, icon: string): string {
  return `\n${icon}  ${chalk.bold(title)}`;
}

/**
 * Divider line
 */
function divider(): string {
  return chalk.dim("  ├" + "─".repeat(40));
}

// ============================================================================
// Main Stats Display
// ============================================================================

/**
 * Display processing statistics to console with beautiful formatting
 */
export function stats(tracker: ConversionTracker, verbose: boolean): void {
  const stats = tracker.getStats();

  // Main summary header
  console.log(
    "\n" + chalk.bold.cyan("╭─────────────────────────────────────────╮"),
  );
  console.log(
    chalk.bold.cyan("│") +
      "         " +
      chalk.bold.white("Conversion Summary") +
      "              " +
      chalk.bold.cyan("│"),
  );
  console.log(
    chalk.bold.cyan("╰─────────────────────────────────────────╯"),
  );

  // Files section
  displayFilesSection(stats);

  // Images section
  displayImagesSection(stats);

  // Links section
  displayLinksSection(stats, tracker, verbose);

  // Issues section
  displayIssuesSection(tracker, verbose);

  // Duration footer
  console.log(
    "\n" +
      chalk.dim("  ⏱  Completed in ") +
      chalk.bold.white(formatDuration(stats.duration)),
  );
  console.log("");
}

// ============================================================================
// Section Displays
// ============================================================================

function displayFilesSection(stats: ProcessingStats): void {
  console.log(sectionHeader("Files", "📄"));
  console.log(divider());

  // Progress bar
  const bar = progressBar(stats.successfulFiles, stats.totalFiles);
  console.log(
    `  ${chalk.dim("│")} ${bar} ${chalk.green(stats.successfulFiles)}${chalk.dim("/")}${stats.totalFiles}`,
  );

  // Details
  console.log(
    statLine("Processed", stats.successfulFiles, chalk.green),
  );

  if (stats.failedFiles > 0) {
    console.log(statLine("Failed", stats.failedFiles, chalk.red));
  }

  if (stats.skippedFiles > 0) {
    console.log(statLine("Skipped", stats.skippedFiles, chalk.yellow));
  }

  if (stats.createdIndexes > 0) {
    console.log(statLine("Indexes created", stats.createdIndexes, chalk.cyan));
  }
}

function displayImagesSection(stats: ProcessingStats): void {
  const totalImages =
    stats.downloadedImages + stats.cachedImages + stats.failedImages;
  if (totalImages === 0) {
    return; // Skip if no images
  }

  console.log(sectionHeader("Images", "🖼️ "));
  console.log(divider());

  // Progress bar showing successful (downloaded + cached) vs total
  const successfulImages = stats.downloadedImages + stats.cachedImages;
  const bar = progressBar(successfulImages, totalImages);
  console.log(
    `  ${chalk.dim("│")} ${bar} ${chalk.green(successfulImages)}${chalk.dim("/")}${totalImages}`,
  );

  if (stats.downloadedImages > 0) {
    console.log(
      statLine("Downloaded", stats.downloadedImages, chalk.green),
    );
  }

  if (stats.cachedImages > 0) {
    console.log(statLine("Cached", stats.cachedImages, chalk.cyan));
  }

  if (stats.failedImages > 0) {
    console.log(statLine("Failed", stats.failedImages, chalk.red));
  }
}

function displayLinksSection(
  stats: ProcessingStats,
  tracker: ConversionTracker,
  verbose: boolean,
): void {
  const linkIssues = tracker.getIssues("link") as LinkIssue[];
  const unresolvedLinks = linkIssues.length;
  const totalLinks = stats.resolvedLinks + unresolvedLinks;

  if (totalLinks === 0) {
    return; // Skip if no links
  }

  console.log(sectionHeader("Links", "🔗"));
  console.log(divider());

  // Progress bar
  const bar = progressBar(stats.resolvedLinks, totalLinks);
  console.log(
    `  ${chalk.dim("│")} ${bar} ${chalk.green(stats.resolvedLinks)}${chalk.dim("/")}${totalLinks}`,
  );

  console.log(statLine("Resolved", stats.resolvedLinks, chalk.green));

  if (unresolvedLinks > 0) {
    console.log(
      statLine("Unresolved", unresolvedLinks, chalk.yellow),
    );

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

  // Display breakdown
  console.log(`  ${chalk.dim("│")}`);
  console.log(`  ${chalk.dim("│")} ${chalk.dim("Breakdown by reason:")}`);

  const reasonLabels: Record<string, string> = {
    "url-not-in-mapping": "URL not in mapping",
    "entity-not-found": "Entity not found",
    "anchor-not-found": "Anchor not found",
    "header-link": "Header link (no anchor)",
    "no-anchors": "Target has no anchors",
  };

  for (const [reason, count] of sortedReasons) {
    const label = reasonLabels[reason] || reason;
    console.log(
      `  ${chalk.dim("│")}   ${chalk.dim("•")} ${label}: ${chalk.yellow(count)}`,
    );
  }

  // Display examples in verbose mode
  if (verbose && linkIssues.length > 0) {
    console.log(`  ${chalk.dim("│")}`);
    console.log(`  ${chalk.dim("│")} ${chalk.dim("Examples (first 5):")}`);

    linkIssues.slice(0, 5).forEach((issue) => {
      console.log(
        `  ${chalk.dim("│")}   ${chalk.dim("→")} ${chalk.white(`[${issue.text}]`)}${chalk.dim(`(${issue.path})`)}`,
      );
    });

    if (linkIssues.length > 5) {
      console.log(
        `  ${chalk.dim("│")}   ${chalk.dim(`... and ${linkIssues.length - 5} more`)}`,
      );
    }
  }
}

function displayIssuesSection(
  tracker: ConversionTracker,
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

  console.log(sectionHeader(chalk.red("Issues"), "⚠️ "));
  console.log(divider());

  // File issues
  if (fileIssues.length > 0) {
    console.log(
      `  ${chalk.dim("│")} ${chalk.red("✗")} ${chalk.red.bold(fileIssues.length)} file(s) failed to process`,
    );
    if (verbose) {
      for (const issue of fileIssues) {
        console.log(
          `  ${chalk.dim("│")}   ${chalk.dim("•")} ${issue.path}`,
        );
        if (issue.details) {
          console.log(
            `  ${chalk.dim("│")}     ${chalk.dim(issue.details)}`,
          );
        }
      }
    }
  }

  // Image issues
  if (imageIssues.length > 0) {
    console.log(
      `  ${chalk.dim("│")} ${chalk.yellow("!")} ${chalk.yellow.bold(imageIssues.length)} image(s) failed to download`,
    );
    if (verbose) {
      for (const issue of imageIssues.slice(0, 10)) {
        console.log(
          `  ${chalk.dim("│")}   ${chalk.dim("•")} ${issue.path}: ${chalk.dim(issue.reason)}`,
        );
      }
      if (imageIssues.length > 10) {
        console.log(
          `  ${chalk.dim("│")}   ${chalk.dim(`... and ${imageIssues.length - 10} more`)}`,
        );
      }
    }
  }

  // Resource issues
  if (resourceIssues.length > 0) {
    console.log(
      `  ${chalk.dim("│")} ${chalk.yellow("!")} ${chalk.yellow.bold(resourceIssues.length)} resource(s) failed to load`,
    );
    if (verbose) {
      for (const issue of resourceIssues) {
        console.log(
          `  ${chalk.dim("│")}   ${chalk.dim("•")} ${issue.path}: ${chalk.dim(issue.reason)}`,
        );
      }
    }
  }
}
