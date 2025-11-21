# Link Resolver Documentation

**Module:** `src/modules/resolver.ts`
**Status:** Implemented and tested

## Overview

The Resolver module transforms D&D Beyond links into local markdown links, enabling seamless cross-referencing between converted sourcebooks. It runs after all files are written to disk, reading each file, resolving links, and overwriting with the resolved content.

## Processing Flow

```
1. Processor completes → All files written to disk with:
   - FileAnchors (valid anchors + HTML ID mappings)
   - Entity URLs extracted from tooltip links

2. Resolver runs:
   a. Build entity index (entity URL → file location)
   b. Build URL map (canonical URL → file)
   c. For each file:
      - Read markdown from disk
      - Resolve D&D Beyond links
      - Write resolved content back
```

## Link Resolution Priority

The resolver uses a **waterfall resolution strategy**, trying each method in order:

### 1. Skip Non-Resolvable Links

Before processing, the resolver checks if a link should be resolved:

```typescript
// Resolve these:
#anchor                              // Internal anchors
/sources/dnd/phb-2024/spells         // Source book paths
/spells/2618831-arcane-vigor         // Entity links
https://www.dndbeyond.com/...        // Full URLs

// Skip these (keep as-is):
abc123.md                            // Local markdown files
https://example.com                  // Non-D&D Beyond URLs
```

### 2. Internal Anchor Resolution

**Same-page links** (e.g., `#ArcaneVigor`)

- Uses `htmlIdToAnchor` mapping from FileAnchors
- Converts HTML IDs to GitHub-style markdown anchors

**Example:**

```
[Bell](#Bell1GP)  →  [Bell](#bell-1-gp)
```

### 3. Excluded URL Check

**URLs in `excludeUrls` config**

- Checked before attempting entity/source resolution
- Immediately converted to fallback text
- Used for legacy content that conflicts with current content

**Example:**

```
Input:  [Bugbear](/monsters/16817-bugbear)   // Legacy 2014 stat block
Output: **Bugbear**                          // Converted to fallback (bold)
```

### 4. Entity Link Resolution

**Entity paths** (e.g., `/spells/123-name`, `/monsters/456-name`)

- Looks up entity URL in entity index
- Entity index built by matching slugs to file anchors
- Uses `entityLocations` config to filter target files by type

**Example:**

```
Input:  [Arcane Vigor](/spells/2618831-arcane-vigor)
Entity: /spells/2618831-arcane-vigor → {fileId: "v3k8", anchor: "arcane-vigor"}
Output: [Arcane Vigor](v3k8.md#arcane-vigor)
```

### 5. Source Link Resolution

**Source paths** (e.g., `/sources/dnd/phb-2024/spells#fireball`)

- Applies URL aliases from config
- Looks up file by canonical URL
- Validates anchor exists with smart matching

**Example:**

```
Input:  [Fireball](/sources/dnd/phb-2024/spell-descriptions#fireball)
Lookup: URL map finds file "v3k8"
Anchor: "fireball" found in v3k8 valid anchors
Output: [Fireball](v3k8.md#fireball)
```

### 6. Fallback Strategy

When resolution fails, the link is formatted based on `fallbackStyle`:

- `"bold"` → `**Text**` (default)
- `"italic"` → `_Text_`
- `"plain"` → `Text`
- `"none"` → Keep original link `[Text](url)`

## Entity Index System

### How It Works

1. **Processor extracts entity URLs** from HTML tooltip links:

   ```html
   <a class="tooltip-hover spell-tooltip" href="/spells/2618831-arcane-vigor">
     Arcane Vigor
   </a>
   ```

2. **Resolver builds entity index** by matching slugs to file anchors:

   ```typescript
   // Entity URL: /spells/2618831-arcane-vigor
   // Slug: "arcane-vigor"
   // Search file anchors for matching anchor
   ```

3. **entityLocations filters target files**:
   ```json
   {
     "spells": ["/sources/dnd/phb-2024/spell-descriptions"],
     "monsters": ["/sources/dnd/mm-2024/monsters-a", ...]
   }
   ```

### Why Entity Locations?

Without entity locations, a spell like "Fireball" might resolve to a monster page that mentions "Fireball" in its stat block. Entity locations ensure:

- Spells resolve to spell description pages
- Monsters resolve to monster manual pages
- Magic items resolve to DMG magic items pages

### Supported Entity Types

- `spells`
- `monsters`
- `magic-items`
- `equipment`
- `classes`
- `feats`
- `species`
- `backgrounds`

## URL Aliasing

