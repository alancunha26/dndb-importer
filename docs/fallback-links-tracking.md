# Fallback Links Tracking

**Status:** Initial Analysis (2025-11-18)
**Total Fallback Links:** 9,403
**Conversion Run:** PHB 2024, DMG 2024, MM 2024

This document tracks unresolved links that fall back to bold text during conversion. Each issue includes analysis, potential solutions, and implementation status.

---

## Executive Summary

| Category                 | Count  | % of Total | Priority | Status                 |
| ------------------------ | ------ | ---------- | -------- | ---------------------- |
| Free Rules References    | ~5,800 | 62%        | High     | ✅ Resolved            |
| Anchor Mismatches        | ~7,000 | 75%        | High     | ✅ Resolved            |
| Equipment Entity Links   | ~1,000 | 59%        | Medium   | 🔴 Not Started         |
| Missing Entity Types     | TBD    | TBD        | High     | 🔴 Not Started         |
| Header Links (No Anchor) | ~250   | 3%         | Low      | ✅ Working as Designed |
| Missing URL Mappings     | ~250   | 3%         | Medium   | 🔴 Not Started         |
| External Book References | ~600   | 6%         | Low      | 🔴 Not Started         |

---

## Issue 1: Free Rules References

**Count:** ~5,800 links (62% of all fallbacks)

**Top Examples:**

- `/sources/dnd/free-rules/rules-glossary`: 4,724 links
- `/sources/dnd/free-rules/playing-the-game`: 1,077 links
- `/sources/dnd/free-rules/equipment`: 41 links

**Root Cause:**
PHB, DMG, and MM extensively reference D&D Beyond's free rules pages for common game mechanics (conditions, actions, equipment, etc.). These are external reference materials not included in our input directory.

**Impact:**
Major - affects most files, especially rules-heavy content.

**Potential Solutions:**

### Option A: Download Free Rules Pages (Recommended)

- **Pros:** Resolves 62% of all fallbacks, provides complete reference material
- **Cons:** Requires downloading additional HTML files from D&D Beyond
- **Implementation:**
  1. Download free-rules pages from D&D Beyond
  2. Add to `examples/input/free-rules/` directory
  3. Auto-discovery will handle URL mapping
  4. No code changes required

### Option B: Map to Equivalent Chapters

- **Pros:** No additional downloads needed
- **Cons:** May not have exact equivalents for all free-rules content
- **Implementation:**
  1. Add manual URL aliases in `default.json`:
     ```json
     "urlAliases": {
       "/sources/dnd/free-rules/rules-glossary": "/sources/dnd/phb-2024/rules-glossary",
       "/sources/dnd/free-rules/playing-the-game": "/sources/dnd/phb-2024/playing-the-game"
     }
     ```

### Option C: Accept as External References

- **Pros:** No changes needed
- **Cons:** Leaves 62% of fallbacks unresolved
- **Decision:** Only use if free-rules content is unavailable

**Status:** ✅ **RESOLVED** (2025-11-18)
**Solution:** Option B - URL Aliasing to Canonical URLs
**Implementation:** See Change Log below

---

## Issue 2: Anchor Mismatches

**Count:** ~1,500 links (16% of all fallbacks)

**Top Examples:**

- `#ArmamentsTables` in file `ilvm`: 42 links
- `#ArcanaTables` in file `ilvm`: 30 links
- `#IndividualTreasure` in file `lzwj`: 28 links
- `#RelicsTables` in file `ilvm`: 28 links
- `#UnderdarkThe` in file `cvgs`: 15 links
- `#EpicBoonFeats` in file `9r3h`: 13 links

**Root Cause:**
D&D Beyond HTML uses custom anchor IDs that don't match GitHub-style markdown anchors:

- HTML: `<h2 id="ArmamentsTables">Armaments Tables</h2>`
- D&D Beyond link: `#ArmamentsTables` (PascalCase)
- Our markdown anchor: `#armaments-tables` (lowercase-with-hyphens)

**Impact:**
Moderate - affects cross-references to tables and specific sections.

**Potential Solutions:**

