/**
 * Turndown Rule: Convert Figure Captions to Blockquotes
 *
 * D&D Beyond uses <figure> elements with artist credits and figcaptions.
 * This rule:
 * - Converts figure captions to blockquotes with artist credits
 * - Extracts and renders alternate images (e.g., player versions of maps)
 * - Removes image link text from captions to avoid UI pollution
 */

import type TurndownService from "turndown";
import type { MarkdownConfig, TurndownNode } from "../../types";
import { isImageUrl } from "../../utils/string";

// ============================================================================
// Artist Credit Extraction
// ============================================================================

/**
 * Get artist credit from a figure element
 */
function getArtistCredit(figure: TurndownNode): string | null {
  if (!figure.childNodes) return null;

  for (const child of figure.childNodes) {
    if (child.nodeName === "SPAN" && child.getAttribute) {
      const className = child.getAttribute("class");
      if (className && className.includes("artist-credit")) {
        return child.textContent?.trim() || null;
      }
    }
  }

  return null;
}

// ============================================================================
// Alternate Images (e.g., Player Versions of Maps)
// ============================================================================

/**
 * Extract alternate image links from figcaption
 * Returns array of {url, linkText} for each image link found
 *
 * Example: <a href="map-player.jpg">View Player Version</a>
 * Returns: [{url: "map-player.jpg", linkText: "View Player Version"}]
 */
function getAlternateImages(figcaption: TurndownNode): Array<{url: string, linkText: string}> {
  const alternates: Array<{url: string, linkText: string}> = [];

  function traverse(node: TurndownNode): void {
    if (node.nodeName === "A" && node.getAttribute) {
      const href = node.getAttribute("href");
      if (href && isImageUrl(href)) {
        alternates.push({
          url: href,
          linkText: node.textContent?.trim() || ""
        });
      }
    }

    if (node.childNodes) {
      for (const child of node.childNodes) {
        traverse(child);
      }
    }
  }

  traverse(figcaption);
  return alternates;
}

// ============================================================================
// Caption Text Extraction
// ============================================================================

/**
 * Get text from a node, handling special cases:
 * - Converts <br> tags to spaces
 * - Optionally skips image links to avoid UI text pollution
 */
function extractTextContent(node: TurndownNode, skipImageLinks: boolean = false): string {
  if (!node.childNodes || node.childNodes.length === 0) {
    return node.textContent || "";
  }

  let result = "";
  for (const child of node.childNodes) {
    if (child.nodeName === "BR") {
      result += " ";
    } else if (child.nodeName === "#text") {
      result += child.textContent || "";
    } else if (skipImageLinks && child.nodeName === "A" && child.getAttribute) {
      // Skip <a> elements that link to images (e.g., "View Player Version")
      const href = child.getAttribute("href");
      if (href && isImageUrl(href)) {
        continue; // Skip this link entirely
      }
      result += extractTextContent(child, skipImageLinks);
    } else {
      result += extractTextContent(child, skipImageLinks);
    }
  }
  return result;
}

/**
 * Get figcaption element from a figure
 */
function getFigcaptionElement(figure: TurndownNode): TurndownNode | null {
  if (!figure.childNodes) return null;

  for (const child of figure.childNodes) {
    if (child.nodeName === "FIGCAPTION") {
      return child;
    }
  }

  return null;
}

/**
 * Get clean caption text from a figure element
 * Skips image link text to avoid UI pollution (e.g., "View Player Version")
 */
function getCaptionText(figure: TurndownNode): string | null {
  const figcaption = getFigcaptionElement(figure);
  if (!figcaption) return null;

  const text = extractTextContent(figcaption, true).trim(); // Skip image links
  if (text) {
    // Clean up any multiple spaces
    return text.replace(/\s+/g, " ");
  }
  return null;
}

// ============================================================================
// Markdown Generation
// ============================================================================

/**
 * Build caption blockquote with artist credit and caption text
 */
function buildCaptionBlockquote(
  artist: string | null,
  caption: string | null,
  config: MarkdownConfig
): string {
  const lines: string[] = [];

  if (artist) {
    lines.push(`> Artist: ${artist}`);
  }

  if (caption) {
    if (artist) {
      lines.push(">"); // Empty line between artist and caption
    }
    const cleanCaption = caption.replace(/\s+/g, " ").trim();
    lines.push(
      `> ${config.strong}${config.emphasis}${cleanCaption}${config.emphasis}${config.strong}`,
    );
  }

  return lines.length > 0 ? "\n\n" + lines.join("\n") + "\n\n" : "";
}

/**
 * Build markdown for alternate images
 */
function buildAlternateImagesMarkdown(
  alternates: Array<{url: string, linkText: string}>,
  imageMapping: Map<string, string>
): string {
  let result = "";

  for (const alt of alternates) {
    const localPath = imageMapping.get(alt.url);
    if (localPath) {
      result += `\n![Alternate: ${alt.linkText}](${localPath})\n`;
    }
  }

  return result;
}

// ============================================================================
// Turndown Rule
// ============================================================================

export function figureCaptionRule(config: MarkdownConfig, imageMapping: Map<string, string>) {
  return (service: TurndownService): void => {
    // Remove artist credit spans from being processed as text
    service.addRule("artistCredit", {
      filter: (node) => {
        if (node.nodeName === "SPAN" && node.getAttribute) {
          const className = node.getAttribute("class");
          return className !== null && className.includes("artist-credit");
        }
        return false;
      },
      replacement: () => "", // Don't output anything for artist credit spans
    });

    // Remove figcaptions from being processed as text
    service.addRule("figcaption", {
      filter: "figcaption",
      replacement: () => "", // Don't output anything for figcaptions
    });

    service.addRule("figureCaption", {
      filter: "figure",
      replacement: (content, node) => {
        const figure = node as TurndownNode;

        // Extract all figure components
        const artist = getArtistCredit(figure);
        const caption = getCaptionText(figure);

        const figcaptionElement = getFigcaptionElement(figure);
        const alternates = figcaptionElement ? getAlternateImages(figcaptionElement) : [];

        // Build markdown output
        let result = content; // Primary image
        result += buildCaptionBlockquote(artist, caption, config);
        result += buildAlternateImagesMarkdown(alternates, imageMapping);

        return result;
      },
    });
  };
}
