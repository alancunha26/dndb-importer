/**
 * Match result with quality score (lower is better)
 */
export interface AnchorMatch {
  anchor: string;
  step: number;
}

/**
 * Pre-processed anchor with all normalized forms
 */
interface ProcessedAnchor {
  original: string;
  norm: string;
  normPlural: string;
  noHyphens: string;
  noHyphensPlural: string;
  words: string[];
  wordsPlural: string[];
}

/**
 * Find matching anchor with smart matching and quality score:
 *
 * With hyphens (preserving word boundaries):
 * 1. Exact match
 * 2. Exact plural match (bugbear → bugbears)
 * 3. Exact word-by-word prefix match
 * 4. Plural-aware word-by-word prefix match
 *
 * Without hyphens (for special characters like "/"):
 * 5. Exact match (no hyphens)
 * 6. Exact plural match (no hyphens)
 * 7. Prefix match (no hyphens)
 * 8. Prefix plural match (no hyphens)
 *
 * Fallback:
 * 9. Unordered word match
 *
 * @example
 * findMatchingAnchor("fireball", anchors) // { anchor: "fireball", step: 1 }
 * findMatchingAnchor("bugbear", anchors) // { anchor: "bugbears", step: 2 }
 * findMatchingAnchor("arcane-focus", anchors) // { anchor: "arcane-focus-varies", step: 3 }
 * findMatchingAnchor("blindness-deafness", anchors) // { anchor: "blindnessdeafness", step: 5 }
 */
export function findMatchingAnchor(
  anchor: string,
  validAnchors: string[],
): AnchorMatch | null {
  // Helper functions
  const stripPlural = (s: string) => (s.endsWith("s") ? s.slice(0, -1) : s);
  const stripDupSuffix = (s: string) => s.replace(/--\d+$/, "");
  const removeHyphens = (s: string) => s.replace(/-/g, "");

  // Return shortest match, or first match when lengths are equal
  const findShortest = (items: ProcessedAnchor[]) =>
    items.reduce((a, b) => (b.norm.length < a.norm.length ? b : a));

  const isWordPrefix = (search: string[], valid: string[]) => {
    if (search.length > valid.length) return false;
    return search.every((word, i) => word === valid[i]);
  };

  // Pre-process all anchors with all normalized forms (computed once)
  const processed: ProcessedAnchor[] = validAnchors.map((original) => {
    const norm = stripDupSuffix(original);
    const words = norm.split("-");
    const noHyphens = removeHyphens(norm);
    const normPlural = stripPlural(norm);
    const noHyphensPlural = stripPlural(noHyphens);
    const wordsPlural = words.map(stripPlural);

    return {
      original,
      norm,
      normPlural,
      noHyphens,
      noHyphensPlural,
      words,
      wordsPlural,
    };
  });

  // Pre-process search anchor
  const searchWords = anchor.split("-");
  const searchWordsPlural = searchWords.map(stripPlural);
  const searchPlural = stripPlural(anchor);
  const searchNoHyphens = removeHyphens(anchor);
  const searchNoHyphensPlural = stripPlural(searchNoHyphens);

  // Define matchers in priority order
  const matchers: Array<(p: ProcessedAnchor) => boolean> = [
    // With hyphens (preserving word boundaries)
    (p) => p.norm === anchor, // 1. Exact match
    (p) => p.normPlural === searchPlural, // 2. Exact plural match
    (p) => isWordPrefix(searchWords, p.words), // 3. Word-by-word prefix match
    (p) => isWordPrefix(searchWordsPlural, p.wordsPlural), // 4. Plural word prefix match

    // Without hyphens (for special characters like "/" → "-")
    (p) => p.noHyphens === searchNoHyphens, // 5. Exact match (no hyphens)
    (p) => p.noHyphensPlural === searchNoHyphensPlural, // 6. Exact plural (no hyphens)
    (p) => p.noHyphens.startsWith(searchNoHyphens), // 7. Prefix match (no hyphens)
    (p) => p.noHyphensPlural.startsWith(searchNoHyphensPlural), // 8. Prefix plural (no hyphens)

    // Fallback: Unordered word match (only for multi-word searches)
    (p) =>
      searchWords.length >= 2 &&
      searchWordsPlural.every((sw) => p.wordsPlural.includes(sw)),
  ];

  // Run matchers in order, return first match
  for (let step = 0; step < matchers.length; step++) {
    const matches = processed.filter(matchers[step]);
    if (matches.length > 0) {
      return { anchor: findShortest(matches).original, step: step + 1 };
    }
  }

  return null;
}
