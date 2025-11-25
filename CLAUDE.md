# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A CLI tool that converts D&D Beyond HTML sourcebooks to clean, structured Markdown files. The tool uses unique 4-character IDs for file naming, downloads images locally, generates navigation links, and preserves D&D-specific formatting (stat blocks, spell descriptions, tables).

**Current Status:** Feature complete - link resolver implemented with entity-aware resolution, URL aliasing, and smart anchor matching.

**Documentation:**

- Architecture details: `docs/architecture.md`
- Configuration reference: `docs/configuration.md`
- Link resolver algorithm: `docs/resolver.md`
- Template variables: `docs/templates.md`
- Entity indexer: `docs/indexer.md`
- Performance notes: `docs/performance.md`

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

- The persistent cache (`files.json`, `images.json`, `indexes.json`) lives in the output directory
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

**Exception:** Only use a different output directory when specifically testing cache behavior or when you want to start fresh.

## Architecture Overview

The converter uses a **pipeline architecture** where a shared `ConversionContext` object flows through sequential modules.

**Pipeline stages:**

1. **scan** - File discovery and ID assignment
2. **process** - Parse all, then process and write markdown
3. **indexer** - Generate entity indexes (optional)
4. **resolve** - Resolve links (optional)
5. **stats** - Display statistics

Each module receives a `ConversionContext` object containing config, tracker, and accumulated data from previous stages.

### Pipeline Modules

1. **Scanner** (`scanner.ts`)
   - **Purpose**: Discover input files and assign persistent IDs
   - **What it does**:
     - Discovers HTML files using fast-glob
     - Loads sourcebook metadata from `sourcebook.json`
     - Assigns unique 4-char IDs with persistent mapping (`files.json`)
     - Detects templates (global and per-sourcebook)
     - Groups files by sourcebook
   - **Outputs**: `ctx.files`, `ctx.sourcebooks`, `ctx.globalTemplates`

2. **Processor** (`processor.ts`)
   - **Purpose**: Convert HTML to markdown and extract metadata
   - **Why two-pass**: Pass 1 extracts all anchors/entities so they're available during Pass 2 processing
   - **What it does**:
     - **Pass 1**: Parse all HTML, extract metadata (titles, anchors, entities, URLs, images)
     - **Pass 2**: Download images, convert to markdown, render templates, write files
     - Generates index file per sourcebook
   - **Title handling**: Uses longest match from titleSelectors, then updates first H1 in content to match
   - **Outputs**: Markdown files, sourcebook indexes, updates `ctx.files` with anchors/entities

3. **Indexer** (`indexer.ts`)
   - **Purpose**: Generate navigable entity index files (spells, monsters, etc.)
   - **Why before resolver**: Index files need their links resolved too
   - **Key concepts**:
     - Creates `LinkResolver` instance (stored in `ctx.linkResolver` for sharing)
     - Auto-filters entities by ddbSourceId from converted sourcebooks
     - Fetches D&D Beyond listing pages (paginated)
     - Parses entities using type-specific parsers
     - Resolves entity URLs to local files during generation
     - Caches entity data in `indexes.json` to avoid re-fetching
   - **Pattern**: Uses factory pattern with closure variables to avoid prop drilling
   - **Outputs**: Entity index files, global index, updated `indexes.json`
   - See `docs/indexer.md` for configuration details

4. **Resolver** (`resolver.ts`)
   - **Purpose**: Transform D&D Beyond URLs into local markdown links
   - **Why after indexer**: Reuses LinkResolver (saves rebuilding entity index)
   - **Key concepts**:
     - Reuses `LinkResolver` from `ctx.linkResolver` (or creates if indexer skipped)
     - Reads all written files, resolves links, overwrites
     - URL normalization, aliasing, entity/source classification all in LinkResolver
     - Smart anchor matching with 12-step priority (plural/singular, prefix, word subset)
   - **Outputs**: All markdown files updated with resolved links
   - See `docs/resolver.md` for complete matching algorithm

5. **Stats** (`stats.ts`)
   - **Purpose**: Display conversion summary
   - **What it shows**: Files, images, entity indexes, links, errors with progress bars

### Data Flow Through Pipeline

Understanding how data flows through the pipeline is critical:

