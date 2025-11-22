import * as cheerio from "cheerio";
import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond feat listing pages
 * Pattern: List Rows (div.list-row[data-slug])
 */
export const featsParser: EntityParser = {
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
      const notes = $el.find(".list-row-notes-primary-text").first().text().trim();
      const tags = $el.find(".list-row-tags-primary-text").first().text().trim();

      entities.push({
        name,
        url,
        metadata: {
          source,
          notes,
          tags,
        },
      });
    });

    return entities;
  },
};