### Option A: Enhance HTML ID Extraction (Recommended)

- **Pros:** Correctly maps all HTML IDs to markdown anchors
- **Cons:** Requires processor changes
- **Implementation:**
  1. Modify `src/modules/processor.ts` to extract `id` attribute from ALL headings
  2. Store in `FileAnchors.htmlIdToAnchor` mapping
  3. Resolver already uses this mapping for resolution
  4. Example:
     ```typescript
     const htmlId = $heading.attr("id");
     if (htmlId) {
       htmlIdToAnchor[htmlId] = markdownAnchor;
     }
     ```

### Option B: Case-Insensitive Anchor Matching

- **Pros:** Simple fallback mechanism
- **Cons:** May cause false matches
- **Implementation:**
  1. Add case-insensitive matching to `findMatchingAnchor()`
  2. Use as last resort after exact and prefix matching

### Option C: Custom Anchor Extraction Rules

- **Pros:** Can handle special D&D Beyond patterns
- **Cons:** Maintenance overhead
- **Implementation:**
  1. Add D&D Beyond-specific anchor generation
  2. Preserve original HTML IDs in mapping

**Status:** ✅ **RESOLVED** (2025-11-18)
**Solution:** Option A - Enhanced HTML ID Extraction (already implemented, just needed to use it!)
**Implementation:** See Change Log below

---

## Issue 3: Equipment Entity Links

**Count:** ~1,000 links (11% of all fallbacks)

**Top Examples:**

- `/equipment/514-holy-symbol`: 15 links
- `/equipment/3-dagger`: 13 links
- `/equipment/544-arcane-focus`: 13 links
- `/equipment/37-longbow`: 12 links
- `/equipment/541-travelers-clothes`: 12 links
- `/equipment/393-oil`: 12 links

**Root Cause:**
Equipment items are referenced as entity links (similar to spells/monsters) but:

1. Equipment pages may not exist as standalone HTML files
2. Equipment may only exist as tables in the Equipment chapter
3. Entity extraction currently only looks for spell/monster tooltips

**Impact:**
Moderate - affects character equipment references throughout all books.

**Potential Solutions:**

### Option A: Extract Equipment Entities from Tables

- **Pros:** No additional HTML files needed
- **Cons:** Complex implementation, may not have individual anchors
- **Implementation:**
  1. Modify processor to detect equipment items in Equipment chapter tables
  2. Extract item names and generate anchors
  3. Add to entity index with proper anchors
  4. Works if equipment tables have predictable structure

### Option B: Download Equipment Pages

- **Pros:** Standard entity resolution, consistent with spells/monsters
- **Cons:** Requires additional downloads, may not exist
- **Implementation:**
  1. Check if D&D Beyond has standalone equipment pages
  2. Download if available
  3. Auto-discovery handles the rest

### Option C: Map All Equipment to Equipment Chapter

- **Pros:** Simple fallback
- **Cons:** Links to chapter, not specific items (becomes bold text)
- **Implementation:**
  1. Add regex pattern to match `/equipment/*` URLs
  2. Map to Equipment chapter with generic anchor
  3. Better than nothing, but not ideal

### Option D: Expand Entity Detection

- **Pros:** Catches more entity types
- **Cons:** Requires understanding D&D Beyond's tooltip patterns
- **Implementation:**
  1. Add `.equipment-tooltip` to entity detection in processor
  2. Extract equipment URLs from headings
  3. Same pattern as spells/monsters

**Status:** 🔴 Not Started
**Assigned:** TBD
**Target:** TBD

**Investigation Notes:**

- Check if equipment chapter has individual item anchors
- Verify if D&D Beyond provides equipment entity pages
- Review HTML for equipment tooltip classes

---

## Issue 4: Header Links (No Anchor)

**Count:** ~250 links (3% of all fallbacks)

**Top Examples:**

- `/sources/dnd/dmg-2024/dms-toolbox`: 47 links
- `/sources/dnd/dmg-2024/creating-adventures`: 22 links
- `/sources/dnd/dmg-2024/running-the-game`: 21 links
- `/sources/dnd/dmg-2024/treasure`: 17 links
- `/sources/dnd/dmg-2024/the-basics`: 14 links

