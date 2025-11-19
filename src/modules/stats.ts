/**
 * Stats Module
 * Displays processing statistics and issues
 */

import type {
  ConversionTracker,
  LinkIssue,
  ImageIssue,
  FileIssue,
  ResourceIssue,
} from "../types";

/**
 * Display processing statistics to console
 */
export function stats(tracker: ConversionTracker, verbose: boolean): void {
  const stats = tracker.getStats();

  // Summary
  console.log(
    `\nFiles processed: ${stats.successfulFiles}/${stats.totalFiles}`,
  );
  console.log(`Images downloaded: ${stats.downloadedImages}`);
  console.log(`Links resolved: ${stats.resolvedLinks}`);

  // Link issues
  const linkIssues = tracker.getIssues("link") as LinkIssue[];
  if (linkIssues.length > 0) {
    console.log(`\n⚠️  ${linkIssues.length} link(s) fell back to bold text:`);

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
    console.log("\nBreakdown by reason:");
    for (const [reason, count] of sortedReasons) {
      console.log(`  - ${reason}: ${count}`);
    }

    // Display examples in verbose mode
    if (verbose) {
      console.log("\nExamples (first 10):");
      linkIssues.slice(0, 10).forEach((issue) => {
        console.log(`  - [${issue.text}](${issue.path})`);
        console.log(`    Reason: ${issue.reason}`);
      });

      if (linkIssues.length > 10) {
        console.log(`  ... and ${linkIssues.length - 10} more`);
      }
    }
  }

  // Duration
  if (stats.duration) {
    console.log(`\nDuration: ${(stats.duration / 1000).toFixed(2)}s`);
  }

  // Other issues
  const imageIssues = tracker.getIssues("image") as ImageIssue[];
  if (imageIssues.length > 0) {
    console.warn(`\n⚠️  ${imageIssues.length} image(s) failed to download:`);
    for (const issue of imageIssues) {
      console.warn(`  - ${issue.path}: ${issue.reason}`);
    }
  }

  const fileIssues = tracker.getIssues("file") as FileIssue[];
  if (fileIssues.length > 0) {
    console.error(`\n❌ ${fileIssues.length} file(s) failed to process:`);
    for (const issue of fileIssues) {
      console.error(`  - ${issue.path}: ${issue.reason}`);
    }
  }

  const resourceIssues = tracker.getIssues("resource") as ResourceIssue[];
  if (resourceIssues.length > 0) {
    console.warn(`\n⚠️  ${resourceIssues.length} resource(s) failed to load:`);
    for (const issue of resourceIssues) {
      console.warn(`  - ${issue.path}: ${issue.reason}`);
    }
  }
}
