/**
 * Turndown Rule: Remove Links from Headings
 *
 * D&D Beyond includes anchor links in headings for navigation.
 * This rule removes those links, keeping only the heading text.
 */

import type TurndownService from "turndown";

interface TurndownNode {
  nodeName: string;
  childNodes: TurndownNode[];
  getAttribute?(name: string): string | null;
}

export function removeHeadingLinks(service: TurndownService): void {
  service.addRule("removeHeadingLinks", {
    filter: (node) => {
      const nodeName = node.nodeName.toLowerCase();
      return nodeName.match(/^h[1-6]$/) !== null;
    },
    replacement: (content, node) => {
      const heading = node as TurndownNode;
      const nodeName = heading.nodeName.toLowerCase();
      const level = nodeName.charAt(1); // Get the number from h1-h6

      // Strip markdown links from content
      // Matches both [text](url) and []() (empty links)
      let text = content.trim();
      text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

      const hashes = "#".repeat(parseInt(level));
      return `\n\n${hashes} ${text}\n\n`;
    },
  });
}
