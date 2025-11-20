# D&D Beyond HTML to Markdown Converter

Convert D&D Beyond HTML sourcebooks to clean, structured Markdown files.

## Overview

This CLI tool converts locally downloaded D&D Beyond HTML pages into Markdown format with:

**Content Features:**

- Unique 4-character ID-based file naming for conflict-free organization
- Local image downloading with unique IDs
- Navigation links between related content (prev/index/next)
- D&D-specific formatting preservation (stat blocks, spell descriptions, tables)
- YAML front matter with metadata and tags
- Cross-reference resolution between books (optional)
- **Customizable templates** using Handlebars (global and per-sourcebook)
- **Sourcebook metadata** via `sourcebook.json` files

**Architecture Highlights:**

- Memory-efficient streaming pipeline (constant memory usage regardless of book count)
- Processes files one at a time, writing immediately to disk
- Link resolution with anchor validation and smart matching (plural/singular, prefix matching)
- Modular pipeline design with shared context object

## Project Status

**Feature Complete** - Core converter with link resolution implemented and tested.

See [docs/rfcs/0001-dndbeyond-html-markdown-converter.md](docs/rfcs/0001-dndbeyond-html-markdown-converter.md) for the architecture specification.

## Installation

```bash
npm install
```

## Development

```bash
# Run in development mode
npm run dndb-convert -- --help

# Build for production
npm run build

# Run built version
npm run dndb-convert:dist -- --help

# Type check
npm run type-check

# Lint code
npm run lint

# Format code
npm run format
```

## Usage

```bash
# Convert all books in input directory
dndb-convert --input ./input --output ./output

# Convert specific book
dndb-convert --input ./input/players-handbook --output ./output

# Dry run (preview without writing)
dndb-convert --input ./input --dry-run

# Verbose output
dndb-convert --input ./input --output ./output --verbose

# Use custom config file
dndb-convert --input ./input --output ./output --config ./my-config.json
```

## Configuration

The tool uses a layered configuration system:

1. **Default config** - Built-in defaults from `config/default.json`
2. **User config** - OS-specific user configuration (optional)
3. **Custom config** - CLI `--config` flag (highest priority)

### User Config Location

```bash
# Show where your user config should be located
dndb-convert config
```

**Config locations by OS:**

- **Linux:** `$XDG_CONFIG_HOME/dndbeyond-importer/config.json` (defaults to `~/.config/dndbeyond-importer/config.json`)
- **macOS:** `~/Library/Preferences/dndbeyond-importer/config.json`
- **Windows:** `%APPDATA%\dndbeyond-importer\config.json`

Create a `config.json` in your OS-specific directory to customize settings. See `src/config/default.json` for all available options.

The configuration system follows the XDG Base Directory specification on Linux and platform conventions on other operating systems.

### Default Configuration

Here's the complete default configuration with explanations for each option:

