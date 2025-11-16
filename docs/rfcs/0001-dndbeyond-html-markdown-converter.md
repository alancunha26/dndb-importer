# RFC 0001: D&D Beyond HTML to Markdown Converter

**Status:** Accepted

**Author:** Alan Cunha

**Created:** 2025-11-15

**Updated:** 2025-11-15

## Summary

A CLI tool that converts D&D Beyond sourcebook HTML pages into clean, structured Markdown files with unique ID-based file naming, local image downloading, navigation links, and D&D-specific formatting preservation (stat blocks, spell descriptions, tables).

## Motivation

### Goals

- Convert D&D Beyond HTML sourcebooks to Markdown format
- Preserve content hierarchy and structure
- Handle D&D-specific formatting (stat blocks, tables, spell descriptions, etc.)
- Maintain relative file organization per sourcebook
- Provide a simple, intuitive CLI interface
- Generate unique IDs for files and images to avoid naming conflicts
- Create navigation links between related content
- Download and organize images locally

### Non-Goals

- Automated downloading from D&D Beyond (users manually download)
- Real-time conversion or web scraping
- PDF generation or other output formats (for now)

## Proposal

### High-Level Architecture

**Two-Phase Processing:**

Phase 1 (Generation): Scan → Parse → Convert → Write files with intact HTML links
Phase 2 (Post-Processing): Read all files → Resolve links → Replace with markdown links or bold text

```
┌─────────────────┐
│   CLI Entry     │
│   Point         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Configuration  │
│  Loader         │
└────────┬────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────┐
│                    PHASE 1: GENERATION                    │
│                                                           │
│  ┌─────────────────┐      ┌──────────────────┐            │
│  │  File Scanner   │─────▶│  ID Generator    │            │
│  │  & Validator    │      │  (short-uuid)    │            │
│  └────────┬────────┘      └──────────────────┘            │
│           │                                               │
│           │  Builds: filename → unique ID mapping         │
│           ▼                                               │
│  ┌─────────────────┐      ┌──────────────────┐            │
│  │  HTML Parser    │─────▶│  Turndown Core   │            │
│  │  & Processor    │      │  + Custom Rules  │            │
│  └────────┬────────┘      └──────────────────┘            │
│           │                                               │
│           │  (Links preserved as-is from HTML)            │
│           │                                               │
│           ├────────────────────────┐                      │
│           ▼                        ▼                      │
│  ┌─────────────────┐      ┌──────────────────┐            │
│  │  Image          │      │  Markdown        │            │
│  │  Downloader     │─────▶│  Post-Processor  │            │
│  └─────────────────┘      └────────┬─────────┘            │
│                                    │                      │
│                                    ▼                      │
│                           ┌──────────────────┐            │
│                           │  Navigation      │            │
│                           │  Builder         │            │
│                           └────────┬─────────┘            │
│                                    │                      │
│                                    ▼                      │
│  ┌─────────────────┐      ┌──────────────────┐            │
│  │  File Writer    │─────▶│  Index           │            │
│  │  & Organizer    │      │  Generator       │            │
│  └─────────────────┘      └──────────────────┘            │
└───────────────────────────────────────────────────────────┘
         │
         │  All files written with HTML links intact
         │
         ▼
┌───────────────────────────────────────────────────────────┐
│                 PHASE 2: LINK RESOLUTION                  │
│                                                           │
│  ┌─────────────────────────────────────────┐              │
│  │  Link Resolver & Post-Processor         │              │
│  │                                         │              │
│  │  1. Read all generated markdown files   │              │
│  │  2. Use URL mapping + ID mapping        │              │
│  │  3. Find D&D Beyond links in content    │              │
│  │  4. Resolve to unique IDs               │              │
│  │  5. Replace with markdown links         │              │
│  │  6. Fallback to bold if link not found  │              │
│  │  7. Overwrite files with resolved links │              │
│  └─────────────────────────────────────────┘              │
└───────────────────────────────────────────────────────────┘
```

### User Experience

