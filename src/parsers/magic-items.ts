import * as cheerio from "cheerio";
import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond magic item listing pages
 * Pattern: Info Cards (div.info[data-slug])
 */
export const magicItemsParser: EntityParser = {
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
      const rarity = $el.find(".item-name .rarity").text().trim();
      const type = $el.find(".item-type .type").first().text().trim();
      const attunement = $el.find(".requires-attunement span").first().text().trim();

      entities.push({
        name,
        url,
        metadata: {
          rarity,
          type,
          attunement: attunement === "——" ? "" : attunement,
        },
      });
    });

    return entities;
  },
};
