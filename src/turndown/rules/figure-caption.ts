/**
 * Turndown Rule: Convert Figure Captions to Blockquotes
 *
 * D&D Beyond uses <figure> elements with artist credits and figcaptions.
 * This rule converts them to blockquotes with:
 * - Artist: [name]
 * - Empty line
 * - Bold italic caption text
 */

import type TurndownService from "turndown";
import type { MarkdownConfig, TurndownNode } from "../../types";

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

/**
 * Get text from a node, handling <br> tags as spaces
 */
function getTextWithBreaks(node: TurndownNode): string {
  if (!node.childNodes || node.childNodes.length === 0) {
    return node.textContent || "";
  }

  let result = "";
  for (const child of node.childNodes) {
    if (child.nodeName === "BR") {
      result += " ";
    } else if (child.nodeName === "#text") {
      result += child.textContent || "";
    } else {
      result += getTextWithBreaks(child);
    }
  }
  return result;
}

/**
 * Get figcaption text from a figure element
 * Handles <br> tags by converting them to spaces
 */
function getFigcaption(figure: TurndownNode): string | null {
  if (!figure.childNodes) return null;

  for (const child of figure.childNodes) {
    if (child.nodeName === "FIGCAPTION") {
      const text = getTextWithBreaks(child).trim();
      if (text) {
        // Clean up any multiple spaces
        return text.replace(/\s+/g, " ");
      }
      return null;
    }
  }

  return null;
}

export function figureCaptionRule(config: MarkdownConfig) {
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

        const artist = getArtistCredit(figure);
        const caption = getFigcaption(figure);

        // Build blockquote if we have artist or caption
        const lines: string[] = [];

        if (artist) {
          lines.push(`> Artist: ${artist}`);
        }

        if (caption) {
          if (artist) {
            lines.push(">"); // Empty line between artist and caption
          }
          // Clean up any multiple spaces
          const cleanCaption = caption.replace(/\s+/g, " ").trim();
          lines.push(
            `> ${config.strong}${config.emphasis}${cleanCaption}${config.emphasis}${config.strong}`,
          );
        }

        // If we have a blockquote, append it to the content (which includes the image)
        if (lines.length > 0) {
          return content + "\n\n" + lines.join("\n") + "\n\n";
        }

        // Otherwise just return the content (image only)
        return content;
      },
    });
  };
}