### Purpose

D&D Beyond has multiple URLs for the same content. URL aliases normalize these to canonical forms.

### Use Cases

**Source aliasing** (Free Rules → PHB):

```json
"/sources/dnd/free-rules/equipment": "/sources/dnd/phb-2024/equipment"
```

**Entity aliasing** (variant items → base items):

```json
"/magic-items/4585-belt-of-hill-giant-strength": "/magic-items/5372-belt-of-giant-strength"
```

**Equipment table aliasing** (items without individual anchors → table anchors):

```json
"/equipment/469-wagon": "/sources/dnd/phb-2024/equipment#tack-harness-and-drawn-vehicles"
```

### How It Works

1. Link URL is normalized (strip domain, lowercase)
2. URL is split into path and anchor
3. URL aliases are applied to the **path only**
4. If aliased value contains an anchor, it's extracted
5. Entity index uses aliased URLs for matching

**Important**: Anchors only work in VALUES (right side), not KEYS (left side):

```json
// ✓ Correct - anchor in value
"/equipment/469-wagon": "/sources/dnd/phb-2024/equipment#tack-harness-and-drawn-vehicles"

// ✗ Wrong - anchor in key won't match (path is looked up without anchor)
"/sources/phb/equipment#MountsandOtherAnimals": "/sources/dnd/phb-2024/equipment#mounts-and-other-animals"

// ✓ Correct - alias path only, let anchor matching handle the rest
"/sources/phb/equipment": "/sources/dnd/phb-2024/equipment"
```

## Smart Anchor Matching

### Quality-Based Matching

The resolver uses a **12-step priority system with quality scores** (lower is better). When searching across multiple files (e.g., for entity resolution), the best quality match wins regardless of file order. Can be limited via `links.maxMatchStep` config option.

### Strategies

**With hyphens (preserving word boundaries):**

1. **Exact match**
   ```
   Anchor: "fireball"
   Valid: ["fireball", ...]
   Match: "fireball" (step 1)
   ```

2. **Exact plural match** (strips trailing 's')
   ```
   Anchor: "bugbear"
   Valid: ["bugbears", "bugbear-stalker", ...]
   Match: "bugbears" (step 2)
   ```

3. **Word-by-word prefix match** (words must match at positions)
   ```
   Anchor: "arcane-focus"
   Valid: ["arcane-focus-varies", "arcane-focuses", ...]
   Match: "arcane-focus-varies" (step 3, NOT "arcane-focuses")
   ```

4. **Plural word prefix match** (strips 's' from each word)
   ```
   Anchor: "potion-of-healing"
   Valid: ["potions-of-healing", ...]
   Match: "potions-of-healing" (step 4)
   ```

**Without hyphens (for special characters like `/` → removed):**

5. **Exact match (no hyphens)**
   ```
   Anchor: "blindness-deafness"
   Valid: ["blindnessdeafness", ...]
   Match: "blindnessdeafness" (step 5)
   ```

6. **Exact plural (no hyphens)**
   ```
   Anchor: "blindness-deafness"
   Valid: ["blindnessdeafnesss", ...]  # hypothetical
   Match: "blindnessdeafnesss" (step 6)
   ```

7. **Prefix match (no hyphens)**
   ```
   Anchor: "blindness-deafness"
   Valid: ["blindnessdeafnessvaries", ...]
   Match: "blindnessdeafnessvaries" (step 7)
   ```

8. **Prefix plural (no hyphens)**
   ```
   Anchor: "blindness-deafness"
   Valid: ["blindnessdeafnesssvaries", ...]  # hypothetical
   Match: "blindnessdeafnesssvaries" (step 8)
   ```

**Reverse matching (anchor contained in search - for variant items):**

9. **Reverse prefix match** (search starts with anchor)
   ```
   Anchor: "flame-tongue-club"
   Valid: ["flame-tongue", ...]
   Match: "flame-tongue" (step 9)
   ```

10. **Word subset match** (anchor words are ordered subset of search words)
    ```
    Anchor: "belt-of-hill-giant-strength"
    Valid: ["belt-of-giant-strength", ...]
    Match: "belt-of-giant-strength" (step 10)
    ```

11. **Word subset match with plurals** (plural-aware word subset)
    ```
    Anchor: "potion-of-healing-greater"
    Valid: ["potions-of-healing", ...]
    Match: "potions-of-healing" (step 11)
    ```

**Fallback:**

12. **Unordered word match** (requires 2+ words)
    ```
    Anchor: "travelers-clothes"
    Valid: ["clothes-travelers-2-gp", ...]
    Match: "clothes-travelers-2-gp" (step 12)
    ```

