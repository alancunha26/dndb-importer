# Resolver Module Refactoring Action Plan

**Branch:** `feature/resolver`
**Status:** Draft
**Created:** 2025-01-19

## Overview

The resolver module has grown to **474 lines** with significant complexity. This plan outlines a systematic refactoring to improve maintainability, testability, and readability.

## Current Problems

### 1. Code Organization
- ❌ No clear separation of concerns (URL parsing, entity resolution, source resolution all mixed)
- ❌ Inline logic scattered throughout functions
- ❌ No utility functions for common operations

### 2. Duplication
- ❌ Fallback tracking code duplicated 6+ times
- ❌ Regex patterns repeated (entity types, URL patterns)
- ❌ URL normalization logic could be reused
- ❌ Anchor normalization logic inline in multiple places

### 3. Type Safety
- ❌ `async` function that doesn't await anything (resolveLinksInContent)
- ❌ Unused dependencies (`pathIndex` checked but never used)
- ❌ Parameter ordering inconsistent across functions

### 4. Testability
- ❌ Hard to unit test individual pieces (too much coupling)
- ❌ No clear interfaces for mocking
- ❌ Side effects mixed with pure logic

## Proposed Structure

### File Organization

```
src/
├── modules/
│   ├── resolver/
│   │   ├── index.ts           # Main resolve() orchestration
│   │   ├── link-processor.ts  # Content processing (resolveLinksInContent)
│   │   ├── entity-resolver.ts # Entity link resolution
│   │   ├── source-resolver.ts # Source link resolution
│   │   ├── anchor-matcher.ts  # Anchor matching and normalization
│   │   ├── constants.ts       # Regex patterns, entity types
│   │   └── types.ts           # Resolver-specific types
│   └── resolver.ts            # Re-export from resolver/index.ts (maintain compatibility)
├── utils/
│   ├── url.ts                 # URL normalization, parsing, validation
│   ├── fallback-tracker.ts   # Centralized fallback tracking logic
│   └── regex.ts               # Common regex patterns (optional)
```

**Alternative (Simpler):** Keep as single file but extract utilities to `src/utils/`.

## Refactoring Phases

---

## Phase 1: Extract Constants & Fix Critical Issues

**Goal:** Clean up immediate code smells without changing structure.

### Tasks

1. **Extract regex patterns to constants**
   ```typescript
   // At top of resolver.ts
   const ENTITY_TYPES = ['spells', 'monsters', 'magic-items', 'equipment', 'classes', 'feats', 'species', 'backgrounds'];
   const ENTITY_URL_PATTERN = /^\/(spells|monsters|magic-items|equipment|classes|feats|species|backgrounds)\/\d+/;
   const DNDBEYOND_DOMAIN_PATTERN = /^https?:\/\/www\.dndbeyond\.com\//;
   const SOURCE_URL_PATTERN = /^\/sources\//;
   ```

2. **Fix async function signature**
   - Remove `async` from `resolveLinksInContent()` (line 112)
   - Change return type from `Promise<string>` to `string`

3. **Remove unused dependency check**
   - Line 39: Remove `!ctx.pathIndex` check (not used anymore)

4. **Fix let/const usage**
   - Line 217: Use const destructuring with clear alias reassignment

5. **Standardize parameter order**
   - Establish convention: `(urlData, text, currentFileId, ctx, supplementalData, tracking)`
   - Update all resolution functions to match

**Files Changed:**
- `src/modules/resolver.ts`

**Estimated Time:** 1-2 hours

**Testing:** Run existing tests, verify fallback count unchanged

---

## Phase 2: Extract URL Utilities

**Goal:** Create reusable URL manipulation functions.

### Tasks

1. **Create `src/utils/url.ts`**
   ```typescript
   /**
    * Normalize D&D Beyond URL
    * - Strips domain
    * - Removes trailing slashes
    * - Lowercases
    */
   export function normalizeDnDBeyondUrl(url: string): string;

   /**
    * Parse URL into components
    */
   export interface ParsedUrl {
     path: string;
     anchor?: string;
     isEntity: boolean;
     isSource: boolean;
     isInternal: boolean;
   }
   export function parseUrl(url: string): ParsedUrl;

   /**
    * Check if URL should be resolved
    */
   export function shouldResolveUrl(url: string): boolean;

   /**
    * Apply URL aliases
    */
   export function applyAliases(urlPath: string, aliases: Record<string, string>): string;
   ```

2. **Refactor resolver to use URL utils**
   - Replace inline normalization (lines 197-209) with `normalizeDnDBeyondUrl()`
   - Replace `shouldResolveLink()` with `shouldResolveUrl()`
   - Replace inline alias logic (lines 222-224) with `applyAliases()`

