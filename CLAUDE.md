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

The conversion follows a two-phase approach:

**Phase 1: Generation (Create markdown files)**
1. **Configuration Loader** (`src/utils/config.ts`) - Three-tier config system: default → user → custom
2. **File Scanner** (`src/scanner.ts`) - Discovers HTML files, assigns unique 4-char IDs, builds filename→ID mapping
3. **HTML Processor** (`src/html-processor.ts`) - Parses HTML with Cheerio, extracts content (links preserved)
4. **Turndown Converter** (`src/turndown/config.ts`) - Converts HTML to Markdown with custom D&D rules
5. **Image Handler** (`src/image-handler.ts`) - Downloads images, assigns unique IDs
6. **Markdown Writer** (`src/markdown-writer.ts`) - Writes files with navigation, front matter (links unresolved)

**Phase 2: Link Resolution (Post-process all files)**
7. **Link Resolver** (`src/link-resolver.ts`) - Reads all markdown files, builds anchor index (file → valid anchors), resolves D&D Beyond links to local markdown links using URL mapping + ID mapping, validates anchors exist in target files, falls back to bold text for missing links or anchors

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

**Cross-References (Two-Phase Approach):**
- **Phase 1**: Files generated with HTML links intact (from Turndown conversion)
- **Phase 2**: Post-processor handles D&D Beyond links based on config
- **Link resolution is optional** (`parser.html.convertInternalLinks`):
  - If `true`: Resolve links with full validation (default)
  - If `false`: Convert all D&D Beyond links to bold text
- User configures URL mapping in `parser.html.urlMapping`:
  - Source paths: `/sources/dnd/phb-2024/equipment` → `players-handbook/08-chapter-6-equipment.html`
  - Entity paths: `/spells` → `players-handbook/10-spell-descriptions.html`
- Supports both source book links and entity links (e.g., `https://www.dndbeyond.com/spells/2619022-magic-missile`)
- Scanner builds runtime mapping: `players-handbook/08-chapter-6-equipment.html` → unique ID `yw3w`
- **Phase 1 builds `FileAnchors`** for each file during HTML processing:
  - `valid: string[]` - All markdown anchors with plural/singular variants
  - `htmlIdToAnchor: Record<string, string>` - HTML element IDs → markdown anchors
- **Phase 2 builds `LinkResolutionIndex`** by collecting all `FileAnchors`:
  - Single unified index: file ID → anchor data
  - Used for both same-page link resolution and cross-file validation
- Link resolver combines mappings: URL → HTML path → unique ID
- **Validates** anchor exists in target file with smart matching:
  1. Exact match (including plural/singular variants)
  2. Prefix match for headers with suffixes (e.g., "Alchemist's Fire" matches "Alchemist's Fire (50 GP)")
  3. Uses shortest match if multiple prefix matches
- **Header links** (no anchor): Links without specific anchors (e.g., `[Equipment](/sources/.../equipment)`) are **removed entirely**
- **Internal links** (same-page): Resolved using `LinkResolutionIndex`
  - Phase 1: HTML Parser builds `htmlIdToAnchor` mapping using Cheerio
    - Example: `<h2 id="Bell1GP">Bell (1 GP)</h2>` → stores `{ "Bell1GP": "bell-1-gp" }`
  - Phase 2: Uses `index[fileId].htmlIdToAnchor` to resolve links
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

All types are centralized in `src/types.ts`:
- `FileDescriptor` - File metadata with unique ID
- `ConversionConfig` - Complete configuration structure
- `HtmlParserConfig` - Includes `urlMapping` (Record<string, string>) for URL → HTML filename mapping
- `ImageDescriptor` - Image download tracking
- `NavigationLinks` - Previous/index/next navigation
- `ConversionResult` - Conversion output with metadata, includes `FileAnchors` for Phase 2
- `FileAnchors` - Anchor data for a single file (valid anchors + HTML ID mappings)
  - `valid: string[]` - All markdown anchors with plural/singular variants
  - `htmlIdToAnchor: Record<string, string>` - HTML element IDs → markdown anchors
- `LinkResolutionIndex` - Maps file IDs to `FileAnchors` (unified index for Phase 2)
- `LinkResolutionResult` - Link resolution outcome with failure reason
- `ProcessingStats` - Includes `linksResolved` and `linksFailed` counters

### CLI Structure

Commands are in `src/cli/commands/`:
- `convert.ts` - Main conversion command (default action)
- `config.ts` - Shows OS-specific config file location

Add new commands by creating files in `src/cli/commands/` and registering in `src/cli/index.ts`.

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
