# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A CLI tool that converts D&D Beyond HTML sourcebooks to clean, structured Markdown files. The tool uses unique 4-character IDs for file naming, downloads images locally, generates navigation links, and preserves D&D-specific formatting (stat blocks, spell descriptions, tables).

**Current Status:** Feature complete - link resolver implemented with entity-aware resolution, URL aliasing, and smart anchor matching.

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

## Development Guidelines

### ⚠️ CRITICAL: Always Use the Same Output Directory During Testing

When testing and iterating on the converter, **ALWAYS use the same output directory** (e.g., `examples/output`).

**DO NOT create new directories** like `examples/output-test`, `examples/output-test2`, etc. for each test run.

**Why?**
- The persistent cache (`files.json` and `images.json`) lives in the output directory
- Using a different directory means:
  - ❌ No cache → All images re-downloaded from D&D Beyond
  - ❌ New random IDs generated for every file and image
  - ❌ Wasted bandwidth and time
  - ❌ Cannot verify cache system is working correctly

**Correct approach:**
```bash
# Always use the same output directory
npm run dndb-convert -- --input examples/input --output examples/output
npm run dndb-convert -- --input examples/input --output examples/output  # Reuses cache!
```

**Incorrect approach:**
```bash
# ❌ DON'T DO THIS - creates new cache each time
npm run dndb-convert -- --input examples/input --output examples/output-test1
npm run dndb-convert -- --input examples/input --output examples/output-test2
```

**Exception:** Only use a different output directory when specifically testing cache behavior or when you want to start fresh (e.g., testing breaking changes to the mapping format).

## Architecture Overview

### Core Processing Pipeline

The converter uses a **pipeline architecture** where a shared `ConversionContext` object flows through sequential modules. Each module reads what it needs, performs its work, and writes results back to the context.

**Conversion Pipeline** (`src/cli/commands/convert.ts`):

```typescript
// Initialize context with Tracker
const tracker = new Tracker(config);
const ctx: ConversionContext = { config, tracker };

// Run pipeline
await modules.scan(ctx);    // 1. File discovery
await modules.process(ctx); // 2. Process + write (memory-efficient)
await modules.resolve(ctx); // 3. Resolve links (optional)
modules.stats(tracker, verbose); // 4. Display statistics
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
   - Writes: `ctx.files`, `ctx.sourcebooks`, `ctx.globalTemplates`

2. **Processor** (`processor.ts`) - **Memory-efficient streaming**
   - Processes files **one at a time** to avoid memory bloat
   - For each file:
     - Parses HTML with Cheerio
     - Extracts content using `.p-article-content` selector
     - Removes unwanted elements (configured via `html.removeSelectors`)
     - **Preprocesses HTML structure** for D&D Beyond patterns:
       - Fixes nested lists: D&D Beyond uses `<ol><li>...</li><ul>...</ul></ol>` pattern
       - Moves misplaced lists into previous `<li>` element before Turndown conversion
       - Prevents incorrect markdown numbering (1,2,4 → 1,2,3)
     - Extracts title from first H1
     - Extracts canonical URL from page metadata
     - Builds `FileAnchors` (valid anchors + HTML ID mappings)
     - **Extracts entity URLs** from tooltip links (spells, monsters, magic items, equipment)
     - Converts HTML → Markdown using Turndown with custom D&D rules
     - Downloads images with retry logic (with persistent mapping)
     - Loads appropriate file template (sourcebook > global > default)
     - Builds `FileTemplateContext` with navigation links and metadata
     - Renders template with Handlebars
     - **Writes to disk immediately**
     - Marks file as `written: true` with anchors and entities
     - HTML and markdown are garbage collected before next file
   - Generates index files per sourcebook:
     - Loads appropriate index template (sourcebook > global > default)
     - Builds `IndexTemplateContext` with sourcebook metadata and file list
     - Renders template with Handlebars
   - Updates `ctx.files` with anchors, entities, and written status

3. **Resolver** (`resolver.ts`)
   - Runs **after all files are written to disk**
   - Builds entity index by matching entity slugs to file anchors
     - Uses `entityLocations` config to filter target files by entity type
     - Prevents spells resolving to monster pages with matching anchors
   - Builds URL map from files with canonical URLs
   - For each file:
     - Reads markdown from disk (one file at a time)
     - Resolves D&D Beyond links using priority system:
       1. Internal anchors (same-page `#links`)
       2. Entity links (`/spells/123-name`, `/monsters/456-name`)
       3. Source links (`/sources/dnd/phb-2024/chapter#anchor`)
     - Applies URL aliases (Free Rules → PHB, variant items → base items)
     - Validates anchors exist with smart matching (exact, prefix, plural/singular)
     - Falls back based on `fallbackStyle` setting (bold, italic, plain, none)
     - Overwrites file with resolved links
   - Memory-efficient: Only one file's content in memory at a time
   - Skipped if `links.resolveInternal: false`
   - Tracks resolved/unresolved links via `ctx.tracker`

