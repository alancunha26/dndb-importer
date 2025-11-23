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

**Pipeline** (`src/cli/commands/convert.ts`):

```typescript
const tracker = new Tracker(config);
const ctx: ConversionContext = { config, tracker };

await modules.scan(ctx); // 1. File discovery
await modules.process(ctx); // 2. Parse all, then process + write
await modules.resolve(ctx); // 3. Resolve links (optional)
await modules.index(ctx); // 4. Generate entity indexes (optional)
modules.stats(tracker, verbose); // 5. Display statistics
```

### Pipeline Modules

1. **Scanner** (`scanner.ts`)
   - Discovers HTML files using fast-glob
   - Detects templates (global and per-sourcebook)
   - Loads sourcebook metadata from `sourcebook.json`
   - Assigns unique 4-char IDs with persistent mapping
   - Groups files by sourcebook
   - Writes: `ctx.files`, `ctx.sourcebooks`, `ctx.globalTemplates`

2. **Processor** (`processor.ts`) - Two-pass processing
   - **Pass 1**: Parse all HTML, extract metadata (titles, anchors, entities, URLs, images)
   - **Pass 2**: Download images, convert to markdown, render templates, write files
   - Generates index file per sourcebook
   - Updates `ctx.files` with anchors, entities, and written status

3. **Resolver** (`resolver.ts`)
   - Creates `LinkResolver` class instance (`link-resolver.ts`)
   - Resolves D&D Beyond links to local markdown links
   - All URL normalization, aliasing, and resolution logic in LinkResolver
   - Uses smart anchor matching with 12-step priority system
   - See `docs/resolver.md` for complete algorithm

4. **Indexer** (`indexer.ts`)
   - Fetches D&D Beyond listing pages
   - Parses entities (spells, monsters, items, etc.)
   - Generates entity index files
   - Generates global index
   - Caches entity data in `indexes.json`
   - See `docs/indexer.md` for configuration

5. **Stats** (`stats.ts`)
   - Displays formatted summary with progress bars
   - Shows files, images, links, errors

## Key Design Decisions

### Unique ID System

All files and images get 4-character lowercase alphanumeric IDs (e.g., `a3f9.md`, `m3x7.png`).

**Persistent mappings:**

- `files.json` - HTML path → markdown filename
- `images.json` - Image URL → local filename
- `indexes.json` - Index title → filename, entity data cache

**Benefits:**

- Prevents filename conflicts and special character issues
- Consistent IDs across conversion runs
- Enables caching (skip downloaded images)

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
- `entity-index.md.hbs` - Entity index pages (also used for parent indexes with children)
- `global-index.md.hbs` - Global index

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

All types are consolidated in `src/types.ts`. Types use Zod schemas as single source of truth:

```typescript
export const SourcebookMetadataSchema = z.looseObject({
  title: z.string().optional(),
  edition: z.string().optional(),
  // ...
});

export type SourcebookMetadata = z.infer<typeof SourcebookMetadataSchema>;
```

### Key Types

- `ConversionContext` - Context object flowing through pipeline
  - `config`: ConversionConfig
  - `tracker`: Tracker
  - `files?`: FileDescriptor[]
  - `sourcebooks?`: SourcebookInfo[]
  - `globalTemplates?`: TemplateSet

- `FileDescriptor` - File metadata with unique ID
  - `sourcePath`, `relativePath`, `outputPath`, `sourcebook`, `uniqueId`
  - `url?`: Canonical URL from page metadata
  - `title?`: Extracted from first H1
  - `anchors?`: FileAnchors (valid anchors + HTML ID mappings)
  - `entities?`: ParsedEntityUrl[] (extracted entity URLs)
  - `content?`, `images?`: Temporary, cleared after processing
  - `written?`: Boolean flag after successful write

- `SourcebookInfo` - Sourcebook metadata with templates
  - `metadata`: SourcebookMetadata
  - `templates`: TemplateSet
  - `bookUrl?`: Book-level URL
  - `id`, `title`, `sourcebook`, `outputPath`

- `FileAnchors` - Anchor data for a file
  - `valid: string[]` - All markdown anchors
  - `htmlIdToAnchor: Record<string, string>` - HTML ID → markdown anchor

- `ProcessingStats` - Final statistics
  - Files, images, links counts
  - `issues`: Issue[] (file, image, resource issues)
  - `unresolvedLinksList`: UnresolvedLink[]

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
