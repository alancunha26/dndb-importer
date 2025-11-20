import type { MarkdownConfig } from "../types";
import { loadTemplate } from "./load-template";
import { getDefaultIndexTemplate } from "./get-default-index-template";

/**
 * Load index template (sourcebook-specific or global or default)
 */
export async function loadIndexTemplate(
  sourcebookTemplatePath: string | null,
  globalTemplatePath: string | null,
  config: MarkdownConfig,
): Promise<HandlebarsTemplateDelegate> {
  const templatePath = sourcebookTemplatePath ?? globalTemplatePath;
  const defaultTemplate = getDefaultIndexTemplate(config);
  return loadTemplate(templatePath, defaultTemplate);
}
