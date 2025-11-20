import type { MarkdownConfig } from "../types";

/**
 * Generate default file template
 * Generates individual chapter/file pages with navigation
 */
export function getDefaultFileTemplate(config: MarkdownConfig): string {
  const bullet = config.bulletMarker;
  const hr = config.horizontalRule;

  return `---
title: "{{{title}}}"
date: {{date}}
tags:
{{#each tags}}
  ${bullet} {{{this}}}
{{/each}}
---

{{#if navigation.prev}}{{{navigation.prev}}} | {{/if}}{{{navigation.index}}}{{#if navigation.next}} | {{{navigation.next}}}{{/if}}

${hr}

{{{content}}}

${hr}

{{#if navigation.prev}}{{{navigation.prev}}} | {{/if}}{{{navigation.index}}}{{#if navigation.next}} | {{{navigation.next}}}{{/if}}
`;
}
