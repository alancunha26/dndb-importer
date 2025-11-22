# Entity Indexer Documentation

**Module:** `src/modules/indexer.ts`
**Status:** Implemented and tested

**Related Documentation:**

- [Architecture](architecture.md) - Pipeline overview
- [Configuration](configuration.md) - Index configuration options (`indexes.*`)
- [Templates](templates.md) - Handlebars template basics
- [Link Resolver](resolver.md) - Entity resolution algorithm
- [Performance](performance.md) - Caching strategy

## Overview

The Indexer module generates entity indexes by fetching listing pages from D&D Beyond, parsing them, and creating navigable index files. It runs AFTER the resolver has processed all files, enabling entity resolution to local file links.

## Processing Flow

```
1. Resolver completes → All files written with resolved links

2. Indexer runs:
   a. Load existing indexes.json mapping (IDs, cache)
   b. Collect sourceIds from converted sourcebooks
   c. Load templates (global or default)
   d. For each entity index config:
      - Apply source filters to URL
      - Fetch listing pages (or use cache)
      - Store entities in global map (deduplicated)
      - Resolve entities to local files
      - Render template with context
      - Write index file
   e. Generate global index (if enabled)
   f. Save updated indexes.json
```

## Entity Types and Parsers

### Supported Entity Types

| Type          | URL Pattern    | Parser Pattern |
| ------------- | -------------- | -------------- |
| `spells`      | `/spells`      | Info Cards     |
| `monsters`    | `/monsters`    | Info Cards     |
| `magic-items` | `/magic-items` | Info Cards     |
| `equipment`   | `/equipment`   | List Rows      |
| `feats`       | `/feats`       | List Rows      |
| `backgrounds` | `/backgrounds` | List Rows      |
| `species`     | `/species`     | Card Grid      |
| `classes`     | `/classes`     | Card Grid      |

### Parser Patterns

**Info Cards** (`div.info[data-slug]`):

- Used by spells, monsters, magic-items
- Rich metadata extraction
- Example metadata: level, school, castingTime, cr, type, size

**List Rows** (`div.list-row`):

- Used by equipment, feats, backgrounds
- Tabular data extraction
- Example metadata: type, cost, weight, source, tags

**Card Grid** (`li.listing-card`):

- Used by species, classes
- Simple name/URL extraction
- No pagination (single page)

### Metadata by Type

**Spells:**

```json
{
  "level": "3rd",
  "school": "evocation",
  "castingTime": "1 Action",
  "components": "V, S, M",
  "concentration": "No",
  "ritual": "No"
}
```

**Monsters:**

```json
{
  "cr": "10",
  "type": "Aberration",
  "size": "Large",
  "alignment": "Lawful Evil",
  "source": "Monster Manual"
}
```

**Magic Items:**

```json
{
  "rarity": "Rare",
  "type": "Weapon",
  "attunement": "Required"
}
```

**Equipment:**

```json
{
  "type": "Adventuring Gear",
  "cost": "50 gp",
  "weight": "1 lb."
}
```

**Feats:**

```json
{
  "source": "Player's Handbook",
  "notes": "Prerequisite: Strength 13",
  "tags": "Origin, General"
}
```

## Configuration

### indexes.generate

Enable/disable index generation:

```json
{
  "indexes": {
    "generate": true
  }
}
```

### indexes.global

Configure the global index:

```json
{
  "indexes": {
    "global": {
      "enabled": true,
      "title": "Global Index"
    }
  }
}
```

### indexes.entities

Array of entity index configurations:

```json
{
  "indexes": {
    "entities": [
      {
        "title": "All Spells",
        "url": "https://www.dndbeyond.com/spells?filter-partnered-content=f",
        "description": "A comprehensive list of all spells from converted sourcebooks."
      },
      {
        "title": "All Monsters",
        "url": "https://www.dndbeyond.com/monsters?filter-partnered-content=f",
        "description": "Complete bestiary of monsters from converted sourcebooks."
      }
    ]
  }
}
```

### Nested Indexes

Create hierarchical index structures:

```json
{
  "indexes": {
    "entities": [
      {
        "title": "Compendium",
        "description": "All game content indexes",
        "children": [
          {
            "title": "All Spells",
            "url": "https://www.dndbeyond.com/spells?filter-partnered-content=f"
          },
          {
            "title": "All Monsters",
            "url": "https://www.dndbeyond.com/monsters?filter-partnered-content=f"
          }
        ]
      }
    ]
  }
}
```

