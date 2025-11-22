/**
 * Entity listing page parsers
 */

import { spellsParser } from "./spells";
import { monstersParser } from "./monsters";
import { magicItemsParser } from "./magic-items";
import { equipmentParser } from "./equipment";
import { featsParser } from "./feats";
import { backgroundsParser } from "./backgrounds";
import { speciesParser } from "./species";
import { classesParser } from "./classes";
import type { EntityParser, EntityType } from "../types";

// Export individual parsers
export {
  spellsParser,
  monstersParser,
  magicItemsParser,
  equipmentParser,
  featsParser,
  backgroundsParser,
  speciesParser,
  classesParser,
};

// Parser registry by entity type
const parsers: Record<EntityType, EntityParser> = {
  spells: spellsParser,
  monsters: monstersParser,
  "magic-items": magicItemsParser,
  equipment: equipmentParser,
  feats: featsParser,
  backgrounds: backgroundsParser,
  species: speciesParser,
  classes: classesParser,
};

/**
 * Get the appropriate parser for an entity type
 */
export function getParser(entityType: EntityType): EntityParser {
  return parsers[entityType];
}
