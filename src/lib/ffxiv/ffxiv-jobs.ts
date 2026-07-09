export type JobRole =
  | "tank"
  | "healer"
  | "melee"
  | "physical_ranged"
  | "magical_ranged"
  | "crafter"
  | "gatherer"
  | "limited"

export const JOB_ROLES: Record<string, JobRole> = {
  Paladin: "tank", Warrior: "tank", "Dark Knight": "tank", Gunbreaker: "tank",
  Gladiator: "tank", Marauder: "tank",
  "White Mage": "healer", Scholar: "healer", Astrologian: "healer", Sage: "healer",
  Conjurer: "healer", Arcanist: "healer",
  Monk: "melee", Dragoon: "melee", Ninja: "melee", Samurai: "melee",
  Reaper: "melee", Viper: "melee",
  Pugilist: "melee", Lancer: "melee", Rogue: "melee",
  Bard: "physical_ranged", Machinist: "physical_ranged", Dancer: "physical_ranged",
  Archer: "physical_ranged",
  "Black Mage": "magical_ranged", Summoner: "magical_ranged", "Red Mage": "magical_ranged",
  Pictomancer: "magical_ranged",
  Thaumaturge: "magical_ranged",
  "Blue Mage": "limited", Beastmaster: "limited",
  Carpenter: "crafter", Blacksmith: "crafter", Armorer: "crafter", Goldsmith: "crafter",
  Leatherworker: "crafter", Weaver: "crafter", Alchemist: "crafter", Culinarian: "crafter",
  Miner: "gatherer", Botanist: "gatherer", Fisher: "gatherer",
}

export const JOB_DISPLAY_ORDER = [
  "Paladin", "Warrior", "Dark Knight", "Gunbreaker",
  "White Mage", "Scholar", "Astrologian", "Sage",
  "Monk", "Dragoon", "Ninja", "Samurai", "Reaper", "Viper",
  "Bard", "Machinist", "Dancer",
  "Black Mage", "Summoner", "Red Mage", "Pictomancer",
  "Carpenter", "Blacksmith", "Armorer", "Goldsmith",
  "Leatherworker", "Weaver", "Alchemist", "Culinarian",
  "Miner", "Botanist", "Fisher",
  "Blue Mage", "Beastmaster",
]

// Maps unupgraded base classes to their corresponding job name
export const BASE_CLASS_TO_JOB: Record<string, string> = {
  Gladiator: "Paladin",
  Marauder: "Warrior",
  Conjurer: "White Mage",
  Pugilist: "Monk",
  Lancer: "Dragoon",
  Rogue: "Ninja",
  Archer: "Bard",
  Thaumaturge: "Black Mage",
  Arcanist: "Summoner",
}
