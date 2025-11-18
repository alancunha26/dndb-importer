# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A CLI tool that converts D&D Beyond HTML sourcebooks to clean, structured Markdown files. The tool uses unique 4-character IDs for file naming, downloads images locally, generates navigation links, and preserves D&D-specific formatting (stat blocks, spell descriptions, tables).

**Current Status:** In active development - project structure complete, implementation in progress.

See `docs/rfcs/0001-dndbeyond-html-markdown-converter.md` for the complete architecture specification.

## Development Commands

```bash
# Development (runs TypeScript directly with tsx)
npm run dndb-convert -- [args]

# Production build (uses esbuild)
npm run build

# Run built version
npm run dndb-convert:dist -- [args]

# Type checking
npm run type-check

# Linting (ESLint v9 with flat config)
npm run lint

# Code formatting
npm run format
```

## Architecture Overview

### Core Processing Pipeline

The converter uses a **pipeline architecture** where a shared `ConversionContext` object flows through sequential modules. Each module reads what it needs, performs its work, and writes results back to the context.

**Conversion Pipeline** (`src/cli/commands/convert.ts`):

```typescript
// Initialize context
const ctx: ConversionContext = { config };

// Run pipeline
await modules.scan(ctx); // 1. File discovery
await modules.process(ctx); // 2. Process + write (memory-efficient)
await modules.resolve(ctx); // 3. Resolve links (optional)
await modules.stats(ctx); // 4. Build statistics

// Display results
console.log(`Files processed: ${ctx.stats.successful}/${ctx.stats.totalFiles}`);
```

**Pipeline Modules** (`src/modules/`):

1. **Scanner** (`scanner.ts`)
   - Discovers HTML files using fast-glob (excludes `*.hbs` template files)
   - Detects global templates (`input/index.md.hbs`, `input/file.md.hbs`)
   - Detects per-sourcebook templates (`input/players-handbook/index.md.hbs`, etc.)
   - Loads sourcebook metadata from `sourcebook.json` files
   - Assigns unique 4-char IDs using `short-unique-id`
   - Builds filename→ID mapping (with persistent storage)
   - Groups files by sourcebook
   - Writes: `ctx.files`, `ctx.sourcebooks`, `ctx.mappings`, `ctx.globalTemplates`

2. **Processor** (`processor.ts`) - **Memory-efficient streaming**
   - Processes files **one at a time** to avoid memory bloat
   - For each file:
     - Parses HTML with Cheerio
     - Extracts content using `.p-article-content` selector
     - Removes unwanted elements (configured via `html.removeSelectors`)
     - **Preprocesses HTML structure** for D&D Beyond patterns (inline in `processHtml`):
       - Fixes nested lists: D&D Beyond uses `<ol><li>...</li><ul>...</ul></ol>` pattern
       - Moves misplaced lists into previous `<li>` element before Turndown conversion
       - Prevents incorrect markdown numbering (1,2,4 → 1,2,3)
     - Extracts title from first H1
     - Builds `FileAnchors` (valid anchors + HTML ID mappings)
     - Converts HTML → Markdown using Turndown with custom D&D rules
     - Downloads images with retry logic (with persistent mapping)
     - Loads appropriate file template (sourcebook > global > default)
     - Builds `FileTemplateContext` with navigation links and metadata
     - Renders template with Handlebars
     - **Writes to disk immediately**
     - Stores lightweight `WrittenFile` (path + anchors only)
     - HTML and markdown are garbage collected before next file
   - Generates index files per sourcebook:
     - Loads appropriate index template (sourcebook > global > default)
     - Builds `IndexTemplateContext` with sourcebook metadata and file list
     - Renders template with Handlebars
   - Writes: `ctx.writtenFiles` (lightweight - no HTML/markdown content)

3. **Resolver** (`resolver.ts`)
   - Runs **after all files are written to disk**
   - Builds `LinkResolutionIndex` from `writtenFiles` anchors
   - For each file:
     - Reads markdown from disk (one file at a time)
     - Resolves D&D Beyond links to local markdown links
     - Validates anchors exist in target files
     - Falls back to bold text for unresolved links
     - Overwrites file with resolved links
   - Memory-efficient: Only one file's content in memory at a time
   - Skipped if `links.resolveInternal: false`

