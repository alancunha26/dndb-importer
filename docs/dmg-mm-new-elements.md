# New HTML Elements in DMG & Monster Manual

**Date**: 2024-11-17
**Status**: Planning
**Scope**: Dungeon Master's Guide (2024) and Monster Manual (2024)

This document catalogs new HTML elements and structures found in the DMG and Monster Manual that may require special handling beyond what's currently implemented for the Player's Handbook.

---

## Summary of Findings

### New Aside Types

| Aside Class | Found In | Count | Current Handling | Recommended Action |
|-------------|----------|-------|------------------|-------------------|
| `text--quote-box` | DMG | Multiple | Generic `[!info]` callout | Add as `[!quote]` callout or blockquote |
| `monster-lore` (+ variants) | MM | Very common | Generic `[!info]` callout | Render as blockquote |
| `text--rules-sidebar greyhawk` | DMG | Few | `[!info]` callout | Already handled (no action) |

### Other Structural Elements

| Element | Found In | Complexity | Current Handling | Recommended Action |
|---------|----------|------------|------------------|-------------------|
| Stat blocks | MM (heavy), DMG (light) | High | Default Turndown | Test & evaluate |
| Multi-column layouts | Both | Low | Ignored (layout only) | No action needed |
| Special tables | Both | Medium | Default Turndown | Test & evaluate |
| Monster metadata | MM | Low | Default rendering | No action needed |
| Download buttons (PDFs/ZIPs) | DMG (20 buttons) | Low | Standard links | Keep as-is (optional enhancement) |
| Figures with alternate image links | DMG (17), potentially others | Medium | **BROKEN** - loses alternates | Download all image versions (generic) |

---

## Detailed Analysis

### 1. `text--quote-box` Aside (DMG)

**Purpose**: Read-aloud text for Dungeon Masters to narrate to players during game sessions.

**HTML Structure**:
```html
<aside class="text--quote-box">
  <p>Published adventures often include text in a box like this,
     which is meant to be read aloud to the players when their
     characters first arrive at a location...</p>
</aside>
```

**Current Behavior**:
- Falls through to default callout rendering
- Would produce: `> [!info]`

**Recommendation**:
- **Option A**: Render as `[!quote]` callout with no title
  ```markdown
  > [!quote]
  > Published adventures often include text in a box like this...
  ```
- **Option B**: Render as simple blockquote (like `epigraph`)
  ```markdown
  > Published adventures often include text in a box like this...
  ```

**Implementation**:
- Add entry to `ASIDE_RENDERING_MAP` in `src/turndown/rules/aside.ts`
- Choose rendering strategy: `"blockquote"` or `"callout"` with custom type

**Priority**: **HIGH** - Common element in DMG, distinct use case

---

### 2. `monster-lore` Aside (Monster Manual)

**Purpose**: Atmospheric flavor text and in-world quotes about monsters. Often includes speaker attribution.

**Variants**:
- `monster-lore` (default size)
- `monster-lore-small` (smaller box)
- `monster-lore-tall` (taller box)
- `monster-lore-large` (larger box)

**HTML Structure**:
```html
<aside class="monster-lore">
  <p>What can withstand the storm's scream? The lightning's spear?
     The want of sweet breath? Air is the mightiest of elements—
     respect its power.</p>
  <p>—Husam, Son of the Breezes, ruler of djinn</p>
</aside>
```

**Current Behavior**:
- Falls through to default callout rendering
- Would produce: `> [!info]`

**Recommendation**:
- Render as **blockquote** (same treatment as `epigraph`)
- This preserves the atmospheric/literary nature of the content
- Size variants are presentational only (ignore)

**Example Output**:
```markdown
> What can withstand the storm's scream? The lightning's spear?
> The want of sweet breath? Air is the mightiest of elements—
> respect its power.
>
> —Husam, Son of the Breezes, ruler of djinn
```

**Implementation**:
- Add `{ pattern: "monster-lore", type: "blockquote" }` to `ASIDE_RENDERING_MAP`
- Will automatically handle all size variants (they all contain "monster-lore")

**Priority**: **HIGH** - Very common in MM (appears on most monster pages)

---

### 3. Stat Blocks

**Purpose**: Monster/creature statistics for combat and encounters.

