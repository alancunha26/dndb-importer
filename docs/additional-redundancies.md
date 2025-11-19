# Additional Data Redundancy Analysis

**Branch:** `feature/resolver`
**Created:** 2025-01-19
**Follow-up to:** `docs/data-structure-analysis.md`

## Overview

Based on deeper analysis, **2 additional redundancies** were discovered beyond the original 3 (fileIndex, pathIndex, LinkResolutionIndex).

---

## Additional Redundancy #1: bookUrl in SourcebookInfo ⚠️

### Current State

**Two separate URL→file lookups:**

```typescript
// SourcebookInfo
{
  id: "lyfz",
  bookUrl: "/sources/dnd/phb-2024",  // ← Book-level URL stored here
  ...
}

// urlMapping Map
{
  "/sources/dnd/phb-2024/spells" => "abc1",   // Page URLs only
  "/sources/dnd/phb-2024/classes" => "def2",  // No book URLs!
}
```

**Resolver does TWO lookups** (resolver.ts:348-370):
```typescript
// 1. Check book-level URLs
const sourcebook = ctx.sourcebooks?.find((sb) => sb.bookUrl === urlPath);
if (sourcebook) {
  return `[${text}](${sourcebook.id}.md)`;
}

// 2. Check page-level URLs
const fileId = ctx.urlMapping?.get(urlPath);
if (fileId) {
  // resolve to that file
}
```

### The Problem

- **Duplication:** Book URL → file ID mapping exists in TWO places
  - `sourcebooks.bookUrl` + `sourcebooks.id` → manual lookup
  - Could be in `urlMapping` → direct lookup
- **Complexity:** Resolver needs to check both sources
- **Maintenance:** Two code paths for URL resolution

### Proposed Solution

**Add book-level URLs to urlMapping:**

```typescript
// In scanner.ts when creating sourcebook:
const bookUrl = await extractBookUrl(sourcePath);
if (bookUrl) {
  urlMapping.set(bookUrl, indexId);  // Add book URL to mapping
}
```

**Remove bookUrl field from SourcebookInfo:**
```typescript
export interface SourcebookInfo {
  id: string;
  title: string;
  // bookUrl?: string;  ← REMOVE THIS
  ...
}
```

**Simplify resolver to ONE lookup:**
```typescript
// Just check urlMapping for ALL URLs (book + page)
const fileId = ctx.urlMapping?.get(urlPath);
if (fileId) {
  return `[${text}](${fileId}.md)`;
}
```

### Impact

**Remove:**
- `bookUrl` field from `SourcebookInfo` type
- `extractBookUrl()` function from scanner (40 lines)
- Separate sourcebooks lookup in resolver (20 lines)

**Add:**
- One line in scanner: `urlMapping.set(bookUrl, indexId)`

**Benefits:**
- ✅ Single source of truth for ALL URL→file mappings
- ✅ Simpler resolver (one lookup instead of two)
- ✅ ~60 lines of code removed
- ✅ More consistent architecture

**Drawbacks:**
- ⚠️ urlMapping now contains both book and page URLs (minor - actually makes more sense)
- ⚠️ Less explicit that a URL is book-level (could add comment)

**Estimated Savings:**
- Code: ~60 lines removed
- Memory: ~500 bytes (bookUrl strings in sourcebooks array)
- Complexity: Significant (eliminates dual lookup pattern)

---

## Additional Redundancy #2: EntityLocation.anchor ⚠️

### Current State

**EntityLocation stores both fileId AND anchor:**
```typescript
export interface EntityLocation {
  fileId: string;  // Where entity is located
  anchor: string;  // Markdown anchor for entity (e.g., "fireball")
}

// Example:
entityIndex.set("/magic-items/123-fireball", [
  { fileId: "abc1", anchor: "fireball" }  // ← anchor is redundant!
]);
```

**How anchor is computed** (processor.ts:573-580):
```typescript
const match = entityUrl.match(/\/[^/]+\/\d+-(.+)$/);
const slug = match[1];  // "fireball"
const anchor = slug;    // Just the slug!
```

### The Problem

- **Redundant:** Anchor is ALWAYS derived from entity URL slug
  - `/magic-items/123-fireball` → anchor always = `"fireball"`
  - `/spells/456-arcane-vigor` → anchor always = `"arcane-vigor"`
- **Duplication:** Storing same information twice:
  - Entity URL contains the slug
  - EntityLocation.anchor stores the slug
- **Memory:** For 800 entities × 8 bytes each = ~6.4 KB wasted

### Proposed Solution

**Option A: Remove anchor field, derive on demand**

```typescript
// Simplified type
export interface EntityLocation {
  fileId: string;  // Only store file ID
}

// Utility function to extract anchor from entity URL
function getEntityAnchor(entityUrl: string): string {
  const match = entityUrl.match(/\/[^/]+\/\d+-(.+)$/);
  return match?.[1] || "";
}

// In resolver:
const locations = entityIndex.get(urlPath);
const location = locations[0];
const defaultAnchor = getEntityAnchor(urlPath);
const targetAnchor = urlAnchor || defaultAnchor;
```

**Option B: Store entire entity URL instead**