4. **Stats** (`stats.ts`)
   - Displays formatted summary with progress bars
   - Shows files, images, links sections
   - Breaks down link issues by reason
   - Shows errors for files, images, resources
   - Uses Chalk for colored terminal output

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
- **Validated with Zod**: Uses `ConversionConfigSchema` for default config, `PartialConversionConfigSchema` for user/custom configs
- **Error handling**: `loadConfig()` returns `{ config, errors }` instead of throwing
  - Invalid user/custom configs tracked in errors array
  - Falls back to default config automatically
  - Errors displayed in final summary via `ctx.errors.resources`
- Location: `src/config/default.json` (copied to `dist/config/` during build)
- Structure: User-centric organization with 7 top-level sections:
  - `input` - Source HTML files directory (string)
  - `output` - Output directory (string)
  - `ids` - Unique ID generation (used for files and images)
  - `markdown` - Markdown formatting preferences (all Turndown options)
  - `html` - HTML parsing settings (content selector, etc.)
  - `images` - Image download settings
  - `links` - Link resolution configuration
- Hardcoded values (not configurable):
  - File pattern: `**/*.html`
  - Encoding: `utf-8`
  - Output extension: `.md`
  - Index creation: always enabled
- HTML Parser: Uses `.p-article-content` selector to extract main content from D&D Beyond HTML
- URL Aliases: `links.urlAliases` maps D&D Beyond URLs to canonical URLs
  - Source aliasing: `/sources/dnd/free-rules/foo` → `/sources/dnd/phb-2024/foo`
  - Entity aliasing: `/magic-items/4585-belt-of-hill-giant-strength` → `/magic-items/5372-belt-of-giant-strength`
- Entity Locations: `links.entityLocations` maps entity types to allowed source pages
  - Prevents spells resolving to monster pages with matching anchors
  - Example: `"spells": ["/sources/dnd/phb-2024/spell-descriptions"]`
- Fallback Style: `links.fallbackStyle` controls unresolved link formatting
  - `"bold"` - Convert to bold text `**Text**` (default)
  - `"italic"` - Convert to italic text `_Text_`
  - `"plain"` - Convert to plain text
  - `"none"` - Keep original link (no fallback tracking)

**Input Validation and Error Tracking:**

- **All user inputs validated with Zod** - ensures type safety and provides clear error messages
- **Validated inputs:**
  1. CLI options (`ConvertOptionsSchema`) - validates command-line arguments in convert command
  2. Config files (`ConversionConfigSchema`, `PartialConversionConfigSchema`) - validates default, user, and custom configs
  3. Sourcebook metadata (`SourcebookMetadataSchema`) - validates sourcebook.json files
  4. Mapping files (`MappingSchema`) - validates files.json and images.json
- **Unified Tracker system** (`src/utils/tracker.ts`):
  - Single `Tracker` class for all stats and issue tracking
  - Counter methods: `incrementSuccessful()`, `incrementImagesDownloaded()`, `incrementLinksResolved()`, etc.
  - Issue tracking: `trackError(path, error, type, context)` with automatic error classification
  - Four issue types with typed reasons:
    - `file` - File processing errors (parse-error, read-error, write-error)
    - `image` - Image download errors (download-failed, timeout, not-found, invalid-response)
    - `resource` - Config/metadata errors (invalid-json, schema-validation, read-error)
    - `link` - Link resolution issues (url-not-in-mapping, entity-not-found, anchor-not-found, header-link)
  - All stats retrieved via `tracker.getStats()` returning `ProcessingStats`