**Found In**:
- **Monster Manual**: Extremely common (every monster has 1-3 stat blocks)
- **Dungeon Master's Guide**: Occasional (example monsters)
- **Player's Handbook**: Rare (appendix creatures only)

**HTML Structure** (simplified):
```html
<div class="stat-block" data-content-chunk-id="...">
  <h4>Aarakocra Aeromancer</h4>
  <p>Medium Elemental, Neutral</p>
  <p><strong>AC</strong> 16 <strong>Initiative</strong> +3 (13)</p>
  <p><strong>HP</strong> 66 (12d8 + 12)</p>
  <p><strong>Speed</strong> 20 ft., Fly 50 ft.</p>

  <div class="stats">
    <table class="physical abilities-saves">
      <thead>
        <tr><th>Ability</th><th>Score</th><th>Mod</th><th>Save</th></tr>
      </thead>
      <tbody>
        <tr><th>Str</th><td>10</td><td>+0</td><td>+0</td></tr>
        <!-- ... -->
      </tbody>
    </table>
    <table class="mental abilities-saves">
      <!-- Similar structure -->
    </table>
  </div>

  <p><strong>Resistances:</strong> Lightning, Thunder</p>
  <p><strong>Immunities:</strong> Poison</p>
  <p><strong>Senses:</strong> Darkvision 60 ft., Passive Perception 14</p>
  <p><strong>Languages:</strong> Auran</p>
  <p><strong>CR:</strong> 5 (XP 1,800; PB +3)</p>

  <p><strong><em>Shocking Strikes.</em></strong> The aeromancer's attacks deal...</p>
  <!-- Actions, reactions, etc. -->
</div>
```

**Current Behavior**:
- Default Turndown rendering
- Tables should convert to markdown tables
- Paragraphs convert normally
- `<div class="stat-block">` wrapper is ignored

**Potential Issues**:
- Two side-by-side ability tables might not render clearly
- May need horizontal rule separators between sections
- Bold labels might not stand out enough

**Recommendation**:
1. **Test first**: Run conversion on Monster Manual and examine output
2. **Evaluate readability**: Are stat blocks usable in markdown?
3. **If needed**: Create custom Turndown rule for better formatting

**Implementation** (if needed):
- New file: `src/turndown/rules/stat-block.ts`
- Could add horizontal rules between sections
- Could format ability tables differently
- Could add section headers

**Priority**: **MEDIUM** - Test before implementing (may already work fine)

---

### 4. Multi-Column Layouts

**Purpose**: Presentational layout (e.g., stat block next to image, two-column text flow).

**Classes Found**:
- `flexible-double-column`
- `flexible-quad-column`
- `flexible-double-column__column-width-{20,25,30,35,40,45}pct`
- `double-column`
- `fixed two-column section-compendium-content`

**HTML Structure**:
```html
<div class="flexible-double-column">
  <div class="flexible-double-column__column-width-45pct">
    <figure><!-- Image --></figure>
  </div>
  <div>
    <p>Descriptive text about the monster...</p>
  </div>
</div>
```

**Current Behavior**:
- Turndown ignores `<div>` elements by default
- Content is extracted and rendered linearly
- Layout information is lost (expected behavior)

**Recommendation**:
- **No action needed**
- These are purely presentational CSS classes
- Markdown doesn't have native multi-column support
- Linear content flow is appropriate for markdown

**Priority**: **N/A** - No action required

---

### 5. Special Table Classes

**Purpose**: Styling hints for various table types (dice tables, alignment, etc.).

**Classes Found in DMG**:
- `table-compendium` (base class)
- `table--generic-dice` (tables with d6/d20/etc. rolls)
- `table--generic-dice-first` (dice column is first)
- `table--left-all` (all columns left-aligned)
- `table--left-col2`, `table--left-col3`, etc. (specific column alignment)
- `half-width` (narrower tables)
- Stat block tables: `physical abilities-saves`, `mental abilities-saves`

**Classes Found in MM**:
- Similar to DMG
- `table--sub-features` (nested feature tables)

**HTML Structure**:
```html
<table class="table-compendium table--generic-dice">
  <caption>
    <h3>Air Elemental Compositions</h3>
  </caption>
  <thead>
    <tr><th>1d6</th><th>The Air Elemental's Body Features...</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>Roiling fog</td></tr>
    <!-- ... -->
  </tbody>
</table>
```