**Root Cause:**
Links point to chapter/section URLs without specific anchors (e.g., `[DM's Toolbox](/sources/dnd/dmg-2024/dms-toolbox)`). These are generic references to entire chapters.

**Current Behavior:**
Correctly converted to bold text as designed (see `resolver.ts:371-380`).

**Impact:**
Low - working as intended. Bold text is appropriate for general chapter references.

**Decision:**
✅ **No action required** - this is the expected behavior per RFC 0001.

**Rationale:**

- Header links without anchors are vague references
- Converting to bold text maintains emphasis without broken links
- User can manually add specific anchors if needed

**Status:** ✅ Working as Designed
**Assigned:** N/A
**Target:** N/A

---

## Issue 5: Missing URL Mappings

**Count:** ~250 links (3% of all fallbacks)

**Top Examples:**

- `/sources/dnd/phb-2024`: 88 links (book-level, no chapter)
- `/sources/dnd/mm-2024`: 43 links
- `/sources/dnd/phb-2024/character-classes-continued/`: 24 links (trailing slash)
- `/sources/dnd/dmg-2024`: 20 links
- `/sources/dnd/phb-2024/spells/`: 13 links (trailing slash)

**Root Cause:**
Two distinct issues:

1. **Book-level URLs**: Links to books without specific chapters (e.g., `/sources/dnd/phb-2024`)
2. **Trailing Slashes**: URLs with trailing slashes don't match canonical URLs

**Impact:**
Low to Medium - mostly affects navigation and cross-book references.

**Potential Solutions:**

### For Book-Level URLs:

- **Option A:** Map to index file for that sourcebook
- **Option B:** Convert to bold text (current behavior)
- **Recommendation:** Option B - book-level references are too vague

### For Trailing Slashes:

- **Option A:** Normalize URLs in resolver (strip trailing slashes)
  ```typescript
  // In resolveLink(), before splitting anchor:
  url = url.replace(/\/$/, ""); // Remove trailing slash
  ```
- **Option B:** Normalize during canonical URL extraction
- **Recommendation:** Option A - handle in resolver for consistency

**Status:** 🔴 Not Started
**Assigned:** TBD
**Target:** TBD

---

## Issue 6: External Book References

**Count:** ~600 links (6% of all fallbacks)

**Top Examples:**

- `/sources/dnd/qftis`: 4 links (Quests from the Infinite Staircase)
- `/sources/dnd/cos`: 3 links (Curse of Strahd)
- `/sources/dnd/twbtw`: 2 links (The Wild Beyond the Witchlight)
- `/sources/dnd/tftyp`: 2 links (Tales from the Yawning Portal)
- `/sources/dnd/paitm`: 2 links (Phandelver and Below: The Shattered Obelisk)
- `/sources/dnd/phb-2014`: 2 links
- `/sources/dnd/dmg-2014`: 2 links
- `/sources/dnd/mm-2014`: 3 links

**Root Cause:**
References to D&D Beyond books not in our input directory (adventures, older editions, supplements).

**Impact:**
Low - relatively few links, unavoidable without downloading all D&D content.

**Potential Solutions:**

### Option A: Accept as External References (Recommended)

- **Pros:** No changes needed, these are genuinely external
- **Cons:** Links remain as bold text
- **Decision:** This is the correct behavior for content we don't have

### Option B: Download Referenced Books

- **Pros:** Complete reference resolution
- **Cons:** Requires purchasing/downloading many additional books
- **Decision:** Out of scope for MVP

### Option C: Add External Link Support

- **Pros:** Could link to D&D Beyond directly
- **Cons:** Requires online access, breaks local-only workflow
- **Implementation:**
  1. Add config option `links.preserveExternal`
  2. Keep external book links as D&D Beyond URLs
  3. Don't convert to bold text

**Status:** 🔴 Not Started
**Assigned:** TBD
**Target:** TBD

**Decision:** Accept as external references for now. Option C could be future enhancement.

---

## Issue 7: Missing Entity Types

**Count:** TBD (requires analysis)

