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

{{#if (eq type "spells")}}
{{#each (sortKeys (groupBy entities "metadata.level") "Cantrip")}}
## {{spellLevel @key}}

| Spell {{#unless ../filters.school}}| School {{/unless}}| Casting Time | Duration | Range/Area | Components | Special |
|-------{{#unless ../filters.school}}|--------{{/unless}}|--------------|----------|------------|------------|---------|
{{#each this}}
{{#if resolved}}
| [{{{name}}}]({{{fileId}}}.md#{{{anchor}}}) {{#unless ../../filters.school}}| {{{capitalize metadata.school}}} {{/unless}}| {{{metadata.castingTime}}} | {{{metadata.duration}}} | {{{metadata.range}}}{{#if metadata.area}} ({{{metadata.area}}}){{/if}} | {{{metadata.components}}} | {{{spellSpecial metadata}}} |
{{/if}}
{{/each}}

{{/each}}

{{else if (eq type "monsters")}}
{{#if (contains title "by CR")}}
{{#each (sortKeys (groupBy entities "metadata.cr"))}}
## CR {{@key}}

| Name {{#unless ../filters.type}}| Type {{/unless}}{{#unless ../filters.size}}| Size {{/unless}}| Alignment |
|------{{#unless ../filters.type}}|------{{/unless}}{{#unless ../filters.size}}|------{{/unless}}|-----------|
{{#each this}}
{{#if resolved}}
| [{{{name}}}]({{{fileId}}}.md#{{{anchor}}}) {{#unless ../../filters.type}}| {{{metadata.type}}}{{#if metadata.subtype}} ({{{metadata.subtype}}}){{/if}} {{/unless}}{{#unless ../../filters.size}}| {{{metadata.size}}} {{/unless}}| {{{metadata.alignment}}} |
{{/if}}
{{/each}}

{{/each}}
{{else}}
| CR | Name {{#unless filters.type}}| Type {{/unless}}{{#unless filters.size}}| Size {{/unless}}| Alignment |
|----|------{{#unless filters.type}}|------{{/unless}}{{#unless filters.size}}|------{{/unless}}|-----------|
{{#each entities}}
{{#if resolved}}
| {{{metadata.cr}}} | [{{{name}}}]({{{fileId}}}.md#{{{anchor}}}) {{#unless ../filters.type}}| {{{metadata.type}}}{{#if metadata.subtype}} ({{{metadata.subtype}}}){{/if}} {{/unless}}{{#unless ../filters.size}}| {{{metadata.size}}} {{/unless}}| {{{metadata.alignment}}} |
{{/if}}
{{/each}}
{{/if}}

{{else if (eq type "magic-items")}}
| Item {{#unless filters.rarity}}| Rarity {{/unless}}{{#unless filters.type}}| Type {{/unless}}| Attunement |
|------{{#unless filters.rarity}}|--------{{/unless}}{{#unless filters.type}}|------{{/unless}}|------------|
{{#each entities}}
{{#if resolved}}
| [{{{name}}}]({{{fileId}}}.md#{{{anchor}}}) {{#unless ../filters.rarity}}| {{{metadata.rarity}}} {{/unless}}{{#unless ../filters.type}}| {{{metadata.type}}} {{/unless}}| {{{metadata.attunement}}} |
{{/if}}
{{/each}}

{{else if (eq type "equipment")}}
| Equipment | Type | Cost | Weight |
|-----------|------|------|--------|
{{#each entities}}
{{#if resolved}}
| [{{{name}}}]({{{fileId}}}.md#{{{anchor}}}) | {{{metadata.type}}} | {{{metadata.cost}}} | {{{metadata.weight}}} |
{{/if}}
{{/each}}

{{else if (eq type "feats")}}
{{#each (sortKeys (groupBy entities "metadata.tags") "Origin" "General" "Fighting Style" "Epic Boon")}}
## {{{@key}}}

{{#each this}}
{{#if resolved}}
${bullet} [{{{name}}}]({{{fileId}}}.md#{{{anchor}}})
{{/if}}
{{/each}}

{{/each}}

{{else if (eq type "backgrounds")}}
{{#each entities}}
{{#if resolved}}
- [{{{name}}}]({{{fileId}}}.md#{{{anchor}}})
{{/if}}
{{/each}}

{{else if (eq type "species")}}
{{#each entities}}
{{#if resolved}}
${bullet} [{{{name}}}]({{{fileId}}}.md#{{{anchor}}})
{{/if}}
{{/each}}

{{else if (eq type "classes")}}
{{#each entities}}
{{#if resolved}}
${bullet} [{{{name}}}]({{{fileId}}}.md#{{{anchor}}})
{{/if}}
{{/each}}

{{else}}
{{#each entities}}
{{#if resolved}}
${bullet} [{{{name}}}]({{{fileId}}}.md#{{{anchor}}})
{{/if}}
{{/each}}
{{/if}}
`;
}