## Templates

### Template Types

| Template     | File                  | Purpose                                    |
| ------------ | --------------------- | ------------------------------------------ |
| Entity Index | `entity-index.md.hbs` | Lists of entities (spells, monsters, etc.) |
| Parent Index | `parent-index.md.hbs` | Links to child indexes                     |
| Global Index | `global-index.md.hbs` | Links to sourcebooks and entity indexes    |

### Template Precedence

1. Global templates: `input/entity-index.md.hbs`
2. Built-in defaults: `src/utils/get-default-*-template.ts`

### Template Context

**Entity Index:**

```typescript
{
  title: string;
  description?: string;
  type: EntityType;  // "spells", "monsters", etc.
  entities: Array<{
    name: string;
    url: string;
    metadata?: Record<string, string>;
    fileId?: string;
    anchor?: string;
    resolved: boolean;
  }>;
}
```

**Parent Index:**

```typescript
{
  title: string;
  description?: string;
  children: Array<{
    title: string;
    filename: string;
  }>;
}
```

**Global Index:**

```typescript
{
  title: string;
  sourcebooks: Array<{
    title: string;
    id: string;
  }>;
  entityIndexes: Array<{
    title: string;
    filename: string;
  }>;
}
```

### Handlebars Helpers

Comparison helpers for conditional rendering:

- `eq` - Equal: `{{#if (eq type "spells")}}`
- `ne` - Not equal: `{{#if (ne type "monsters")}}`
- `gt`, `lt`, `gte`, `lte` - Numeric comparisons
- `and`, `or`, `not` - Logical operators

### Example Template

```handlebars
#
{{{title}}}
{{#if description}}

  {{{description}}}
{{/if}}

{{#if (eq type "spells")}}
  | Spell | Level | School | Casting Time |
  |-------|-------|--------|--------------|
  {{#each entities}}
    |
    {{#if
      resolved
    }}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}**{{{name}}}**{{/if}}
    |
    {{metadata.level}}
    |
    {{metadata.school}}
    |
    {{metadata.castingTime}}
    |
  {{/each}}

{{else if (eq type "monsters")}}
  | Monster | CR | Type | Size | |---------|----|----- |------|
  {{#each entities}}
    |
    {{#if
      resolved
    }}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}**{{{name}}}**{{/if}}
    |
    {{metadata.cr}}
    |
    {{metadata.type}}
    |
    {{metadata.size}}
    |
  {{/each}}

{{else}}
  {{#each entities}}
    -
    {{#if
      resolved
    }}[{{{name}}}]({{{fileId}}}.md#{{{anchor}}}){{else}}**{{{name}}}**{{/if}}
  {{/each}}
{{/if}}
```

## Caching

### Cache Structure

Entity data is cached in `indexes.json` to avoid re-fetching:

```json
{
  "mappings": {
    "global": "77g2.md",
    "entities": {
      "All Spells": "td9w.md",
      "All Monsters": "3vb7.md"
    }
  },
  "entities": {
    "/spells/2618887-fireball": {
      "name": "Fireball",
      "metadata": { "level": "3rd", "school": "evocation", ... }
    }
  },
  "cache": {
    "https://www.dndbeyond.com/spells?filter-source=145&filter-source=146": {
      "fetchedAt": "2025-01-15T10:30:00.000Z",
      "entityUrls": ["/spells/2618887-fireball", ...]
    }
  }
}
```

### Deduplication

Entities are stored once by URL in the global `entities` map. Cache entries only store URL references, preventing duplication when multiple indexes share entities.

### Cache Behavior

- **First run**: Fetches from D&D Beyond, stores in cache
- **Subsequent runs**: Uses cached data (fast)
- **--refetch flag**: Forces re-fetch of entity data and re-download of images

```bash
# Use cache (fast)
npm run dndb-convert -- --input input --output output

# Force refetch (slow - re-downloads images and refetches entity data)
npm run dndb-convert -- --input input --output output --refetch
```

## Auto-Filtering

### Source ID Filtering

When sourcebooks include `sourceId` in their `sourcebook.json`, the indexer automatically filters listing URLs to only include entities from converted sourcebooks.

**sourcebook.json:**

