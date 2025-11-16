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
const ctx: ConversionContext = { config }

// Run pipeline
await modules.scan(ctx)       // 1. File discovery
await modules.process(ctx)    // 2. Process + write (memory-efficient)
await modules.resolve(ctx)    // 3. Resolve links (optional)
await modules.stats(ctx)      // 4. Build statistics

// Display results
console.log(`Files processed: ${ctx.stats.successful}/${ctx.stats.totalFiles}`)
```

**Pipeline Modules** (`src/modules/`):

1. **Scanner** (`scanner.ts`)
   - Discovers HTML files using fast-glob
   - Assigns unique 4-char IDs using `short-unique-id`
   - Builds filename→ID mapping
   - Groups files by sourcebook
   - Writes: `ctx.files`, `ctx.sourcebooks`, `ctx.mappings`

2. **Processor** (`processor.ts`) - **Memory-efficient streaming**
   - Processes files **one at a time** to avoid memory bloat
   - For each file:
     - Parses HTML with Cheerio
     - Extracts content using `.p-article-content` selector
     - Builds `FileAnchors` (valid anchors + HTML ID mappings)
     - Converts HTML → Markdown using Turndown with custom D&D rules
     - Downloads images with retry logic
     - Builds navigation links (prev/index/next)
     - Assembles final markdown (frontmatter + navigation + content)
     - **Writes to disk immediately**
     - Stores lightweight `WrittenFile` (path + anchors only)
     - HTML and markdown are garbage collected before next file
   - Generates index files per sourcebook
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
   - Skipped if `convertInternalLinks: false`

4. **Stats** (`stats.ts`)
   - Counts files, images, links
   - Calculates duration
   - Writes: `ctx.stats`

### Key Design Decisions

**Unique ID System:**
- All files and images get 4-character lowercase alphanumeric IDs (e.g., `a3f9.md`, `m3x7.png`)
- Generated using `short-unique-id` library with collision detection
- Prevents filename conflicts and special character issues

**Configuration System:**
- Uses `env-paths` library for OS-specific config paths
- Linux: Follows XDG Base Directory specification (`$XDG_CONFIG_HOME`)
- Configs are deep-merged: default.json → user config → CLI --config flag
- Location: `src/config/default.json` (copied to `dist/config/` during build)
- Structure: `input`, `output`, `parser` (html/markdown/idGenerator), `media`, `logging`
- HTML Parser: Uses `.p-article-content` selector to extract main content from D&D Beyond HTML
- URL Mapping: `parser.html.urlMapping` maps D&D Beyond URLs to HTML file paths (relative to input directory)
- Fallback: `parser.html.fallbackToBold` converts unresolvable links to bold text (default: true)

**File Organization:**
- Input: User manually downloads HTML files, names with numeric prefixes (01-, 02-, etc.)
- Output: One directory per sourcebook, all files (markdown + images) in same directory
- Navigation: Each file has prev/index/next links, index file per sourcebook

**Cross-References (Resolver Module):**
- **Link resolution is optional** (`parser.html.convertInternalLinks`):
  - If `true`: Resolver module resolves links with full validation (default)
  - If `false`: Resolver module skipped
- User configures URL mapping in `parser.html.urlMapping`:
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
  - Always resolved, regardless of `convertInternalLinks` setting
- Example 1: `[Bell](#Bell1GP)` → `[Bell](#bell-1-gp)` (internal link via HTML ID index)
- Example 2: `[Fireball](/sources/dnd/phb-2024/spells#fireball)` → `[Fireball](a3f9.md#fireball)` (cross-file)
- Example 3: `[Magic Missile](https://www.dndbeyond.com/spells/2619022-magic-missile)` → `[Magic Missile](b4x8.md#magic-missile)` (entity)
- Example 4: `[Fireballs](/sources/...)` → matches heading "Fireball" (singular/plural handled)
- Example 5: `[Alchemist's Fire](/.../equipment#alchemists-fire)` → matches "Alchemist's Fire (50 GP)" (prefix matching)
- Example 6: `[Equipment](/.../equipment)` → removed entirely (no anchor)
- Anchors generated from link text using GitHub markdown format (lowercase, hyphens)
- **Fallback**: When `convertInternalLinks: true` and `fallbackToBold: true`, converts to bold text (`**Fireball**`) if:
  - URL not in mapping
  - File not found
  - Anchor doesn't exist in target file (after checking exact, plural/singular, and prefix matches)
- External links preserved as-is
- Maintains navigation while preventing broken links

### Type System

Types are organized in `src/types/` by domain:
- **`types/config.ts`** - Configuration types (`ConversionConfig`, `HtmlParserConfig`, etc.)
- **`types/files.ts`** - File-related types (`FileDescriptor`, `ImageDescriptor`, `FileAnchors`, etc.)
- **`types/pipeline.ts`** - Pipeline data types (`ScanResult`, `ProcessedFile`, `WrittenFile`, `LinkResolutionIndex`, etc.)
- **`types/context.ts`** - `ConversionContext` (flows through all modules)
- **`types/index.ts`** - Re-exports all types

Key types:
- `ConversionContext` - Context object that flows through pipeline modules (flattened structure):
  - `config`: Configuration
  - `files`: FileDescriptor[] (from scanner)
  - `sourcebooks`: SourcebookInfo[] (from scanner)
  - `mappings`: Map<string, string> (from scanner)
  - `writtenFiles`: WrittenFile[] (from processor - lightweight, no HTML/markdown)
  - `stats`: ProcessingStats (from stats)
- `FileDescriptor` - File metadata with unique ID
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
├── turndown/
│   ├── rules/index.ts
│   └── config.ts
├── utils/
│   ├── config.ts
│   ├── id-generator.ts
│   └── logger.ts
├── types/
│   ├── config.ts            # Configuration types
│   ├── files.ts             # File-related types
│   ├── pipeline.ts          # Pipeline data types
│   ├── context.ts           # ConversionContext
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
`src/utils/id-generator.ts` maintains a Set of used IDs to prevent collisions within a conversion run. Reset between runs.

## Testing Strategy

(From RFC - not yet implemented)
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
