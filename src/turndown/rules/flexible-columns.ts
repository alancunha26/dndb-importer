/**
 * Turndown Rule: Convert Flexible Column Lists to Markdown
 *
 * D&D Beyond uses flexible-*-column classes for both simple lists and complex layouts.
 * This rule converts simple lists (plain text/links) to markdown unordered lists,
 * while preserving complex layouts (tables, figures, nested content).
 */

import type TurndownService from "turndown";
import type { MarkdownConfig, TurndownNode } from "../../types";

// ============================================================================
// Content Classification
// ============================================================================

/**
 * Check if a node is a simple text container (p or div with only text/links)
 */
function isSimpleTextNode(node: TurndownNode): boolean {
  const nodeName = node.nodeName;

  // Must be P or DIV
  if (nodeName !== "P" && nodeName !== "DIV") {
    return false;
  }

  // Check if it only contains text nodes and/or links
  if (!node.childNodes || node.childNodes.length === 0) {
    // Empty node or text-only node
    return true;
  }

  // Check all children
  for (const child of node.childNodes) {
    const childName = child.nodeName;

    // Allow text nodes (#text), links (A), and inline formatting (STRONG, EM, CODE)
    if (
      childName === "#text" ||
      childName === "A" ||
      childName === "STRONG" ||
      childName === "EM" ||
      childName === "CODE"
    ) {
      continue;
    }

    // Any other element type means this is not a simple text node
    return false;
  }

  return true;
}

/**
 * Check if all children of a flexible column are simple text nodes
 */
function hasOnlySimpleContent(node: TurndownNode): boolean {
  if (!node.childNodes || node.childNodes.length === 0) {
    return false;
  }

  for (const child of node.childNodes) {
    // Skip text nodes and whitespace
    if (child.nodeName === "#text") {
      const text = child.textContent?.trim();
      if (!text) continue; // Skip whitespace-only text nodes
      // Text directly in the column (not wrapped in p/div) = not a simple list
      return false;
    }

    // Check if this is a simple text container
    if (!isSimpleTextNode(child)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Markdown List Rendering
// ============================================================================

/**
 * Render flexible column as markdown unordered list
 */
function renderAsList(content: string, bulletMarker: string): string {
  const items: string[] = [];

  // Split content by paragraphs/divs and convert to list items
  // We use the already-converted content from Turndown, not the original HTML
  const lines = content.trim().split("\n\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      // Remove any leading/trailing whitespace and newlines within the item
      const cleaned = trimmed.replace(/\n+/g, " ");
      items.push(`${bulletMarker} ${cleaned}`);
    }
  }

  if (items.length === 0) {
    return content;
  }

  return `\n\n${items.join("\n")}\n\n`;
}

// ============================================================================
// Turndown Rule
// ============================================================================

/**
 * Factory function to create flexible column rule with markdown config
 */
export function flexibleColumnsRule(config: MarkdownConfig) {
  return (service: TurndownService): void => {
  service.addRule("flexibleColumns", {
    filter: (node) => {
      if (node.nodeName !== "DIV" || !node.getAttribute) {
        return false;
      }

      const className = node.getAttribute("class");
      if (!className) {
        return false;
      }

      // Match flexible-quad-column, flexible-triple-column, flexible-double-column, etc.
      return /flexible-(?:quad|triple|double|single)-column/.test(className);
    },
      replacement: (content, node) => {
        const flexNode = node as TurndownNode;

        // Check if this is a simple list or complex layout
        if (hasOnlySimpleContent(flexNode)) {
          // Simple content: Convert to markdown list
          return renderAsList(content, config.bulletMarker);
        }

        // Complex content: Preserve default behavior (just return content)
        return content;
      },
    });
  };
}