**Current Behavior**:
- Default Turndown table conversion
- Produces standard markdown tables
- Classes are ignored
- Caption headings might need special handling

**Potential Issues**:
- Table captions with `<h3>` inside `<caption>` might render oddly
- Complex tables might not align well in markdown
- Stat block ability tables (side-by-side) might be confusing

**Recommendation**:
1. **Test first**: Convert a file with various tables and review output
2. **Check caption handling**: Ensure `<caption>` content renders above table
3. **If needed**: Add custom table handling

**Priority**: **MEDIUM** - Test before implementing

---

### 6. Monster Metadata Paragraphs

**Purpose**: Structured habitat and treasure information for monsters.

**HTML Structure**:
```html
<p class="treasure-habitat" data-content-chunk-id="...">
  <strong>Habitat:</strong> Desert, Mountain, Planar (Elemental Plane of Air);
  <strong>Treasure:</strong> None
</p>
```

**Current Behavior**:
- Renders as normal paragraph with bold labels
- Should work fine with default Turndown

**Example Output**:
```markdown
**Habitat:** Desert, Mountain, Planar (Elemental Plane of Air); **Treasure:** None
```

**Recommendation**:
- **No action needed**
- Default rendering is appropriate
- Could potentially format as list items, but not necessary

**Priority**: **N/A** - No action required

---

### 7. Special Heading Classes

**Purpose**: Styling and behavior hints for headings.

**Classes Found**:
- `compendium-hr` (heading with horizontal rule styling)
- `heading-anchor` (heading with anchor link support)
- `quick-menu-exclude` (excluded from navigation)
- `monster-with-metadata` (monster heading with metadata below)
- `h4-override`, `h5-override` (override default level styling)

**Current Behavior**:
- Classes are ignored
- Headings convert to markdown based on `<h1>` - `<h6>` level
- Should work correctly

**Recommendation**:
- **No action needed**
- These are presentational or navigation-related
- Not relevant for markdown output

**Priority**: **N/A** - No action required

---

### 8. Download Buttons (PDF & ZIP Resources)

**Purpose**: Links to downloadable supplementary materials (tracking sheets, character sheets, etc.).

**Found In**:
- **Dungeon Master's Guide**: 20 buttons (11 unique resources)
- **Monster Manual**: Not found
- **Player's Handbook**: Not checked

**HTML Structure**:
```html
<!-- Usually appears after an image preview of the sheet -->
<figure id="GameExpectationsSheet" class="compendium-art compendium-art-center">
  <a href="https://media.dndbeyond.com/.../game-expectations-sheet.jpg">
    <img src="https://media.dndbeyond.com/.../game-expectations-sheet.jpg" alt="" />
  </a>
</figure>

<div class="compendium--center">
  <a class="compendium--button"
     href="https://media.dndbeyond.com/compendium-images/free-rules/dmg/game-expectations-sheet.pdf">
    Downloadable PDF
  </a>
</div>
```

**Resource Types Found**:
- **PDF files** (tracking sheets):
  - `game-expectations-sheet.pdf`
  - `travel-planner.pdf`
  - `npc-tracker-sheet.pdf`
  - `settlement-tracker.pdf`
  - `campaign-journal-sheet.pdf`
  - `character-tracker.pdf`
  - `campaign-conflict-sheet.pdf`
  - `magic-item-sheet.pdf`
  - `bastion-sheet.pdf`
  - `combined-tracking-sheets.pdf` (all sheets in one file)
- **ZIP files**:
  - `dmg-tracking-sheets.zip` (all sheets as separate files)

**Current Behavior**:
- Default Turndown link conversion
- Produces: `[Downloadable PDF](https://media.dndbeyond.com/.../file.pdf)`
- Wrapper `<div class="compendium--center">` is ignored

**Example Current Output**:
```markdown
![](image-id.png)

[Downloadable PDF](https://media.dndbeyond.com/.../game-expectations-sheet.pdf)
```

---

**Recommendation Options**:

**Option 1: Keep as Standard Links (Default Behavior)** ✅ **RECOMMENDED**
- **Pros**:
  - No code changes needed
  - Links remain functional
  - User can download if desired
  - Doesn't bloat the output directory with supplementary files
- **Cons**:
  - External dependency (D&D Beyond must host files)
  - Links might break if D&D Beyond changes URLs
- **Use case**: Best for users who want lightweight markdown files

