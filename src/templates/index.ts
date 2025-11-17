/**
 * Template utilities for Handlebars template rendering
 */

import Handlebars from "handlebars";
import { readFile } from "fs/promises";
import { DEFAULT_INDEX_TEMPLATE, DEFAULT_FILE_TEMPLATE } from "./defaults";

/**
 * Load and compile a template from file path or use default
 */
export async function loadTemplate(
  templatePath: string | null,
  defaultTemplate: string,
): Promise<HandlebarsTemplateDelegate> {
  if (templatePath === null) {
    // Use built-in default
    return Handlebars.compile(defaultTemplate);
  }

  try {
    const templateContent = await readFile(templatePath, "utf-8");
    return Handlebars.compile(templateContent);
  } catch (error) {
    console.warn(
      `Warning: Failed to load template from ${templatePath}, using default:`,
      error,
    );
    return Handlebars.compile(defaultTemplate);
  }
}

/**
 * Load index template (sourcebook-specific or global or default)
 */
export async function loadIndexTemplate(
  sourcebookTemplatePath: string | null,
  globalTemplatePath: string | null,
): Promise<HandlebarsTemplateDelegate> {
  // Try sourcebook-specific first, then global, then default
  const templatePath = sourcebookTemplatePath ?? globalTemplatePath;
  return loadTemplate(templatePath, DEFAULT_INDEX_TEMPLATE);
}

/**
 * Load file template (sourcebook-specific or global or default)
 */
export async function loadFileTemplate(
  sourcebookTemplatePath: string | null,
  globalTemplatePath: string | null,
): Promise<HandlebarsTemplateDelegate> {
  // Try sourcebook-specific first, then global, then default
  const templatePath = sourcebookTemplatePath ?? globalTemplatePath;
  return loadTemplate(templatePath, DEFAULT_FILE_TEMPLATE);
}
