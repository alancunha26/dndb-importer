import * as cheerio from "cheerio";
import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond class listing pages
 * Pattern: Card Grid (li.listing-card)
 * Note: No pagination (all shown in grid)
 */
export const classesParser: EntityParser = {
  parse(html: string): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    $("li.listing-card").each((_, element) => {
      const $el = $(element);

      // Extract name and URL from the link
      const $link = $el.find("a.listing-card__link");
      const url = $link.attr("href");
      const name = $el.find(".listing-card__title").text().trim();

      if (!name || !url) return;

      // Extract metadata
      const source = $el.find(".listing-card__source").first().text().trim();

      entities.push({
        name,
        url,
        metadata: {
          source,
        },
      });
    });

    return entities;
  },
};
