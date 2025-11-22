# Architecture

This document describes the architecture and design of the D&D Beyond HTML to Markdown Converter.

## Overview

The converter transforms D&D Beyond HTML sourcebooks into clean, structured Markdown files suitable for note-taking applications. It handles the complexities of D&D content including stat blocks, spell descriptions, tables, and cross-references between books.

## Design Goals

1. **Consistent output** - Same input always produces same output (deterministic IDs)
2. **Offline-first** - All content and images stored locally
3. **Cross-reference support** - Links between sourcebooks resolve correctly
4. **Customizable** - Templates and configuration for different workflows
5. **Graceful degradation** - Continue on errors, report issues at end

## Pipeline Architecture

The converter uses a sequential pipeline where each stage transforms or enriches a shared context object. This design provides clear separation of concerns and makes each stage independently testable.

### Stage 1: Scanning

The scanner discovers all HTML files and prepares them for processing.

**Responsibilities:**

- Find HTML files in input directory using glob patterns
- Group files by sourcebook (based on directory structure)
- Load sourcebook metadata from `sourcebook.json` files
- Detect custom templates (global and per-sourcebook)
- Assign unique 4-character IDs to each file
- Load or create persistent ID mappings

**Output:** List of file descriptors with paths, IDs, and sourcebook associations.

### Stage 2: Processing

The processor converts HTML to Markdown and writes output files. It uses a two-pass approach to enable correct navigation titles.

**Pass 1 - Extraction:**

For each file, extract all metadata needed for the conversion:

- Parse HTML and select main content area
- Preprocess HTML structure to fix D&D Beyond patterns (e.g., incorrectly nested lists)
- Extract page title using priority: metadata array → title selector → first H1
- Extract canonical URL for cross-reference resolution
- Build anchor mappings (HTML IDs to Markdown anchors)
- Extract entity URLs from tooltip links (spells, monsters, items, etc.)
- Collect image URLs for downloading

After this pass, all files have their titles extracted, enabling correct navigation links.

**Pass 2 - Conversion:**

For each file, perform the actual conversion:

- Download images (with retry logic and caching)
- Convert HTML to Markdown using Turndown with custom D&D rules
- Build navigation links using extracted titles from all files
- Render output using Handlebars templates
- Write Markdown file to disk

**Index Generation:**

After all files are processed, generate a table of contents for each sourcebook using the index template.

### Stage 3: Resolution

The resolver transforms D&D Beyond URLs into local Markdown links. This stage runs after all files are written because it needs the complete set of anchors from all files.

See [Link Resolver](resolver.md) for detailed documentation of the resolution algorithm, including:

- Link type detection and priority
- Entity index building
- URL aliasing system
- Smart anchor matching

**Output:** Markdown files updated with resolved local links.

### Stage 4: Indexing

The indexer generates entity indexes by fetching listing pages from D&D Beyond and creating navigable index files that link to converted content.

**Responsibilities:**

- Load cached entity data from `indexes.json` (or fetch fresh)
- Collect source IDs from converted sourcebooks for auto-filtering
- For each configured entity index:
  - Fetch paginated listing pages from D&D Beyond
  - Parse entities using type-specific parsers (info cards, list rows, card grids)
  - Resolve entities to local files using the entity index
  - Render index using Handlebars templates
- Generate global index linking sourcebooks and entity indexes
- Save updated cache to `indexes.json`

**Output:** Entity index files (spells, monsters, items, etc.) and global index file.

See [Entity Indexer](indexer.md) for detailed documentation.

### Stage 5: Statistics

Display a summary of the conversion including:

- Files processed, indexes created
- Images downloaded vs cached
- Links resolved vs unresolved
- Errors and warnings

## Two-Pass Processing Rationale

The original design processed files one at a time for memory efficiency. However, this prevented correct navigation links because titles are extracted during processing—when processing file N, file N+1's title isn't known yet.

The two-pass approach solves this by extracting all metadata first, then processing. The trade-off is higher peak memory usage (all content loaded at end of pass 1), but this is acceptable for typical usage. See [Performance](performance.md) for memory estimates.

## Unique ID System

Files and images use random 4-character alphanumeric IDs instead of their original names. This provides:

- **Conflict avoidance** - No filename collisions or special character issues
- **Consistency** - Same source always gets same ID (via persistent mapping)
- **Privacy** - Output filenames don't reveal content

IDs are stored in `files.json` and `images.json` in the output directory, ensuring subsequent runs reuse the same IDs.

## Configuration System

Configuration uses a layered approach with deep merging:

1. **Default config** - Built-in sensible defaults
2. **User config** - OS-specific location for personal preferences
3. **Custom config** - Per-project overrides via CLI flag

This allows users to set global preferences while overriding for specific projects. All configuration is validated with schemas to catch errors early.

See [Configuration Guide](configuration.md) for all available options.

## Template System

Output is generated using Handlebars templates, providing flexibility for different note-taking workflows (Obsidian, Notion, etc.).

Templates are loaded with precedence:

1. Sourcebook-specific templates
2. Global templates in input directory
3. Built-in defaults

This allows customization at any level of granularity.

See [Template Guide](templates.md) for available variables and examples.

## Error Handling Strategy

The converter follows a "continue and report" strategy:

- Individual file failures don't stop the conversion
- Errors are collected with context (file path, error type, details)
- Summary shows all issues at the end
- Exit code reflects overall success/failure

This allows users to see all problems at once rather than fixing one at a time.

## Caching Strategy

Multiple caching layers improve subsequent runs:

**ID Mappings:**

- File paths → Markdown filenames (`files.json`)
- Image URLs → Local filenames (`images.json`)
- Entity index titles → Index filenames (`indexes.json`)

These ensure consistent output across runs.

**Image Downloads:**

- Check if local file exists before downloading
- Reuse cached images from previous runs

**Entity Data:**

- Entity metadata cached in `indexes.json`
- Avoids re-fetching from D&D Beyond on subsequent runs
- Use `--refetch` flag to force fresh data

First run downloads all images and fetches entity data; subsequent runs are nearly instant.

## Cross-Reference Resolution

The converter supports three types of cross-references:

1. **Internal anchors** - Links within the same page
2. **Entity links** - Links to spells, monsters, items by ID
3. **Source links** - Links to other sourcebook pages

Resolution uses URL aliasing to handle:

- Free Rules → core rulebook mappings
- Variant items → base item mappings
- Legacy URLs → current URLs

See [Link Resolver](resolver.md) for the complete resolution algorithm.

## HTML Preprocessing

D&D Beyond HTML contains patterns that don't convert cleanly to Markdown. The processor preprocesses HTML before Turndown conversion to fix:

- **Nested lists** - D&D Beyond places `<ul>` as siblings to `<li>` instead of children
- **Table structures** - Complex tables with rowspan/colspan

This preprocessing happens with Cheerio DOM manipulation before Turndown sees the content.

## Custom Turndown Rules

Standard Turndown doesn't handle D&D-specific content well. Custom rules handle:

- Stat blocks (monster statistics)
- Spell descriptions
- Figure captions with artist credits
- Aside/callout boxes
- Flexible column layouts
- Complex tables

Each rule focuses on converting a specific D&D Beyond pattern to appropriate Markdown.

## Validation Strategy

All user-provided data is validated:

- CLI options
- Configuration files
- Sourcebook metadata
- Mapping files

Validation uses Zod schemas that serve as both runtime validators and TypeScript type definitions (single source of truth).

Invalid data triggers graceful fallbacks where possible (e.g., invalid config falls back to defaults) with errors reported in the final summary.