- **Graceful degradation:**
  - Invalid config → Falls back to default config
  - Invalid sourcebook metadata → Uses empty metadata
  - Invalid mapping file → Deletes corrupted file and starts fresh
  - Conversion continues even with errors (fails gracefully)

**File Organization:**

- Input: User manually downloads HTML files, names with numeric prefixes (01-, 02-, etc.)
- Output: One directory per sourcebook, all files (markdown + images) in same directory
- Navigation: Each file has prev/index/next links, index file per sourcebook

**Template System:**

- **Handlebars template engine** - Full templating support for index and file pages
- **Template precedence**:
  1. Sourcebook-specific: `input/players-handbook/index.md.hbs` or `file.md.hbs`
  2. Global: `input/index.md.hbs` or `file.md.hbs`
  3. Built-in defaults: `src/utils/get-default-index-template.ts` and `get-default-file-template.ts`
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
- **Validated with Zod**: Uses `SourcebookMetadataSchema` with `.looseObject()` to allow custom fields
- Scanner loads metadata using `loadSourcebookMetadata()` helper
- Fields: `title`, `edition`, `description`, `author`, `coverImage`, plus any custom fields
- Invalid metadata files tracked in `ctx.errors.resources` and falls back to empty metadata
- Stored in `SourcebookInfo.metadata` and passed to templates
- Title from metadata overrides directory-name-based title generation
- All metadata accessible in templates via `metadata` object

**Cross-References (Resolver Module):**

See `docs/resolver.md` for complete implementation details.

**Overview:**

The resolver transforms D&D Beyond links into local markdown links, enabling seamless cross-referencing between converted sourcebooks. It uses a factory pattern with closure variables for efficient resolution without prop drilling.

**Link Resolution Priority:**

1. **Internal anchors** (same-page `#links`)
   - Uses `htmlIdToAnchor` mapping from FileAnchors
   - Example: `[Bell](#Bell1GP)` → `[Bell](#bell-1-gp)`

2. **Entity links** (`/spells/123-name`, `/monsters/456-name`)
   - Builds entity index by matching entity slugs to file anchors
   - Uses `entityLocations` config to filter target files by entity type
   - Example: `[Fireball](/spells/2618887-fireball)` → `[Fireball](a3f9.md#fireball)`

3. **Source links** (`/sources/dnd/phb-2024/chapter#anchor`)
   - Looks up file by canonical URL
   - Validates anchor with smart matching
   - Example: `[Equipment](/sources/dnd/phb-2024/equipment#adventuring-gear)` → `[Equipment](b4x8.md#adventuring-gear)`

**Entity Index System:**

- Processor extracts entity URLs from tooltip links in HTML
- Entity types: `spells`, `monsters`, `magic-items`, `equipment`, `classes`, `feats`, `species`, `backgrounds`
- `entityLocations` config maps types to allowed source pages:
  ```json
  {
    "spells": ["/sources/dnd/phb-2024/spell-descriptions"],
    "monsters": ["/sources/dnd/mm-2024/monsters-a", ...],
    "magic-items": ["/sources/dnd/dmg-2024/magic-items"]
  }
  ```
- Prevents spells resolving to monster pages with matching anchors

**URL Aliasing:**

- `urlAliases` maps URLs to canonical forms before resolution
- Source aliasing: `/sources/dnd/free-rules/foo` → `/sources/dnd/phb-2024/foo`
- Entity aliasing: `/magic-items/4585-belt-of-hill-giant-strength` → `/magic-items/5372-belt-of-giant-strength`
- Supports variant items (Belt of X Giant Strength → Belt of Giant Strength)

**Smart Anchor Matching:**

1. **Exact match**
2. **Normalized match** (strips trailing 's' from words for singular/plural matching)
   - Example: `#potion-of-healing` matches `#potions-of-healing`
3. **Prefix match** for headers with suffixes
   - Example: `#alchemists-fire` matches `#alchemists-fire-50-gp`
4. Uses shortest match if multiple candidates

**Anchor Building (Processor):**

- `FileAnchors.valid: string[]` - All markdown anchors from headings
- `FileAnchors.htmlIdToAnchor: Record<string, string>` - HTML element IDs → markdown anchors
- Example: `<h2 id="Bell1GP">Bell (1 GP)</h2>` → `{ "Bell1GP": "bell-1-gp" }`

