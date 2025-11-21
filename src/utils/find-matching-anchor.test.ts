import { describe, it, expect } from "vitest";
import { findMatchingAnchor } from "./find-matching-anchor";

describe("findMatchingAnchor", () => {
  // ==========================================================================
  // Step 1: Exact match
  // ==========================================================================
  describe("Step 1: Exact match", () => {
    it("matches exact anchor", () => {
      const result = findMatchingAnchor("fireball", ["fireball", "firebolt"]);
      expect(result).toEqual({ anchor: "fireball", step: 1 });
    });

    it("returns shortest match when multiple exact matches exist", () => {
      const result = findMatchingAnchor("test", ["test", "test--1"]);
      expect(result).toEqual({ anchor: "test", step: 1 });
    });
  });

  // ==========================================================================
  // Step 2: Exact plural match
  // ==========================================================================
  describe("Step 2: Exact plural match", () => {
    it("matches singular to plural", () => {
      const result = findMatchingAnchor("bugbear", [
        "bugbears",
        "bugbear-stalker",
      ]);
      expect(result).toEqual({ anchor: "bugbears", step: 2 });
    });

    it("matches plural to singular", () => {
      const result = findMatchingAnchor("spells", ["spell", "spellbook"]);
      expect(result).toEqual({ anchor: "spell", step: 2 });
    });
  });

  // ==========================================================================
  // Step 3: Word-by-word prefix match
  // ==========================================================================
  describe("Step 3: Word-by-word prefix match", () => {
    it("matches word prefix", () => {
      const result = findMatchingAnchor("arcane-focus", [
        "arcane-focus-varies",
        "arcane-focuses",
      ]);
      expect(result).toEqual({ anchor: "arcane-focus-varies", step: 3 });
    });

    it("does not match when second word differs", () => {
      const result = findMatchingAnchor("arcane-lock", ["arcane-focus-varies"]);
      expect(result).toBeNull();
    });

    it("prefers shorter match", () => {
      const result = findMatchingAnchor("holy-water", [
        "holy-water-25-gp",
        "holy-water-flask",
      ]);
      expect(result).toEqual({ anchor: "holy-water-25-gp", step: 3 });
    });
  });

  // ==========================================================================
  // Step 4: Plural word prefix match
  // ==========================================================================
  describe("Step 4: Plural word prefix match", () => {
    it("matches with plural handling", () => {
      const result = findMatchingAnchor("potion-of-healing", [
        "potions-of-healing",
      ]);
      expect(result).toEqual({ anchor: "potions-of-healing", step: 4 });
    });
  });

  // ==========================================================================
  // Step 5: Exact match (no hyphens)
  // ==========================================================================
  describe("Step 5: Exact match (no hyphens)", () => {
    it("matches when hyphens removed", () => {
      const result = findMatchingAnchor("blindness-deafness", [
        "blindnessdeafness",
      ]);
      expect(result).toEqual({ anchor: "blindnessdeafness", step: 5 });
    });
  });

  // ==========================================================================
  // Step 6: Exact plural (no hyphens)
  // ==========================================================================
  describe("Step 6: Exact plural (no hyphens)", () => {
    it("matches plural without hyphens", () => {
      const result = findMatchingAnchor("ray-of-frost", ["rayoffrosts"]);
      expect(result).toEqual({ anchor: "rayoffrosts", step: 6 });
    });
  });

  // ==========================================================================
  // Step 7: Prefix match (no hyphens)
  // ==========================================================================
  describe("Step 7: Prefix match (no hyphens)", () => {
    it("matches prefix without hyphens", () => {
      const result = findMatchingAnchor("cure-wounds", ["curewoundsvaries"]);
      expect(result).toEqual({ anchor: "curewoundsvaries", step: 7 });
    });
  });

  // ==========================================================================
  // Step 8: Prefix plural (no hyphens)
  // ==========================================================================
  describe("Step 8: Prefix plural (no hyphens)", () => {
    it("matches prefix plural without hyphens", () => {
      // "scrolls" -> "scroll" (strip plural) matches prefix of "scrollofprotection"
      const result = findMatchingAnchor("scrolls", ["scrollofprotection"]);
      expect(result).toEqual({ anchor: "scrollofprotection", step: 8 });
    });
  });

  // ==========================================================================
  // Step 9: Reverse prefix match
  // ==========================================================================
  describe("Step 9: Reverse prefix match", () => {
    it("matches when search starts with anchor", () => {
      const result = findMatchingAnchor("flame-tongue-club", [
        "flame-tongue",
        "flame",
      ]);
      expect(result).toEqual({ anchor: "flame-tongue", step: 9 });
    });

    it("prefers longest anchor (most specific)", () => {
      const result = findMatchingAnchor("flame-tongue-longsword", [
        "flame",
        "flame-tongue",
      ]);
      expect(result).toEqual({ anchor: "flame-tongue", step: 9 });
    });
  });

  // ==========================================================================
  // Step 10: Word subset match
  // ==========================================================================
  describe("Step 10: Word subset match", () => {
    it("matches when anchor words are subset of search", () => {
      const result = findMatchingAnchor("belt-of-hill-giant-strength", [
        "belt-of-giant-strength",
      ]);
      expect(result).toEqual({ anchor: "belt-of-giant-strength", step: 10 });
    });

    it("matches potion variants", () => {
      const result = findMatchingAnchor("potion-of-hill-giant-strength", [
        "potion-of-giant-strength",
      ]);
      expect(result).toEqual({ anchor: "potion-of-giant-strength", step: 10 });
    });

    it("requires at least 2 words in anchor", () => {
      const result = findMatchingAnchor("fire-bolt-cantrip", ["fire"]);
      // Should not match via step 10 (single word anchor)
      expect(result?.step).not.toBe(10);
    });

    it("prefers longest match (most specific)", () => {
      const result = findMatchingAnchor("belt-of-hill-giant-strength", [
        "belt-of-strength",
        "belt-of-giant-strength",
      ]);
      expect(result).toEqual({ anchor: "belt-of-giant-strength", step: 10 });
    });
  });

  // ==========================================================================
  // Step 11: Word subset match with plurals
  // ==========================================================================
  describe("Step 11: Word subset match with plurals", () => {
    it("matches with plural handling in subset", () => {
      const result = findMatchingAnchor("potion-of-healing-greater", [
        "potions-of-healing",
      ]);
      expect(result).toEqual({ anchor: "potions-of-healing", step: 11 });
    });
  });

  // ==========================================================================
  // Step 12: Unordered word match
  // ==========================================================================
  describe("Step 12: Unordered word match", () => {
    it("matches words in different order", () => {
      const result = findMatchingAnchor("travelers-clothes", [
        "clothes-travelers-2-gp",
      ]);
      expect(result).toEqual({ anchor: "clothes-travelers-2-gp", step: 12 });
    });

    it("requires at least 2 words in search", () => {
      // Single word "fire" appears in anchor but should not match
      // because unordered word match requires 2+ words
      const result = findMatchingAnchor("fire", ["bolt-fire-25-gp"]);
      // Should not match because single-word search is disabled for step 12
      expect(result).toBeNull();
    });

    it("requires all search words to be in anchor", () => {
      const result = findMatchingAnchor("acid-vial", ["acid-25-gp"]);
      // "vial" is not in anchor, so no match
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // maxStep parameter
  // ==========================================================================
  describe("maxStep parameter", () => {
    it("limits matching to specified step", () => {
      // This would match at step 10, but we limit to 8
      const result = findMatchingAnchor(
        "belt-of-hill-giant-strength",
        ["belt-of-giant-strength"],
        8,
      );
      expect(result).toBeNull();
    });

    it("allows matches within limit", () => {
      // Exact match at step 1
      const result = findMatchingAnchor("fireball", ["fireball"], 1);
      expect(result).toEqual({ anchor: "fireball", step: 1 });
    });

    it("blocks matches beyond limit", () => {
      // Plural match would be step 2
      const result = findMatchingAnchor("bugbear", ["bugbears"], 1);
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Real-world scenarios
  // ==========================================================================
  describe("Real-world scenarios", () => {
    it("acid-vial should NOT match acid-25-gp (missing word)", () => {
      const result = findMatchingAnchor("acid-vial", ["acid-25-gp"]);
      expect(result).toBeNull();
    });

    it("travelers-clothes should match clothes-travelers-2-gp", () => {
      const result = findMatchingAnchor("travelers-clothes", [
        "clothes-travelers-2-gp",
      ]);
      expect(result).not.toBeNull();
      expect(result?.anchor).toBe("clothes-travelers-2-gp");
    });

    it("potion-of-hill-giant-strength should match potion-of-giant-strength", () => {
      const result = findMatchingAnchor("potion-of-hill-giant-strength", [
        "potion-of-giant-strength",
      ]);
      expect(result).not.toBeNull();
      expect(result?.anchor).toBe("potion-of-giant-strength");
    });

    it("flame-tongue-club should match flame-tongue", () => {
      const result = findMatchingAnchor("flame-tongue-club", ["flame-tongue"]);
      expect(result).not.toBeNull();
      expect(result?.anchor).toBe("flame-tongue");
    });

    it("arcane-focus should match arcane-focus-varies", () => {
      const result = findMatchingAnchor("arcane-focus", [
        "arcane-focus-varies",
        "arcane-lock",
      ]);
      expect(result).toEqual({ anchor: "arcane-focus-varies", step: 3 });
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe("Edge cases", () => {
    it("returns null for empty anchors array", () => {
      const result = findMatchingAnchor("test", []);
      expect(result).toBeNull();
    });

    it("handles duplicate suffix anchors", () => {
      const result = findMatchingAnchor("ability-score-improvement", [
        "ability-score-improvement",
        "ability-score-improvement--1",
        "ability-score-improvement--2",
      ]);
      expect(result).toEqual({ anchor: "ability-score-improvement", step: 1 });
    });

    it("strips duplicate suffix before matching", () => {
      const result = findMatchingAnchor("fireball", ["fireball--1"]);
      expect(result).toEqual({ anchor: "fireball--1", step: 1 });
    });

    it("prefers earlier steps over later steps", () => {
      // Should match at step 1 (exact) not step 12 (unordered)
      const result = findMatchingAnchor("fire-bolt", [
        "bolt-fire",
        "fire-bolt",
      ]);
      expect(result).toEqual({ anchor: "fire-bolt", step: 1 });
    });
  });
});
