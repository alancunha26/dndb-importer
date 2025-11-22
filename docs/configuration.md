# Configuration Guide

The converter uses a layered configuration system that deep-merges settings from multiple sources.

## Configuration Priority

1. **Default config** - Built-in defaults from `src/config/default.json`
2. **User config** - OS-specific user configuration (optional)
3. **Custom config** - CLI `--config` flag (highest priority)

## User Config Location

| OS      | Path                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------ |
| Linux   | `$XDG_CONFIG_HOME/dndb-importer/config.json` (defaults to `~/.config/dndb-importer/config.json`) |
| macOS   | `~/Library/Preferences/dndb-importer/config.json`                                                |
| Windows | `%APPDATA%\dndb-importer\config.json`                                                            |

Run `dndb-convert config` to see your config location.

## Complete Configuration Reference

````jsonc
{
  // === Input/Output Directories ===
  "input": "./input", // Source HTML files directory
  "output": "./output", // Output markdown files directory

  // === Unique ID Settings ===
  "ids": {
    "length": 4, // Length of generated IDs (e.g., "a3f9")
    "characters": "abcdefghijklmnopqrstuvwxyz0123456789",
  },

  // === Markdown Formatting ===
  "markdown": {
    "headingStyle": "atx", // "atx" (# Heading) or "setext" (underlined)
    "codeBlockStyle": "fenced", // "fenced" (```) or "indented" (4 spaces)
    "emphasis": "_", // "_" or "*" for italic text
    "strong": "**", // "**" or "__" for bold text
    "bulletMarker": "-", // "-", "+", or "*" for unordered lists
    "linkStyle": "inlined", // "inlined" [text](url) or "referenced" [text][ref]
    "linkReferenceStyle": "full", // "full", "collapsed", or "shortcut"
    "horizontalRule": "---", // Any string (e.g., "---", "* * *", "___")
    "lineBreak": "  ", // Two spaces for soft line breaks
    "codeFence": "```", // "```" or "~~~" for fenced code blocks
    "preformattedCode": false, // Preserve preformatted code blocks
  },

  // === HTML Parsing ===
  "html": {
    "contentSelector": ".p-article-content", // CSS selector for main content
    "removeSelectors": [], // CSS selectors for elements to remove
  },

  // === Image Download Settings ===
  "images": {
    "download": true, // Enable/disable image downloading
    "formats": ["png", "jpg", "jpeg", "webp", "gif"],
    "maxSize": 10485760, // Maximum size in bytes (10MB)
    "timeout": 30000, // Timeout in milliseconds (30s)
    "retries": 3, // Number of retry attempts
  },

  // === Link Resolution ===
  "links": {
    "resolveInternal": true, // Enable/disable link resolution
    "fallbackStyle": "bold", // "bold", "italic", "plain", or "none"
    "maxMatchStep": 12, // Anchor matching aggressiveness (1-12)
    "urlAliases": {}, // URL mappings (see below)
    "excludeUrls": [], // URLs to skip (see below)
    "entityLocations": {}, // Entity type → allowed pages (see below)
  },

  // === Entity Indexes ===
  "indexes": {
    "generate": true, // Enable/disable index generation
    "global": {
      "enabled": true, // Generate global index
      "title": "Global Index", // Global index title
    },
    "entities": [], // Entity index configurations (see below)
  },
}
````

## Hardcoded Values

These settings are not configurable:

- File pattern: `**/*.html`
- File encoding: `utf-8`
- Output extension: `.md`
- Index creation: always enabled

## Link Resolution Options

### URL Aliases

Map D&D Beyond URLs to canonical forms before resolution:

```json
{
  "links": {
    "urlAliases": {
      // Source aliasing (Free Rules → PHB)
      "/sources/dnd/free-rules/equipment": "/sources/dnd/phb-2024/equipment",

      // Entity aliasing (variant items → base items)
      "/magic-items/4585-belt-of-hill-giant-strength": "/magic-items/5372-belt-of-giant-strength",

      // Equipment table aliasing
      "/equipment/469-wagon": "/sources/dnd/phb-2024/equipment#tack-harness-and-drawn-vehicles"
    }
  }
}
```

