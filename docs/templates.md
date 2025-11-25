# Template Guide

The converter uses Handlebars templates for customizable output. Templates can be defined globally or per-sourcebook.

**Related Documentation:**

- [Architecture](architecture.md) - Pipeline overview and template system
- [Configuration](configuration.md) - Markdown formatting options
- [Entity Indexer](indexer.md) - Entity index templates

## Template Precedence

Templates are loaded in this order (highest priority first):

1. **Sourcebook-specific**: `input/players-handbook/index.md.hbs`
2. **Global**: `input/index.md.hbs`
3. **Built-in defaults**

## Template Types

### Index Template (`index.md.hbs`)

Generates the table of contents for each sourcebook.

**Available Variables:**

| Variable     | Type   | Description                    |
| ------------ | ------ | ------------------------------ |
| `title`      | string | Sourcebook title               |
| `date`       | string | Current date (YYYY-MM-DD)      |
| `coverImage` | string | Cover image filename (optional)|
| `files`      | array  | Array of file objects          |

**File Object Properties:**

| Property   | Description           |
| ---------- | --------------------- |
| `title`    | File title            |
| `filename` | Output filename       |
| `id`       | 4-character unique ID |

### File Template (`file.md.hbs`)

Generates individual chapter/file pages.

**Available Variables:**

| Variable     | Type   | Description                |
| ------------ | ------ | -------------------------- |
| `title`      | string | File title                 |
| `date`       | string | Current date (YYYY-MM-DD)  |
| `tags`       | array  | Array of tag strings       |
| `sourcebook` | object | Sourcebook info object     |
| `navigation` | object | Navigation links object    |
| `content`    | string | Converted markdown content |

**Sourcebook Object Properties:**

| Property | Description      |
| -------- | ---------------- |
| `title`  | Sourcebook title |

**Navigation Object Properties:**

| Property | Description                   |
| -------- | ----------------------------- |
| `prev`   | Previous file link (markdown) |
| `index`  | Index file link (markdown)    |
| `next`   | Next file link (markdown)     |

### Entity Index Template (`entity-index.md.hbs`)

Generates entity indexes (spells, monsters, items, etc.) or hierarchical parent indexes linking to child indexes.

**Available Variables (with entities):**

| Variable      | Type   | Description                                  |
| ------------- | ------ | -------------------------------------------- |
| `title`       | string | Index title                                  |
| `description` | string | Index description (optional)                 |
| `type`        | string | Entity type ("spells", "monsters", etc.)     |
| `entities`    | array  | Array of entity objects                      |

**Entity Object Properties:**

| Property   | Type    | Description                                    |
| ---------- | ------- | ---------------------------------------------- |
| `name`     | string  | Entity name                                    |
| `url`      | string  | Original D&D Beyond URL                        |
| `metadata` | object  | Entity metadata (level, CR, rarity, etc.)      |
| `fileId`   | string  | Local file ID (if resolved)                    |
| `anchor`   | string  | Markdown anchor (if resolved)                  |
| `resolved` | boolean | Whether entity was found in converted files    |

**Available Variables (with children - hierarchical indexes):**

| Variable      | Type   | Description                                  |
| ------------- | ------ | -------------------------------------------- |
| `title`       | string | Index title                                  |
| `description` | string | Index description (optional)                 |
| `children`    | array  | Array of child index objects                 |

**Child Index Object Properties:**

| Property   | Description           |
| ---------- | --------------------- |
| `title`    | Child index title     |
| `filename` | Child index filename  |

Note: The same template is used for both entity lists and hierarchical indexes. Check for `entities` vs `children` to render appropriately.

### Global Index Template (`global-index.md.hbs`)

Generates the global index linking all sourcebooks and entity indexes.

**Available Variables:**

| Variable        | Type   | Description                      |
| --------------- | ------ | -------------------------------- |
| `title`         | string | Global index title               |
| `sourcebooks`   | array  | Array of sourcebook objects      |
| `entityIndexes` | array  | Array of entity index objects    |

**Sourcebook Object Properties:**

| Property | Description           |
| -------- | --------------------- |
| `title`  | Sourcebook title      |
| `id`     | 4-character unique ID |

**Entity Index Object Properties:**

