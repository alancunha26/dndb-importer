/**
 * Turndown-related types
 */

/**
 * TurndownNode represents a DOM node in Turndown's processing
 * This is a minimal interface matching what Turndown provides
 */
export interface TurndownNode {
  nodeName: string;
  childNodes: TurndownNode[];
  getAttribute?(name: string): string | null;
  textContent?: string;
}