**CLI Commands:**

```bash
# Convert all books in input directory
dndb-convert --input ./input --output ./output

# Convert specific book
dndb-convert --input ./input/players-handbook --output ./output

# Dry run (preview without writing)
dndb-convert --input ./input --dry-run

# Verbose output
dndb-convert --input ./input --output ./output --verbose

# Custom config
dndb-convert --input ./input --output ./output --config custom.json
```

**Directory Structure:**

```
my-dndbeyond-books/
├── input/
│   ├── players-handbook/
│   │   ├── 01-introduction.html
│   │   ├── 02-chapter-1.html
│   │   └── 03-chapter-2.html
│   └── dungeon-masters-guide/
│       └── 01-chapter-1.html
└── output/
    ├── players-handbook/
    │   ├── m3x7.png             # Downloaded images with unique IDs
    │   ├── p4q2.jpg
    │   ├── k2p8.md              # Index file
    │   ├── a3f9.md              # Introduction
    │   └── m5x1.md              # Chapter 1
    └── dungeon-masters-guide/
        ├── j4uv.md              # Index file
        └── yg6c.md              # Chapter 1
```

**Output File Format:**

Each markdown file contains:

- YAML front matter (title, date, tags)
- Navigation header (prev | index | next)
- Content converted from HTML
- Image references using unique IDs (e.g., `![Alt](m3x7.png)`)

## Design Details

### Architecture Decisions

**File Naming & IDs:**

- Use unique 4-character IDs generated by `short-unique-id` library
- Format: lowercase alphanumeric only (e.g., `a3f9.md`, `k2p8.md`)
- Images also use unique IDs (e.g., `m3x7.png`, `p4q2.jpg`)
- Images saved in same directory as markdown files

**Navigation & Structure:**

- Create one index file per sourcebook with ordered links
- Add previous/index/next navigation header to each file
- Index files link to all content in order

**YAML Front Matter:**

- Simplified format with title, date, and tags
- Two tag types:
  - `dnd5e/chapter` - for source sections/chapters
  - `dnd5e/source` - for source index files

**Content Handling:**

