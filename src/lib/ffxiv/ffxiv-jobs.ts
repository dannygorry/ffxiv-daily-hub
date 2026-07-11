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

/** ClassJob row IDs from FFXIV game data — used for icon CDN lookups */
export const JOB_CLASS_IDS: Record<string, number> = {
  Paladin: 19, Warrior: 21, "Dark Knight": 32, Gunbreaker: 37,
  "White Mage": 24, Scholar: 28, Astrologian: 33, Sage: 40,
  Monk: 20, Dragoon: 22, Ninja: 30, Samurai: 34, Reaper: 39, Viper: 41,
  Bard: 23, Machinist: 31, Dancer: 38,
  "Black Mage": 25, Summoner: 27, "Red Mage": 35, Pictomancer: 42,
  Carpenter: 8, Blacksmith: 9, Armorer: 10, Goldsmith: 11,
  Leatherworker: 12, Weaver: 13, Alchemist: 14, Culinarian: 15,
  Miner: 16, Botanist: 17, Fisher: 18,
}

export const JOB_ABBREVIATIONS: Record<string, string> = {
  Paladin: "PLD", Warrior: "WAR", "Dark Knight": "DRK", Gunbreaker: "GNB",
  "White Mage": "WHM", Scholar: "SCH", Astrologian: "AST", Sage: "SGE",
  Monk: "MNK", Dragoon: "DRG", Ninja: "NIN", Samurai: "SAM", Reaper: "RPR", Viper: "VPR",
  Bard: "BRD", Machinist: "MCH", Dancer: "DNC",
  "Black Mage": "BLM", Summoner: "SMN", "Red Mage": "RDM", Pictomancer: "PCT",
  Carpenter: "CRP", Blacksmith: "BSM", Armorer: "ARM", Goldsmith: "GSM",
  Leatherworker: "LTW", Weaver: "WVR", Alchemist: "ALC", Culinarian: "CUL",
  Miner: "MIN", Botanist: "BTN", Fisher: "FSH",
}

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