4. **Stats** (`stats.ts`)
   - Counts files, images, links
   - Calculates duration
   - Writes: `ctx.stats`

### Key Design Decisions

**Unique ID System:**

- All files and images get 4-character lowercase alphanumeric IDs (e.g., `a3f9.md`, `m3x7.png`)
- **Files**: Random IDs with persistent mapping stored in `files.json`
  - First run: Generates random IDs and saves HTML path → markdown filename mapping
  - Subsequent runs: Loads mapping and reuses existing IDs for same HTML files
  - Example: `"players-handbook/01-intro.html"` → `"a3f9.md"`
  - Mapping file location: `{output_directory}/files.json`
- **Images**: Random IDs with persistent mapping stored in `images.json`
  - First run: Generates random IDs and saves URL → filename mapping
  - Subsequent runs: Loads mapping and reuses existing IDs for same URLs
  - Example: `"https://media.dndbeyond.com/.../image.png"` → `"m3x7.png"`
  - Mapping file location: `{output_directory}/images.json`
- Prevents filename conflicts and special character issues
- Enables consistent IDs across conversion runs

**Configuration System:**

- Uses `env-paths` library for OS-specific config paths
- Linux: Follows XDG Base Directory specification (`$XDG_CONFIG_HOME`)
- Configs are deep-merged: default.json → user config → CLI --config flag
- Location: `src/config/default.json` (copied to `dist/config/` during build)
- Structure: User-centric organization with 8 top-level sections:
  - `input` - Source HTML files location and pattern
  - `output` - Output directory and file settings
  - `ids` - Unique ID generation (used for files and images)
  - `markdown` - Markdown formatting preferences
  - `html` - HTML parsing settings (content selector, etc.)
  - `images` - Image download settings
  - `links` - Link resolution configuration
  - `logging` - Logging level and progress display
- HTML Parser: Uses `.p-article-content` selector to extract main content from D&D Beyond HTML
- URL Mapping: `links.urlMapping` maps D&D Beyond URLs to HTML file paths (relative to input directory)
- Fallback: `links.fallbackToBold` converts unresolvable links to bold text (default: true)

**File Organization:**

- Input: User manually downloads HTML files, names with numeric prefixes (01-, 02-, etc.)
- Output: One directory per sourcebook, all files (markdown + images) in same directory
- Navigation: Each file has prev/index/next links, index file per sourcebook

**Template System:**

- **Handlebars template engine** - Full templating support for index and file pages
- **Template precedence**:
  1. Sourcebook-specific: `input/players-handbook/index.md.hbs` or `file.md.hbs`
  2. Global: `input/index.md.hbs` or `file.md.hbs`
  3. Built-in defaults: Hardcoded templates in `src/templates/defaults.ts`
- **Scanner detects templates** during file discovery
  - Global templates detected in input root
  - Per-sourcebook templates detected in each sourcebook directory
  - Template paths stored in `SourcebookInfo.templates` and `ConversionContext.globalTemplates`
- **Processor renders templates** during output generation
  - `loadIndexTemplate()` and `loadFileTemplate()` handle precedence
  - Templates receive rich context objects (`IndexTemplateContext`, `FileTemplateContext`)
  - Built-in defaults ensure converter always works without user templates
- **Template variables**:
  - Index: `title`, `edition`, `description`, `author`, `coverImage`, `date`, `files`, `metadata`
  - File: `title`, `date`, `tags`, `sourcebook`, `navigation`, `content`
- **HTML escaping**: Use `{{{variable}}}` (triple braces) for unescaped output to preserve markdown

**Sourcebook Metadata:**

- **Optional `sourcebook.json`** in each sourcebook directory
- Scanner loads metadata using `loadSourcebookMetadata()` helper
- Fields: `title`, `edition`, `description`, `author`, `coverImage`, plus any custom fields
- Stored in `SourcebookInfo.metadata` and passed to templates
- Title from metadata overrides directory-name-based title generation
- All metadata accessible in templates via `metadata` object

**Cross-References (Resolver Module):**

- **Link resolution is optional** (`links.resolveInternal`):
  - If `true`: Resolver module resolves links with full validation (default)
  - If `false`: Resolver module skipped