**Option 2: Download PDFs Like Images**
- **Pros**:
  - Self-contained output
  - No external dependencies
  - Files remain accessible even if D&D Beyond removes them
- **Cons**:
  - Increases output size significantly (~20 PDFs × ~500KB each = ~10MB)
  - PDFs can't be embedded in markdown viewers
  - Links would still point to local PDFs (not inline content)
  - Users may not need all tracking sheets
- **Use case**: Best for archival purposes

**Option 3: Enhanced Link Formatting**
- **Pros**:
  - Makes download links stand out visually
  - Still lightweight (no downloads)
  - Clear indication of downloadable content
- **Cons**:
  - Requires custom Turndown rule
  - Additional code complexity
- **Example output**:
  ```markdown
  ![](image-id.png)

  **📥 [Download PDF: Game Expectations Sheet](https://media.dndbeyond.com/.../game-expectations-sheet.pdf)**
  ```
- **Use case**: Best for clarity and user experience

**Option 4: Remove Download Buttons**
- **Pros**:
  - Cleanest markdown output
  - Removes UI elements from content
- **Cons**:
  - Loss of useful supplementary materials
  - Users must find resources elsewhere
- **Use case**: Not recommended - these are valuable resources

---

**Final Recommendation**: **Option 1** (Keep as Standard Links)

**Reasoning**:
1. These are supplementary materials, not core content
2. Unlike inline images, PDFs aren't viewable in markdown
3. Not all users will need tracking sheets
4. Default behavior is already correct and functional
5. Users who want local copies can download manually

**Alternative**: If users prefer, could add **Option 2** as a config option:
```json
{
  "downloads": {
    "pdfs": false,  // Default: keep as links
    "pdfsDirectory": "downloads"  // If true, save to this subdirectory
  }
}
```

**Priority**: **LOW** - Current behavior is acceptable, enhancement is optional

---

### 9. Figures with Alternate Image Links

**Purpose**: Some figures contain links to alternate versions of the image in their captions (e.g., player versions of maps without secrets, unlabeled versions, high-res versions, etc.).

**Found In**:
- **Dungeon Master's Guide**: 17 figures with alternate images
  - "View Player Version" (15 maps) - removes secret doors, traps, hidden areas
  - "View Unlabeled Version" (2 maps) - removes labels from regional maps
- **Potentially other sourcebooks**: Any figure with image links in captions

**HTML Pattern** (Generic):
```html
<figure>
  <span class="artist-credit">Artist Name</span>

  <!-- Primary Image -->
  <a href="https://media.dndbeyond.com/.../image.jpg">
    <img src="https://media.dndbeyond.com/.../image.jpg" alt="" />
  </a>

  <!-- Alternate Image (link in caption) -->
  <figcaption>
    Caption Text
    <a href="https://media.dndbeyond.com/.../image-alternate.jpg">
      Link Text (e.g., "View Player Version", "High Resolution", etc.)
    </a>
  </figcaption>
</figure>
```

**Key Insight**: The **pattern** is generic - any `<a>` tag in a `<figcaption>` that links to an image URL

**Detection Strategy** (Generic):
1. Check if `<figcaption>` contains any `<a>` elements
2. For each `<a>`, check if `href` points to an image file (.jpg, .jpeg, .png, .gif, .webp, .svg)
3. If yes → Treat as alternate image link

**Current Behavior**:
- Primary image is downloaded with unique ID (e.g., `abc123.jpg`)
- Alternate image link is extracted as text in the figcaption
- **Problem**: Caption includes link text but loses the URL

**Current Output** (problematic):
```markdown
![](abc123.jpg)

> Artist: Dyson Logos
>
> **_Barrow Crypt View Player Version_**
```

**Issues**:
1. Link text appears in caption (pollutes content with UI element)
2. Alternate image URL is lost
3. User can't access the alternate version

---

**Recommendation Options**:

**Option 1: Download All Image Versions** ✅ **RECOMMENDED**
- **Behavior**:
  - Download primary image: `abc123.jpg`
  - Detect any image links in `<figcaption>`
  - Download each alternate image with unique ID: `abc124.jpg`, etc.
  - Show all images in markdown
- **Pros**:
  - **Generic solution** - works for any sourcebook, any link text
  - Self-contained - no external dependencies
  - All image versions available locally
  - Respects the multi-version design intent
  - Future-proof for unknown patterns