1. **Scanner** → Builds `ctx.files` array with FileDescriptor objects (id, paths, directory)
2. **Processor** → Enriches each file with: `title`, `anchors`, `entities`, `url`, writes markdown
3. **Indexer** → Creates `LinkResolver` from `ctx.files` entities → stores in `ctx.linkResolver`
4. **Resolver** → Reuses `ctx.linkResolver` → resolves links in all written files

**Key insight**: `LinkResolver` is built ONCE by indexer, reused by resolver. This is why:
- Indexer runs before resolver
- Both modules use `ctx.linkResolver ?? new LinkResolver(ctx)` pattern
- Entity index (URL → file mapping) doesn't need rebuilding

**Context evolution**:
- After scanner: `ctx.files`, `ctx.sourcebooks`, `ctx.globalTemplates`
- After processor: `ctx.files[].title`, `ctx.files[].anchors`, `ctx.files[].entities`, `ctx.files[].written`
- After indexer: `ctx.linkResolver` (with entity index built from all files)
- After resolver: All files have resolved links

## Common Patterns

### Context Object Pattern
All modules receive `ConversionContext` containing `config`, `tracker`, `idGenerator`, `verbose`, `refetch`.
Modules enrich context by adding fields (e.g., scanner adds `files`, indexer adds `linkResolver`).
This enables sharing state between modules without coupling them.

### Factory Pattern with Closures
Modules like processor and indexer define helper functions inside the main function.
These inner functions share access to closure variables (`config`, `tracker`, etc.) without needing them passed as parameters.

**Why**: Avoids prop drilling while keeping related functions organized together. The module extracts what it needs from context once, then all helper functions can use those values.

### Two-Pass Processing
**Pattern**: Parse all → then process
**Why**: Need complete data before making decisions

Examples:
- **Processor**: Parse all HTML to extract anchors → then process (anchors available for cross-references)
- **Indexer**: Fetch all entity pages → then resolve (all entities available for matching)

### Persistent Mapping Pattern
All ID assignments use persistent JSON mappings:
- `files.json`: HTML path → markdown filename
- `images.json`: Image URL → local filename
- `indexes.json`: Index title → filename + cached entities

**Why**: Enables caching, prevents ID conflicts across runs, maintains stable links.

## Key Design Decisions

### Unique ID System

All files and images get 4-character lowercase alphanumeric IDs (e.g., `a3f9.md`, `m3x7.png`).

**Why random IDs instead of meaningful names:**
- Many chapters have the same name ("Introduction", "Appendix A")
- File titles contain special characters and spaces
- Random IDs create clean, conflict-free filenames
- IDs are hackable and easy to reference

**How it works:**
- `IdGenerator` creates unique alphanumeric IDs
- Scanner assigns file IDs, processor assigns image IDs
- IDs are registered globally to prevent duplicates
- Persistent mappings ensure same ID across conversions

**Persistent mappings:**
- `files.json` - HTML path → markdown filename
- `images.json` - Image URL → local filename
- `indexes.json` - Index title → filename + cached entity data

**Benefits:**
- **Caching**: Same URL → same filename → skip re-download
- **Stability**: Links remain valid across reconversions
- **Uniqueness**: No filename conflicts or special character issues

### Configuration System

Uses layered deep-merge: default.json → user config → CLI --config flag

- Validated with Zod schemas
- Invalid configs fall back gracefully with errors in summary
- Uses `env-paths` for OS-specific config paths
- See `docs/configuration.md` for all options

**Key config sections:**

- `input`/`output` - Directories
- `ids` - ID generation settings
- `markdown` - Turndown formatting options
- `html` - Content selector, remove selectors
- `images` - Download settings
- `links` - Resolution, aliases, entity locations
- `indexes` - Entity index generation

### Template System

Uses Handlebars with precedence: sourcebook-specific → global → built-in defaults

**Template types:**

- `index.md.hbs` - Sourcebook table of contents
- `file.md.hbs` - Individual chapter pages
- `entity-index.md.hbs` - Entity index pages (handles both entity lists and hierarchical children)
- `global-index.md.hbs` - Global index

**Custom Handlebars helpers:**

