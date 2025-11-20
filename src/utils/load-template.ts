import Handlebars from "handlebars";
import { readFile } from "fs/promises";

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