**Currently Tracked Entity Types:**

- ✅ Spells (`/spells/{id}`)
- ✅ Monsters (`/monsters/{id}`)
- ✅ Magic Items (`/magic-items/{id}`)
- ✅ Equipment (`/equipment/{id}`)

**Missing Entity Types:**

- ❌ Classes (`/classes/{id}`)
- ❌ Feats (`/feats/{id}`)
- ❌ Species/Races (`/species/{id}`)
- ❌ Backgrounds (`/backgrounds/{id}`)

**Examples:**

- `/classes/2190875-barbarian`
- `/feats/1789092-ability-score-improvement`
- `/species/1751434-aasimar`
- `/backgrounds/406475-acolyte`

**Root Cause:**

Entity detection in `src/modules/processor.ts` only looks for specific tooltip classes and URL patterns:

```typescript
// Current implementation (incomplete)
const $entityLink = $heading.find(
  "a.spell-tooltip, a.monster-tooltip, a.magic-item-tooltip, a.equipment-tooltip"
);
if ($entityLink.length > 0) {
  const href = $entityLink.attr("href");
  if (href && /^\/(spells|monsters|magic-items|equipment)\/\d+/.test(href)) {
    entityUrls.push(href);
  }
}
```

Missing tooltip classes:

- `a.class-tooltip`
- `a.feat-tooltip`
- `a.species-tooltip`
- `a.background-tooltip`

**Impact:**

High - Classes, feats, species, and backgrounds are fundamental D&D concepts referenced extensively throughout all sourcebooks. Not tracking these means many cross-references remain unresolved.

**Potential Solutions:**

### Option A: Expand Entity Detection (Recommended)

- **Pros:** Complete entity coverage, consistent with existing system
- **Cons:** May increase fallbacks if these entities aren't in our files
- **Implementation:**
  1. Update entity detection in `src/modules/processor.ts` to check ALL links in headings:
     ```typescript
     // OLD: Only tooltip links
     const $entityLink = $heading.find(
       "a.spell-tooltip, a.monster-tooltip, a.magic-item-tooltip, a.equipment-tooltip"
     );

     // NEW: All links matching entity patterns
     const $links = $heading.find("a[href]");
     for (const link of $links) {
       const href = $(link).attr("href");
       if (href && /^\/(spells|monsters|magic-items|equipment|classes|feats|species|backgrounds)\/\d+/.test(href)) {
         entityUrls.push(href);
       }
     }
     ```
  2. Update resolver pattern in `src/modules/resolver.ts`:
     ```typescript
     if (!/^\/(spells|monsters|magic-items|equipment|classes|feats|species|backgrounds)\/\d+/.test(urlPath)) {
       return null;
     }
     ```
  3. Update `shouldResolveLink()` regex to match new entity types:
     ```typescript
     if (/^\/(spells|monsters|magic-items|equipment|classes|feats|species|backgrounds)\//.test(url)) {
       return true;
     }
     ```

### Option B: Selective Entity Types

- **Pros:** Only track what we have in our files
- **Cons:** Incomplete coverage
- **Implementation:** Same as Option A, but only add entity types we actually have

**Status:** 🔴 Not Started
**Assigned:** TBD
**Target:** TBD

**Investigation Notes:**

- [x] Run grep to find all entity link patterns in example files
- [x] Verify tooltip class names in actual HTML
- [ ] Determine which entity types exist in PHB/DMG/MM
- [ ] Check if entity pages exist or if they're inline content

**Analysis Results (2025-11-18):**

Found in HTML files:
- **Classes:** 1 unique link (`/classes/2190881-paladin`)
- **Backgrounds:** 15 unique links (acolyte, artisan, charlatan, criminal, entertainer, guard, guide, hermit, merchant, noble, sage, sailor, scribe, soldier, wayfarer)
- **Species:** 0 links found
- **Feats:** 0 links found

