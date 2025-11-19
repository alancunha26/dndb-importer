# Entity Resolution Improvement

**Status:** Planned
**Created:** 2025-01-19

## Problem

Current entity extraction only finds entity URLs in headings:
```html
<h3><a href="/spells/2618887-fireball">Fireball</a></h3>
```

But not all entity types have links in headings. For example, **feats** are plain text:
```html
<h3 id="Alert">Alert</h3>
```

This means links to `/feats/123-alert` won't resolve because the entity isn't indexed.

## Proposed Solution: Slug-to-Anchor Matching

Instead of relying on entity links in headings (top-down), we match entity slugs to heading anchors (bottom-up).

### Strategy

1. **Extract all entity URLs from content** (not just headings)
   - Scan all `<a>` tags with entity URLs
   - Store unique entity URLs in `file.entities`

2. **Build entityIndex by matching slugs to anchors**
   - For each entity URL, extract the slug (e.g., `/feats/123-alert` → `alert`)
   - Search all file anchors for a matching heading
   - Use existing matching logic (plural/singular, prefix matching)
   - Index the match: `entityIndex[url] = [fileId]`

### Example Flow

```
Content has link: /feats/2041750-alert
         ↓ extract slug
Slug: "alert"
         ↓ search all file anchors
Found: file "xyz9" has anchor "alert" (from heading "Alert")
         ↓ index
entityIndex["/feats/2041750-alert"] = ["xyz9"]
```

### Why This Works

- **Entity URLs are reliable** - Always have a slug in kebab-case
- **Headings generate anchors** - "Alert" → `alert`, "Fireball" → `fireball`
- **Matching is proven** - Already have `findMatchingAnchor()` with plural/singular and prefix support

## Implementation Plan

### Phase 1: Update Entity Extraction in Processor

```typescript
// Extract entity URLs from ALL links, not just headings
content.find("a[href]").each((_i, link) => {
  const href = $(link).attr("href");
  if (href) {
    const parsed = parseEntityUrl(href);
    if (parsed && !entities.some(e => e.url === parsed.url)) {
      entities.push(parsed);
    }
  }
});
```

**Important:** Deduplicate entities by URL to avoid storing duplicates.

### Phase 2: Update Entity Indexing in Resolver

```typescript
// Build entity index by matching slugs to anchors
const entityIndex = new Map<string, string[]>();

for (const file of writtenFiles) {
  if (!file.entities) continue;

  for (const entity of file.entities) {
    if (!entity.slug) continue;

    // Don't re-index if already found
    if (entityIndex.has(entity.url)) continue;

    // Search all files for matching anchor
    for (const targetFile of writtenFiles) {
      if (!targetFile.anchors) continue;

      const matchedAnchor = findMatchingAnchor(
        entity.slug,
        targetFile.anchors.valid
      );

      if (matchedAnchor) {
        if (!entityIndex.has(entity.url)) {
          entityIndex.set(entity.url, []);
        }
        entityIndex.get(entity.url)!.push(targetFile.uniqueId);
        break; // Found it, stop searching
      }
    }
  }
}
```

### Phase 3: Use Matched Anchor for Resolution

When resolving, use the matched anchor from `findMatchingAnchor()` instead of the entity slug directly, since they might differ (e.g., prefix matches like `alchemists-fire` → `alchemists-fire-50-gp`).

## Considerations

### Deduplication

Entity URLs can appear multiple times across files. Store unique entities only:
- By URL in `file.entities`
- First match wins in `entityIndex`

### Multiple Matches

An entity slug might match anchors in multiple files (e.g., same spell in PHB and another book). Options:
- First match wins (current approach)
- Prefer same sourcebook
- Store all matches and pick during resolution

### Performance

Searching all file anchors for each entity is O(entities × files × anchors). For 59 files this is negligible, but could optimize with an anchor index if needed.

## Expected Impact

- Should resolve many of the 595 "entity-not-found" issues
- Feats will now be indexable
- Any entity type will work regardless of heading structure

## Files to Modify

- `src/modules/processor.ts` - Extract entities from all links
- `src/modules/resolver.ts` - Match slugs to anchors when building index
- `src/utils/entity.ts` - May need utility updates

## Testing

1. Run conversion and compare entity-not-found count
2. Verify feats are now resolvable
3. Check for false positives (wrong matches)
4. Baseline should improve significantly
