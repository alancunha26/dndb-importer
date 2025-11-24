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

| Variable      | Type   | Description                            |
| ------------- | ------ | -------------------------------------- |
| `title`       | string | Sourcebook title                       |
| `edition`     | string | Edition string (from metadata)         |
| `description` | string | Sourcebook description (from metadata) |
| `author`      | string | Author name (from metadata)            |
| `coverImage`  | string | Cover image filename (from metadata)   |
| `date`        | string | Current date (YYYY-MM-DD)              |
| `files`       | array  | Array of file objects                  |
| `metadata`    | object | Full metadata object                   |

**File Object Properties:**

| Property   | Description           |
| ---------- | --------------------- |
| `title`    | File title            |
| `filename` | Output filename       |
| `uniqueId` | 4-character unique ID |

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

| Property   | Description          |
| ---------- | -------------------- |
| `title`    | Sourcebook title     |
| `edition`  | Edition string       |
| `author`   | Author name          |
| `metadata` | Full metadata object |

**Navigation Object Properties:**

| Property | Description                   |
| -------- | ----------------------------- |
| `prev`   | Previous file link (markdown) |
| `index`  | Index file link (markdown)    |
| `next`   | Next file link (markdown)     |

## Example Templates

### Index Template

```handlebars
--- title: "{{{title}}}" edition: "{{{edition}}}" date:
{{date}}
--- #
{{{title}}}

{{#if edition}}
  **Edition:**
  {{{edition}}}
{{/if}}

{{#if description}}
  >
  {{{description}}}
{{/if}}

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

## Accessing Custom Metadata

Any custom fields in `sourcebook.json` are accessible via the `metadata` object:

```handlebars
{{#if metadata.publisher}}
  **Publisher:**
  {{{metadata.publisher}}}
{{/if}}

{{#if metadata.isbn}}
  **ISBN:**
  {{{metadata.isbn}}}
{{/if}}
```

---

# Sourcebook Metadata

Each sourcebook can have an optional `sourcebook.json` file to customize output.

## Location

Place `sourcebook.json` alongside your HTML files:

```
input/
  players-handbook/
    sourcebook.json
    01-intro.html
    02-chapter-1.html
```

## Standard Fields

```json
{
  "title": "Player's Handbook 2024",
  "edition": "5th Edition (2024)",
  "description": "Core rulebook for creating characters and playing D&D",
  "author": "Wizards of the Coast",
  "coverImage": "cover.png",
  "titles": [
    "Introduction",
    "Chapter 1: Playing the Game",
    "Chapter 2: Creating a Character"
  ]
}
```

All fields are optional.

### Field Descriptions

| Field         | Description                                 |
| ------------- | ------------------------------------------- |
| `title`       | Sourcebook title (overrides directory name) |
| `edition`     | Edition string for templates                |
| `description` | Sourcebook description                      |
| `author`      | Author or publisher name                    |
| `coverImage`  | Cover image filename                        |
| `titles`      | Array of page titles in file sort order     |

### Titles Array

The `titles` array overrides automatic title extraction from HTML. Use this when D&D Beyond page titles are inconsistent or need cleanup.

Titles must be in the same order as your HTML files (sorted alphabetically by filename).

## Custom Fields

Add any custom fields you need:

```json
{
  "title": "Player's Handbook 2024",
  "publisher": "Wizards of the Coast",
  "isbn": "978-0-7869-6966-1",
  "pageCount": 384,
  "releaseDate": "2024-09-17"
}
```

Access custom fields in templates via `metadata`:

```handlebars
{{#if metadata.isbn}}
  **ISBN:**
  {{{metadata.isbn}}}
{{/if}}
```

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

## Benefits

- **Custom titles** - Override directory name with proper formatting
- **Rich metadata** - Add edition, author, description for index pages
- **Template flexibility** - Access any field in custom templates
- **Portable** - Metadata travels with the sourcebook folder
