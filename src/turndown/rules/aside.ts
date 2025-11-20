/**
 * Turndown Rule: Convert Aside Elements to Appropriate Markdown
 *
 * D&D Beyond uses <aside> elements for various callout boxes.
 * This rule converts them to Obsidian/GitHub callout format.
 * Format: > [!type]+ TITLE
 */

import type TurndownService from "turndown";
import type { MarkdownConfig, TurndownNode } from "../../types";

// ============================================================================
// Aside Classification
// ============================================================================

/**
 * Rendering strategy types for aside elements
 */
type AsideRenderingType = "plain" | "blockquote" | "callout";

/**
 * Mapping of CSS class patterns to rendering strategies
 * Order matters: first match wins
 */
const ASIDE_RENDERING_MAP: Array<{
  pattern: string;
  type: AsideRenderingType;
}> = [
  { pattern: "gameplay-callout", type: "plain" },
  { pattern: "epigraph", type: "blockquote" },
  { pattern: "monster-lore", type: "blockquote" },
  { pattern: "text--quote-box", type: "blockquote" },
];

/**
 * Determine which rendering strategy to use for an aside
 */
function getAsideRenderingType(className: string): AsideRenderingType {
  for (const mapping of ASIDE_RENDERING_MAP) {
    if (className.includes(mapping.pattern)) {
      return mapping.type;
    }
  }

  return "callout";
}

/**
 * Mapping of CSS class patterns to Obsidian callout types
 * Only used for asides with rendering type "callout"
 */
const CALLOUT_TYPE_MAP: Array<{ pattern: string; type: string }> = [
  { pattern: "rhythm-box", type: "note" },
  // Default: text--rules-sidebar and unknown types use "info"
];

/**
 * Get Obsidian callout type for asides that render as callouts
 * Only called for asides with rendering type "callout"
 */
function getCalloutType(className: string): string {
  for (const mapping of CALLOUT_TYPE_MAP) {
    if (className.includes(mapping.pattern)) {
      return mapping.type;
    }
  }
  return "info"; // Default fallback
}

// ============================================================================
// Title Extraction for Callouts
// ============================================================================

/**
 * Extract title from first <strong> element (recursively)
 * Used for rhythm-box callouts
 */
function extractFirstStrong(node: TurndownNode): string | null {
  if (node.nodeName === "STRONG") {
    return node.textContent?.trim() || null;
  }

  if (node.childNodes) {
    for (const child of node.childNodes) {
      const result = extractFirstStrong(child);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Extract title from first paragraph if it looks like a title
 * Used for text--rules-sidebar callouts (default behavior)
 */
function extractFirstParagraph(node: TurndownNode): string | null {
  if (!node.childNodes) return null;

  for (const child of node.childNodes) {
    if (child.nodeName === "P") {
      const text = child.textContent?.trim();
      // Short paragraph without period is likely a title
      if (text && text.length < 100 && !text.endsWith(".")) {
        return text;
      }
      return null;
    }
  }

  return null;
}

/**
 * Extract title for callout-style asides
 * Only called for asides with rendering type "callout"
 */
function extractCalloutTitle(
  node: TurndownNode,
  className: string,
): string | null {
  // rhythm-box: Use first <strong> element
  if (className.includes("rhythm-box")) {
    const strongTitle = extractFirstStrong(node);
    if (strongTitle) {
      return strongTitle.replace(/\.$/, ""); // Remove trailing period
    }
    return null;
  }

  // Default: First paragraph approach (for text--rules-sidebar and unknown)
  return extractFirstParagraph(node);
}

// ============================================================================
// Content Cleanup Helpers
// ============================================================================

/**
 * Remove title from content for callout-style asides
 * Only called for asides with rendering type "callout"
 */
function removeCalloutTitle(
  title: string | null,
  content: string,
  className: string,
  config: MarkdownConfig,
): string {
  if (!title) return content.trim();

  const finalContent = content.trim();

  if (className.includes("rhythm-box")) {
    // Title is from first <strong>, remove it from content
    // Use configured strong delimiter (** or __)
    const escapedDelimiter = escapeRegex(config.strong);
    const titlePattern = new RegExp(
      `^${escapedDelimiter}${escapeRegex(title)}[.:]?${escapedDelimiter}\\s*`,
      "",
    );
    return finalContent.replace(titlePattern, "").trim();
  }

  // text--rules-sidebar: Title is first paragraph, remove it if it matches
  const lines = finalContent.split("\n");
  if (lines.length > 0 && lines[0].trim() === title) {
    return lines.slice(1).join("\n").trim();
  }

  return finalContent;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================================
// Rendering Strategies
// ============================================================================

/**
 * Render aside as plain content (used for gameplay-callout)
 */
function renderAsPlainContent(content: string): string {
  return `\n\n${content.trim()}\n\n`;
}

/**
 * Render aside as simple blockquote (used for epigraph)
 */
function renderAsBlockquote(content: string): string {
  const blockquoteContent = content.trim().replace(/\n/g, "\n> ");
  return `\n\n> ${blockquoteContent}\n\n`;
}

/**
 * Render aside as Obsidian/GitHub callout (used for text--rules-sidebar and rhythm-box)
 */
function renderAsCallout(
  content: string,
  className: string,
  node: TurndownNode,
  config: MarkdownConfig,
): string {
  const calloutType = getCalloutType(className);
  const title = extractCalloutTitle(node, className);

  // Format callout header: > [!type]+ Title
  const calloutHeader = `[!${calloutType}]`;
  const titleLine = title ? `${calloutHeader}+ ${title}` : calloutHeader;

  // Remove title from content (respects markdown config)
  const finalContent = removeCalloutTitle(title, content, className, config);

  // Build the callout
  const calloutLines = [`> ${titleLine}`];

  if (finalContent) {
    calloutLines.push(`> ${finalContent.replace(/\n/g, "\n> ")}`);
  }

  return `\n\n${calloutLines.join("\n")}\n\n`;
}

// ============================================================================
// Turndown Rule
// ============================================================================

/**
 * Factory function to create the aside rule with markdown config
 */
export function asideRule(config: MarkdownConfig) {
  return (service: TurndownService): void => {
    // Remove example-number spans from being processed
    service.addRule("exampleNumber", {
      filter: (node) => {
        if (node.nodeName === "SPAN" && node.getAttribute) {
          const className = node.getAttribute("class");
          return className !== null && className.includes("example-number");
        }
        return false;
      },
      replacement: () => "",
    });

    service.addRule("aside", {
      filter: "aside",
      replacement: (content, node) => {
        const aside = node as TurndownNode;
        const className = aside.getAttribute
          ? aside.getAttribute("class") || ""
          : "";

        switch (getAsideRenderingType(className)) {
          case "plain":
            return renderAsPlainContent(content);
          case "blockquote":
            return renderAsBlockquote(content);
          case "callout":
            return renderAsCallout(content, className, aside, config);
        }
      },
    });
  };
}
