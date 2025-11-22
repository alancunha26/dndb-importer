import * as cheerio from "cheerio";
import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond monster listing pages
 * Pattern: Info Cards (div.info[data-slug])
 */
export const monstersParser: EntityParser = {
  parse(html: string): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    $('div.info[data-slug]').each((_, element) => {
      const $el = $(element);

      // Extract name and URL from the link
      const $link = $el.find("a.link");
      const name = $link.text().trim();
      const url = $link.attr("href");

      if (!name || !url) return;

      // Extract metadata
      const cr = $el.find(".monster-challenge span").first().text().trim();
      const type = $el.find(".monster-type .type").first().text().trim();
      const size = $el.find(".monster-size span").first().text().trim();
      const alignment = $el.find(".monster-alignment span").first().text().trim();
      const source = $el.find(".monster-name .source").first().text().trim();

      entities.push({
        name,
        url,
        metadata: {
          cr,
          type,
          size,
          alignment,
          source,
        },
      });
    });

    return entities;
  },
};
