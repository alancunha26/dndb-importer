/**
 * Turndown Configuration
 * Sets up Turndown with custom rules for D&D Beyond content
 */

import TurndownService from "turndown";
import type { MarkdownConfig } from "../types";

export function createTurndownService(
  config: MarkdownConfig,
): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: config.headingStyle,
    codeBlockStyle: config.codeBlockStyle,
    emDelimiter: config.emphasis,
    strongDelimiter: config.strong,
    bulletListMarker: config.bulletMarker,
    linkStyle: config.linkStyle,
  });

  // Custom rule: Unwrap images from links (lightbox links)
  // D&D Beyond wraps images in <a> tags for lightbox effect
  // We want just the image in markdown, not a linked image
  turndownService.addRule("unwrapLinkedImages", {
    filter: (node) => {
      // Check if this is an <a> tag
      if (node.nodeName !== "A") return false;

      // Find any <img> children (ignoring whitespace text nodes)
      const imgNodes = Array.from(node.childNodes).filter(
        (child) => child.nodeName === "IMG",
      );

      // Only match if there's exactly one image child
      return imgNodes.length === 1;
    },
    replacement: (_content, node) => {
      // Find the img element
      const img = Array.from(node.childNodes).find(
        (child) => child.nodeName === "IMG",
      ) as HTMLImageElement | undefined;

      if (!img) return "";

      const alt = img.getAttribute("alt") || "";
      const src = img.getAttribute("src") || "";
      return `![${alt}](${src})`;
    },
  });

  // TODO: Add more custom rules for D&D Beyond content
  // - Stat blocks
  // - Spell blocks
  // - Tables

  return turndownService;
}