| Property   | Description           |
| ---------- | --------------------- |
| `title`    | Entity index title    |
| `filename` | Entity index filename |

## Example Templates

### Index Template

```handlebars
---
title: "{{{title}}}"
date: {{date}}
---

# {{{title}}}

## Contents

{{#each files}}
{{@index}}. [{{{this.title}}}]({{{this.filename}}})
{{/each}}
```

### File Template

```handlebars
--- title: "{{{title}}}" date:
{{date}}
tags: [{{#each tags}}"{{{this}}}"{{#unless @last}}, {{/unless}}{{/each}}] --- #
{{{title}}}

{{{navigation.prev}}}
|
{{{navigation.index}}}
|
{{{navigation.next}}}

{{{content}}}
```

### Custom Obsidian Template

```handlebars
--- title: "{{{title}}}" aliases: ["{{{title}}}"] cssclass: dnd-sourcebook --- #
{{{title}}}

> [!info] Navigation >
{{{navigation.prev}}}
|
{{{navigation.index}}}
|
{{{navigation.next}}}

{{{content}}}
```

## HTML Escaping

Use triple braces `{{{variable}}}` to output unescaped content. This is essential for:

- Markdown content (`{{{content}}}`)
- Titles with special characters
- Navigation links

Double braces `{{variable}}` will HTML-escape the output.

## Conditional Blocks

```handlebars
{{#if edition}}
  **Edition:**
  {{{edition}}}
{{/if}}

{{#unless @last}}, {{/unless}}
```

## Iteration

```handlebars
{{#each files}}
  - [{{{this.title}}}]({{{this.filename}}})
{{/each}}
```

Access the index with `@index` and check for last item with `@last`.

## Custom Handlebars Helpers

The converter provides custom Handlebars helpers for common template operations:

### Sorting Helpers

#### `sortKeys`

Sort object keys alphabetically with optional priority keys.

```handlebars
{{#each (sortKeys (groupBy entities "metadata.tags") "Origin" "General")}}
  ## {{{@key}}}
  {{#each this}}
    - {{{name}}}
  {{/each}}
{{/each}}
```

Sorts alphabetically, but "Origin" and "General" appear first in that order.

#### `sortNumeric`

Sort object keys numerically, handling both integers and fractions.

```handlebars
{{#each (sortNumeric (groupBy entities "metadata.cr"))}}
  ## CR {{@key}}
  {{#each this}}
    - {{{name}}}
  {{/each}}
{{/each}}
```

Correctly sorts Challenge Ratings: 0, 1/8, 1/4, 1/2, 1, 2, ..., 30

Also handles prefixes like "CR 1/8" or "Level 5" by extracting the numeric part.

### Data Transformation

#### `groupBy`

Group array items by a field path.

```handlebars
{{#each (groupBy entities "metadata.school")}}
  ## {{{@key}}} Spells
  {{#each this}}
    - {{{name}}}
  {{/each}}
{{/each}}
```

### Formatting Helpers

#### `spellLevel`

Format spell level for display.

```handlebars
{{spellLevel "cantrip"}} → "Cantrip"
{{spellLevel "1"}}       → "1 Level"
{{spellLevel "9"}}       → "9 Level"
```

#### `spellSpecial`

Build spell special column (R=Ritual, C=Concentration).

```handlebars
{{spellSpecial metadata}} → "R, C"  (if both apply)
{{spellSpecial metadata}} → "R"     (if only ritual)
{{spellSpecial metadata}} → ""      (if neither)
```

### Comparison Helpers

- `eq` - Equality: `{{#if (eq type "spells")}}`
- `ne` - Not equal: `{{#if (ne status "completed")}}`
- `gt` / `lt` - Greater/less than: `{{#if (gt count 10)}}`
- `gte` / `lte` - Greater/less or equal
- `and` / `or` - Logical operators: `{{#if (and resolved (eq type "spell"))}}`
- `not` - Logical not: `{{#if (not resolved)}}`

### String Helpers

#### `capitalize`

Capitalize first letter.

```handlebars
{{capitalize "fire"}} → "Fire"
```

#### `contains`

Case-insensitive substring check.

```handlebars
{{#if (contains title "by CR")}}
  Monsters grouped by Challenge Rating
{{/if}}
```