- `sortKeys` - Alphabetical sorting with optional priority keys
- `sortNumeric` - Numeric sorting for integers and fractions (e.g., CR: 1/8, 1/4, 1/2, 1, 2)
- `groupBy` - Group array by field path
- `spellLevel` - Format spell level display
- `spellSpecial` - Build spell special column (R=Ritual, C=Concentration)
- Comparison helpers: `eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `and`, `or`, `not`
- String helpers: `capitalize`, `contains`

See `docs/templates.md` for variables and examples.

### Link Resolution

The resolver transforms D&D Beyond links into local markdown links.

**Link types (priority order):**

1. Internal anchors (same-page `#links`)
2. Entity links (`/spells/123-name`, `/monsters/456-name`)
3. Source links (`/sources/dnd/phb-2024/chapter#anchor`)

**Key features:**

- URL aliasing (Free Rules → PHB, variant items → base items)
- Entity locations (spells → spell pages, monsters → monster pages)
- Smart anchor matching (plural/singular, prefix, word subset)
- Fallback styles (bold, italic, plain, none)

See `docs/resolver.md` for the complete 12-step matching algorithm.

### Error Handling

Uses "continue and report" strategy:

- Individual failures don't stop conversion
- Errors collected with context
- Summary shows all issues at end
- Invalid configs fall back to defaults

**Unified Tracker** (`src/utils/tracker.ts`):

- Counter methods: `incrementSuccessful()`, `incrementImagesDownloaded()`, etc.
- Issue tracking: `trackError(path, error, type, context)`
- Link tracking: `trackUnresolvedLink(path, text)`
- Results: `getStats()` returns `ProcessingStats`

## Type System

All types are consolidated in `src/types.ts`. Most types use Zod schemas as single source of truth for validation.

### Key Types

- `ConversionContext` - Context object flowing through pipeline
  - `config`: ConversionConfig
  - `tracker`: Tracker
  - `idGenerator`: IdGenerator
  - `refetch?`: boolean
  - `verbose?`: boolean
  - `files?`: FileDescriptor[]
  - `sourcebooks?`: SourcebookInfo[]
  - `globalTemplates?`: TemplateSet
  - `linkResolver?`: LinkResolver

- `FileDescriptor` - File metadata with unique ID
  - `inputPath`: string - Original HTML file path
  - `relativePath`: string - Relative path from input directory
  - `outputPath`: string - Full path to output markdown file
  - `directory`: string - Sourcebook directory name
  - `sourcebookId`: string - Unique sourcebook ID
  - `filename`: string - Output filename (with .md)
  - `id`: string - 4-character unique ID
  - `url?`: string - Canonical URL from page metadata
  - `title?`: string - Extracted from first H1
  - `anchors?`: FileAnchors - Valid anchors + HTML ID mappings
  - `content?`: string - Temporary, cleared after processing
  - `images?`: string[] - Temporary, cleared after processing
  - `written?`: boolean - Flag after successful write

- `SourcebookInfo` - Sourcebook metadata and configuration
  - `id`: string - Unique sourcebook ID
  - `title`: string - Sourcebook title
  - `directory`: string - Directory name
  - `outputPath`: string - Path to output directory
  - `ddbSourceId?`: number - D&D Beyond source ID (from config.sources)
  - `templates`: TemplateSet - Loaded templates
  - `bookUrl?`: string - Book-level URL

- `FileAnchors` - Anchor data for a file
  - `valid: string[]` - All markdown anchors
  - `htmlIdToAnchor: Record<string, string>` - HTML ID → markdown anchor

- `ProcessingStats` - Final statistics
  - Files, images, links counts
  - `issues`: Issue[] (file, image, resource issues)
  - `unresolvedLinksList`: UnresolvedLink[]

## Critical Implementation Details

### LinkResolver Sharing Between Modules

The indexer and resolver both need `LinkResolver`, but it should only be built once:

**Why share?**
- Building LinkResolver requires iterating through all `ctx.files` to extract entities
- Entity index maps URLs to file locations (expensive to build)
- Indexer needs it to resolve entity links in index files
- Resolver needs it to resolve links in all files

**How it works:**
Both modules use nullish coalescing to reuse existing LinkResolver or create new one. If the instance doesn't exist in context yet, it's stored for the next module.

**Result**: Whichever runs first creates it, the other reuses it. This enables flexible module ordering.

