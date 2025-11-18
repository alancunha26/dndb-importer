/**
 * Template utilities for Handlebars template rendering
 */

import Handlebars from "handlebars";
import { readFile } from "fs/promises";
import { getDefaultIndexTemplate, getDefaultFileTemplate } from "./defaults";
import type { MarkdownConfig } from "../types";

// Re-export default template functions for module-level error handling
export { getDefaultIndexTemplate, getDefaultFileTemplate };

/**
 * Load and compile a template from file path or use default
 * Throws error if custom template fails to load
 */
export async function loadTemplate(
  templatePath: string | null,
  defaultTemplate: string,
): Promise<HandlebarsTemplateDelegate> {
  if (templatePath === null) {
    // Use built-in default
    return Handlebars.compile(defaultTemplate);
  }

  // Load custom template - let errors bubble up to module level
  const templateContent = await readFile(templatePath, "utf-8");
  return Handlebars.compile(templateContent);
}

/**
 * Load index template (sourcebook-specific or global or default)
 */
export async function loadIndexTemplate(
  sourcebookTemplatePath: string | null,
  globalTemplatePath: string | null,
  config: MarkdownConfig,
): Promise<HandlebarsTemplateDelegate> {
  // Try sourcebook-specific first, then global, then default
  const templatePath = sourcebookTemplatePath ?? globalTemplatePath;
  const defaultTemplate = getDefaultIndexTemplate(config);
  return loadTemplate(templatePath, defaultTemplate);
}

/**
 * Load file template (sourcebook-specific or global or default)
 */
export async function loadFileTemplate(
  sourcebookTemplatePath: string | null,
  globalTemplatePath: string | null,
  config: MarkdownConfig,
): Promise<HandlebarsTemplateDelegate> {
  // Try sourcebook-specific first, then global, then default
  const templatePath = sourcebookTemplatePath ?? globalTemplatePath;
  const defaultTemplate = getDefaultFileTemplate(config);
  return loadTemplate(templatePath, defaultTemplate);
}
