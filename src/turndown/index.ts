/**
 * Turndown Configuration
 * Sets up Turndown with custom rules for D&D Beyond content
 */

import TurndownService from "turndown";
import { gfm } from "@truto/turndown-plugin-gfm";
import type { MarkdownConfig } from "../types";
import { removeHeadingLinks, unwrapLinkedImages, imageAltText, figureCaptionRule, asideRule, flexibleColumnsRule } from "./rules";

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
  turndownService.use(figureCaptionRule(config));
  turndownService.use(asideRule(config));
  turndownService.use(flexibleColumnsRule(config));

  return turndownService;
}