**Special Cases:**

- **Book-level links** (no anchor): Resolve to index files
  - Example: `[Player's Handbook](/sources/dnd/phb-2024)` → `[Player's Handbook](ksmc.md)`
- **Header links** (page without anchor): Fall back based on `fallbackStyle`
  - Example: `[Equipment](/sources/.../equipment)` → `**Equipment**`
- **Image lines**: Skipped entirely (lines starting with `!`)
- **Local links**: Skipped (already resolved, e.g., `abc123.md`)

**Fallback System:**

- `fallbackStyle: "bold"` → `**Text**` (default)
- `fallbackStyle: "italic"` → `_Text_`
- `fallbackStyle: "plain"` → `Text`
- `fallbackStyle: "none"` → Keep original link `[Text](url)`

**Examples:**

```markdown
# Internal anchor
[Bell](#Bell1GP) → [Bell](#bell-1-gp)

# Entity link
[Fireball](https://www.dndbeyond.com/spells/2618887-fireball) → [Fireball](a3f9.md#fireball)

# Source link with anchor
[Adventuring Gear](/sources/dnd/phb-2024/equipment#adventuring-gear) → [Adventuring Gear](b4x8.md#adventuring-gear)

# Plural/singular matching
[Fireballs](/sources/.../spells#fireballs) → [Fireballs](a3f9.md#fireball)

# Prefix matching
[Alchemist's Fire](/.../equipment#alchemists-fire) → [Alchemist's Fire](b4x8.md#alchemists-fire-50-gp)

# Book-level link
[Player's Handbook](/sources/dnd/phb-2024) → [Player's Handbook](ksmc.md)

# Header link (no anchor)
[Equipment](/sources/.../equipment) → **Equipment**
```

**Performance:**

- Memory-efficient: Reads files one at a time
- No full content caching: Read → Process → Write → GC
- Entity index built once at start of resolution

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
- `flexible-columns.ts` - Convert D&D Beyond flexible column layouts to lists
- `table.ts` - Custom table handling for complex D&D Beyond table patterns

**Decision criteria:**
- Use **preprocessing** if: Fixing invalid HTML structure that breaks Turndown
- Use **Turndown rule** if: Converting valid HTML patterns to specific markdown format

### Table Handling

D&D Beyond uses complex table patterns that don't translate cleanly to standard markdown tables because **markdown tables don't support rowspan or colspan**. The converter uses a custom Turndown rule (`src/turndown/rules/table.ts`) to handle these patterns.

**Implemented Features:**

1. **Caption Extraction**
   - Extracts `<caption>` content and renders above table
   - Uses `config.strong` for formatting (respects user config)
   - Example: `**Magic Item Rarities**`

2. **Rowspan Handling**
   - Detects D&D Beyond's special pattern: rowspan cell in its own `<tr>`
   - Merges with next row's data automatically
   - Renders value in first row, empty cells for subsequent spanned rows
   - Example HTML: `<tr><td rowspan="5">Chaotic</td></tr><tr><td>1</td><td>Boastful</td></tr>`
   - Example Output:
     ```markdown
     | Chaotic | 1 | Boastful |
     |  | 2 | Impulsive |
     |  | 3 | Rebellious |
     ```

3. **Multiple Header Rows** (Option A - Keep Detailed Row Only)
   - Discards grouping headers with colspan (e.g., "————— 1d100 Roll —————")
   - Keeps only the most granular/detailed header row
   - Prevents double separator rows (non-standard markdown)
   - Future option: Can add book-specific handling if needed

4. **Footer Extraction**
   - Extracts `<tfoot>` content and renders below table as plain text
   - Preserves asterisk footnotes and multi-line notes
   - Example: `*Halve the value for a consumable item...`

5. **Section Dividers** (Colspan in Tbody)
   - Preserves section headers within tables (e.g., "Simple Melee Weapons")
   - Renders as first column with empty cells for remaining columns
   - Example: `| Simple Melee Weapons |  |  |  |  |  |`

6. **Multiple Tbody Elements**
   - Combines all `<tbody>` sections into single table
   - Rowspan handling provides visual grouping

