# Resolver Architecture

**Status:** Proposed Refactoring
**Created:** 2025-01-19

## Current Architecture (As-Is)

```
┌─────────────────────────────────────────────────────────────────┐
│                    src/modules/resolver.ts                      │
│                         (474 lines)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  resolve()                                  [Main Orchestration]│
│    ├─ Build LinkResolutionIndex                                │
│    ├─ For each file:                                           │
│    │    ├─ Read markdown from disk                             │
│    │    ├─ resolveLinksInContent()                             │
│    │    └─ Write resolved content                              │
│    └─ Store fallback links                                     │
│                                                                 │
│  resolveLinksInContent()                   [Content Processing]│
│    ├─ Split content into lines                                 │
│    ├─ Skip image lines                                         │
│    └─ Replace markdown links with resolved versions            │
│                                                                 │
│  shouldResolveLink()                         [Link Filtering]  │
│    ├─ Check if internal anchor                                 │
│    ├─ Check if D&D Beyond domain                               │
│    ├─ Check if source URL                                      │
│    └─ Check if entity URL                                      │
│                                                                 │
│  resolveLink()                              [Main Resolution]  │
│    ├─ Strip D&D Beyond domain (inline)                         │
│    ├─ Normalize URL (inline)                                   │
│    ├─ Handle internal anchors                                  │
│    ├─ Split URL into path and anchor (inline)                  │
│    ├─ Apply URL aliases (inline)                               │
│    ├─ Try entity resolution                                    │
│    ├─ Try source resolution                                    │
│    └─ Fallback to bold                                         │
│                                                                 │
│  resolveInternalAnchor()                  [Anchor Resolution]  │
│    ├─ Look up HTML ID in htmlIdToAnchor                        │
│    └─ Return markdown anchor link                              │
│                                                                 │
│  resolveEntityLink()                      [Entity Resolution]  │
│    ├─ Check entity URL pattern (inline regex)                  │
│    ├─ Look up in entity index                                  │
│    ├─ Track fallback if not found (inline)                     │
│    └─ Build markdown link                                      │
│                                                                 │
│  resolveSourceLink()                      [Source Resolution]  │
│    ├─ Check for book-level URL                                 │
│    ├─ Check for header link (no anchor)                        │
│    ├─ Track fallback (inline) - DUPLICATED                     │
│    ├─ Look up in URL mapping                                   │
│    ├─ Track fallback (inline) - DUPLICATED                     │
│    ├─ Validate anchor exists                                   │
│    ├─ Try HTML ID mapping                                      │
│    ├─ Normalize anchor (inline)                                │
│    ├─ Try smart matching                                       │
│    ├─ Track fallback (inline) - DUPLICATED                     │
│    └─ Build markdown link                                      │
│                                                                 │
│  findMatchingAnchor()                     [Anchor Matching]    │
│    ├─ Try exact match                                          │
│    ├─ Try prefix matching                                      │
│    └─ Return shortest match                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Problems:
❌ Inline logic scattered throughout (URL normalization, fallback tracking)
❌ Duplication (fallback tracking 6+ times, regex patterns)
❌ Hard to test individual pieces
❌ No clear separation between parsing, resolution, and tracking
```

---

## Proposed Architecture (To-Be)

### Phase 1-4: Extract Utilities (Recommended Minimum)

