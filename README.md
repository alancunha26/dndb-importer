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

🚧 **In Development** - Project structure is set up, implementation in progress.

See [docs/rfcs/0001-dndbeyond-html-markdown-converter.md](docs/rfcs/0001-dndbeyond-html-markdown-converter.md) for the complete architecture specification.

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

### Configuration Structure

The config file uses a user-centric structure with 8 top-level sections:

- **`input`** - Source HTML files location and pattern
- **`output`** - Output directory and file settings
- **`ids`** - Unique ID generation (used for files and images)
- **`markdown`** - Markdown formatting preferences
- **`html`** - HTML parsing settings (content selector, etc.)
- **`images`** - Image download settings
- **`links`** - Link resolution configuration
- **`logging`** - Logging level and progress display

### Key Configuration Options

- **`links.urlMapping`**: Maps D&D Beyond URLs to local HTML files for cross-reference resolution
- **`links.resolveInternal`**: Enable/disable link resolution (default: true)
- **`links.fallbackToBold`**: Convert unresolvable links to bold text (default: true)
- **`images.download`**: Enable/disable image downloading
- **`images.retries`**: Number of retry attempts for failed downloads (default: 3)
- **`ids.length`**: Length of unique IDs (default: 4)
- **`html.contentSelector`**: CSS selector for main content extraction (default: `.p-article-content`)

See `src/config/default.json` for all available options.

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

- **[RFC 0001](docs/rfcs/0001-dndbeyond-html-markdown-converter.md)** - Complete architecture specification
- **[CLAUDE.md](CLAUDE.md)** - Development guide for Claude Code

## Contributing

This project follows a modular pipeline architecture. Each module is a simple function with a clear input/output contract via the `ConversionContext` object.

## License

MIT