**CRITICAL DISCOVERY:** These entity types **do NOT use tooltip CSS classes** like spells/monsters do:
```html
<!-- Spell/Monster (HAS tooltip class) -->
<a class="tooltip-hover magic-item-tooltip" href="/magic-items/9229097-staff-of-healing">

<!-- Background/Class (NO tooltip class) -->
<a href="/backgrounds/406475-acolyte">Acolyte</a>
<a href="/classes/2190881-paladin">Paladin class description</a>
```

This means the current tooltip-based detection won't work. Need alternative approach:
1. Search for ANY `<a>` tag with href matching entity patterns (not just in headings)
2. OR enhance heading search to look for plain links, not just tooltip links

**Expected Locations:**

- **Classes:** PHB Chapter 3 (Character Classes)
- **Feats:** PHB Chapter 5 (Feats)
- **Species:** PHB Chapter 2 (Character Origins)
- **Backgrounds:** PHB Chapter 4 (Character Backgrounds)

**Questions to Answer:**

1. Do these entity types have `data-tooltip` anchors like spells/monsters?
2. Are they in separate HTML files or inline in chapters?
3. Do they use consistent ID formats (`{id}-{slug}`)?
4. How many links would this resolve?

---

## Implementation Roadmap

### Phase 1: High-Impact Fixes (Target: TBD)

1. **Issue 7: Expand Entity Type Detection**
   - [ ] Run analysis to find all entity link patterns in example files
   - [ ] Update processor to detect classes, feats, species, backgrounds
   - [ ] Update resolver entity link patterns
   - [ ] Test with actual entity references
   - [ ] Expected impact: TBD (requires analysis)

2. **Issue 2: Fix Anchor ID Extraction**
   - [ ] Investigate current anchor extraction in processor
   - [ ] Enhance HTML ID mapping for all headings
   - [ ] Test with problematic files (ilvm, lzwj, cvgs)
   - [ ] Expected impact: Resolve ~1,500 fallbacks (16%)

3. **Issue 1: Add Free Rules Support**
   - [ ] Download free-rules pages from D&D Beyond
   - [ ] Add to input directory structure
   - [ ] Verify auto-discovery works
   - [ ] Expected impact: Resolve ~5,800 fallbacks (62%)

### Phase 2: Medium-Impact Fixes (Target: TBD)

4. **Issue 3: Equipment Entity Links**
   - [ ] Investigate equipment chapter structure
   - [ ] Determine best approach (extract from tables vs. download pages)
   - [ ] Implement chosen solution
   - [ ] Expected impact: Resolve ~1,000 fallbacks (11%)

5. **Issue 5: URL Normalization**
   - [ ] Add trailing slash normalization
   - [ ] Test with affected URLs
   - [ ] Expected impact: Resolve ~50 fallbacks (0.5%)

### Phase 3: Optional Enhancements (Target: TBD)

6. **Issue 6: External Link Preservation**
   - [ ] Add config option for external links
   - [ ] Implement external link detection
   - [ ] Update resolver to preserve external URLs
   - [ ] Expected impact: Better UX for external references

---

## Testing Strategy

After each fix:

1. Run full conversion: `npm run dndb-convert -- --input examples/input --output examples/output --verbose`
2. Check fallback statistics in output
3. Verify specific fix worked (check breakdown by reason)
4. Sample check resolved links in actual markdown files
5. Update this document with results

**Baseline Metrics (Current):**

- Total fallback links: 9,403
- Top reason: Free Rules (4,724 for rules-glossary alone)
- Anchor mismatches: ~1,500
- Equipment entities: ~1,000

**Target Metrics (After Phase 1):**

- Total fallback links: <2,000 (79% reduction)
- Free Rules: 0
- Anchor mismatches: <100

**Target Metrics (After Phase 2):**

- Total fallback links: <1,000 (89% reduction)
- Equipment entities: <100

---

## Notes and Observations

### Anchor Pattern Analysis

Common anchor mismatch patterns:

- PascalCase in HTML → lowercase-with-hyphens in markdown
- Table names often have suffixes: `#ArmamentsTables`, `#ArcanaTables`
- Some anchors have article prefixes: `#UnderdarkThe` (should be `#the-underdark`)

### Equipment Entity Patterns

Equipment IDs follow format: `/equipment/{id}-{slug}`

