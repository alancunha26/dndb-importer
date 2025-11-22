import type { MarkdownConfig } from "../types";

/**
 * Generate default parent index template
 * Renders links to child indexes
 */
export function getDefaultParentIndexTemplate(config: MarkdownConfig): string {
  const bullet = config.bulletMarker;

  return `# {{{title}}}
{{#if description}}

{{{description}}}
{{/if}}

{{#each children}}
${bullet} [{{{title}}}]({{{filename}}})
{{/each}}
`;
}