- User configures URL mapping in `links.urlMapping`:
  - Source paths: `/sources/dnd/phb-2024/equipment` → `players-handbook/08-chapter-6-equipment.html`
  - Entity paths: `/spells` → `players-handbook/10-spell-descriptions.html`
- Supports both source book links and entity links (e.g., `https://www.dndbeyond.com/spells/2619022-magic-missile`)
- Scanner builds runtime mapping: `players-handbook/08-chapter-6-equipment.html` → unique ID `yw3w`
- **Processor builds `FileAnchors`** for each file during HTML processing:
  - `valid: string[]` - All markdown anchors with plural/singular variants
  - `htmlIdToAnchor: Record<string, string>` - HTML element IDs → markdown anchors
- **Resolver builds `LinkResolutionIndex`** by collecting all `FileAnchors`:
  - Single unified index: file ID → anchor data
  - Used for both same-page link resolution and cross-file validation
- Link resolver combines mappings: URL → HTML path → unique ID
- **Validates** anchor exists in target file with smart matching:
  1. Exact match (including plural/singular variants)
  2. Prefix match for headers with suffixes (e.g., "Alchemist's Fire" matches "Alchemist's Fire (50 GP)")
  3. Uses shortest match if multiple prefix matches
- **Header links** (no anchor): Links without specific anchors (e.g., `[Equipment](/sources/.../equipment)`) are **removed entirely**
- **Internal links** (same-page): Resolved using `LinkResolutionIndex`
  - Processor builds `htmlIdToAnchor` mapping using Cheerio
    - Example: `<h2 id="Bell1GP">Bell (1 GP)</h2>` → stores `{ "Bell1GP": "bell-1-gp" }`
  - Resolver uses `index[fileId].htmlIdToAnchor` to resolve links
    - Example: `[Bell](#Bell1GP)` → looks up `"Bell1GP"` → `[Bell](#bell-1-gp)`
  - Always resolved, regardless of `resolveInternal` setting
- Example 1: `[Bell](#Bell1GP)` → `[Bell](#bell-1-gp)` (internal link via HTML ID index)
- Example 2: `[Fireball](/sources/dnd/phb-2024/spells#fireball)` → `[Fireball](a3f9.md#fireball)` (cross-file)
- Example 3: `[Magic Missile](https://www.dndbeyond.com/spells/2619022-magic-missile)` → `[Magic Missile](b4x8.md#magic-missile)` (entity)
- Example 4: `[Fireballs](/sources/...)` → matches heading "Fireball" (singular/plural handled)
- Example 5: `[Alchemist's Fire](/.../equipment#alchemists-fire)` → matches "Alchemist's Fire (50 GP)" (prefix matching)
- Example 6: `[Equipment](/.../equipment)` → removed entirely (no anchor)
- Anchors generated from link text using GitHub markdown format (lowercase, hyphens)
- **Fallback**: When `links.resolveInternal: true` and `links.fallbackToBold: true`, converts to bold text (`**Fireball**`) if:
  - URL not in mapping
  - File not found
  - Anchor doesn't exist in target file (after checking exact, plural/singular, and prefix matches)
- External links preserved as-is
- Maintains navigation while preventing broken links

### HTML Preprocessing vs Turndown Rules

The converter handles D&D Beyond HTML in two stages:

**1. HTML Preprocessing** (in `src/modules/processor.ts`):
- Runs BEFORE Turndown conversion
- Fixes structural HTML issues that violate spec but are D&D Beyond patterns
- Uses Cheerio DOM manipulation
- **Why preprocessing instead of Turndown rules:**
  - Turndown rules execute DURING conversion (element by element)
  - DOM manipulation during Turndown conversion can cause content loss
  - Turndown expects valid HTML structure to generate correct markdown
  - Preprocessing ensures Turndown sees proper structure from the start

**Current preprocessing operations:**
- **Nested lists**: D&D Beyond uses `<ol><li>...</li><ul>...</ul></ol>` pattern
  - Invalid HTML (nested list should be inside `<li>`)
  - Preprocessing moves `<ul>` into previous `<li>` element
  - Prevents incorrect markdown numbering (1,2,4 → 1,2,3)
  - Selector: `ol > ul, ol > ol, ul > ul, ul > ol`
  - Example: `<li>Item</li><ul>...</ul>` → `<li>Item<ul>...</ul></li>`