- `/equipment/3-dagger` (ID: 3, slug: dagger)
- `/equipment/514-holy-symbol` (ID: 514, slug: holy-symbol)

Need to investigate if these IDs are stable across D&D Beyond updates.

### Free Rules Coverage

The free rules appear to be comprehensive basic rules. May be worth:

1. Checking what's in free-rules vs. paid content
2. Determining if free-rules duplicates PHB content
3. Understanding canonical source for each rule

### Verbose Mode Usage

The `--verbose` flag is extremely helpful for debugging:

- Shows first 10 fallback examples with full details
- Helps identify patterns in failures
- Should be documented in user guide

---

## Change Log

### 2025-11-18: Initial Analysis

- Ran conversion on PHB 2024, DMG 2024, MM 2024
- Identified 9,403 fallback links
- Categorized into 6 major issues
- Prioritized fixes based on impact
- Created this tracking document

### 2025-11-18: Added Issue 7 - Missing Entity Types

- Identified missing entity types: classes, feats, species, backgrounds
- Analyzed HTML files to find entity link patterns
- **Critical Discovery:** Classes/backgrounds/feats/species do NOT use tooltip CSS classes
  - Unlike spells/monsters which have `.spell-tooltip`, `.monster-tooltip` classes
  - These are plain `<a>` tags without special classes
  - Current tooltip-based detection won't work
- Found in current files:
  - 1 class link (Paladin)
  - 15 background links (all PHB 2024 backgrounds)
  - 0 species links
  - 0 feat links
- Updated implementation approach to detect all entity links, not just tooltip links
- Added to Phase 1 roadmap as high-priority item

### 2025-11-18: RESOLVED Issue 2 - Anchor Mismatches ✅

**Implementation: Use htmlIdToAnchor Mapping for Cross-File Links**

The processor was already extracting HTML IDs and building the `htmlIdToAnchor` mapping, but the resolver wasn't using it for cross-file links!

**Root Cause:**
- D&D Beyond uses custom HTML IDs: `<h3 id="FlySpeed">Fly Speed</h3>`
- Markdown generates lowercase anchors: `#fly-speed`
- Links reference HTML IDs: `/sources/dnd/free-rules/rules-glossary#FlySpeed`
- Resolver was only checking `valid` array, not `htmlIdToAnchor` mapping

**Changes Made:**

Updated `src/modules/resolver.ts` in `resolveSourceLink()` function:
```typescript
// OLD: Only smart matching against valid anchors
const matchedAnchor = findMatchingAnchor(urlAnchor, fileAnchors.valid);

// NEW: Priority-based matching
// Priority 1: Check HTML ID mapping (e.g., "FlySpeed" -> "fly-speed")
let matchedAnchor = fileAnchors.htmlIdToAnchor[urlAnchor];

// Priority 2: Smart matching (exact, plural/singular, prefix)
if (!matchedAnchor) {
  matchedAnchor = findMatchingAnchor(urlAnchor, fileAnchors.valid);
}
```

**Results:**

- ✅ **Reduced fallbacks from 9,403 to 1,688** (82% reduction!)
- ✅ **Resolved ~7,715 anchor mismatch links**
- ✅ Speed/FlySpeed/SwimSpeed/ClimbSpeed all working correctly
- ✅ Conditions, actions, rules glossary terms all resolving
- Remaining 64 "Anchor not found" are edge cases (e.g., `#OpportunityAttack`)

**Example:**
- Before: `**Fly Speed**` (bold fallback)
- After: `[Fly Speed](pp8e.md#fly-speed)` (working link!)

**Impact:**

- **Issue #2 (Anchor Mismatches):** ✅ RESOLVED - down from ~7,000 to 64 (99% resolved)
- **Total fallbacks:** 9,403 → 1,688 (82% overall reduction)

**Remaining Issues:**

Current 1,688 fallbacks breakdown:
- Equipment entity links: ~1,000 (59% of remaining)
- Header links (no anchor): ~250 (15% - working as designed)
- URL not in mapping: ~237 (14% - book-level URLs, trailing slashes)
- Other: ~201 (12% - edge cases)