### Title Extraction and Synchronization

Files often have multiple H1 elements with different text. We need consistent titles everywhere.

**The problem:**
- `<h1 class="page-title">Chapter 1: Name</h1>` (outside content, used for navigation)
- `<h1 class="compendium-hr">Name</h1>` (inside content, becomes markdown)
- Without sync: Navigation shows "Chapter 1: Name", file shows "# Name"

**The solution:**
1. Try multiple selectors from `config.html.titleSelectors` array
2. Keep the longest match (typically the more descriptive one)
3. Update first H1 *inside content* to match extracted title
4. This H1 becomes the markdown heading when converted

**Result**: Navigation and file content show identical titles.

### Entity Index Building

The entity index is a critical data structure for link resolution:

**What it is:** Map of entity URL → FileDescriptor
- Key: `/spells/12345-fireball`
- Value: File where that spell is described

**How it's built:**
1. During processing, each file's HTML is parsed for entity links
2. Entity URLs are stored in `file.entities`
3. LinkResolver initialization iterates `ctx.files` and builds the index
4. Index is used to resolve entity links → local file paths

**Why during LinkResolver init:**
- Entities are already extracted by processor
- Building happens once (when first LinkResolver is created)
- Both indexer and resolver use the same index

### Two-Pass Processing Pattern

**Why two passes:**
- Pass 1 extracts ALL anchors from ALL files first
- Pass 2 can then reference anchors from any file (even files processed later)
- Without this: File A can't link to anchor in File B if B is processed after A

**How it works:**
First pass iterates all files to extract titles, anchors, and entities. Second pass uses that complete metadata to generate navigation, convert to markdown, and write files. This separation ensures all cross-references are valid regardless of file processing order.

### Cache Hit Detection

Images and entities use "download vs cache" logic:

**Images:**
1. Is URL in `images.json`? → Get cached filename
2. Does file exist on disk? → Skip download (cached)
3. Otherwise: Download and add to mapping

**Entities:**
1. Is fetch URL in `indexes.json` cache? → Load entity URLs
2. Reconstruct entities from `entities` map
3. Otherwise: Fetch from D&D Beyond

**Why this matters:**
- Enables `--refetch` flag to force fresh fetches
- Verbose mode shows "downloaded vs cached" counts
- Cache files are portable (can commit to git)

## Important Conventions

### Import Paths

Do NOT include `.js` extensions - esbuild handles module resolution:

```typescript
// Correct
import { loadConfig } from "./utils/config";

// Incorrect
import { loadConfig } from "./utils/config.js";
```

### HTML Preprocessing vs Turndown Rules

**Use preprocessing** (Cheerio DOM manipulation before Turndown): Fix invalid HTML structure

**Use Turndown rules**: Convert valid HTML patterns to markdown

**Current preprocessing:**

- Nested lists fix: D&D Beyond uses `<ol><li>...</li><ul>...</ul></ol>` pattern
- Moves misplaced lists into previous `<li>` element
- Title extraction: Uses multiple selectors (longest match), then updates first H1 in content to match
- This ensures navigation/index titles match file content titles

**Current Turndown rules:**

- `remove-heading-links.ts` - Remove anchor links from headings
- `unwrap-linked-images.ts` - Remove `<a>` wrappers from images
- `image-alt-text.ts` - Extract alt text from image URLs
- `figure-caption.ts` - Figure captions to blockquotes
- `aside.ts` - Aside elements to callouts
- `flexible-columns.ts` - Column layouts to lists
- `table.ts` - Complex table handling (rowspan, colspan, captions)
- `stat-block.ts` - Monster stat-block formatting

### Table Handling

D&D Beyond uses complex tables. Custom rule handles:

- Caption extraction
- Rowspan handling (D&D Beyond pattern)
- Multiple header rows (keeps detailed row only)
- Footer extraction
- Section dividers (colspan in tbody)

## Project Structure