```json
{
  "title": "Player's Handbook (2024)",
  "sourceId": 145
}
```

**URL transformation:**

```
Original:  https://www.dndbeyond.com/spells?filter-partnered-content=f
Filtered:  https://www.dndbeyond.com/spells?filter-partnered-content=f&filter-source=145&filter-source=146&filter-source=147
```

### Benefits

- Only fetches relevant entities
- Faster pagination (fewer pages)
- Consistent cache keys (sourceIds are sorted)

### Manual Filtering

If URL already has `filter-source` parameters, auto-filtering is skipped:

```json
{
  "title": "PHB Spells Only",
  "url": "https://www.dndbeyond.com/spells?filter-source=145"
}
```

## Pagination

### Detection

The indexer detects pagination from `.b-pagination-item` elements:

```
Page 1 of 5: [1] [2] [3] [4] [5] [→]
                        ↑
              penultimate = last page
```

### Fetching

All pages are fetched sequentially and entities combined:

```typescript
// First page
const html = await fetchListingPage(url);
const lastPage = detectLastPage(html);

// Remaining pages
for (let page = 2; page <= lastPage; page++) {
  const pageUrl = setPageParam(url, page);
  const pageHtml = await fetchListingPage(pageUrl);
  // ... parse and combine
}
```

## Entity Resolution

### Process

1. Parse entities from listing page
2. Apply URL aliases
3. Look up in `ctx.entityIndex` (built by resolver)
4. If found: include `fileId` and `anchor`
5. If not found: mark as unresolved

### Resolved Entity

```typescript
{
  name: "Fireball",
  url: "/spells/2618887-fireball",
  metadata: { level: "3rd", school: "evocation", ... },
  fileId: "fc17",
  anchor: "fireball",
  resolved: true
}
```

### Unresolved Entity

```typescript
{
  name: "Custom Spell",
  url: "/spells/12345-custom-spell",
  metadata: { ... },
  resolved: false
}
```

Unresolved entities are rendered with fallback formatting (bold by default).

## Statistics Tracking

The indexer tracks:

- `entityIndexes`: Number of entity index files created
- `fetchedEntities`: Entities fetched from D&D Beyond
- `cachedEntities`: Entities loaded from cache
- `resolvedLinks`: Entities successfully resolved to local files
- `unresolvedLinks`: Entities that couldn't be resolved

## Examples

### Basic Configuration

```json
{
  "indexes": {
    "generate": true,
    "global": {
      "enabled": true,
      "title": "D&D 5e Compendium"
    },
    "entities": [
      {
        "title": "Spells",
        "url": "https://www.dndbeyond.com/spells?filter-partnered-content=f",
        "description": "All spells from converted sourcebooks."
      }
    ]
  }
}
```

### Output: Spell Index

```markdown
# Spells

All spells from converted sourcebooks.

| Spell                              | Level   | School     | Casting Time |
| ---------------------------------- | ------- | ---------- | ------------ |
| [Acid Splash](fc17.md#acid-splash) | Cantrip | evocation  | 1 Action     |
| [Aid](fc17.md#aid)                 | 2nd     | abjuration | 1 Action     |
| [Alarm](fc17.md#alarm)             | 1st     | abjuration | 1 Minute     |

...
```

### Output: Global Index

```markdown
# D&D 5e Compendium

## Sourcebooks

- [Player's Handbook (2024)](ksmc.md)
- [Dungeon Master's Guide (2024)](e61i.md)
- [Monster Manual (2024)](8ipf.md)

## Entity Indexes

- [Spells](td9w.md)
- [Monsters](3vb7.md)
```

## Error Handling

### Graceful Degradation

- **Fetch error**: Track error, skip index, continue
- **Parse error**: Track error, skip index, continue
- **Write error**: Track error, continue
- **Missing entity**: Render as unresolved (fallback)

### Cache Corruption

If `indexes.json` fails validation, it's deleted and a fresh mapping is created.

## Testing

### Verified Scenarios

- Pagination detection and multi-page fetching
- All 8 entity type parsers
- Auto-filtering by sourceId
- Cache reuse across runs
- Template rendering with type conditionals
- Nested index structures
- Global index generation

### Performance

| Scenario                            | Time |
| ----------------------------------- | ---- |
| Fresh fetch (411 spells + monsters) | ~35s |
| Cached run                          | ~5s  |