13. **No match** → Apply fallback style

### Tie-Breaking

When multiple anchors match at the same quality level:
- **Forward matching (steps 1-8, 12)**: Shortest match wins (by normalized length)
- **Reverse matching (steps 9-11)**: Longest match wins (most specific anchor)
- **First match wins** when lengths are equal (preserves document order)

## Anchor Building (Processor Stage)

During HTML processing, the processor builds `FileAnchors` for each file:

### FileAnchors Structure

```typescript
interface FileAnchors {
  valid: string[]; // All markdown anchors
  htmlIdToAnchor: Record<string, string>; // HTML ID → markdown anchor
}
```

### Anchor Generation

1. **Extract heading text** from HTML
2. **Generate GitHub-style anchor** (lowercase, hyphens)
3. **Handle duplicate anchors** - Uses `--N` suffix internally to avoid conflicts with entity URL slugs (e.g., `ammunition-1` magic item vs `ammunition--1` duplicate heading). Output converts to standard `-N` format.
4. **Map HTML IDs** to markdown anchors

**Why `--N` internally?**

Entity URL slugs from D&D Beyond use patterns like `ammunition-1` (for "Ammunition, +1"). If we used GitHub's standard `-1` suffix for duplicates, a link to the magic item could incorrectly resolve to a duplicate heading. The `--N` pattern ensures clean separation during matching.

**Example (single heading):**

```html
<h2 id="Bell1GP">Bell (1 GP)</h2>
```

Results in:

```typescript
{
  valid: ["bell-1-gp"],
  htmlIdToAnchor: { "Bell1GP": "bell-1-gp" }
}
```

**Example (duplicate headings):**

```html
<h3 id="Level4AbilityScoreImprovement">Ability Score Improvement</h3>
<!-- ... other content ... -->
<h3 id="Level8AbilityScoreImprovement">Ability Score Improvement</h3>
<!-- ... other content ... -->
<h3 id="Level12AbilityScoreImprovement">Ability Score Improvement</h3>
```

Stored internally (with `--N`):

```typescript
{
  valid: ["ability-score-improvement", "ability-score-improvement--1", "ability-score-improvement--2"],
  htmlIdToAnchor: {
    "Level4AbilityScoreImprovement": "ability-score-improvement",
    "Level8AbilityScoreImprovement": "ability-score-improvement--1",
    "Level12AbilityScoreImprovement": "ability-score-improvement--2"
  }
}
```

Output in markdown (converted to `-N`):

```markdown
[Ability Score Improvement](#ability-score-improvement)
[Ability Score Improvement](#ability-score-improvement-1)
[Ability Score Improvement](#ability-score-improvement-2)
```

## Special Cases

### Book-Level Links

Links to sourcebooks without anchors resolve to index files:

```
Input:  [Player's Handbook](/sources/dnd/phb-2024)
Output: [Player's Handbook](ksmc.md)
```

The resolver searches `ctx.sourcebooks` for matching `bookUrl`.

### Header Links (No Anchor)

Links to pages without anchors fall back based on style:

```
Input:  [Equipment](/sources/dnd/phb-2024/equipment)
Output: **Equipment**  (with fallbackStyle: "bold")
```

### Image Lines

Lines starting with `!` (images) are skipped entirely:

```
![Image](image.png)  // Never processed
```

### Local Links

Already-resolved local links are skipped:

```
[Previous](abc123.md)  // Keep as-is
```

## Configuration

### links.resolveInternal

- `true` (default): Run resolver module
- `false`: Skip resolver entirely

### links.fallbackStyle

Controls formatting of unresolved links:

- `"bold"` → `**Text**`
- `"italic"` → `_Text_`
- `"plain"` → `Text`
- `"none"` → Keep original link

### links.maxMatchStep

Limits anchor matching algorithm aggressiveness (1-12):

- Lower values = stricter matching (less false positives)
- Higher values = more lenient matching (better coverage)
- Default: all 12 steps enabled

```json
{
  "links": {
    "maxMatchStep": 8
  }
}
```

This would stop matching before the reverse matching steps (9-11), useful if those are producing false positives for variant items.

### links.urlAliases

Maps URLs to canonical forms:

```json
{
  "/sources/dnd/free-rules/foo": "/sources/dnd/phb-2024/foo",
  "/magic-items/old-id": "/magic-items/new-id"
}
```

### links.entityLocations

Maps entity types to allowed source pages:

