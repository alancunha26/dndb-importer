import type { MarkdownConfig } from "../types";

/**
 * Generate default entity index template
 * Renders entity list with type-specific formatting
 */
export function getDefaultEntityIndexTemplate(config: MarkdownConfig): string {
  const bullet = config.bulletMarker;
  const strong = config.strong;

  return `# {{{title}}}
{{#if description}}

{{{description}}}
{{/if}}

{{#if (eq type "spells")}}
| Spell | Level | School | Casting Time |
|-------|-------|--------|--------------|
{{#each entities}}
| {{#if resolved}}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}${strong}{{{name}}}${strong}{{/if}} | {{metadata.level}} | {{metadata.school}} | {{metadata.castingTime}} |
{{/each}}

{{else if (eq type "monsters")}}
| Monster | CR | Type | Size |
|---------|----|----- |------|
{{#each entities}}
| {{#if resolved}}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}${strong}{{{name}}}${strong}{{/if}} | {{metadata.cr}} | {{metadata.type}} | {{metadata.size}} |
{{/each}}

{{else if (eq type "magic-items")}}
| Item | Rarity | Type | Attunement |
|------|--------|------|------------|
{{#each entities}}
| {{#if resolved}}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}${strong}{{{name}}}${strong}{{/if}} | {{metadata.rarity}} | {{metadata.type}} | {{metadata.attunement}} |
{{/each}}

{{else if (eq type "equipment")}}
| Equipment | Type | Cost | Weight |
|-----------|------|------|--------|
{{#each entities}}
| {{#if resolved}}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}${strong}{{{name}}}${strong}{{/if}} | {{metadata.type}} | {{metadata.cost}} | {{metadata.weight}} |
{{/each}}

{{else if (eq type "feats")}}
| Feat | Source | Tags |
|------|--------|------|
{{#each entities}}
| {{#if resolved}}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}${strong}{{{name}}}${strong}{{/if}} | {{metadata.source}} | {{metadata.tags}} |
{{/each}}

{{else if (eq type "backgrounds")}}
| Background | Source |
|------------|--------|
{{#each entities}}
| {{#if resolved}}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}${strong}{{{name}}}${strong}{{/if}} | {{metadata.source}} |
{{/each}}

{{else if (eq type "species")}}
{{#each entities}}
${bullet} {{#if resolved}}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}${strong}{{{name}}}${strong}{{/if}}
{{/each}}

{{else if (eq type "classes")}}
{{#each entities}}
${bullet} {{#if resolved}}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}${strong}{{{name}}}${strong}{{/if}}
{{/each}}

{{else}}
{{#each entities}}
${bullet} {{#if resolved}}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}${strong}{{{name}}}${strong}{{/if}}
{{/each}}
{{/if}}
`;
}
