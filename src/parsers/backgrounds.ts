import * as cheerio from "cheerio";
import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond background listing pages
 * Pattern: List Rows (div.list-row[data-slug])
 */
export const backgroundsParser: EntityParser = {
  parse(html: string): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    $("div.list-row[data-slug]").each((_, element) => {
      const $el = $(element);

      // Extract name and URL from the link
      const $link = $el.find(".list-row-name-primary-text a.link");
      const name = $link.text().trim();
      const url = $link.attr("href");

      if (!name || !url) return;

      // Extract metadata
      const source = $el.find(".list-row-name-secondary-text").first().text().trim();
      const feature = $el.find(".list-row-feature-primary-text").first().text().trim();
      const proficiencies = $el.find(".list-row-proficiencies-primary-text").first().text().trim();

      entities.push({
        name,
        url,
        metadata: {
          source,
          feature,
          proficiencies,
        },
      });
    });

    return entities;
  },
};
