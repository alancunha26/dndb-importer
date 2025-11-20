import type { MarkdownConfig } from "../types";
import { loadTemplate } from "./load-template";
import { getDefaultFileTemplate } from "./get-default-file-template";

/**
 * Load file template (sourcebook-specific or global or default)
 */
export async function loadFileTemplate(
  sourcebookTemplatePath: string | null,
  globalTemplatePath: string | null,
  config: MarkdownConfig,
): Promise<HandlebarsTemplateDelegate> {
  const templatePath = sourcebookTemplatePath ?? globalTemplatePath;
  const defaultTemplate = getDefaultFileTemplate(config);
  return loadTemplate(templatePath, defaultTemplate);
}