**2. Turndown Rules** (in `src/turndown/rules/`):
- Run DURING conversion (HTML → Markdown)
- Handle D&D Beyond content patterns (not structural fixes)
- Each rule focuses on converting specific HTML patterns to markdown

**Current Turndown rules:**
- `remove-heading-links.ts` - Remove anchor links from headings
- `unwrap-linked-images.ts` - Remove `<a>` wrappers from images
- `image-alt-text.ts` - Extract alt text from image URLs
- `figure-caption.ts` - Convert figure captions to blockquotes with artist credits
- `aside.ts` - Convert aside elements to Obsidian/GitHub callouts or blockquotes

**Decision criteria:**
- Use **preprocessing** if: Fixing invalid HTML structure that breaks Turndown
- Use **Turndown rule** if: Converting valid HTML patterns to specific markdown format

### Type System

Types are organized in `src/types/` by domain:

- **`types/config.ts`** - Configuration types (`ConversionConfig`, `HtmlParserConfig`, etc.)
- **`types/files.ts`** - File-related types (`FileDescriptor`, `ImageDescriptor`, `FileAnchors`, template types, etc.)
- **`types/pipeline.ts`** - Pipeline data types (`ScanResult`, `ProcessedFile`, `WrittenFile`, `LinkResolutionIndex`, etc.)
- **`types/context.ts`** - `ConversionContext` (flows through all modules)
- **`types/turndown.ts`** - Turndown-related types (`TurndownNode` - used by all Turndown rules)
- **`types/index.ts`** - Re-exports all types

Key types:

- `ConversionContext` - Context object that flows through pipeline modules (flattened structure):
  - `config`: Configuration
  - `files`: FileDescriptor[] (from scanner)
  - `sourcebooks`: SourcebookInfo[] (from scanner)
  - `mappings`: Map<string, string> (from scanner)
  - `globalTemplates`: TemplateSet (from scanner - global template paths)
  - `writtenFiles`: WrittenFile[] (from processor - lightweight, no HTML/markdown)
  - `stats`: ProcessingStats (from stats)
- `FileDescriptor` - File metadata with unique ID
- `SourcebookInfo` - Sourcebook metadata with templates and files:
  - `metadata`: SourcebookMetadata (from sourcebook.json)
  - `templates`: TemplateSet (sourcebook-specific template paths)
  - `files`: FileDescriptor[] (content files)
  - `id`, `title`, `sourcebook`, `outputPath`
- `SourcebookMetadata` - Optional metadata from sourcebook.json:
  - `title?`, `edition?`, `description?`, `author?`, `coverImage?`
  - `[key: string]: unknown` - Allows custom fields
- `TemplateSet` - Template file paths:
  - `index: string | null` - Path to index.md.hbs (null = use default)
  - `file: string | null` - Path to file.md.hbs (null = use default)
- `IndexTemplateContext` - Variables available in index templates
- `FileTemplateContext` - Variables available in file templates
- `FileAnchors` - Anchor data for a single file (valid anchors + HTML ID mappings)
  - `valid: string[]` - All markdown anchors with plural/singular variants
  - `htmlIdToAnchor: Record<string, string>` - HTML element IDs → markdown anchors
- `ProcessedFile` - Output of processor module (HTML, markdown, images, anchors)
- `WrittenFile` - Output of writer module (descriptor, path, anchors)
- `LinkResolutionIndex` - Maps file IDs to `FileAnchors` (for resolver module)
- `ProcessingStats` - Final statistics (files, images, links)

### Project Structure