**Table Statistics:**
- **576 tables** across PHB, DMG, MM validated and working
- **377 tables** use captions
- **224 tables** use footers
- **22 files** use rowspan
- **10+ instances** of section dividers

**Why Custom Rule Instead of HTML Preprocessing:**
- Full control over markdown generation
- Can walk through table structure systematically
- Cleaner code organization (all table logic in one place)
- No risk of breaking HTML structure before conversion

### Type System

All types are consolidated in a single file `src/types.ts` for easier navigation and maintenance.

**Zod Schema Pattern:**
All user-facing types use Zod for runtime validation with TypeScript type inference:
```typescript
// Schema defines both runtime validation and TypeScript type
export const SourcebookMetadataSchema = z.looseObject({
  title: z.string().optional(),
  edition: z.string().optional(),
  // ...
});

// Type inferred from schema (single source of truth)
export type SourcebookMetadata = z.infer<typeof SourcebookMetadataSchema>;
```

**Validated types:**
- **Config files** - `ConversionConfigSchema`, `PartialConversionConfigSchema`
- **CLI options** - `ConvertOptionsSchema`
- **Sourcebook metadata** - `SourcebookMetadataSchema`
- **Mapping files** - `MappingSchema` (files.json, images.json)

**Key types:**

- `ConversionContext` - Context object that flows through pipeline modules:
  - `config`: ConversionConfig
  - `tracker`: Tracker (unified stats and issue tracking)
  - `files?`: FileDescriptor[] (all files - flat list)
  - `sourcebooks?`: SourcebookInfo[] (sourcebook metadata only)
  - `globalTemplates?`: TemplateSet (global templates from input root)
- `Tracker` - Unified stats and issue tracking class:
  - Counter methods: `incrementSuccessful()`, `incrementImagesDownloaded()`, etc.
  - Issue tracking: `trackError()`, `trackLinkIssue()`
  - Results: `getStats()` returns `ProcessingStats`
- `FileDescriptor` - File metadata with unique ID:
  - `sourcePath`, `relativePath`, `outputPath`, `sourcebook`, `uniqueId`
  - `url?`: Canonical URL from page metadata
  - `title?`: Extracted from first H1
  - `anchors?`: FileAnchors (valid anchors + HTML ID mappings)
  - `entities?`: ParsedEntityUrl[] (extracted entity URLs)
  - `written?`: Boolean flag set after successful write
- `SourcebookInfo` - Sourcebook metadata with templates:
  - `metadata`: SourcebookMetadata (from sourcebook.json)
  - `templates`: TemplateSet (sourcebook-specific template paths)
  - `bookUrl?`: Book-level URL (e.g., `/sources/dnd/phb-2024`)
  - `id`, `title`, `sourcebook`, `outputPath`
- `FileAnchors` - Anchor data for a single file:
  - `valid: string[]` - All markdown anchors from headings
  - `htmlIdToAnchor: Record<string, string>` - HTML element IDs → markdown anchors
- `ParsedEntityUrl` - Extracted entity URL data:
  - `type`: Entity type (spells, monsters, etc.)
  - `id`: Entity ID number
  - `slug?`: Entity slug (e.g., "fireball")
  - `anchor?`: Computed anchor from slug
  - `url`: Original entity URL
- `ProcessingStats` - Final statistics:
  - `totalFiles`, `successfulFiles`, `failedFiles`, `skippedFiles`
  - `downloadedImages`, `cachedImages`, `failedImages`
  - `resolvedLinks`, `createdIndexes`
  - `issues`: Issue[] (all tracked issues)
  - `duration`: Conversion time in milliseconds
