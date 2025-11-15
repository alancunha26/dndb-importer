/**
 * Turndown Configuration
 * Sets up Turndown with custom rules for D&D Beyond content
 */

import TurndownService from "turndown";

export function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
    bulletListMarker: "-",
    linkStyle: "inlined",
  });

  // TODO: Add custom rules for D&D Beyond content
  // - Stat blocks
  // - Spell blocks
  // - Tables
  // - Cross-references

  return turndownService;
}
