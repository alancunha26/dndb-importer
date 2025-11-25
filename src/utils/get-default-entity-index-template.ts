import type { MarkdownConfig } from "../types";

/**
 * Generate default entity index template
 * Renders entity list with type-specific formatting
 */
export function getDefaultEntityIndexTemplate(config: MarkdownConfig): string {
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
{{#if children}}

## Contents
{{#each children}}
${bullet} [{{{title}}}]({{{filename}}})
{{/each}}
{{/if}}
{{#if type}}

{{#if (eq type "spells")}}
{{#each (sortKeys (groupBy entities "metadata.level") "Cantrip")}}
## {{spellLevel @key}}

{{#each this}}
{{#if resolved}}
${bullet} {{{link}}}
{{/if}}
{{/each}}

{{/each}}

{{else if (eq type "monsters")}}
{{#if (contains title "by CR")}}
{{#each (sortNumeric (groupBy entities "metadata.cr"))}}
## CR {{@key}}

{{#each this}}
{{#if resolved}}
${bullet} {{{link}}}
{{/if}}
{{/each}}

{{/each}}
{{else}}
{{#each entities}}
{{#if resolved}}
${bullet} {{{link}}}
{{/if}}
{{/each}}
{{/if}}

{{else if (eq type "feats")}}
{{#each (sortKeys (groupBy entities "metadata.tags") "Origin" "General" "Fighting Style" "Epic Boon")}}
## {{{@key}}}

{{#each this}}
{{#if resolved}}
${bullet} {{{link}}}
{{/if}}
{{/each}}

{{/each}}

{{else}}
{{#each entities}}
{{#if resolved}}
${bullet} {{{link}}}
{{/if}}
{{/each}}
{{/if}}
{{/if}}
`;
}