**Files Changed:**
- `src/utils/url.ts` (new)
- `src/modules/resolver.ts`

**Estimated Time:** 2-3 hours

**Testing:** Unit tests for URL utils, integration tests for resolver

---

## Phase 3: Extract Fallback Tracking

**Goal:** DRY up fallback tracking logic.

### Tasks

1. **Create `src/utils/fallback-tracker.ts`**
   ```typescript
   import type { FallbackLink, ConversionContext } from '../types';

   export class FallbackTracker {
     private links: FallbackLink[] = [];

     constructor(private ctx: ConversionContext) {}

     track(params: {
       url: string;
       text: string;
       file: string;
       reason: string;
     }): void {
       if (!this.ctx.config.links.fallbackToBold) return;
       this.links.push(params);
     }

     trackEntityNotFound(url: string, text: string, file: string, entityPath: string): void {
       this.track({ url, text, file, reason: `Entity not found: ${entityPath}` });
     }

     trackUrlNotInMapping(url: string, text: string, file: string, urlPath: string): void {
       this.track({ url, text, file, reason: `URL not in mapping: ${urlPath}` });
     }

     trackAnchorNotFound(url: string, text: string, file: string, fileId: string, anchor: string): void {
       this.track({ url, text, file, reason: `Anchor not found in ${fileId}: #${anchor}` });
     }

     trackHeaderLink(url: string, text: string, file: string, urlPath: string): void {
       this.track({ url, text, file, reason: `Header link (no anchor): ${urlPath}` });
     }

     getLinks(): FallbackLink[] {
       return this.links;
     }
   }
   ```

2. **Refactor resolver to use FallbackTracker**
   - Create tracker instance in `resolve()` function
   - Replace all inline fallback tracking with tracker methods
   - Remove duplicate code (6+ locations)

**Files Changed:**
- `src/utils/fallback-tracker.ts` (new)
- `src/modules/resolver.ts`

**Estimated Time:** 2-3 hours

**Testing:** Verify fallback counts remain identical

---

## Phase 4: Extract Anchor Utilities

**Goal:** Centralize anchor matching and normalization logic.

### Tasks

1. **Create `src/utils/anchor.ts`**
   ```typescript
   /**
    * Normalize anchor to markdown format
    * Converts: "OpportunityAttack" -> "opportunity-attack"
    */
   export function normalizeAnchor(anchor: string): string;

   /**
    * Generate anchor from heading text (GitHub-style)
    */
   export function generateAnchor(text: string): string;

   /**
    * Find matching anchor with smart matching:
    * 1. Exact match
    * 2. Plural/singular variants
    * 3. Prefix matching
    */
   export function findMatchingAnchor(
     anchor: string,
     validAnchors: string[]
   ): string | null;

   /**
    * Generate plural and singular variants
    */
   export function generateAnchorVariants(anchor: string): string[];
   ```

2. **Move anchor logic from processor.ts**
   - Move anchor generation logic (lines 218-228) to `generateAnchor()`
   - Move variant generation to `generateAnchorVariants()`
   - Update processor to use anchor utils

3. **Refactor resolver anchor matching**
   - Move `findMatchingAnchor()` to utils
   - Move normalization logic (lines 421-426) to `normalizeAnchor()`
   - Update resolver to use anchor utils

**Files Changed:**
- `src/utils/anchor.ts` (new)
- `src/modules/resolver.ts`
- `src/modules/processor.ts`

**Estimated Time:** 2-3 hours

**Testing:** Unit tests for anchor utils, verify link resolution unchanged

---

## Phase 5: Modularize Resolver (Optional)

**Goal:** Split resolver into focused modules for better maintainability.

### Tasks

1. **Create resolver subdirectory structure**
   ```
   src/modules/resolver/
   ├── index.ts              # Main orchestration
   ├── link-processor.ts     # Content processing
   ├── entity-resolver.ts    # Entity link resolution
   ├── source-resolver.ts    # Source link resolution
   ├── anchor-resolver.ts    # Internal anchor resolution
   ├── constants.ts          # Regex patterns, entity types
   └── types.ts              # Resolver-specific types
   ```

2. **Split resolver.ts into modules**
   - `index.ts`: Main `resolve()` function
   - `link-processor.ts`: `resolveLinksInContent()`
   - `entity-resolver.ts`: `resolveEntityLink()`
   - `source-resolver.ts`: `resolveSourceLink()`
   - `anchor-resolver.ts`: `resolveInternalAnchor()`

3. **Create compatibility layer**
   - Keep `src/modules/resolver.ts` as re-export from `resolver/index.ts`
   - No breaking changes to external API

**Files Changed:**
- `src/modules/resolver/*` (new)
- `src/modules/resolver.ts` (becomes re-export)

**Estimated Time:** 3-4 hours

**Testing:** Full integration tests, verify no regression

**Decision Point:** Evaluate if this is necessary based on Phase 1-4 results.

---

## Phase 6: Improve Entity Index Building

**Goal:** Make entity URL parsing more robust.

### Tasks

1. **Improve entity URL parsing in processor.ts**
   - Add validation for entity URLs without slugs
   - Handle edge cases (e.g., `/magic-items/123` without slug)
   - Add warning/logging for skipped entities

2. **Extract entity URL parsing to utility**
   ```typescript
   // src/utils/entity.ts
   export interface ParsedEntityUrl {
     type: string;      // 'spells', 'monsters', etc.
     id: string;        // '123'
     slug?: string;     // 'fireball'
     anchor?: string;   // Computed from slug
   }

   export function parseEntityUrl(url: string): ParsedEntityUrl | null;
   ```

**Files Changed:**
- `src/utils/entity.ts` (new)
- `src/modules/processor.ts`

**Estimated Time:** 1-2 hours

**Testing:** Verify entity index building, test edge cases

---

## Phase 7: Add Comprehensive Tests

**Goal:** Ensure refactoring doesn't break functionality.

### Tasks

1. **Unit tests for utilities**
   - `url.ts`: Test normalization, parsing, alias application
   - `anchor.ts`: Test matching, normalization, variant generation
   - `fallback-tracker.ts`: Test tracking methods
   - `entity.ts`: Test entity URL parsing

2. **Integration tests for resolver**
   - Test entity link resolution
   - Test source link resolution
   - Test internal anchor resolution
   - Test fallback tracking
   - Test URL aliases

3. **Regression tests**
   - Capture current fallback count baseline
   - Verify each phase doesn't change fallback count
   - Test with real examples

**Files Changed:**
- `tests/utils/url.test.ts` (new)
- `tests/utils/anchor.test.ts` (new)
- `tests/utils/fallback-tracker.test.ts` (new)
- `tests/modules/resolver.test.ts` (new)

**Estimated Time:** 4-6 hours

**Testing:** All tests pass, 100% coverage on utils

---

## Success Criteria

### Code Quality
- ✅ All functions < 50 lines
- ✅ No duplicated code
- ✅ Clear separation of concerns
- ✅ Consistent naming and parameter ordering

### Testability
- ✅ All utilities have unit tests
- ✅ Integration tests for main flows
- ✅ Easy to mock/stub dependencies

### Maintainability
- ✅ Easy to add new link types
- ✅ Easy to modify resolution logic
- ✅ Clear file organization
- ✅ Well-documented functions

### Functionality
- ✅ No regression in link resolution
- ✅ Fallback count unchanged (baseline: 1,495)
- ✅ All existing tests pass

---

## Rollout Plan

### Week 1: Foundation
- **Day 1-2:** Phase 1 (Constants & Fixes)
- **Day 3-4:** Phase 2 (URL Utilities)
- **Day 5:** Phase 3 (Fallback Tracker)

### Week 2: Enhancement
- **Day 1-2:** Phase 4 (Anchor Utilities)
- **Day 3:** Phase 6 (Entity Parsing)
- **Day 4-5:** Phase 7 (Testing)

### Week 3: Optional
- **Day 1-3:** Phase 5 (Modularization) - Only if needed
- **Day 4-5:** Documentation and cleanup

**Note:** Phases can be done incrementally with PR reviews between each phase.

---

## Open Questions

1. **Modular vs Single File?**
   - Current: 474 lines in one file
   - Threshold: Split if it grows beyond 600 lines?
   - Decision: Start with utilities extraction (Phases 1-4), evaluate modularization later

2. **Where to draw the line?**
   - How much should we extract vs keep inline?
   - Trade-off: Reusability vs complexity

3. **Testing strategy?**
   - Unit tests for all utils?
   - Integration tests only?
   - Both?

4. **Breaking changes?**
   - Keep current API intact?
   - Acceptable to change internal structure only?

---

## References

- Current implementation: `src/modules/resolver.ts`
- Related modules: `src/modules/processor.ts`, `src/modules/scanner.ts`
- Type definitions: `src/types/resolver.ts`, `src/types/context.ts`
- Configuration: `src/config/default.json`

---

## Notes

- Maintain backward compatibility with existing code
- Each phase should be independently testable
- Run full conversion between phases to verify no regression
- Update CLAUDE.md documentation after refactoring
