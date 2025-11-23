import type { MarkdownConfig } from "../types";

/**
 * Generate default parent index template
 * Renders links to child indexes
 */
export function getDefaultParentIndexTemplate(config: MarkdownConfig): string {
  const bullet = config.bulletMarker;

  return `---
title: "{{{title}}}"
date: {{date}}
tags:
  - dnd/index
---

# {{{title}}}
{{#if parent}}

← [Back to {{{parent.title}}}]({{parent.filename}})
{{/if}}
{{#if description}}

{{{description}}}
{{/if}}

{{#each children}}
${bullet} [{{{title}}}]({{{filename}}})
{{/each}}
`;
}
