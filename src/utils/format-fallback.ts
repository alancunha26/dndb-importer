import type { ConversionConfig } from "../types";

/**
 * Format text using the configured fallback style
 */
export function formatFallback(text: string, config: ConversionConfig): string {
  switch (config.links.fallbackStyle) {
    case "bold":
      return `${config.markdown.strong}${text}${config.markdown.strong}`;
    case "italic":
      return `${config.markdown.emphasis}${text}${config.markdown.emphasis}`;
    case "plain":
      return text;
    case "none":
      return ""; // Signal to keep original link
    default:
      return `${config.markdown.strong}${text}${config.markdown.strong}`;
  }
}
