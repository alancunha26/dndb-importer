# RFC 0002: Entity and Global Indexes

**Status:** Accepted

**Author:** Alan Cunha

**Created:** 2025-11-21

**Updated:** 2025-11-21

## Summary

Add a new pipeline step that generates entity indexes by fetching entity lists from D&D Beyond's listing pages. Users can configure filters to generate multiple indexes (by sourcebook, type, rarity, etc.) and a global index linking to all sourcebooks and entity indexes. This leverages D&D Beyond as the source of truth for entity data and reuses the existing entity matching algorithm from the resolver.

## Motivation

Currently, the converter produces:

- Individual markdown files for each sourcebook page
- A sourcebook index file per sourcebook

What's missing:

- **Cross-sourcebook navigation**: No way to see all spells, monsters, or magic items across multiple sourcebooks
- **Entity discovery**: Users must know which sourcebook contains which entities
- **Quick reference**: No alphabetized lists of entities for quick lookup
- **Filtered views**: No way to see "all rare magic items" or "all evocation spells"

Use cases:

1. "Show me all spells available across PHB, DMG, and my homebrew"
2. "List all monsters from all converted sourcebooks"
3. "Find all rare magic items from the DMG"
4. "Generate an index of all 1st-level spells"

## Proposal

### Approach: Fetch Entity Lists from D&D Beyond

Instead of extracting entities from converted file anchors (error-prone, loses display names), fetch entity lists directly from D&D Beyond's listing pages. These pages provide:

- Accurate display names
- Complete entity URLs for matching
- Metadata (rarity, school, CR, etc.)
- Filter support via URL parameters

### Benefits of This Approach

1. **Accurate display names**: Get exact names from D&D Beyond (no guessing from anchors)
2. **Complete entity URLs**: Get `/spells/2618887-fireball` format for matching
3. **Filter support**: Use D&D Beyond's filters for sourcebook, type, rarity, etc.
4. **Metadata**: Can extract additional data (rarity, school, CR, etc.) from listing tables
5. **Reuse resolver**: Use existing entity matching algorithm to find local files

### High-Level Flow

1. **Fetch**: Download entity listing page from D&D Beyond with configured filters
2. **Parse**: Extract entity names, URLs, and metadata from HTML tables/lists
3. **Resolve**: For each entity, use the existing entity matcher to find the local file and anchor
4. **Generate**: Create index markdown file with links to resolved entities

### Configuration

Users define which indexes to generate in the config. Each index specifies:

- A display title for the index
- A D&D Beyond listing URL (with filters)

The entity type is extracted from the URL path (e.g., `/spells?...` → spells parser, `/magic-items?...` → magic-items parser).

Example configuration:

```json
{
  "indexes": {
    "generate": true,
    "global": {
      "enabled": true,
      "title": "Global Index"
    },
    "entities": [
      {
        "title": "All Spells",
        "url": "https://www.dndbeyond.com/spells?filter-partnered-content=f"
      },
      {
        "title": "PHB Spells",
        "url": "https://www.dndbeyond.com/spells?filter-source=145&filter-partnered-content=f"
      },
      {
        "title": "Rare Magic Items",
        "url": "https://www.dndbeyond.com/magic-items?filter-rarity=3&filter-partnered-content=f"
      }
    ]
  }
}
```

Users can create multiple indexes of the same type with different filters (e.g., "PHB Spells" vs "All Spells").

### Sourcebook ID in Metadata

Each `sourcebook.json` can include a D&D Beyond source ID:

```json
{
  "title": "Player's Handbook",
  "sourceId": 145
}
```

This enables:

- Automatic filtering to only show entities from converted sourcebooks
- The indexer can compute `filter-source` parameters based on available books
- Users don't need to manually specify source IDs in every URL

When an index URL doesn't include a `filter-source` parameter, the indexer can automatically add filters for all converted sourcebooks that have a `sourceId` defined. This prevents indexes from showing entities from books the user hasn't downloaded.

### Nested Indexes

Indexes can be nested to create hierarchical navigation. A parent index can link to child indexes instead of entities.

Example structure:

```
Spells (parent index)
├── By Sourcebook (parent index)
│   ├── PHB Spells (entity index)
│   └── DMG Spells (entity index)
└── By Level (parent index)
    ├── Cantrips (entity index)
    └── 1st Level Spells (entity index)
```

Configuration for nested indexes:

```json
{
  "indexes": {
    "generate": true,
    "entities": [
      {
        "title": "Spells",
        "children": [
          {
            "title": "By Sourcebook",
            "children": [
              {
                "title": "PHB Spells",
                "url": "https://www.dndbeyond.com/spells?filter-source=145"
              },
              {
                "title": "DMG Spells",
                "url": "https://www.dndbeyond.com/spells?filter-source=146"
              }
            ]
          },
          {
            "title": "By Level",
            "children": [
              {
                "title": "Cantrips",
                "url": "https://www.dndbeyond.com/spells?filter-level=0"
              },
              {
                "title": "1st Level",
                "url": "https://www.dndbeyond.com/spells?filter-level=1"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

An index entry with `children` becomes a parent index that lists links to its child indexes. An entry with `url` becomes an entity index that fetches and lists entities.

**Important**: The global index only lists root-level indexes. Nested indexes appear only in their respective parent index files. This keeps the global index clean while preserving hierarchical navigation.

### File Naming and Caching

Like all other output files, index files use 4-character unique IDs (e.g., `k3x9.md` not `index.md`). The `indexes.json` file stores both filename mappings and cached entity data:

```json
{
  "mappings": {
    "global": "k3x9.md",
    "entities": {
      "All Spells": "a7f2.md",
      "PHB Spells": "b4c1.md",
      "Spells": "f4k1.md"
    }
  },
  "cache": {
    "https://www.dndbeyond.com/spells?filter-partnered-content=f": {
      "fetchedAt": "2025-11-21T12:00:00Z",
      "entities": [
        {
          "name": "Fireball",
          "url": "/spells/2618887-fireball",
          "metadata": {
            "level": "3rd",
            "school": "Evocation"
          }
        }
      ]
    }
  }
}
```

**How it works:**

1. **Mappings section**: Maps index titles to their generated filenames. Used to maintain stable IDs across runs.

2. **Cache section**: Stores parsed entity lists keyed by the full D&D Beyond URL. Each cached entry includes:
   - `fetchedAt`: Timestamp for potential time-based invalidation
   - `entities`: Parsed list of entities with names, URLs, and metadata

3. **On subsequent runs**: The indexer checks if a URL exists in cache before fetching. If cached, it skips the fetch and uses stored data.

4. **Force refetch**: Users can pass a CLI flag to ignore cache and refetch all entity lists.

## Design Details

### Pipeline Integration

Add index generation as a new step in the existing module pipeline:

```typescript
await modules.scan(ctx);
await modules.process(ctx);
await modules.resolve(ctx);
await modules.indexer(ctx); // NEW
modules.stats(tracker, verbose);
```

The indexer module runs after the resolver because it needs:

- All files processed with anchors extracted
- The entity matching algorithm available
- File canonical URLs for resolution

Can be disabled via `indexes.generate: false` config.

### HTML Parsing

Each entity type requires its own parser for type-specific metadata extraction. However, parsers can share common utilities based on three distinct listing patterns. Sample HTML files are available in `examples/entities/` for reference during development.

> **Note:** The `examples/entities/` directory is not committed to the repository due to copyright restrictions.

**Pattern 1: Info Cards** (spells, monsters, magic items):

- Selector: `div.info[data-slug] a.link`
- Entity ID from `data-slug` attribute
- Has pagination

**Pattern 2: List Rows** (equipment, feats, backgrounds):

- Selector: `div.list-row[data-slug] a.link`
- Entity ID from `data-slug` attribute
- Has pagination

**Pattern 3: Card Grid** (species, classes):

- Selector: `li.listing-card a.listing-card__link`
- Entity ID from href or class name
- No pagination (all shown in grid)

**Parser architecture:**

- One parser per entity type (8 total)
- Common utilities per pattern for entity/URL extraction
- Type-specific metadata selectors (e.g., spells: `.row.spell-level`, `.row.spell-school`; monsters: `.row.monster-type`, `.row.monster-challenge`)

Each parser extracts:

- **Name**: Display name of the entity
- **URL**: Entity URL path (e.g., `/spells/2618887-fireball`)
- **Metadata**: Type-specific data (level, rarity, CR, etc.)

### Entity Resolution

Reuse the existing entity matching from the resolver:

1. Parse the entity URL to get type and slug
2. Look up target files from `entityLocations` config
3. Find matching anchor using the existing matcher algorithm
4. Return file path and anchor for the link

Entities that can't be resolved are tracked separately and can be shown in stats or excluded from the index.

### Output Format

Entity indexes are generated as markdown files using Handlebars templates. The template receives:

- Index name and metadata
- List of resolved entities with names, file paths, anchors, and metadata
- Sourcebook information if spanning multiple books

The global index template receives:

- List of all sourcebooks with their index paths
- List of all entity indexes with entry counts

### Handling Pagination

D&D Beyond listing pages paginate for large result sets. The indexer handles this by:

1. Fetching the first page
2. Extracting the last page number from the penultimate `.b-pagination-item` element
3. Fetching remaining pages by incrementing the `page` URL parameter
4. Combining all results into a single entity list

### Error Handling

- **Fetch failures**: Retry with backoff, skip index if persistent failure
- **Parse failures**: Log and continue, generate partial index
- **Resolution failures**: Track unresolved entities, show in stats

### D&D Beyond Filter Parameters

D&D Beyond listing pages support various URL parameters for filtering:

**Common filters:**

- `filter-source=ID` - Filter by sourcebook (145=PHB, 146=DMG, etc.)
- `filter-partnered-content=f` - Exclude partnered content

**Spells:** level, school, class, concentration, ritual

**Magic Items:** rarity, type, attunement

**Monsters:** type, CR range, legendary status

**Equipment:** cost range, weight range

### Filesystem Structure

Overview of configuration, input, and output directories:

```
~/.config/dndb-importer/
└── config.json                 # User configuration (indexes config goes here)

