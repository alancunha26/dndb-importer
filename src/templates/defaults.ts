/**
 * Built-in default templates
 * These are used when no user templates are provided
 */

/**
 * Default index template
 * Generates sourcebook index page with table of contents
 */
export const DEFAULT_INDEX_TEMPLATE = `---
title: "{{{title}}}"
date: {{date}}
tags:
  - dnd5e/source
---

# {{{title}}}
{{#if author}}

_by {{{author}}}_
{{/if}}
{{#if coverImage}}

![{{{title}}} Cover]({{{coverImage}}})
{{/if}}

## Contents
{{#if description}}

> {{{description}}}
{{/if}}

{{#each files}}
- [{{{this.title}}}]({{{this.filename}}})
{{/each}}
`;

/**
 * Default file template
 * Generates individual chapter/file pages with navigation
 */
export const DEFAULT_FILE_TEMPLATE = `---
title: "{{{title}}}"
date: {{date}}
tags:
{{#each tags}}
  - {{{this}}}
{{/each}}
---

{{#if navigation.prev}}{{{navigation.prev}}} | {{/if}}{{{navigation.index}}}{{#if navigation.next}} | {{{navigation.next}}}{{/if}}

---

{{{content}}}

---

{{#if navigation.prev}}{{{navigation.prev}}} | {{/if}}{{{navigation.index}}}{{#if navigation.next}} | {{{navigation.next}}}{{/if}}
`;
