/**
 * Built-in default templates
 * These are used when no user templates are provided
 */

import type { MarkdownConfig } from "../types";

/**
 * Generate default index template
 * Generates sourcebook index page with table of contents
 */
export function getDefaultIndexTemplate(config: MarkdownConfig): string {
  const em = config.emphasis;
  const bullet = config.bulletMarker;
  const hr = config.horizontalRule;

  return `---
title: "{{{title}}}"
date: {{date}}
tags:
  ${bullet} dnd5e/source
---

# {{{title}}}
{{#if author}}

${em}by {{{author}}}${em}
{{/if}}
{{#if coverImage}}

![{{{title}}} Cover]({{{coverImage}}})
{{/if}}

## Contents
{{#if description}}

> {{{description}}}
{{/if}}

{{#each files}}
${bullet} [{{{this.title}}}]({{{this.filename}}})
{{/each}}

${hr}
`;
}

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