```
src/
├── cli/
│   ├── commands/
│   │   ├── convert.ts       # Pipeline orchestration + CLI
│   │   └── config.ts        # Shows config location
│   └── index.ts
├── modules/
│   ├── scanner.ts           # File discovery & ID assignment
│   ├── processor.ts         # Two-pass: parse all, then process + write
│   ├── resolver.ts          # Link resolution
│   ├── indexer.ts           # Entity index generation
│   ├── stats.ts             # Statistics display
│   └── index.ts
├── turndown/
│   ├── rules/               # Custom D&D-specific rules
│   └── index.ts
├── utils/                   # Shared utilities
├── types.ts                 # All types and Zod schemas
└── config/
    └── default.json
```

### Utilities Overview

**Core:** `id-generator.ts`, `load-config.ts`, `tracker.ts`, `link-resolver.ts`

**File operations:** `load-mapping.ts`, `save-mapping.ts`, `file-exists.ts`, template loaders

**URL/Entity handling:** `parse-entity-url.ts`, `get-entity-type-from-url.ts`, `is-image-url.ts`

**Anchor handling:** `generate-anchor.ts`, `find-matching-anchor.ts`

Note: URL normalization, aliasing, and link classification are internalized in `LinkResolver` class.

### Build System

**esbuild** (`build.js`):

- Entry: `src/cli/index.ts` → `dist/cli.js`
- ESM format, external packages
- Copies `src/config/default.json` to `dist/config/`

**Module system:**

- ES modules (`"type": "module"`)
- TypeScript with `moduleResolution: "bundler"`

## Testing Strategy

### Persistent Caching

Cache files in output directory avoid repeated D&D Beyond requests:

- `files.json` - HTML paths → markdown filenames
- `images.json` - Image URLs → local filenames
- `indexes.json` - Entity index mappings and cached entity data

**Download logic:**

1. URL in mapping? → Reuse filename
2. File on disk? → Skip download
3. Both pass → Use cached file (instant)

**Verbose mode:**

```bash
npm run dndb-convert -- --input examples/input --output examples/output --verbose
# Shows: "Images: 0 downloaded, 49 cached"
```

### Example Files

**Location:** `examples/input/players-handbook/`

14 HTML files from Player's Handbook 2024 covering intro, classes, equipment, spells, appendices.

```bash
npm run dndb-convert -- --input examples/input --output examples/output --verbose
```

## Documentation Guidelines

When writing or updating documentation, follow these rules to maintain consistency and avoid duplication.

### Where to Document

**CLAUDE.md** - Development context for Claude Code:

- Project overview and current status
- Development commands
- Architecture overview (concise, with links to docs/)
- Key design decisions (why, not deep how)
- Type system overview
- Important conventions
- Project structure
- Testing strategy

**docs/\*.md** - Detailed technical documentation:

- Complete algorithms (e.g., resolver.md has 12-step anchor matching)
- Full configuration references
- Exhaustive template variables
- Performance details and benchmarks
- Implementation specifics

### Rules to Prevent Duplication

1. **Single source of truth**: Each piece of information should exist in ONE place
   - Detailed algorithms → docs/
   - Quick reference for development → CLAUDE.md

2. **Reference, don't repeat**: In CLAUDE.md, summarize and link to docs/

   ```markdown
   # Good

   See `docs/resolver.md` for the complete 12-step matching algorithm.

   # Bad

   [Copy entire algorithm here]
   ```

3. **Keep CLAUDE.md concise**: If a section exceeds ~20 lines, consider:
   - Moving details to docs/
   - Summarizing with a link

4. **Update all locations**: When changing behavior that's documented in multiple places:
   - Search for related terms across all docs
   - Update CLI help text, docs/, and CLAUDE.md references
   - Keep cross-references accurate

### When to Write Documentation

1. **New features**: Document in the appropriate docs/ file, add summary to CLAUDE.md if needed for development context

2. **Bug fixes**: Only document if it changes expected behavior

3. **Refactoring**: Update docs if public interfaces or file locations change

4. **CLI changes**: Always update:
   - CLI help text in `src/cli/index.ts`
   - Relevant docs/ file
   - CLAUDE.md if it affects development workflow

### Cross-References

Always add "Related Documentation" links at the top of docs/ files:

```markdown
**Related Documentation:**

- [Architecture](architecture.md) - Pipeline overview
- [Configuration](configuration.md) - All options
```

## Additional Notes

- ESLint uses flat config format (`eslint.config.js`) for v9
- TypeScript strict mode enabled
- License: MIT