```typescript
export interface EntityLocation {
  fileId: string;
  entityUrl: string;  // Store full URL, derive anchor when needed
}
```

**Recommendation:** Option A - simpler, anchor can be derived from the URL key itself

### Impact

**Remove:**
- `anchor` field from `EntityLocation` type
- Anchor extraction in processor.ts (can keep as utility)

**Add:**
- `getEntityAnchor()` utility function
- One-line anchor derivation in resolver

**Benefits:**
- ✅ No data duplication
- ✅ ~6.4 KB memory saved
- ✅ Single source of truth (entity URL)

**Drawbacks:**
- ⚠️ Need to extract anchor on every entity link resolution (minor - just regex)
- ⚠️ Slightly less explicit (but anchor is clearly derivable from URL)

**Estimated Savings:**
- Memory: ~6.4 KB (for 800 entities)
- Code: Cleaner type, but add utility function (net neutral)

---

## Other Examined Structures (NOT Redundant)

### 1. outputPath vs uniqueId + extension ✅ Keep

**Current:**
```typescript
{
  uniqueId: "abc1",
  outputPath: "/path/to/output/abc1.md"
}
```

**Analysis:**
- outputPath = `config.output.directory + "/" + uniqueId + config.output.extension`
- Technically derivable, but...
- **Reason to keep:** Accessed frequently (read/write operations)
- **Verdict:** Caching is reasonable performance optimization

### 2. sourcePath vs relativePath ✅ Keep

**Current:**
```typescript
{
  sourcePath: "/absolute/path/to/input/players-handbook/01-intro.html",
  relativePath: "players-handbook/01-intro.html"
}
```

**Analysis:**
- relativePath = `path.relative(inputDir, sourcePath)`
- Technically derivable, but...
- **Reason to keep:** Used for file mapping persistence (files.json)
- **Verdict:** Both serve distinct purposes

### 3. sourcebook vs sourcebookId ✅ Keep

**Current:**
```typescript
{
  sourcebook: "players-handbook",  // Directory name
  sourcebookId: "lyfz"             // Index file ID
}
```

**Analysis:**
- DIFFERENT data, not redundant
- sourcebook: Directory name (string for paths)
- sourcebookId: Reference to SourcebookInfo
- **Verdict:** Both needed for different purposes

### 4. FileDescriptor.title vs SourcebookInfo.title ✅ Keep

**Analysis:**
- DIFFERENT data, not redundant
- FileDescriptor.title: Title of individual file (from H1)
- SourcebookInfo.title: Title of entire sourcebook
- **Verdict:** Different semantic meaning

---

## Summary of ALL Redundancies

| Structure | Type | Savings | Priority |
|-----------|------|---------|----------|
| **fileIndex** | Complete duplicate | -15 KB | 🔴 Critical |
| **pathIndex** | Dead code | -3 KB | 🔴 Critical |
| **LinkResolutionIndex** | Duplicate anchors | -50 KB | 🔴 Critical |
| **bookUrl** | Dual lookup | -60 LOC | 🟡 Medium |
| **EntityLocation.anchor** | Derivable data | -6.4 KB | 🟢 Low |

**Total Impact:**
- Memory: ~74.4 KB saved
- Code: ~120 lines removed
- Complexity: Significantly simpler

---

## Updated Phase 0 Plan

### Phase 0A: Remove Critical Redundancies (Original)
1. Remove fileIndex
2. Remove pathIndex
3. Refactor LinkResolutionIndex → fileMap

**Time:** 2-3 hours
**Savings:** ~68 KB memory, simpler codebase

### Phase 0B: Remove bookUrl Redundancy (New)
1. Add book URLs to urlMapping in scanner
2. Remove bookUrl field from SourcebookInfo
3. Remove extractBookUrl() function
4. Simplify resolver to single lookup

**Time:** 1-2 hours
**Savings:** ~60 lines code, simpler architecture

### Phase 0C: Remove EntityLocation.anchor (Optional)
1. Add getEntityAnchor() utility
2. Remove anchor from EntityLocation type
3. Update processor and resolver

**Time:** 1 hour
**Savings:** ~6.4 KB memory

**Total Phase 0 Time:** 4-6 hours
**Total Impact:** Massive simplification

---

## Decision: Should We Fix Everything in Phase 0?

### Recommendation: Yes for 0A + 0B, Optional for 0C

**Phase 0A + 0B:**
- ✅ High impact (removes dual lookup pattern)
- ✅ Simplifies architecture significantly
- ✅ Low risk (well-understood changes)
- ✅ Sets foundation for future work

**Phase 0C (EntityLocation.anchor):**
- ⚠️ Lower impact (~6 KB)
- ⚠️ Adds regex call on every entity resolution (minor perf cost)
- ⚠️ Could be done later if needed
- **Verdict:** Skip for now, revisit if memory becomes an issue

---

## References

- Original analysis: `docs/data-structure-analysis.md`
- Action plan: `docs/refactoring-action-plan.md`
- Scanner implementation: `src/modules/scanner.ts`
- Resolver implementation: `src/modules/resolver.ts`
- Processor implementation: `src/modules/processor.ts`