```
┌──────────────────────────────────────────────────────────────────┐
│                       src/utils/url.ts                           │
├──────────────────────────────────────────────────────────────────┤
│  • normalizeDnDBeyondUrl()                                       │
│  • parseUrl()                                                    │
│  • shouldResolveUrl()                                            │
│  • applyAliases()                                                │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     src/utils/anchor.ts                          │
├──────────────────────────────────────────────────────────────────┤
│  • normalizeAnchor()                                             │
│  • generateAnchor()                                              │
│  • findMatchingAnchor()                                          │
│  • generateAnchorVariants()                                      │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                 src/utils/fallback-tracker.ts                    │
├──────────────────────────────────────────────────────────────────┤
│  class FallbackTracker                                           │
│    • track()                                                     │
│    • trackEntityNotFound()                                       │
│    • trackUrlNotInMapping()                                      │
│    • trackAnchorNotFound()                                       │
│    • trackHeaderLink()                                           │
│    • getLinks()                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                  src/modules/resolver.ts                         │
│                      (~300 lines)                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Constants                                                       │
│    • ENTITY_TYPES                                                │
│    • ENTITY_URL_PATTERN                                          │
│    • DNDBEYOND_DOMAIN_PATTERN                                    │
│    • SOURCE_URL_PATTERN                                          │
│                                                                  │
│  resolve()                               [Main Orchestration]   │
│    ├─ Build LinkResolutionIndex                                 │
│    ├─ Create FallbackTracker                                    │
│    ├─ For each file:                                            │
│    │    ├─ Read markdown                                        │
│    │    ├─ resolveLinksInContent()                              │
│    │    └─ Write resolved content                               │
│    └─ Store fallback links from tracker                         │
│                                                                  │
│  resolveLinksInContent()                [Content Processing]    │
│    └─ Uses url.shouldResolveUrl()                               │
│                                                                  │
│  resolveLink()                          [Main Resolution]       │
│    ├─ Uses url.normalizeDnDBeyondUrl()                          │
│    ├─ Uses url.parseUrl()                                       │
│    ├─ Uses url.applyAliases()                                   │
│    ├─ Try entity resolution                                     │
│    ├─ Try source resolution                                     │
│    └─ Fallback to bold                                          │
│                                                                  │
│  resolveInternalAnchor()                [Anchor Resolution]     │
│    └─ (No changes - already clean)                              │
│                                                                  │
│  resolveEntityLink()                    [Entity Resolution]     │
│    ├─ Uses ENTITY_URL_PATTERN constant                          │
│    ├─ Uses tracker.trackEntityNotFound()                        │
│    └─ Build markdown link                                       │
│                                                                  │
│  resolveSourceLink()                    [Source Resolution]     │
│    ├─ Uses tracker.trackHeaderLink()                            │
│    ├─ Uses tracker.trackUrlNotInMapping()                       │
│    ├─ Uses anchor.normalizeAnchor()                             │
│    ├─ Uses anchor.findMatchingAnchor()                          │
│    ├─ Uses tracker.trackAnchorNotFound()                        │
│    └─ Build markdown link                                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Benefits:
✅ Clear separation of concerns
✅ No duplication (DRY)
✅ Easy to unit test utilities
✅ Resolver focused on orchestration
✅ ~40% reduction in resolver.ts size (474 → ~300 lines)
```

---

### Phase 5: Modular Structure (Optional)

```
┌─────────────────────────────────────────────────────────────────┐
│                   src/modules/resolver/                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  index.ts                               [Main Orchestration]   │
│    └─ resolve()                                                 │
│                                                                 │
│  constants.ts                           [Constants]            │
│    ├─ ENTITY_TYPES                                              │
│    ├─ ENTITY_URL_PATTERN                                        │
│    └─ Other regex patterns                                      │
│                                                                 │
│  link-processor.ts                      [Content Processing]   │
│    └─ resolveLinksInContent()                                   │
│                                                                 │
│  link-resolver.ts                       [Main Resolution]      │
│    └─ resolveLink()                                             │
│                                                                 │
│  entity-resolver.ts                     [Entity Resolution]    │
│    └─ resolveEntityLink()                                       │
│                                                                 │
│  source-resolver.ts                     [Source Resolution]    │
│    └─ resolveSourceLink()                                       │
│                                                                 │
│  anchor-resolver.ts                     [Anchor Resolution]    │
│    ├─ resolveInternalAnchor()                                   │
│    └─ (Uses anchor utils)                                       │
│                                                                 │
│  types.ts                               [Resolver Types]       │
│    └─ Internal resolver types                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               src/modules/resolver.ts                           │
├─────────────────────────────────────────────────────────────────┤
│  // Compatibility re-export                                     │
│  export * from './resolver/index';                              │
└─────────────────────────────────────────────────────────────────┘

Benefits:
✅ Each file < 100 lines
✅ Very clear separation of concerns
✅ Easy to navigate codebase
✅ Easy to add new resolution types

Drawbacks:
⚠️  More files to maintain
⚠️  Might be overkill for current size
⚠️  Only worth it if module continues to grow
```

