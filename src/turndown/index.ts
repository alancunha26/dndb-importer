/**
 * Turndown Configuration
 * Sets up Turndown with custom rules for D&D Beyond content
 */

import TurndownService from "turndown";
import { gfm } from "@truto/turndown-plugin-gfm";
import type { MarkdownConfig } from "../types";
import { removeHeadingLinks, unwrapLinkedImages, imageAltText, figureCaptionRule, asideRule, flexibleColumnsRule, tableRule, statBlockRules } from "./rules";

export function createTurndownService(
  config: MarkdownConfig,
  imageMapping: Map<string, string>,
): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: config.headingStyle,
    codeBlockStyle: config.codeBlockStyle,
    emDelimiter: config.emphasis,
    strongDelimiter: config.strong,
    bulletListMarker: config.bulletMarker,
    linkStyle: config.linkStyle,
    linkReferenceStyle: config.linkReferenceStyle,
    hr: config.horizontalRule,
    br: config.lineBreak,
    fence: config.codeFence,
    preformattedCode: config.preformattedCode,
  });

  // Add GitHub Flavored Markdown support (tables, strikethrough, task lists)
  turndownService.use(gfm);

  // Apply custom D&D Beyond rules
  turndownService.use(removeHeadingLinks(config));
  turndownService.use(unwrapLinkedImages(imageMapping));
  turndownService.use(imageAltText(imageMapping));
  turndownService.use(figureCaptionRule(config, imageMapping));
  turndownService.use(asideRule(config));
  turndownService.use(flexibleColumnsRule(config));
  turndownService.use(tableRule(config)); // Override GFM table rule for D&D Beyond tables
  turndownService.use(statBlockRules());

  return turndownService;
}
