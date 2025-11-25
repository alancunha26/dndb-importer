import type { MarkdownConfig } from "../types";

/**
 * Generate default index template
 * Generates sourcebook index page with table of contents
 */
export function getDefaultIndexTemplate(config: MarkdownConfig): string {
  const bullet = config.bulletMarker;
  const hr = config.horizontalRule;

  return `---
title: "{{{title}}}"
date: {{date}}
tags:
  ${bullet} dnd5e/source
---

# {{{title}}}
{{#if coverImage}}

![{{{title}}} Cover]({{{coverImage}}})
{{/if}}

## Contents

{{#each files}}
${bullet} [{{{this.title}}}]({{{this.filename}}})
{{/each}}

${hr}
`;
}
