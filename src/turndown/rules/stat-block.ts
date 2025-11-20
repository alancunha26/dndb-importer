import type TurndownService from "turndown";

/**
 * Stat-block rules for D&D Beyond monster stat blocks
 *
 * Handles:
 * 1. Type/alignment line - first paragraph after heading rendered in italic
 * 2. Monster headers - section headers rendered as headings one level deeper
 */
export function statBlockRules() {
  return (turndownService: TurndownService): void => {
    const { emDelimiter } = turndownService.options;

    // Rule for type/alignment paragraph (first p after heading in stat-block)
    turndownService.addRule("stat-block-type", {
      filter: (node) => {
        if (node.nodeName !== "P") return false;

        // Must be inside a stat-block
        const statBlock = node.closest(".stat-block");
        if (!statBlock) return false;

        // Must not have monster-header class
        if (node.classList.contains("monster-header")) return false;

        // Check if this is the first p after a heading
        const prevSibling = node.previousElementSibling;
        if (!prevSibling) return false;

        // Previous sibling should be a heading (h1-h6)
        return /^H[1-6]$/.test(prevSibling.nodeName);
      },
      replacement: (content) => {
        // Wrap in emphasis (italic)
        return `\n\n${emDelimiter}${content.trim()}${emDelimiter}\n\n`;
      },
    });

    // Rule for monster-header elements (Traits, Actions, etc.)
    turndownService.addRule("monster-header", {
      filter: (node) => {
        return (
          node.nodeName === "P" && node.classList.contains("monster-header")
        );
      },
      replacement: (content, node) => {
        // Find the parent stat-block
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statBlock = (node as any).closest(".stat-block");
        if (!statBlock) {
          // Fallback to bold if no stat-block found
          const { strongDelimiter } = turndownService.options;
          return `\n\n${strongDelimiter}${content.trim()}${strongDelimiter}\n\n`;
        }

        // Find the heading level in the stat-block
        const heading = statBlock.querySelector("h1, h2, h3, h4, h5, h6");
        let level = 4; // Default to h4

        if (heading) {
          // Get the heading level and go one deeper
          const headingLevel = parseInt(heading.nodeName.charAt(1), 10);
          level = Math.min(headingLevel + 1, 6); // Cap at h6
        }

        const prefix = "#".repeat(level);
        return `\n\n${prefix} ${content.trim()}\n\n`;
      },
    });
  };
}