- **Cons**:
  - Extra images (~17 in DMG, unknown in other sourcebooks)
  - Slightly longer download time
- **Example output**:
  ```markdown
  ![](abc123.jpg)

  > Artist: Dyson Logos
  >
  > **_Barrow Crypt_**

  ![Alternate: View Player Version](abc124.jpg)
  ```
- **Alternative format** (link instead of image):
  ```markdown
  ![](abc123.jpg)

  > Artist: Dyson Logos
  >
  > **_Barrow Crypt_**
  >
  > [View Player Version](abc124.jpg)
  ```

**Option 2: Download Primary Only, Link Externally**
- **Behavior**:
  - Download primary image only
  - Keep alternate images as external D&D Beyond links
  - Remove link text from caption, add as separate link
- **Pros**:
  - Smaller output size
  - Still accessible (if online)
- **Cons**:
  - External dependency
  - Not self-contained
  - Defeats purpose of local conversion
- **Example output**:
  ```markdown
  ![](abc123.jpg)

  > Artist: Dyson Logos
  >
  > **_Barrow Crypt_**
  >
  > [View Player Version](https://media.dndbeyond.com/.../alternate.jpg)
  ```

**Option 3: Download Primary Only, Ignore Alternates**
- **Behavior**:
  - Download primary image only
  - Strip all links from caption text
- **Pros**:
  - Cleanest caption
  - No UI elements
- **Cons**:
  - Loss of alternate versions entirely
- **Example output**:
  ```markdown
  ![](abc123.jpg)

  > Artist: Dyson Logos
  >
  > **_Barrow Crypt_**
  ```

---

**Final Recommendation**: **Option 1** (Download All Versions)

**Reasoning**:
1. ✅ **Generic solution** - No hardcoded patterns or sourcebook-specific logic
2. ✅ **Future-proof** - Works for any similar pattern in any sourcebook
3. ✅ **Self-contained** - Matches philosophy of downloading images locally
4. ✅ **Complete data** - Preserves all information from source material
5. ✅ **Not excessive** - Only downloads when pattern is detected (17 in DMG)
6. ✅ **Fixes the bug** - Removes UI text pollution from captions

**Implementation Details** (Generic Approach):
- **In `figure-caption.ts` (Turndown rule)**:
  - Parse `<figcaption>` to find `<a>` elements
  - Check if `href` matches image pattern: `/\.(jpe?g|png|gif|webp|svg)$/i`
  - Extract alternate image URLs
  - Remove link elements from caption text (not the text, just the `<a>` wrapper)
  - Return metadata about alternate images to processor

- **In `processor.ts` (image download)**:
  - When processing a figure, check for alternate image URLs from caption
  - Download each alternate image with unique ID
  - Store all URLs → IDs in `images.json` mapping
  - Generate markdown for primary + all alternates

**Output Format Preference**:
- Show alternates as separate markdown images (not links)
- Use alt text with original link text: `![Alternate: View Player Version](id.jpg)`
- Keeps all versions visible and accessible

**Priority**: **MEDIUM-HIGH** - Current behavior is broken (includes UI text in caption), needs fix

---

## Implementation Plan

### Phase 1: Fix Broken Behaviors (High Priority)

**A. Alternate Image Handling** (Currently Broken)

**Tasks**:
1. Update `src/turndown/rules/figure-caption.ts`:
   - Detect `<a>` elements in `<figcaption>` with image URLs
   - Extract alternate image URLs (generic detection via file extension)
   - Remove `<a>` elements from caption text
   - Return alternate URLs for processor to download
2. Update `src/modules/processor.ts`:
   - Download alternate images with unique IDs
   - Store all URLs → IDs in `images.json` mapping
   - Generate markdown for primary + alternates
3. Test with DMG maps appendix

**Estimated Effort**: 1-2 hours

**Success Criteria**:
- All image versions are downloaded locally
- Caption text is clean (no "View Player Version" pollution)
- Generic solution works for any link text pattern
- No regression in regular figure handling

---

**B. New Aside Types** (Missing Rendering)

**Tasks**:
1. Update `src/turndown/rules/aside.ts`:
   - Add `monster-lore` → `"blockquote"` mapping (generic for all size variants)
   - Add `text--quote-box` → Choose rendering strategy (recommend blockquote)
