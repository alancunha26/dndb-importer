/**
 * Turndown Rule: Remove Links from Headings
 *
 * D&D Beyond includes anchor links in headings for navigation.
 * This rule removes those links, keeping only the heading text.
 */

import type TurndownService from "turndown";
import type { MarkdownConfig, TurndownNode } from "../../types";

export function removeHeadingLinks(config: MarkdownConfig) {
  return (service: TurndownService): void => {
    service.addRule("removeHeadingLinks", {
      filter: (node) => {
        const nodeName = node.nodeName.toLowerCase();
        return nodeName.match(/^h[1-6]$/) !== null;
      },
      replacement: (content, node) => {
        const heading = node as TurndownNode;
        const nodeName = heading.nodeName.toLowerCase();
        const level = parseInt(nodeName.charAt(1)); // Get the number from h1-h6

        // Strip markdown links from content
        // Matches both [text](url) and []() (empty links)
        let text = content.trim();
        text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

        // Format based on configured headingStyle
        if (config.headingStyle === "setext" && level <= 2) {
          // Setext style (only for h1 and h2)
          const underline = level === 1 ? "=" : "-";
          return `\n\n${text}\n${underline.repeat(text.length)}\n\n`;
        } else {
          // ATX style (for h3-h6, or when headingStyle is "atx")
          const hashes = "#".repeat(level);
          return `\n\n${hashes} ${text}\n\n`;
        }
      },
    });
  };
}
