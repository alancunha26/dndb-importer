/**
 * Turndown Rule: Unwrap Images from Links
 *
 * D&D Beyond wraps images in <a> tags for lightbox effect.
 * This rule unwraps them, extracts alt text from the filename,
 * and replaces remote URLs with local paths.
 */

import type TurndownService from "turndown";
import type { TurndownNode } from "../../types";

/**
 * Get alt text for an image node
 * Uses existing alt attribute or extracts from the original URL if empty
 */
function getAltText(img: TurndownNode): string {
  if (!img.getAttribute) return "image";

  const alt = img.getAttribute("alt") || "";
  if (alt && alt.trim() !== "") {
    return alt;
  }

  // Extract from original URL (not mapped path)
  try {
    const url = img.getAttribute("src") || "";
    const parsedUrl = new URL(url, "https://www.dndbeyond.com");
    const pathname = parsedUrl.pathname;
    return pathname.split("/").pop() || "image";
  } catch {
    return "image";
  }
}

/**
 * Get the source URL for an image, replacing remote URLs with local paths
 */
function getImageSrc(
  img: TurndownNode,
  imageMapping: Map<string, string>,
): string {
  if (!img.getAttribute) return "";

  const originalSrc = img.getAttribute("src") || "";
  // Replace remote URL with local path if available in mapping
  return imageMapping.get(originalSrc) || originalSrc;
}

export function unwrapLinkedImages(imageMapping: Map<string, string>) {
  return (service: TurndownService): void => {
    service.addRule("unwrapLinkedImages", {
      filter: (node) => {
        // Check if this is an <a> tag
        if (node.nodeName !== "A") return false;

        // Find any <img> children (ignoring whitespace text nodes)
        const imgNodes = Array.from(node.childNodes as TurndownNode[]).filter(
          (child) => child.nodeName === "IMG",
        );

        // Only match if there's exactly one image child
        return imgNodes.length === 1;
      },
      replacement: (_content, node) => {
        // Find the img element
        const img = Array.from(node.childNodes as TurndownNode[]).find(
          (child) => child.nodeName === "IMG",
        );

        if (!img || !img.getAttribute) return "";

        const alt = getAltText(img);
        const src = getImageSrc(img, imageMapping);

        return `![${alt}](${src})`;
      },
    });
  };
}
