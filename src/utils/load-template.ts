import Handlebars from "handlebars";
import { readFile } from "fs/promises";

// Register comparison helpers
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("ne", (a, b) => a !== b);
Handlebars.registerHelper("gt", (a, b) => a > b);
Handlebars.registerHelper("lt", (a, b) => a < b);
Handlebars.registerHelper("gte", (a, b) => a >= b);
Handlebars.registerHelper("lte", (a, b) => a <= b);
Handlebars.registerHelper("and", (a, b) => a && b);
Handlebars.registerHelper("or", (a, b) => a || b);
Handlebars.registerHelper("not", (a) => !a);

// Register string helpers
Handlebars.registerHelper("capitalize", (str) => {
  if (!str) return "";
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
});

Handlebars.registerHelper("contains", (str, substring) => {
  if (!str || !substring) return false;
  return String(str).toLowerCase().includes(String(substring).toLowerCase());
});

// Register groupBy helper
// Usage: {{#each (groupBy entities "metadata.level")}}
Handlebars.registerHelper("groupBy", (array, field) => {
  if (!Array.isArray(array)) return {};

  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    return path.split(".").reduce((current: unknown, key) => {
      return current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined;
    }, obj);
  };

  const groups: Record<string, unknown[]> = {};
  for (const item of array) {
    const value = String(getNestedValue(item as Record<string, unknown>, field) || "Unknown");
    if (!groups[value]) {
      groups[value] = [];
    }
    groups[value].push(item);
  }

  return groups;
});

// Register spellSpecial helper to build the special column for spells (R=Ritual, C=Concentration)
Handlebars.registerHelper("spellSpecial", function (metadata) {
  const parts: string[] = [];

  if (metadata?.ritual === "Yes") parts.push("R");
  if (metadata?.concentration === "Yes") parts.push("C");

  return parts.join(", ");
});

// Register spellLevel helper to format spell level
Handlebars.registerHelper("spellLevel", (level) => {
  if (!level) return "Unknown";
  const str = String(level);
  if (str.toLowerCase() === "cantrip") return "Cantrip";
  return `${str} Level`;
});

// Register sortKeys helper to sort object keys with optional priority keys
// Usage: {{#each (sortKeys (groupBy entities "field") "First" "Second" "Third")}}
Handlebars.registerHelper("sortKeys", (obj, ...args) => {
  if (!obj || typeof obj !== "object") return obj;

  // Last argument is Handlebars options object, remove it
  const priorityKeys = args.slice(0, -1).map((k) => String(k).toLowerCase());

  const sortedEntries = Object.entries(obj).sort(([a], [b]) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aIndex = priorityKeys.indexOf(aLower);
    const bIndex = priorityKeys.indexOf(bLower);

    // Both have priority - sort by priority order
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    // Only a has priority - a comes first
    if (aIndex !== -1) return -1;
    // Only b has priority - b comes first
    if (bIndex !== -1) return 1;
    // Neither has priority - sort alphabetically
    return a.localeCompare(b);
  });

  return Object.fromEntries(sortedEntries);
});

// Register sortNumeric helper to sort object keys numerically
// Handles fractions (1/8, 1/4, 1/2) and integers (0, 1, 2, 30)
// Usage: {{#each (sortNumeric (groupBy entities "metadata.cr"))}}
Handlebars.registerHelper("sortNumeric", (obj) => {
  if (!obj || typeof obj !== "object") return obj;

  /**
   * Parse numeric value including fractions
   * Returns null for non-numeric values
   * Handles prefixes like "CR 1/8" or "Level 5"
   */
  const parseNumeric = (value: string): number | null => {
    if (!value) return null;

    // Extract the numeric part (handles "CR 1/8" → "1/8", "Level 5" → "5")
    const match = value.match(/(\d+(?:\/\d+)?)/);
    if (!match) return null;

    const numericStr = match[1];

    if (numericStr.includes("/")) {
      const [num, den] = numericStr.split("/").map(Number);
      if (isNaN(num) || isNaN(den) || den === 0) return null;
      return num / den;
    }
    const parsed = Number(numericStr);
    return isNaN(parsed) ? null : parsed;
  };

  const sortedEntries = Object.entries(obj).sort(([a], [b]) => {
    const aNum = parseNumeric(a);
    const bNum = parseNumeric(b);

    // Both are numeric - sort numerically
    if (aNum !== null && bNum !== null) return aNum - bNum;
    // Only a is numeric - a comes first
    if (aNum !== null) return -1;
    // Only b is numeric - b comes first
    if (bNum !== null) return 1;
    // Neither is numeric - sort alphabetically as fallback
    return a.localeCompare(b);
  });

  // JavaScript automatically sorts numeric string keys (like '0', '1', '2')
  // before non-numeric keys (like '1/8', '1/4'), which breaks CR sorting.
  // Solution: Return array of {key, value} objects to preserve sort order.
  // Templates must use {{key}} instead of {{@key}} and {{value}} instead of {{this}}.
  return sortedEntries.map(([key, value]) => ({ key, value }));
});

/**
 * Load and compile a template from file path or use default
 * Throws error if custom template fails to load
 */
export async function loadTemplate(
  templatePath: string | null,
  defaultTemplate: string,
): Promise<HandlebarsTemplateDelegate> {
  if (templatePath === null) {
    return Handlebars.compile(defaultTemplate);
  }

  const templateContent = await readFile(templatePath, "utf-8");
  return Handlebars.compile(templateContent);
}