**Note:** Anchors only work in values (right side), not keys (left side).

### Exclude URLs

Skip specific URLs and convert them to fallback text:

```json
{
  "links": {
    "excludeUrls": [
      "/monsters/16817-bugbear", // Legacy 2014 stat blocks
      "/monsters/16904-gnoll"
    ]
  }
}
```

### Entity Locations

Map entity types to allowed source pages to prevent incorrect resolutions:

```json
{
  "links": {
    "entityLocations": {
      "spells": ["/sources/dnd/phb-2024/spell-descriptions"],
      "monsters": [
        "/sources/dnd/mm-2024/monsters-a",
        "/sources/dnd/mm-2024/monsters-b"
      ],
      "magic-items": ["/sources/dnd/dmg-2024/magic-items"]
    }
  }
}
```

This prevents spells from resolving to monster pages that happen to have matching anchors.

### Fallback Styles

Control how unresolved links are displayed:

- `"bold"` - Convert to `**Text**` (default)
- `"italic"` - Convert to `_Text_`
- `"plain"` - Convert to plain text
- `"none"` - Keep original link unchanged

### Max Match Step

The `maxMatchStep` option (1-12) limits anchor matching aggressiveness:

- Lower values = stricter matching (fewer false positives)
- Higher values = more lenient matching (better coverage)
- Default: 12 (all matching steps enabled)

See [resolver.md](resolver.md) for the complete matching algorithm.

## Entity Matching

Entity link resolution uses smart anchor matching with:

- Plural/singular handling (`bugbear` → `bugbears`)
- Prefix matching (`arcane-focus` → `arcane-focus-varies`)
- Word boundary matching (`belt-of-hill-giant-strength` → `belt-of-giant-strength`)

This is best-effort - some edge cases may resolve incorrectly. Fix specific issues with `urlAliases`:

```json
{
  "links": {
    "urlAliases": {
      "/equipment/544-arcane-focus": "/sources/dnd/phb-2024/equipment#arcane-focus-varies"
    }
  }
}
```

## Entity Indexes

Generate navigable indexes of D&D entities (spells, monsters, items, etc.) by fetching listing pages from D&D Beyond.

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
        "title": "All Spells",
        "url": "https://www.dndbeyond.com/spells?filter-partnered-content=f",
        "description": "Complete spell list from converted sourcebooks."
      },
      {
        "title": "All Monsters",
        "url": "https://www.dndbeyond.com/monsters?filter-partnered-content=f"
      }
    ]
  }
}
```

Entity indexes support nested structures with `children`, and can be customized with Handlebars templates.

See [indexer.md](indexer.md) for complete documentation including supported entity types, auto-filtering, caching, and templates.

## Markdown Formatting

All markdown settings apply throughout conversion:

- **Templates** - Index and file frontmatter
- **Content** - All HTML-to-markdown conversion
- **Custom rules** - Figure captions, columns, headings

## 2024 Rulebook Defaults

The default configuration is optimized for D&D 2024 rulebooks (PHB 2024, DMG 2024, MM 2025) with:

- Free Rules aliased to PHB 2024
- Legacy 2014 monster stat blocks excluded
- Entity locations mapped to 2024 source pages

For older sourcebooks (pre-2024), adjust these settings in your config.

## Example Custom Config

```json
{
  "markdown": {
    "bulletMarker": "*",
    "emphasis": "*"
  },
  "images": {
    "download": false
  },
  "links": {
    "fallbackStyle": "italic",
    "urlAliases": {
      "/sources/dnd/custom-book/intro": "/sources/dnd/phb-2024/introduction"
    }
  }
}
```

This config:

- Uses `*` for bullets and emphasis
- Disables image downloading
- Sets unresolved links to italic
- Adds a custom URL alias