```
src/
├── cli/
│   ├── commands/
│   │   ├── convert.ts       # Pipeline orchestration + CLI handling
│   │   └── config.ts        # Shows config location
│   └── index.ts
├── modules/
│   ├── scanner.ts           # File discovery & ID assignment
│   ├── processor.ts         # Process + write (memory-efficient)
│   ├── writer.ts            # (deprecated - merged into processor)
│   ├── resolver.ts          # Link resolution
│   ├── stats.ts             # Build statistics
│   └── index.ts
├── templates/
│   ├── defaults.ts          # Built-in default templates
│   └── index.ts             # Template loading utilities
├── turndown/
│   ├── rules/index.ts
│   └── index.ts
├── utils/
│   ├── config.ts            # Configuration loading
│   ├── id-generator.ts      # Unique ID generation
│   ├── logger.ts            # Logging utilities
│   ├── mapping.ts           # JSON mapping persistence
│   ├── fs.ts                # Filesystem utilities (fileExists)
│   └── string.ts            # String utilities (filenameToTitle)
├── types/
│   ├── config.ts            # Configuration types
│   ├── files.ts             # File-related types (includes template types)
│   ├── pipeline.ts          # Pipeline data types
│   ├── context.ts           # ConversionContext
│   ├── turndown.ts          # Turndown types (TurndownNode)
│   └── index.ts
└── config/
    └── default.json
```

**Key principles:**

- **Modules**: Simple functions with context-based signature `async fn(ctx: ConversionContext): Promise<void>`
- **Pipeline**: Orchestrated directly in convert command (no separate orchestrator class)
- **Context**: Shared object flows through all modules
- **Types**: Organized by domain (config, files, pipeline, context)

### Build System

**esbuild configuration** (`build.js`):

- Entry point: `src/cli/index.ts`
- Bundles to `dist/cli.js` with ESM format
- `packages: "external"` - doesn't bundle node_modules
- Copies `src/config/default.json` to `dist/config/`
- Builds utils separately for potential library usage

**Module System:**

- Uses ES modules (`"type": "module"` in package.json)
- TypeScript with `moduleResolution: "bundler"`
- Import paths without `.js` extensions (esbuild handles resolution)

## Important Conventions

### Import Paths

Do NOT include `.js` extensions in imports - esbuild handles module resolution:

```typescript
// Correct
import { loadConfig } from "./utils/config";

// Incorrect
import { loadConfig } from "./utils/config.js";
```

### Unused Parameters

Prefix with underscore for parameters that will be used later:

```typescript
// Stub method that will be implemented
async function process(htmlPath: string): Promise<string> {
  console.log("Processing HTML file:", htmlPath);
  // TODO: Implement
  return "";
}
```

### Configuration Loading

The config loader (`src/utils/config.ts`) uses:

- `fileURLToPath(import.meta.url)` to get `__dirname` in ESM
- `env-paths` for cross-platform directory paths
- Deep merge strategy preserving nested defaults

### ID Generation

`src/utils/id-generator.ts` maintains a Set of used IDs to prevent collisions within a conversion run. Has a `register()` method to load existing IDs from persistent mappings. Reset between runs.

### Shared Utilities

**`src/utils/fs.ts`** - Filesystem helpers:
- `fileExists(path: string)` - Check if file/directory exists
- Used by scanner (template detection), processor (image checking), and mapping utilities
- Eliminates duplicate code across modules

**`src/utils/string.ts`** - String manipulation:
- `filenameToTitle(filename: string)` - Convert filenames to readable titles
  - Removes numeric prefix (e.g., "01-", "02-")
  - Splits by hyphens/underscores
  - Capitalizes each word
- Used by scanner (sourcebook titles) and processor (navigation links, file titles)
- Eliminates duplicate title formatting code across modules

**`src/utils/mapping.ts`** - JSON mapping persistence:
- `loadMapping(dir, filename)` - Load JSON mapping from output directory
- `saveMapping(dir, filename, mapping)` - Save JSON mapping with pretty formatting
- Used for `files.json` (HTML→MD mapping) and `images.json` (URL→filename mapping)

## Example Files

The repository includes real D&D Beyond HTML files for testing and development purposes:

**Location:** `examples/input/players-handbook/`

**Contents:** 14 HTML files from the Player's Handbook 2024, covering:

- Introduction and core rules (chapters 1-2)
- Character classes (chapters 3-5, split across multiple files)
- Equipment, spells, and spell descriptions (chapters 6-7)
- Appendices (multiverse, creature stat blocks)
- Rules glossary and credits

**File sizes:** Range from 118KB to 1.1MB (spell descriptions being the largest)