```jsonc
{
  // === Input/Output Directories ===
  "input": "./input",                  // Where your downloaded HTML files are located
  "output": "./output",                // Where to write converted markdown files

  // === Unique ID Settings ===
  "ids": {
    "length": 4,                     // Length of generated IDs (e.g., "a3f9")
    "characters": "abcdefghijklmnopqrstuvwxyz0123456789"  // Character set for IDs
  },

  // === Markdown Formatting ===
  // Customize how your markdown is generated to match your preferred style
  // or tool requirements (Obsidian, GitHub, CommonMark, etc.)
  "markdown": {
    "headingStyle": "atx",           // "atx" (# Heading) or "setext" (underlined)
    "codeBlockStyle": "fenced",      // "fenced" (```) or "indented" (4 spaces)
    "emphasis": "_",                 // "_" or "*" for italic text
    "strong": "**",                  // "**" or "__" for bold text
    "bulletMarker": "-",             // "-", "+", or "*" for unordered lists
    "linkStyle": "inlined",          // "inlined" [text](url) or "referenced" [text][ref]
    "linkReferenceStyle": "full",    // "full", "collapsed", or "shortcut" (for referenced links)
    "horizontalRule": "---",         // Any string (e.g., "---", "* * *", "___")
    "lineBreak": "  ",               // Two spaces for soft line breaks
    "codeFence": "```",              // "```" or "~~~" for fenced code blocks
    "preformattedCode": false        // Preserve preformatted code blocks
  },

  // === HTML Parsing ===
  "html": {
    "contentSelector": ".p-article-content",  // CSS selector for main content
    "removeSelectors": []                     // CSS selectors for elements to remove
  },

  // === Image Download Settings ===
  "images": {
    "download": true,                // Enable/disable image downloading
    "formats": ["png", "jpg", "jpeg", "webp", "gif"],  // Allowed image formats
    "maxSize": 10485760,             // Maximum image size in bytes (10MB)
    "timeout": 30000,                // Download timeout in milliseconds (30s)
    "retries": 3                     // Number of retry attempts for failed downloads
  },

  // === Link Resolution ===
  "links": {
    "resolveInternal": true,         // Enable/disable link resolution
    "fallbackStyle": "bold",         // How to format unresolved links: "bold", "italic", "plain", "none"
    "urlAliases": {                  // Map URLs to canonical forms
      // Source aliasing (Free Rules → PHB)
      "/sources/dnd/free-rules/equipment": "/sources/dnd/phb-2024/equipment",
      // Entity aliasing (variant items → base items)
      "/magic-items/4585-belt-of-hill-giant-strength": "/magic-items/5372-belt-of-giant-strength"
    },
    "entityLocations": {             // Map entity types to allowed source pages
      "spells": ["/sources/dnd/phb-2024/spell-descriptions"],
      "monsters": ["/sources/dnd/mm-2024/monsters-a", "/sources/dnd/mm-2024/monsters-b"],
      "magic-items": ["/sources/dnd/dmg-2024/magic-items"]
    }
  }
}
```

**Markdown Configuration Notes:**

All markdown settings are respected throughout the conversion:
- **Templates**: Index and file frontmatter formatting
- **Content**: All Turndown-converted HTML
- **Custom Rules**: Figure captions, flexible columns, headings

**Configuration Priority:**

Configs are deep-merged with this priority order (lowest to highest):
1. Default config (shown above)
2. User config (OS-specific location)
3. Custom config (via `--config` flag)

**Hardcoded Values:**

These settings are not configurable:
- File pattern: `**/*.html`
- File encoding: `utf-8`
- Output extension: `.md`
- Index creation: always enabled

## Issue Tracking

The converter tracks issues silently during processing and displays a summary at the end. Issues are categorized by type and reason for easier debugging.

### Issue Types

| Type | Description |
|------|-------------|
| `file` | Problems processing source HTML files |
| `image` | Problems downloading or copying images |
| `resource` | Problems loading config, metadata, or mapping files |
| `link` | Links that couldn't be resolved and fell back to bold text |

### Issue Reasons

#### File Issues

| Reason | Description |
|--------|-------------|
| `parse-error` | HTML parsing or Markdown conversion failed |
| `read-error` | Could not read the source file (permissions, not found) |
| `write-error` | Could not write the output file (permissions, disk full) |

#### Image Issues

| Reason | Description |
|--------|-------------|
| `download-failed` | Network error while downloading image from D&D Beyond |
| `timeout` | Image download exceeded the configured timeout |
| `not-found` | Local image file not found (for cover images) |
| `invalid-response` | Server returned an error status (4xx, 5xx) |

#### Resource Issues

| Reason | Description |
|--------|-------------|
| `invalid-json` | JSON file has syntax errors |
| `schema-validation` | JSON file doesn't match expected schema |
| `read-error` | Could not read the resource file |

#### Link Issues

| Reason | Description |
|--------|-------------|
| `url-not-in-mapping` | URL path not found in any converted file |
| `entity-not-found` | Entity (spell, monster, etc.) not found in index |
| `anchor-not-found` | Target anchor doesn't exist in the target file |
| `header-link` | Page-level link without anchor (converted to bold) |
| `no-anchors` | Target file has no anchor data |

### Example Output

```
Files processed: 59/59
Images downloaded: 0
Links resolved: 15107

⚠️  1495 link(s) fell back to bold text:

Breakdown by reason:
  - url-not-in-mapping: 633
  - entity-not-found: 595
  - header-link: 255
  - anchor-not-found: 12

Duration: 4.48s
```

## Templates

The converter supports customizable Handlebars templates for both index pages and individual file pages. Templates can be defined globally or per-sourcebook.

### Template Locations (by precedence)

1. **Sourcebook-specific** (highest priority): `input/players-handbook/index.md.hbs` or `file.md.hbs`
2. **Global**: `input/index.md.hbs` or `file.md.hbs`
3. **Built-in defaults** (always available if no custom templates provided)

### Template Types

**Index Template** (`index.md.hbs`) - Generates sourcebook table of contents

Available variables:
- `title` - Sourcebook title
- `edition` - Edition string (from metadata)
- `description` - Sourcebook description (from metadata)
- `author` - Author name (from metadata)
- `coverImage` - Cover image filename (from metadata)
- `date` - Current date (YYYY-MM-DD)
- `files` - Array of files with `title`, `filename`, `uniqueId`
- `metadata` - Full metadata object for custom fields

**File Template** (`file.md.hbs`) - Generates individual chapter/file pages

Available variables:
- `title` - File title (extracted from filename)
- `date` - Current date (YYYY-MM-DD)
- `tags` - Array of tags
- `sourcebook` - Object with `title`, `edition`, `author`, `metadata`
- `navigation` - Object with `prev`, `index`, `next` (markdown links)
- `content` - Converted markdown content

### Example Custom Template

```handlebars
---
title: "{{{title}}}"
edition: "{{{edition}}}"
date: {{date}}
---

# {{{title}}}

{{#if edition}}
**Edition:** {{{edition}}}
{{/if}}

{{#if description}}
> {{{description}}}
{{/if}}

## Contents

{{#each files}}
{{@index}}. [{{{this.title}}}]({{{this.filename}}})
{{/each}}
```

## Sourcebook Metadata

Each sourcebook can have an optional `sourcebook.json` file in its directory to customize the output.

### Location

Place `sourcebook.json` alongside your HTML files:

```
input/
  players-handbook/
    sourcebook.json
    01-intro.html
    02-chapter-1.html
```

### Available Fields

```json
{
  "title": "Player's Handbook 2024",
  "edition": "5th Edition (2024)",
  "description": "Core rulebook for creating characters and playing D&D",
  "author": "Wizards of the Coast",
  "coverImage": "cover.png"
}
```

All fields are optional. Any custom fields you add will be available in templates via the `metadata` object.

### Benefits

- **Custom titles**: Override directory name with proper formatting
- **Rich metadata**: Add edition, author, description for index pages
- **Template flexibility**: Access metadata in custom templates
- **Portable**: Metadata travels with the sourcebook folder

## Documentation

- **[RFC 0001](docs/rfcs/0001-dndbeyond-html-markdown-converter.md)** - Architecture specification
- **[Link Resolver](docs/resolver.md)** - Detailed resolver implementation documentation
- **[CLAUDE.md](CLAUDE.md)** - Development guide for Claude Code

## Contributing

This project follows a modular pipeline architecture. Each module is a simple function with a clear input/output contract via the `ConversionContext` object.

## License

MIT
