import * as cheerio from "cheerio";
import type { ParsedEntity, EntityParser } from "../types";

/**
 * Parser for D&D Beyond spell listing pages
 * Pattern: Info Cards (div.info[data-slug])
 */
export const spellsParser: EntityParser = {
  parse(html: string): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    $("div.info[data-slug]").each((_, element) => {
      const $el = $(element);

      // Extract name and URL from the link
      const $link = $el.find("a.link");
      const name = $link.text().trim();
      const url = $link.attr("href");

      if (!name || !url) return;

      // Extract metadata
      const level = $el.find(".spell-level span").first().text().trim();
      const school =
        $el.find(".spell-school .school").attr("class")?.split(" ")[1] || "";
      const castingTime = $el
        .find(".spell-cast-time span")
        .first()
        .text()
        .trim();
      const duration = $el.find(".spell-duration span").first().text().trim();
      const range =
        $el.find(".spell-range .range-distance").first().text().trim() ||
        $el.find(".spell-range span").first().text().trim();

      // Additional metadata
      const concentration =
        $el.find(".i-concentration").length > 0 ? "Yes" : "";
      const ritual = $el.find(".i-ritual").length > 0 ? "Yes" : "";

      // Components are in the spell-name row after the school
      const $nameRow = $el.find(".spell-name");
      const components = $nameRow.find("span > span").last().text().trim();

      // Area of effect - extract size and shape from icon class
      const $aoe = $el.find(".aoe-size");
      let area = "";
      if ($aoe.length) {
        const sizeText = $aoe.text().trim().replace(/[()*]/g, "").trim();
        const $icon = $aoe.find("i[class*='i-aoe-']");
        const iconClass = $icon.attr("class") || "";
        const shapeMatch = iconClass.match(/i-aoe-(\w+)/);
        const shape = shapeMatch ? shapeMatch[1] : "";
        area = shape ? `${sizeText} ${shape}` : sizeText;
      }

      entities.push({
        name,
        url,
        metadata: {
          level,
          school,
          castingTime,
          duration,
          range,
          concentration,
          ritual,
          components,
          area,
        },
      });
    });

    return entities;
  },
};