**Naming convention:** Files follow the expected input format with numeric prefixes:

- `01-introduction-welcome-to-adventure.html`
- `08-chapter-6-equipment.html`
- `10-chapter-7-spell-descriptions.html`
- etc.

**Usage:**

- Use these files to test the converter during development
- Example command: `npm run dndb-convert -- examples/input examples/output`
- These files contain real D&D Beyond HTML structure including:
  - Stat blocks (in creature appendix)
  - Spell descriptions with structured formatting
  - Equipment tables
  - Internal D&D Beyond links (for testing link resolution)
  - Images hosted on D&D Beyond CDN

**Note:** These are downloaded HTML files saved from D&D Beyond's web interface. They include the full page structure with scripts, styles, and navigation that the converter needs to parse.

## Testing Strategy

### Persistent Caching (Implemented)

To avoid repeatedly hitting D&D Beyond servers during development and enable consistent file/image IDs across runs, the converter implements **persistent caching** using simple mapping files:

**Mapping Files:**
- **`files.json`**: Maps HTML file paths to markdown filenames
  - Example: `{ "players-handbook/01-intro.html": "ftqq.md" }`
  - Ensures same HTML file always converts to same markdown filename
  - Generated by Scanner module
- **`images.json`**: Maps image URLs to local filenames
  - Example: `{ "https://media.dndbeyond.com/.../image.png": "d0gh.png" }`
  - Ensures same image URL always gets same local filename
  - Generated by Processor module

**Smart Download Logic:**
Before downloading images, processor checks:
1. Does this URL exist in `images.json`? (If yes, reuse filename)
2. Does the image file exist on disk? (If yes, skip download)
- Both checks pass: Use cached file (instant)
- URL in mapping but file missing: Reuse filename and re-download
- URL not in mapping: Generate new filename, download, and save mapping

**Verbose Mode:**
Use `--verbose` flag to see caching statistics per file:
- Example: `Images: 0 downloaded, 49 cached` (all images reused from cache)

**Testing Workflow:**
```bash
# First run: Downloads all images, creates files.json and images.json
npm run dndb-convert -- --input examples/input --output examples/output --verbose

# Subsequent runs: Reuses IDs, all images cached, no network requests
npm run dndb-convert -- --input examples/input --output examples/output --verbose

# Inspect mapping files
cat examples/output/files.json | head -10
cat examples/output/images.json | head -10
```

**Benefits:**
- Safe to run converter repeatedly during development
- No risk of IP blocking or account bans from D&D Beyond
- Faster conversion on subsequent runs (no network I/O)
- Bandwidth-efficient for testing
- Consistent IDs - same source always produces same output filenames
- Simple, human-readable mapping files (JSON)
- Easy debugging - just look up URL/path in mapping file

**Config Options:**
- `images.download: false` - Disable image downloads entirely (useful for testing Markdown conversion only)
- `images.download: true` - Enable downloads with automatic caching (default)

**File Structure:**
```
output/
├── files.json                     # HTML path → markdown filename
├── images.json                    # Image URL → local filename
├── players-handbook/
│   ├── ftqq.md                    # Markdown files (IDs from files.json)
│   ├── e2po.md
│   ├── d0gh.png                   # Images (IDs from images.json)
│   ├── ducb.png
│   └── lyfz.md                    # Index file (ID also in files.json)
```

### Automated Testing (From RFC - not yet implemented)

- Unit tests for custom Turndown rules
- Integration tests for full pipeline
- Test fixtures in `tests/fixtures/` for sample HTML
- Test various D&D content: stat blocks, spells, tables, sidebars

## Phase 1 MVP Scope

Sequential file processing (no parallelization):

- Basic HTML to Markdown with custom rules
- CLI with Commander.js + Chalk styling
- Unique ID generation for files and images
- Image downloading with retry (3 attempts, exponential backoff)
- Navigation links and index generation
- JSON error report for failed image downloads

## Additional Notes

- ESLint uses flat config format (`eslint.config.js`) for v9 compatibility
- TypeScript strict mode enabled with detailed compiler checks
- License changed to MIT (was ISC initially)
- Git repository is clean - no ignored files should be committed
