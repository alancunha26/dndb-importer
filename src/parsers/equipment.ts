import * as cheerio from "cheerio";
import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond equipment listing pages
 * Pattern: List Rows (div.list-row)
 */
export const equipmentParser: EntityParser = {
  parse(html: string): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    $("div.list-row").each((_, element) => {
      const $el = $(element);

      // Extract name and URL from the link
      const $link = $el.find(".list-row-name-primary-text a.link");
      const name = $link.text().trim();
      const url = $link.attr("href");

      if (!name || !url) return;

      // Extract metadata
      const type = $el.find(".list-row-name-secondary-text").first().text().trim();
      const cost = $el.find(".list-row-cost-primary-text").first().text().trim();
      const weight = $el.find(".list-row-weight-primary-text").first().text().trim();

      entities.push({
        name,
        url,
        metadata: {
          type,
          cost,
          weight: weight === "--" ? "" : weight,
        },
      });
    });

    return entities;
  },
};