---

## Data Flow Diagram

### Current Flow

```
resolve()
  ↓
  Read file content
  ↓
resolveLinksInContent()
  ↓
  For each link → resolveLink()
                    ↓
                    Inline normalization
                    Inline alias application
                    ↓
                    ┌─────────────────────┐
                    │ Internal anchor?    │
                    └─────────────────────┘
                      ↓ Yes
                    resolveInternalAnchor()
                      ↓ No
                    ┌─────────────────────┐
                    │ Entity link?        │
                    └─────────────────────┘
                      ↓ Yes
                    resolveEntityLink()
                      ├─ Inline fallback tracking
                      └─ Return link
                      ↓ No
                    ┌─────────────────────┐
                    │ Source link?        │
                    └─────────────────────┘
                      ↓ Yes
                    resolveSourceLink()
                      ├─ Inline normalization
                      ├─ Inline anchor matching
                      ├─ Inline fallback tracking (×3)
                      └─ Return link
                      ↓ No
                    Fallback to bold
  ↓
  Write resolved content
```

### Proposed Flow (After Phase 1-4)

```
resolve()
  ↓
  Create FallbackTracker
  ↓
  Read file content
  ↓
resolveLinksInContent()
  ↓
  For each link → resolveLink()
                    ↓
                    url.normalizeDnDBeyondUrl()
                    url.applyAliases()
                    ↓
                    url.parseUrl()
                    ↓
                    ┌─────────────────────┐
                    │ Internal anchor?    │
                    └─────────────────────┘
                      ↓ Yes
                    resolveInternalAnchor()
                      ↓ No
                    ┌─────────────────────┐
                    │ Entity link?        │
                    └─────────────────────┘
                      ↓ Yes
                    resolveEntityLink()
                      ├─ tracker.trackEntityNotFound()
                      └─ Return link
                      ↓ No
                    ┌─────────────────────┐
                    │ Source link?        │
                    └─────────────────────┘
                      ↓ Yes
                    resolveSourceLink()
                      ├─ anchor.normalizeAnchor()
                      ├─ anchor.findMatchingAnchor()
                      ├─ tracker.trackUrlNotInMapping()
                      ├─ tracker.trackAnchorNotFound()
                      └─ Return link
                      ↓ No
                    Fallback to bold
  ↓
  Write resolved content
  ↓
  Store tracker.getLinks()
```

---

## Metrics

### Current State
- **Total Lines:** 474
- **Functions:** 8
- **Longest Function:** `resolveSourceLink()` (108 lines)
- **Duplicated Code:** Fallback tracking (6 locations), Regex patterns (3 locations)
- **Test Coverage:** 0% (no tests)

### Target State (After Phase 1-4)
- **Total Lines (resolver.ts):** ~300 (-37%)
- **Total Lines (utilities):** ~200
- **Functions:** 8 (same, but smaller)
- **Longest Function:** < 50 lines
- **Duplicated Code:** 0
- **Test Coverage:** > 80%

### Target State (After Phase 5 - Optional)
- **Total Lines (per file):** < 100
- **Modules:** 7 files
- **Test Coverage:** > 90%

---

## Decision Matrix

| Criteria | Single File + Utils | Modular Structure |
|----------|-------------------|-------------------|
| **Complexity** | ⭐⭐ Low | ⭐⭐⭐⭐ Medium |
| **Maintainability** | ⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent |
| **Testability** | ⭐⭐⭐⭐ Very Good | ⭐⭐⭐⭐⭐ Excellent |
| **Time to Implement** | ⭐⭐⭐⭐ 1-2 weeks | ⭐⭐ 2-3 weeks |
| **Breaking Changes** | ✅ None | ✅ None (with re-export) |
| **File Count** | +3 files | +8 files |

**Recommendation:** Start with Single File + Utils (Phases 1-4), evaluate modular structure later if needed.

---

## References

- Action Plan: `docs/refactoring-action-plan.md`
- Current Implementation: `src/modules/resolver.ts`
- Type Definitions: `src/types/resolver.ts`