---

### 2025-11-18: RESOLVED Issue 1 - Free Rules References ✅

**Implementation: URL Aliasing System**

Added support for URL aliasing in the resolver, allowing free-rules URLs to map to their PHB equivalents via canonical URLs instead of file paths.

**Changes Made:**

1. **Updated `src/config/default.json`:**
   - Added URL aliases for ALL 14 PHB pages to their free-rules equivalents
   - Provides comprehensive coverage for any free-rules reference from any book
   ```json
   "urlAliases": {
     "/sources/dnd/free-rules/character-classes": "/sources/dnd/phb-2024/character-classes",
     "/sources/dnd/free-rules/character-classes-continued": "/sources/dnd/phb-2024/character-classes-continued",
     "/sources/dnd/free-rules/character-origins": "/sources/dnd/phb-2024/character-origins",
     "/sources/dnd/free-rules/creating-a-character": "/sources/dnd/phb-2024/creating-a-character",
     "/sources/dnd/free-rules/creature-stat-blocks": "/sources/dnd/phb-2024/creature-stat-blocks",
     "/sources/dnd/free-rules/credits": "/sources/dnd/phb-2024/credits",
     "/sources/dnd/free-rules/equipment": "/sources/dnd/phb-2024/equipment",
     "/sources/dnd/free-rules/feats": "/sources/dnd/phb-2024/feats",
     "/sources/dnd/free-rules/playing-the-game": "/sources/dnd/phb-2024/playing-the-game",
     "/sources/dnd/free-rules/rules-glossary": "/sources/dnd/phb-2024/rules-glossary",
     "/sources/dnd/free-rules/spell-descriptions": "/sources/dnd/phb-2024/spell-descriptions",
     "/sources/dnd/free-rules/spells": "/sources/dnd/phb-2024/spells",
     "/sources/dnd/free-rules/the-multiverse": "/sources/dnd/phb-2024/the-multiverse",
     "/sources/dnd/free-rules/welcome-to-adventure": "/sources/dnd/phb-2024/welcome-to-adventure"
   }
   ```

2. **Updated `src/modules/resolver.ts` (lines 57-91):**
   - Added URL aliasing support: if manual mapping value starts with `/sources/`, treat as canonical URL
   - Perform two-step lookup: alias URL → auto-discovered mapping → file ID
   - Maintains backward compatibility with file path mappings

**Results:**

- ✅ **Successfully resolved ~5,800 free-rules URL mappings** (from "URL not in mapping" to file resolution)
- "URL not in mapping" errors reduced from ~5,800 to 237 (96% reduction for this error type)
- Total fallback count remains ~9,403 because free-rules links now hit Issue #2 (Anchor Mismatches)
  - Example: `/sources/dnd/free-rules/playing-the-game#Skills` now maps to PHB file but `#Skills` anchor doesn't exist
  - This is PROGRESS - we found the files, now need to fix anchor mappings

**Impact:**

- **Issue #1 (Free Rules):** ✅ RESOLVED - URLs successfully aliased
- **Issue #2 (Anchor Mismatches):** ⚠️ EXPOSED - free-rules links reveal ~5,600 additional anchor mismatches
  - Updated estimate: ~7,000 total anchor mismatch fallbacks (75% of all fallbacks)
  - Was hidden behind "URL not in mapping" errors before

**Additional Enhancements:**

1. Expanded URL aliases to cover ALL 14 PHB pages (not just the 3 that appeared in fallbacks):
   - Future-proofs the config for any free-rules references from other books
   - Works out-of-the-box for any user converting D&D Beyond content
   - Zero configuration required

2. Renamed config field from `urlMapping` to `urlAliases`:
   - Better reflects the primary use case (URL aliasing)
   - More descriptive and intuitive name
   - Updated in types (`src/types/config.ts`), config (`src/config/default.json`), resolver (`src/modules/resolver.ts`), and documentation

**Next Steps:**

- ~~Focus on Issue #2 (Anchor Mismatches)~~ ✅ RESOLVED
- Focus on remaining issues (Equipment entities, trailing slashes, etc.)
