/**
 * Turndown Rule: Set Alt Text on Standalone Images
 *
 * Overrides default image rule to ensure alt text is always present.
 * Extracts filename from URL if alt attribute is empty.
 * Replaces remote URLs with local paths.
 */

import type TurndownService from "turndown";

interface TurndownNode {
  nodeName: string;
  childNodes: TurndownNode[];
  getAttribute?(name: string): string | null;
}

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

export function imageAltText(imageMapping: Map<string, string>) {
  return (service: TurndownService): void => {
    service.addRule("imageAltText", {
      filter: "img",
      replacement: (_content, node) => {
        const img = node as TurndownNode;

        if (!img.getAttribute) return "";

        const alt = getAltText(img);
        const src = getImageSrc(img, imageMapping);

        return `![${alt}](${src})`;
      },
    });
  };
}