input/
├── sourcebook.md.hbs           # Sourcebook index template (optional)
├── page.md.hbs                 # Page content template (optional)
├── entity-index.md.hbs         # Entity index template (optional)
├── global-index.md.hbs         # Global index template (optional)
├── players-handbook/
│   ├── sourcebook.json         # Metadata with sourceId
│   ├── sourcebook.md.hbs       # Sourcebook-specific index template (optional)
│   ├── page.md.hbs             # Sourcebook-specific page template (optional)
│   └── *.html                  # Downloaded HTML files
├── dungeon-masters-guide/
│   ├── sourcebook.json
│   └── *.html
└── monster-manual/
    ├── sourcebook.json
    └── *.html

output/
├── files.json                  # HTML path → markdown filename mapping
├── images.json                 # Image URL → local filename mapping
├── indexes.json                # Index mappings + cached entity lists
├── *.md                        # Converted sourcebook pages (4-char IDs)
├── *.png, *.jpg                # Downloaded images (4-char IDs)
└── [indexes]                   # Sourcebook, entity, and global indexes (4-char IDs)
```

All markdown and image files use 4-character unique IDs. The JSON mapping files provide persistence and human-readable lookups for debugging.

## Alternatives Considered

### 1. Extract entities from converted file anchors

**Original approach, now rejected**:

- Error-prone (not all anchors are entities)
- Loses display names (must guess from slugs)
- No filtering support
- No metadata

### 2. Use D&D Beyond API

**Deferred**: D&D Beyond may have internal APIs, but:

- Not publicly documented
- May require authentication
- Could change without notice

### 3. Manual entity lists

**Rejected**: Requires users to maintain entity lists manually.

## Open Questions

- [x] **Sourcebook indexes relationship**: Should this configuration affect existing sourcebook index files?
  - Keep separate - they serve different purposes
  - Sourcebook indexes: auto-generated chapter listings for linear reading
  - Entity indexes: configured cross-reference listings for lookup
  - Global index links to both types

- [x] **HTML structure**: What's the exact HTML structure of each listing page type?
  - Three patterns: Info cards, List rows, Card grid
  - Sample files in `examples/entities/` for reference
  - See HTML Parsing section for selectors

- [x] **Pagination**: How to handle paginated results?
  - D&D Beyond uses `page` URL parameter for pagination
  - Last page number is in the penultimate `.b-pagination-item` element
  - Fetch all pages automatically

- [x] **Rate limiting**: How to avoid being rate-limited by D&D Beyond?
  - Not a concern due to aggressive caching
  - Results cached to disk, reused in subsequent runs
  - User can pass optional argument to force refetch

- [x] **Metadata columns**: Which metadata to include in index tables?
  - Determined by entity type based on what's available in the fetched HTML
  - Each parser extracts all available metadata from its listing page structure

- [x] **Unresolved entities**: How to handle entities that don't resolve?
  - Use the existing fallback strategy from `links.fallbackStyle` config
  - Consistent with how unresolved links are handled in the resolver

- [x] **Source IDs**: Need to map sourcebook names to D&D Beyond filter IDs
  - Add `sourceId` field to `sourcebook.json` metadata
  - Indexer auto-filters to converted sourcebooks when URL lacks `filter-source`
  - Prevents showing entities from books user hasn't downloaded

## Implementation Phases

### Phase 1: Core Infrastructure

- Config schema for index definitions (Zod validation)
- `indexes.json` for mappings and cache persistence
- Fetch listing pages with retry logic
- Basic HTML parser for one entity type (spells)
- Entity resolution using existing matcher
- Generate simple markdown list output

### Phase 2: All Entity Types

- Parsers for all entity types (table-based and card-based)
- Pagination handling (detect last page, fetch all)
- Metadata extraction per entity type

### Phase 3: Nested Indexes and Global Index

- Nested index configuration (`children` support)
- Parent indexes that link to child indexes
- Global index with sourcebook and entity index links
- Root-only listing in global index

### Phase 4: Auto-filtering and Caching

- `sourceId` in sourcebook.json metadata
- Auto-filter URLs based on converted sourcebooks
- Cache parsed entity lists in `indexes.json`
- CLI flag to force refetch

### Phase 5: Templates and Statistics

- Handlebars templates for entity and global indexes
- Statistics (resolved/unresolved counts)
- Fallback handling for unresolved entities

## References

- [RFC 0001: D&D Beyond HTML to Markdown Converter](./0001-dndbeyond-html-markdown-converter.md)
- [CLAUDE.md - Entity Locations](../CLAUDE.md#configuration-system)
- [Resolver documentation](../resolver.md)

### D&D Beyond Listing URLs

**With filters:**

- Magic Items: `https://www.dndbeyond.com/magic-items?filter-type=0&filter-search=&filter-requires-attunement=&filter-effect-type=&filter-effect-subtype=&filter-has-charges=&filter-source=146&filter-partnered-content=f`
- Backgrounds: `https://www.dndbeyond.com/backgrounds?filter-name=&filter-partnered-content=f`
- Feats: `https://www.dndbeyond.com/feats?filter-name=&filter-prereq-subtype=&filter-partnered-content=f`
- Spells: `https://www.dndbeyond.com/spells?filter-search=&filter-verbal=&filter-somatic=&filter-material=&filter-concentration=&filter-ritual=&filter-partnered-content=f`
- Monsters: `https://www.dndbeyond.com/monsters?filter-type=0&filter-search=&filter-cr-min=&filter-cr-max=&filter-armor-class-min=&filter-armor-class-max=&filter-average-hp-min=&filter-average-hp-max=&filter-is-legendary=&filter-is-mythic=&filter-has-lair=&filter-partnered-content=f`
- Equipment: `https://www.dndbeyond.com/equipment?filter-search=&filter-cost-min=&filter-cost-max=&filter-weight-min=&filter-weight-max=`

**Full page lists:**

- Species: `https://www.dndbeyond.com/species`
- Classes: `https://www.dndbeyond.com/classes`