```json
{
  "spells": ["/sources/dnd/phb-2024/spell-descriptions"],
  "monsters": [
    "/sources/dnd/mm-2024/monsters-a",
    "/sources/dnd/mm-2024/monsters-b"
  ]
}
```

### links.excludeUrls

Array of URLs to exclude from resolution. URLs in this list are immediately converted to fallback text (based on `fallbackStyle`) without attempting resolution. Useful for legacy content that conflicts with current content:

```json
[
  "/monsters/16817-bugbear",
  "/monsters/16904-gnoll",
  "/monsters/16907-goblin"
]
```

The default config includes all 59 legacy 2014 monster stat blocks from the Monster Manual's Stat Block Conversions table, preventing them from conflicting with 2024 monsters.

## Error Handling

### Link Tracking

Link resolution is tracked with simplified resolved/unresolved counts via `ctx.tracker`:

- `incrementLinksResolved()`: Called for each successfully resolved link
- `trackUnresolvedLink(path, text)`: Called for links that couldn't be resolved (deduplicated by path)

The `stats.json` output includes:
- `resolvedLinks`: Total count of resolved links
- `unresolvedLinks`: Total count of unresolved link occurrences (sum of all counts)
- `unresolvedLinks[]`: Array of unique unresolved links with:
  - `path`: The URL path that couldn't be resolved
  - `text`: The link text
  - `count`: Number of occurrences (for deduplication)

Example:
```json
{
  "unresolvedLinks": [
    { "path": "/sources/dnd/fraif", "text": "Forgotten Realms", "count": 8 },
    { "path": "/sources/dnd/phb-2014", "text": "2014 version", "count": 2 }
  ]
}
```

### Graceful Degradation

- **File read error**: Skip file, track error, continue
- **Invalid link**: Apply fallback style, track as unresolved
- **Missing entity**: Apply fallback style, track as unresolved
- **Missing anchor**: Apply fallback style, track as unresolved

## Examples

### Internal Anchor

```markdown
[Bell](#Bell1GP) → [Bell](#bell-1-gp)
```

### Entity Link

```markdown
[Fireball](https://www.dndbeyond.com/spells/2618887-fireball)
→ [Fireball](a3f9.md#fireball)
```

### Source Link with Anchor

```markdown
[Adventuring Gear](/sources/dnd/phb-2024/equipment#adventuring-gear)
→ [Adventuring Gear](b4x8.md#adventuring-gear)
```

### Plural/Singular Matching

```markdown
[Fireballs](/sources/.../spells#fireballs)
→ [Fireballs](a3f9.md#fireball)
```

### Prefix Matching

```markdown
[Alchemist's Fire](/.../equipment#alchemists-fire)
→ [Alchemist's Fire](b4x8.md#alchemists-fire-50-gp)
```

### Reverse Prefix Matching (Variant Items)

```markdown
[Flame Tongue Club](/magic-items/9228625-flame-tongue-club)
→ [Flame Tongue Club](dmg.md#flame-tongue)
```

### Word Subset Matching (Variant Items)

```markdown
[Belt of Hill Giant Strength](/magic-items/4585-belt-of-hill-giant-strength)
→ [Belt of Hill Giant Strength](dmg.md#belt-of-giant-strength)
```

### Unordered Word Matching

```markdown
[Traveler's Clothes](/.../equipment#travelers-clothes)
→ [Traveler's Clothes](b4x8.md#clothes-travelers-2-gp)
```

### Book-Level Link

```markdown
[Player's Handbook](/sources/dnd/phb-2024)
→ [Player's Handbook](ksmc.md)
```

### Header Link (No Anchor)

```markdown
[Equipment](/sources/.../equipment)
→ **Equipment**
```

## Testing

### Verified Scenarios

- Navigation links preserved
- Images preserved
- D&D Beyond links resolved
- Entity tooltips fall back correctly
- Plural/singular matching works
- Prefix matching works (word-by-word)
- Unordered word matching works
- Book-level links resolve to index
- Header links fall back correctly

### Edge Cases Handled

- Multiple entities with same anchor
- Full URLs vs relative paths
- Aliased URLs with anchors in values
- Missing target files
- Missing anchors
- Single-word searches avoid false positives (cart ≠ cartographers-tools)
- Reversed word order matching (travelers-clothes → clothes-travelers)
- Variant items with specific names (flame-tongue-club → flame-tongue)
- Variant items with subset words (belt-of-hill-giant-strength → belt-of-giant-strength)
- Plural mismatches in subsets (potion-of-healing-greater → potions-of-healing)