- **Headings**: Preserve source heading levels (don't normalize)
- **Cross-References**: Two-phase approach - generate files first, then resolve all links in post-processing (see "Link Resolution Strategy" below)
- **Images**: Download images locally and name with unique IDs
- **Duplicate Content**: Repeat content if it appears in multiple files

**File Ordering:**

- Use numeric prefix in filenames (e.g., `01-introduction.html`, `02-chapter-1.html`)
- Scanner sorts by numeric prefix, falls back to alphabetical

**Two-Phase Processing:**

1. **Phase 1 (Generation)**: Scan files, assign IDs, convert HTML to Markdown, download images, write files
   - Links preserved as-is from HTML
   - All files and IDs known after this phase
2. **Phase 2 (Link Resolution)**: Post-process all files to resolve D&D Beyond links
   - Build anchor index from all files
   - Validate and convert links to local markdown format
   - Fallback to bold text for unresolvable links

This separation provides complete knowledge of all files/IDs before resolving links, enabling proper validation.

### Core Components

#### 1. File Scanner (`src/scanner.ts`) - Phase 1

- Discovers HTML files in input directory
- Generates unique 4-character IDs for each file using `short-unique-id`
- Groups files by sourcebook
- Creates file processing queue ordered by numeric prefix
- Generates unique ID for sourcebook index files
- Builds runtime mapping: relative HTML path → unique ID
  - Example: `players-handbook/08-chapter-6-equipment.html` → `yw3w`
- Passes mapping to Phase 2 for link resolution

#### 2. HTML Parser & Preprocessor (`src/html-processor.ts`) - Phase 1

- Loads HTML files
- Extracts main content using `.p-article-content` selector
- Optionally removes unwanted elements via `removeSelectors` config
- Identifies D&D-specific structures
- Extracts metadata (title, chapter, page references)
- **Builds anchor data** (`FileAnchors`) using Cheerio:
  1. **HTML ID mappings**: Finds all elements with `id` attribute
     - Example: `<h2 id="Bell1GP">Bell (1 GP)</h2>`
     - Extracts element text, generates GitHub-style anchor: `"bell-1-gp"`
     - Stores: `htmlIdToAnchor: { "Bell1GP": "bell-1-gp" }`
  2. **Valid anchors**: Extracts all headings
     - Generates GitHub-style anchors with plural/singular variants
     - Example: `## Fireball` → `valid: ["fireball", "fireballs"]`
  3. Stores both in `ConversionResult.anchors` for Phase 2
- **Does NOT convert links in Phase 1** - links preserved as-is from HTML

#### 3. Turndown Converter with Custom Rules (`src/turndown/`) - Phase 1

- Converts HTML to Markdown
- Applies D&D-specific formatting rules:
  - **Stat Blocks**: Monster/NPC stat blocks with proper formatting
  - **Spell Blocks**: Spell descriptions with standard format
  - **Tables**: Equipment tables, spell lists, encounter tables
  - **Sidebars/Callouts**: Block quotes for variant rules
  - **Links**: Converted to basic markdown links from HTML (will be resolved in Phase 2)

#### 4. Markdown Writer (`src/markdown-writer.ts`) - Phase 1

- Cleans up Turndown output
- Generates navigation headers (previous/index/next)
- Adds YAML front matter with title, date, and tags
- Updates image paths to use unique ID filenames
- Writes markdown files to output directory (with unresolved links)

#### 5. Image Downloader & Processor (`src/image-handler.ts`) - Phase 1

- Detects images in HTML content
- Downloads images from URLs
- Generates unique IDs for image filenames
- Saves images to sourcebook directory
- Tracks image mappings (original URL → unique ID)

#### 6. Link Resolver & Post-Processor (`src/link-resolver.ts`) - Phase 2

- Runs after all markdown files are generated (Phase 1 complete)
- **Builds LinkResolutionIndex** by collecting `FileAnchors` from all Phase 1 results
  - Maps file ID → anchor data (valid anchors + HTML ID mappings)
  - Example: `{ "a3f9": { valid: [...], htmlIdToAnchor: {...} } }`
- Processes three types of links:
  1. **Internal links** (same-page): Uses `htmlIdToAnchor` from index
     - Example: `[Bell](#Bell1GP)` looks up `index["a3f9"].htmlIdToAnchor["Bell1GP"]` → `"bell-1-gp"`
     - Result: `[Bell](#bell-1-gp)`
  2. **D&D Beyond links** (cross-file): Uses `valid` anchors for validation
  3. **External links**: Preserved as-is
- **If `convertInternalLinks: true`**:
  - Resolves D&D Beyond links using URL mapping + anchor validation
  - Replaces valid links with local markdown links: `[LinkText](fileId.md#anchor)`
  - Converts unresolvable links per `fallbackToBold` setting
  - Removes header links (links without anchors)
- **If `convertInternalLinks: false`**:
  - Simply converts all D&D Beyond links to bold text
- Internal link resolution always occurs regardless of `convertInternalLinks` setting
- Overwrites markdown files with processed links
- See "Link Resolution Strategy" for complete details

### Technology Stack

**Core Dependencies:**

- Node.js (v18+)
- TypeScript (v5+)
- Turndown - HTML to Markdown conversion
- Cheerio - HTML parsing and manipulation
- Commander.js - CLI argument parsing
- Chalk - Terminal styling and colors
- Ora - Progress spinners
- Fast-glob - File pattern matching
- short-unique-id - Unique ID generation
- axios - Image downloading
- env-paths - Cross-platform config paths (XDG on Linux)

**Development Dependencies:**

- esbuild - Production bundling and builds
- tsx - TypeScript execution for development
- Jest or Vitest - Testing
- ESLint + @typescript-eslint/\* - Linting
- Prettier - Code formatting

### Link Resolution Strategy

This section provides comprehensive details on how D&D Beyond links are converted to local markdown links.

**Overview:**

Link resolution is **optional** and controlled by `parser.html.convertInternalLinks`:
- **If true**: Run Phase 2 to resolve links (default behavior)
- **If false**: Skip Phase 2, convert all D&D Beyond links to bold text

**Phase 1: Generation**
- Links preserved as-is from Turndown HTML-to-Markdown conversion
- All files written with their unique IDs
- Runtime mapping built: HTML path → unique ID

**Phase 2: Link Resolution** (only if `convertInternalLinks: true`)

**Step 1: User Configuration**

Users configure URL-to-HTML-path mapping in `parser.html.urlMapping`:
```json
{
  "/sources/dnd/phb-2024/equipment": "players-handbook/08-chapter-6-equipment.html",
  "/sources/dnd/phb-2024/spells": "players-handbook/09-chapter-7-spells.html",
  "/spells": "players-handbook/10-spell-descriptions.html",
  "/monsters": "players-handbook/12-creature-stat-blocks.html"
}
```

Two types of mappings:
1. **Source book paths**: `/sources/dnd/phb-2024/spells` → book section
2. **Entity type paths**: `/spells` → spell description page (for entity links like `https://www.dndbeyond.com/spells/2619022-magic-missile`)

- Paths relative to input directory root (supports multiple sourcebooks)
- Config deep-merge allows adding/overriding individual mappings

**Step 2: Build Link Resolution Index**

Before resolving any links, collect anchor data from all Phase 1 conversion results:
- Gather `FileAnchors` from all `ConversionResult`s generated in Phase 1
- Each file provides:
  1. **Valid anchors**: List of all markdown anchors with plural/singular variants
     - Built during HTML processing from headings
     - Example: `["fireball", "fireballs", "magic-missile", "magic-missiles"]`
  2. **HTML ID mappings**: HTML element IDs → markdown anchors
     - Built during HTML processing using Cheerio
     - Example: `{ "Bell1GP": "bell-1-gp", "Fireball": "fireball" }`
- Build `LinkResolutionIndex`: `{ "a3f9": { valid: [...], htmlIdToAnchor: {...} }, ... }`

This single index supports both same-page link resolution and cross-file anchor validation

**Step 3: Three-Level Link Validation**

For each D&D Beyond link, extract the relevant URL path and validate:

**Example 1 - Source book link:**
`[Fireball](/sources/dnd/phb-2024/spells#fireball)`
1. **URL Lookup**: `/sources/dnd/phb-2024/spells` → `players-handbook/09-spells.html`
2. **File Lookup**: `players-handbook/09-spells.html` → `a3f9`
3. **Anchor Validation**: `"fireball"` in `index["a3f9"].valid`? ✓
→ Result: `[Fireball](a3f9.md#fireball)`

**Example 2 - Entity link:**
`[Magic Missile](https://www.dndbeyond.com/spells/2619022-magic-missile)`
1. **URL Lookup**: `/spells` → `players-handbook/10-spell-descriptions.html`
2. **File Lookup**: `players-handbook/10-spell-descriptions.html` → `b4x8`
3. **Anchor Validation**: `"magic-missile"` in `index["b4x8"].valid`? ✓
→ Result: `[Magic Missile](b4x8.md#magic-missile)`

**Example 3 - Header with suffix (prefix matching):**
`[Alchemist's Fire](/sources/dnd/phb-2024/equipment#alchemists-fire)`
- Heading in target: `## Alchemist's Fire (50 GP)`
- Generated anchor: `"alchemists-fire-50-gp"`
- Link anchor: `"alchemists-fire"`
1. **Exact match**: `index["a3f9"].valid.includes("alchemists-fire")`? ✗
2. **Prefix match**: `index["a3f9"].valid.find(a => a.startsWith("alchemists-fire"))`? ✓ `"alchemists-fire-50-gp"`
→ Result: `[Alchemist's Fire](a3f9.md#alchemists-fire-50-gp)`

**Anchor Matching Strategy:**
1. Check for exact match in `index[fileId].valid` (includes plural/singular variants)
2. If no exact match, check if any anchor starts with the link anchor
3. If multiple prefix matches, use the shortest one
4. If no matches: Apply fallback strategy

**Header Links (No Anchor):**
Links without anchors (e.g., `[Equipment](/sources/dnd/phb-2024/equipment)`) are removed entirely:
- These are typically table of contents or chapter reference links
- Not converted to bold text or preserved as links
- Simply removed from the output

If all validations pass: Create link
If any fail: Apply fallback strategy

**Step 4: Anchor Generation**

- Generate anchor from **link text** (not href): `"Fire Ball!"` → `"fire-ball"`
- GitHub format: lowercase, spaces→hyphens, remove special chars
- Always preserves original link text for display

**Step 5: Fallback Strategy**

**When link resolution is enabled** (`convertInternalLinks: true`):

Convert `[LinkText](url)` → `**LinkText**` if `fallbackToBold: true` and:
1. URL not in config mapping
2. File not found in runtime mapping
3. Anchor doesn't exist in target file (after checking plural/singular variants)

If `fallbackToBold: false`: Keep original URL (useful for debugging)
Logs warning with: URL, source file, line number, failure reason

**When link resolution is disabled** (`convertInternalLinks: false`):

All D&D Beyond links converted to bold text in Phase 2:
- `[Fireball](/sources/...)` → `**Fireball**`
- `[Magic Missile](https://www.dndbeyond.com/spells/...)` → `**Magic Missile**`
- External links preserved as-is
- Phase 2 only performs this conversion, no validation needed

**Link Type Detection:**

The resolver identifies and processes different link types:

1. **HTML Internal Links** (same-page anchors):
   - Pattern: `[Bell](#Bell1GP)` (from Turndown conversion of `<a href="#Bell1GP">`)
   - Action: Resolve using `htmlIdToAnchor` from link resolution index
   - Process:
     1. Extract HTML ID from anchor: `#Bell1GP` → `"Bell1GP"`
     2. Look up in `index[currentFileId].htmlIdToAnchor["Bell1GP"]` → `"bell-1-gp"`
     3. Replace anchor: `[Bell](#Bell1GP)` → `[Bell](#bell-1-gp)`
   - Note: HTML ID `"Bell1GP"` may not match markdown anchor `"bell-1-gp"` because:
     - HTML: `<h2 id="Bell1GP">Bell (1 GP)</h2>` (compact ID)
     - Markdown: `## Bell (1 GP)` → anchor `#bell-1-gp` (from heading text)
   - Mapping built during Phase 1 HTML processing using Cheerio
   - Always resolved, regardless of `convertInternalLinks` setting

2. **D&D Beyond Cross-File Links**:
   - **Full URLs**: `https://www.dndbeyond.com/spells/2619022-magic-missile` → Extract `/spells`
   - **Absolute paths**: `/sources/dnd/phb-2024/equipment` → Use as-is
   - Action: Resolve to local markdown file + anchor (Phase 2)

3. **External Links**:
   - Pattern: Non-D&D Beyond URLs (e.g., `https://example.com`)
   - Action: Preserved as-is

**Edge Cases:**
- Internal links (same-page): Anchors normalized to GitHub format, always preserved
- External links: Preserved as-is
- Page-level links (no anchor): Removed entirely (table of contents / chapter references)
- Duplicate anchors: Links to first occurrence (GitHub behavior)
- Entity ID in URL (e.g., `2619022-`): Ignored, only entity type matters
- Plural/singular mismatch: Both forms checked (e.g., link says "Fireballs" but heading is "Fireball")
- Headers with suffixes: Prefix matching used (e.g., "Alchemist's Fire" matches "Alchemist's Fire (50 GP)")

**Plural/Singular Matching:**

Common patterns handled:
- Add/remove 's': `"spell"` ↔ `"spells"`
- Add/remove 'es': `"class"` ↔ `"classes"`
- 'y' ↔ 'ies': `"ability"` ↔ `"abilities"`

When validating anchors, both forms are checked automatically.

### Type Definitions

All types consolidated in `src/types.ts`:

```typescript
export interface FileDescriptor {
  sourcePath: string;
  relativePath: string;
  outputPath: string;
  sourcebook: string;
  filename: string;
  uniqueId: string; // 4-character unique ID
}

export interface ImageDescriptor {
  originalUrl: string;
  uniqueId: string;
  extension: string;
  localPath: string;
  sourcebook: string;
  downloadStatus: "pending" | "success" | "failed";
  error?: Error;
}

export interface NavigationLinks {
  previous?: { title: string; id: string };
  index: { title: string; id: string };
  next?: { title: string; id: string };
}

export interface ConversionResult {
  markdown: string;
  metadata: DocumentMetadata;
  navigation: NavigationLinks;
  images: ImageDescriptor[];
  warnings: string[];
}

// Phase 2: Link Resolution
export interface AnchorIndex {
  // Maps file unique ID to list of valid anchors in that file
  [fileId: string]: string[];
}

export interface LinkResolutionResult {
  resolved: boolean;
  reason?: "url-not-mapped" | "file-not-found" | "anchor-not-found";
  targetFileId?: string;
  targetAnchor?: string;
}
```

### Configuration

**Layered Configuration System:**

The tool uses a three-tier configuration priority:

1. **Default config** - Built-in defaults from `src/config/default.json`
2. **User config** - OS-specific user configuration (optional)
3. **Custom config** - CLI `--config` flag (highest priority)

**OS-Specific Config Paths (using env-paths):**

- **Linux:** `$XDG_CONFIG_HOME/dndbeyond-importer/config.json` (defaults to `~/.config/dndbeyond-importer/config.json`)
  - Follows XDG Base Directory specification
- **macOS:** `~/Library/Preferences/dndbeyond-importer/config.json`
- **Windows:** `%APPDATA%\dndbeyond-importer\config.json`

**Configuration Sections:**

- **Input/Output**: Directory paths, file patterns, file extensions
- **Parser**:
  - `html`: Content selector, URL mapping, link conversion settings
  - `markdown`: Turndown options, front matter, navigation headers
  - `idGenerator`: Unique ID length and character set
- **Media**: Image download settings, formats, timeout, retries
- **Logging**: Log level, progress display

Configs are deep-merged (default → user → custom), allowing partial overrides while preserving defaults.

See "Link Resolution Strategy" section for details on `parser.html.urlMapping`.

### Error Handling

**Error Categories:**

1. File System Errors (directory not found, permissions)
2. Parsing Errors (malformed HTML, unexpected structure)
3. Conversion Errors (Turndown failures, custom rule exceptions)
4. Write Errors (output directory creation, file permissions)

**Strategy:**

- Fail Fast: Critical errors (config issues, input not found) stop execution
- Graceful Degradation: Per-file errors log and continue to next file
- Detailed Logging: All errors logged with context
- Summary Report: End-of-run summary showing successes and failures
- Image Download Errors: Retry with exponential backoff (3 attempts), generate JSON report for persistent failures

## Alternatives Considered

### Alternative 1: Normalized Heading Levels

**Considered:** Normalizing all heading levels to start at H1 for consistency.
**Rejected:** Preserving source heading levels maintains the original document structure and hierarchy.

### Alternative 2: Convert Cross-Reference Links to Bold Text

**Considered:** Converting all entity cross-reference links (spells, monsters, equipment) to bold text to match PDF style.
**Rejected:** Markdown links preserve navigation and user experience. By building a URL-to-file mapping, we can convert D&D Beyond internal links to local markdown links (e.g., `[Fireball](a3f9.md#fireball)`), maintaining navigation while keeping everything offline. This is superior to losing all navigation by converting to bold text.

### Alternative 3: Image Subdirectory

**Considered:** Storing images in a separate `images/` subdirectory.
**Rejected:** Keeping images in the same directory as markdown files simplifies references and organization.

### Alternative 4: Descriptive Filenames

**Considered:** Using descriptive filenames based on chapter titles (e.g., `chapter-1-character-creation.md`).
**Rejected:** Unique IDs are more robust, avoid filename conflicts, and prevent issues with special characters or long titles.

### Alternative 5: Sequential Numeric IDs

**Considered:** Using sequential numbers (001, 002, etc.) for file IDs.
**Rejected:** Short unique IDs are more flexible, avoid renumbering when files are added/removed, and provide better collision resistance.

### Alternative 6: Manual OS Detection for Config Paths

**Considered:** Manually detecting OS and building config paths with custom logic.
**Rejected:** Using `env-paths` library provides:

- Automatic XDG Base Directory specification compliance on Linux
- Platform-specific conventions (macOS Preferences, Windows AppData)
- Tested and maintained cross-platform behavior
- Environment variable support (e.g., `$XDG_CONFIG_HOME`)

## Open Questions

- [x] Should we use unique IDs or descriptive filenames? → **Decision: Unique 4-character IDs**
- [x] Should images be in a subdirectory or same directory as markdown? → **Decision: Same directory**
- [x] How should cross-references to entities be handled? → **Decision: Convert to bold text**
- [x] What tag structure should we use in YAML front matter? → **Decision: `dnd5e/chapter` and `dnd5e/source`**
- [x] Which build tool should we use for production? → **Decision: esbuild**
- [x] Which HTML parser should we use (JSDOM vs Cheerio)? → **Decision: Cheerio (simpler and faster)**
- [x] Which CLI framework should we use (Commander.js vs Yargs)? → **Decision: Commander.js + Chalk**
- [x] How should we handle errors during image downloads? → **Decision: Retry 3 times with backoff, generate JSON report for failures**
- [x] Should we support batch processing with parallel conversion? → **Decision: No parallel processing in Phase 1, sequential file processing**

## Implementation Phases

### Phase 1 (MVP)

- Basic HTML to Markdown conversion
- Custom rules for stat blocks, spells, tables
- CLI interface with essential options (Commander.js + Chalk)
- Sequential file processing (no parallelization)
- Unique ID generation for files and images
- Image downloading with retry logic and failure reporting (JSON)
- Navigation links
- Index file generation

### Phase 2 (Enhancements)

- Parallel processing of files
- Better cross-reference handling
- Generate table of contents
- Plugin system for custom rules
- Watch mode for automatic conversion

### Phase 3 (Advanced)

- Support for other VTT HTML exports
- Interactive mode for handling ambiguous structures
- Advanced metadata extraction
- Export to other formats (Obsidian, Notion, etc.)

## Success Criteria

- ✅ Converts HTML files to readable Markdown
- ✅ Preserves directory structure (one folder per sourcebook)
- ✅ Generates unique 4-character IDs for all files
- ✅ Generates unique 4-character IDs for all images
- ✅ Downloads images and saves to same directory as markdown files
- ✅ Image references use simple filenames
- ✅ Creates navigation headers with previous/index/next links
- ✅ Generates index file per sourcebook with ordered links
- ✅ Uses correct tags (`dnd5e/chapter` and `dnd5e/source`)
- ✅ Converts entity cross-references to bold text
- ✅ Preserves source heading levels
- ✅ Stat blocks are properly formatted
- ✅ Tables are preserved and readable
- ✅ Spell blocks follow consistent format
- ✅ CLI is intuitive and provides helpful feedback
- ✅ Handles errors gracefully without data loss
- ✅ Processes entire sourcebook without manual intervention

## References

- [Turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown converter
- [short-unique-id](https://github.com/jeanlescure/short-unique-id) - Unique ID generation
- [JSDOM](https://github.com/jsdom/jsdom) - HTML parsing option
- [Cheerio](https://github.com/cheeriojs/cheerio) - HTML parsing option
- [Commander.js](https://github.com/tj/commander.js) - CLI framework option
- [Yargs](https://github.com/yargs/yargs) - CLI framework option
