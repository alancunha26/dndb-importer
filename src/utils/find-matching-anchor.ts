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
 * Reverse matching (anchor contained in search):
 * 9. Reverse prefix match (flame-tongue-club → flame-tongue)
 * 10. Word subset match (belt-of-hill-giant-strength → belt-of-giant-strength)
 * 11. Word subset match with plurals (potion-of-healing-greater → potions-of-healing)
 *
 * Fallback:
 * 12. Unordered word match
 *
 * @example
 * findMatchingAnchor("fireball", anchors) // { anchor: "fireball", step: 1 }
 * findMatchingAnchor("bugbear", anchors) // { anchor: "bugbears", step: 2 }
 * findMatchingAnchor("arcane-focus", anchors) // { anchor: "arcane-focus-varies", step: 3 }
 * findMatchingAnchor("blindness-deafness", anchors) // { anchor: "blindnessdeafness", step: 5 }
 * findMatchingAnchor("flame-tongue-club", anchors) // { anchor: "flame-tongue", step: 9 }
 * findMatchingAnchor("belt-of-hill-giant-strength", anchors) // { anchor: "belt-of-giant-strength", step: 10 }
 */
export function findMatchingAnchor(
  anchor: string,
  validAnchors: string[],
  maxStep?: number,
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

  // Check if anchor words are a subset of search words (in order, allowing gaps)
  // e.g., ["belt", "of", "giant", "strength"] is subset of ["belt", "of", "hill", "giant", "strength"]
  const isWordSubset = (anchorWords: string[], searchWords: string[]) => {
    if (anchorWords.length > searchWords.length) return false;
    if (anchorWords.length < 2) return false; // Require at least 2 words to avoid false positives

    let searchIdx = 0;
    for (const word of anchorWords) {
      // Find this word in remaining search words
      while (
        searchIdx < searchWords.length &&
        searchWords[searchIdx] !== word
      ) {
        searchIdx++;
      }
      if (searchIdx >= searchWords.length) return false;
      searchIdx++;
    }
    return true;
  };

  // Return longest match for reverse matching (we want the most specific anchor)
  const findLongest = (items: ProcessedAnchor[]) =>
    items.reduce((a, b) => (b.norm.length > a.norm.length ? b : a));

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

    // Reverse matching (anchor contained in search - for variant items)
    (p) => anchor.startsWith(p.norm + "-"), // 9. Reverse prefix match (flame-tongue-club → flame-tongue)
    (p) => isWordSubset(p.words, searchWords), // 10. Word subset match (belt-of-hill-giant-strength → belt-of-giant-strength)
    (p) => isWordSubset(p.wordsPlural, searchWordsPlural), // 11. Word subset match with plurals (potion-of-healing-greater → potions-of-healing)

    // Fallback: Unordered word match (only for multi-word searches)
    (p) =>
      searchWords.length >= 2 &&
      searchWordsPlural.every((sw) => p.wordsPlural.includes(sw)),
  ];

  // Matchers that should use findLongest instead of findShortest (reverse matching)
  const useLongestMatch = new Set([8, 9, 10]); // Steps 9, 10, 11 (0-indexed: 8, 9, 10)

  // Run matchers in order, return first match
  const maxStepLimit = maxStep ?? matchers.length;
  for (let step = 0; step < Math.min(matchers.length, maxStepLimit); step++) {
    const matches = processed.filter(matchers[step]);
    if (matches.length > 0) {
      // For reverse matching, prefer longest (most specific) anchor
      const bestMatch = useLongestMatch.has(step)
        ? findLongest(matches)
        : findShortest(matches);
      return { anchor: bestMatch.original, step: step + 1 };
    }
  }

  return null;
}
