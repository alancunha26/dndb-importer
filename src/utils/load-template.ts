import Handlebars from "handlebars";
import { readFile } from "fs/promises";

// Register comparison helpers for use in templates
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("ne", (a, b) => a !== b);
Handlebars.registerHelper("gt", (a, b) => a > b);
Handlebars.registerHelper("lt", (a, b) => a < b);
Handlebars.registerHelper("gte", (a, b) => a >= b);
Handlebars.registerHelper("lte", (a, b) => a <= b);
Handlebars.registerHelper("and", (a, b) => a && b);
Handlebars.registerHelper("or", (a, b) => a || b);
Handlebars.registerHelper("not", (a) => !a);

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