- `Issue` - Tracked issue with type discrimination:
  - `FileIssue`, `ImageIssue`, `ResourceIssue`, `LinkIssue`
  - Each has `type`, `path`, `reason`, and optional `details`/`text`

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
│   ├── resolver.ts          # Link resolution
│   ├── stats.ts             # Statistics display with formatting
│   └── index.ts
├── turndown/
│   ├── rules/index.ts
│   └── index.ts
├── utils/
│   ├── apply-aliases.ts     # URL alias application
│   ├── extract-id-from-filename.ts
│   ├── file-exists.ts       # Filesystem check utility
│   ├── filename-to-title.ts # Convert filenames to readable titles
│   ├── find-matching-anchor.ts # Smart anchor matching
│   ├── generate-anchor.ts   # GitHub-style anchor generation
│   ├── generate-anchor-variants.ts # Anchor normalization for matching
│   ├── get-default-file-template.ts
│   ├── get-default-index-template.ts
│   ├── id-generator.ts      # Unique ID generation
│   ├── is-entity-url.ts     # Check for entity URL patterns
│   ├── is-image-url.ts      # Check for image URLs
│   ├── is-source-url.ts     # Check for source book URLs
│   ├── load-config.ts       # Configuration loading
│   ├── load-file-template.ts
│   ├── load-index-template.ts
│   ├── load-mapping.ts      # JSON mapping persistence
│   ├── load-template.ts
│   ├── logger.ts            # Logging utilities
│   ├── normalize-anchor.ts  # Anchor normalization
│   ├── normalize-url.ts     # URL normalization
│   ├── parse-entity-url.ts  # Entity URL parsing
│   ├── save-mapping.ts      # JSON mapping persistence
│   ├── should-resolve-url.ts # Check if URL should be resolved
│   ├── tracker.ts           # Unified stats and issue tracking
│   └── index.ts             # Re-exports all utilities
├── types.ts                 # All types and Zod schemas consolidated
└── config/
    └── default.json
```

**Key principles:**

- **Modules**: Simple functions with context-based signature `async fn(ctx: ConversionContext): Promise<void>`
- **Pipeline**: Orchestrated directly in convert command (no separate orchestrator class)
- **Context**: Shared object flows through all modules
- **Types**: Organized by domain with Zod schemas for validation
- **Validation**: All user inputs validated with Zod, errors tracked in context

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

Utilities are organized as focused, single-purpose functions in `src/utils/`:

**Core utilities:**
- `id-generator.ts` - Unique ID generation with collision prevention
- `load-config.ts` - Configuration loading with deep merge
- `load-mapping.ts` / `save-mapping.ts` - JSON mapping persistence with Zod validation
- `tracker.ts` - Unified stats and issue tracking class
- `logger.ts` - Logging utilities

**File utilities:**
- `file-exists.ts` - Check if file/directory exists
- `filename-to-title.ts` - Convert filenames to readable titles
- `load-template.ts` / `load-file-template.ts` / `load-index-template.ts` - Template loading
- `get-default-file-template.ts` / `get-default-index-template.ts` - Built-in defaults

**URL utilities:**
- `normalize-url.ts` - Strip domain, normalize paths
- `apply-aliases.ts` - Apply URL aliases from config
- `is-entity-url.ts` / `is-source-url.ts` / `is-image-url.ts` - URL type detection
- `should-resolve-url.ts` - Check if URL should be resolved
- `parse-entity-url.ts` - Parse entity URLs into components

**Anchor utilities:**
- `generate-anchor.ts` - GitHub-style anchor generation
- `normalize-anchor.ts` - Anchor normalization
- `generate-anchor-variants.ts` - Anchor normalization for matching
- `find-matching-anchor.ts` - Smart anchor matching with prefix support

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

**⚠️ IMPORTANT: Always Use the Same Output Directory During Testing**

When testing and iterating on the converter, **ALWAYS use the same output directory** (e.g., `examples/output`). Do NOT create new directories like `examples/output-test`, `examples/output-test2`, etc. for each test run.

**Why?**
- The persistent cache (`files.json` and `images.json`) lives in the output directory
- Using a different directory means:
  - ❌ No cache → All images re-downloaded from D&D Beyond
  - ❌ New random IDs generated for every file and image
  - ❌ Wasted bandwidth and time
  - ❌ Cannot verify cache system is working correctly

**Correct approach:**
```bash
# Always use the same output directory
npm run dndb-convert -- --input examples/input --output examples/output --verbose
npm run dndb-convert -- --input examples/input --output examples/output --verbose  # Reuses cache!
```

**Incorrect approach:**
```bash
# ❌ DON'T DO THIS - creates new cache each time
npm run dndb-convert -- --input examples/input --output examples/output-test1 --verbose
npm run dndb-convert -- --input examples/input --output examples/output-test2 --verbose
```

**Exception:** Only use a different output directory when specifically testing cache behavior or when you want to start fresh (e.g., testing breaking changes to the mapping format).

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
