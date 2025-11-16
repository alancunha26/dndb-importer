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

The conversion follows a sequential pipeline:

1. **Configuration Loader** (`src/utils/config.ts`) - Three-tier config system: default → user → custom
2. **File Scanner** (`src/scanner.ts`) - Discovers HTML files, assigns unique 4-char IDs using `short-unique-id`
3. **HTML Processor** (`src/html-processor.ts`) - Parses HTML with Cheerio, removes D&D Beyond chrome
4. **Turndown Converter** (`src/turndown/config.ts`) - Converts HTML to Markdown with custom D&D rules
5. **Image Handler** (`src/image-handler.ts`) - Downloads images, assigns unique IDs
6. **Markdown Writer** (`src/markdown-writer.ts`) - Writes files, generates navigation, creates indexes

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

**File Organization:**
- Input: User manually downloads HTML files, names with numeric prefixes (01-, 02-, etc.)
- Output: One directory per sourcebook, all files (markdown + images) in same directory
- Navigation: Each file has prev/index/next links, index file per sourcebook

**Cross-References:**
- Entity links (spells, monsters, equipment) converted to bold text
- Matches PDF style and avoids broken links in offline format

### Type System

All types are centralized in `src/types.ts`:
- `FileDescriptor` - File metadata with unique ID
- `ConversionConfig` - Complete configuration structure
- `ImageDescriptor` - Image download tracking
- `NavigationLinks` - Previous/index/next navigation
- `ConversionResult` - Conversion output with metadata

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
