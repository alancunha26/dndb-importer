import type { MarkdownConfig } from "../types";

/**
 * Generate default global index template
 * Renders links to sourcebooks and entity indexes
 */
export function getDefaultGlobalIndexTemplate(config: MarkdownConfig): string {
  const bullet = config.bulletMarker;

  return `---
title: "{{{title}}}"
date: {{date}}
tags:
  - dnd/index
---

# {{{title}}}

{{#if sourcebooks.length}}
## Sourcebooks

{{#each sourcebooks}}
${bullet} [{{{title}}}]({{{id}}}.md)
{{/each}}

{{/if}}
{{#if entityIndexes.length}}
## Compendium

{{#each entityIndexes}}
${bullet} [{{{title}}}]({{{filename}}})
{{/each}}
{{/if}}
`;
}