2. Test conversion with both DMG and MM examples
3. Verify output looks good in markdown preview

**Estimated Effort**: 30 minutes

**Success Criteria**:
- Monster lore renders as clean blockquotes
- Read-aloud text has distinct formatting
- No regression in existing aside handling

---

### Phase 2: Testing & Evaluation (Medium Priority)

**Tasks**:
1. Run full conversion on Monster Manual sample files
2. Review stat block rendering in markdown
3. Review table rendering (especially dice tables and ability tables)
4. Identify any critical formatting issues

**Test Files**:
- `examples/input/monster-manual/01-introduction-how-to-use-a-monster.html` (stat block examples)
- `examples/input/monster-manual/02-monsters-a.html` (real stat blocks)
- `examples/input/dungeon-masters-guide/01-chapter-1-the-basics.html` (read-aloud boxes)
- `examples/input/dungeon-masters-guide/13-appendix-b-maps.html` (alternate images)

**Estimated Effort**: 1 hour

**Success Criteria**:
- Stat blocks are readable and usable
- Tables render correctly
- Alternate images work correctly
- No major formatting problems

---

### Phase 3: Custom Rules (If Needed - Low Priority)

**Potential Tasks** (only if Phase 2 reveals issues):
1. Create `src/turndown/rules/stat-block.ts` (if stat blocks need better formatting)
2. Create `src/turndown/rules/table-caption.ts` (if table captions need special handling)
3. Add horizontal rules or section separators

**Estimated Effort**: 2-4 hours (if needed)

**Success Criteria**:
- All identified issues from Phase 2 are resolved
- Output is clean and usable

---

## Testing Checklist

**Phase 1A - Alternate Images**:
- [ ] Convert DMG maps appendix (alternate images)
- [ ] Verify both image versions are downloaded
- [ ] Verify caption text is clean (no link text pollution)
- [ ] Check `images.json` contains all image URLs

**Phase 1B - New Asides**:
- [ ] Convert DMG sample with `text--quote-box` asides
- [ ] Convert MM sample with `monster-lore` asides
- [ ] Verify blockquote formatting looks good

**Phase 2 - General Testing**:
- [ ] Convert MM file with stat blocks
- [ ] Convert file with dice tables
- [ ] Convert file with ability score tables
- [ ] Review all output for formatting issues
- [ ] Check that existing PHB conversion still works correctly (no regression)

---

## Notes

### Aside Types Comparison

**All aside types across all three books**:

| Class | PHB | DMG | MM | Current Handling |
|-------|-----|-----|----|----|
| `epigraph` | ✓ | ✓ | ✓ | Blockquote |
| `epigraph--with-author` | ✓ | — | — | Blockquote |
| `gameplay-callout` | ✓ | ✓ | — | Plain |
| `rhythm-box` | ✓ | ✓ | — | `[!note]` callout |
| `rhythm-box-small` | ✓ | ✓ | — | `[!note]` callout |
| `rhythm-box-tall` | ✓ | ✓ | — | `[!note]` callout |
| `rhythm-box-tiny` | — | ✓ | — | `[!note]` callout |
| `text--rules-sidebar` | ✓ | ✓ | ✓ | `[!info]` callout |
| `text--rules-sidebar greyhawk` | — | ✓ | — | `[!info]` callout |
| `text--quote-box` | — | ✓ | — | **NEEDS HANDLING** |
| `monster-lore` | — | — | ✓ | **NEEDS HANDLING** |
| `monster-lore-small` | — | — | ✓ | **NEEDS HANDLING** |
| `monster-lore-tall` | — | — | ✓ | **NEEDS HANDLING** |
| `monster-lore-large` | — | — | ✓ | **NEEDS HANDLING** |

### HTML Preprocessing vs Turndown Rules

As documented in `CLAUDE.md`, we have two stages:

1. **HTML Preprocessing** (in `src/modules/processor.ts`):
   - Fixes invalid HTML structure before Turndown
   - Uses Cheerio DOM manipulation
   - Example: Fixing nested lists

2. **Turndown Rules** (in `src/turndown/rules/`):
   - Converts valid HTML patterns to markdown
   - Runs during Turndown conversion
   - Example: Aside formatting, image unwrapping

**For these new elements**: All should be handled by **Turndown rules** (not preprocessing), as they're valid HTML with specific formatting needs.
