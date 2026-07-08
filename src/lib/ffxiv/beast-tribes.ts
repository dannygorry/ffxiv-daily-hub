export const DAILY_QUEST_LIMIT = 12
export const QUESTS_PER_TRIBE = 3

export interface BeastTribe {
  key: string
  name: string
  expansion: string  // expansion/patch ID for spoiler filtering
  displayGroup: string  // base expansion for column grouping
  ranks: string[]
}

// Standard rank progressions
const RANKS_ALLIED = ["Neutral", "Friendly", "Honored", "Trusted", "Allied"]
const RANKS_TRUSTED = ["Neutral", "Friendly", "Honored", "Trusted"]

export const BEAST_TRIBES: BeastTribe[] = [
  // A Realm Reborn
  { key: "amaljaa",   name: "Amalj'aa",  expansion: "arr",   displayGroup: "arr", ranks: RANKS_ALLIED  },
  { key: "sylphs",    name: "Sylphs",    expansion: "arr",   displayGroup: "arr", ranks: RANKS_ALLIED  },
  { key: "kobolds",   name: "Kobolds",   expansion: "arr",   displayGroup: "arr", ranks: RANKS_ALLIED  },
  { key: "sahagin",   name: "Sahagin",   expansion: "arr",   displayGroup: "arr", ranks: RANKS_ALLIED  },
  { key: "ixal",      name: "Ixal",      expansion: "arr22", displayGroup: "arr", ranks: RANKS_TRUSTED },
  // Heavensward
  { key: "vanu_vanu", name: "Vanu Vanu", expansion: "hw",    displayGroup: "hw",  ranks: RANKS_TRUSTED },
  { key: "vath",      name: "Vath",      expansion: "hw",    displayGroup: "hw",  ranks: RANKS_TRUSTED },
  { key: "moogles",   name: "Moogles",   expansion: "hw32",  displayGroup: "hw",  ranks: RANKS_TRUSTED },
  // Stormblood
  { key: "kojin",     name: "Kojin",     expansion: "sb",    displayGroup: "sb",  ranks: RANKS_TRUSTED },
  { key: "ananta",    name: "Ananta",    expansion: "sb",    displayGroup: "sb",  ranks: RANKS_TRUSTED },
  { key: "namazu",    name: "Namazu",    expansion: "sb44",  displayGroup: "sb",  ranks: RANKS_TRUSTED },
  // Shadowbringers
  { key: "pixies",    name: "Pixies",    expansion: "shb51", displayGroup: "shb", ranks: RANKS_TRUSTED },
  { key: "qitari",    name: "Qitari",    expansion: "shb51", displayGroup: "shb", ranks: RANKS_TRUSTED },
  { key: "dwarves",   name: "Dwarves",   expansion: "shb51", displayGroup: "shb", ranks: RANKS_TRUSTED },
  // Endwalker
  { key: "arkasodara",name: "Arkasodara",expansion: "ew",    displayGroup: "ew",  ranks: RANKS_TRUSTED },
  { key: "omicrons",  name: "Omicrons",  expansion: "ew61",  displayGroup: "ew",  ranks: RANKS_TRUSTED },
  { key: "loporrits", name: "Loporrits", expansion: "ew62",  displayGroup: "ew",  ranks: RANKS_TRUSTED },
  // Dawntrail
  { key: "pelupelu",  name: "Pelupelu",  expansion: "dt",    displayGroup: "dt",  ranks: RANKS_TRUSTED },
  { key: "mamool_ja", name: "Mamool Ja", expansion: "dt71",  displayGroup: "dt",  ranks: RANKS_TRUSTED },
  { key: "yok_huy",   name: "Yok Huy",   expansion: "dt",    displayGroup: "dt",  ranks: RANKS_TRUSTED },
]

export const DISPLAY_GROUPS: { id: string; label: string }[] = [
  { id: "arr", label: "A Realm Reborn" },
  { id: "hw",  label: "Heavensward" },
  { id: "sb",  label: "Stormblood" },
  { id: "shb", label: "Shadowbringers" },
  { id: "ew",  label: "Endwalker" },
  { id: "dt",  label: "Dawntrail" },
]

export const RANK_COLORS: Record<string, string> = {
  Neutral:  "bg-secondary text-secondary-foreground",
  Friendly: "bg-green-900/60 text-green-300",
  Honored:  "bg-blue-900/60 text-blue-300",
  Trusted:  "bg-purple-900/60 text-purple-300",
  Allied:   "bg-yellow-900/60 text-yellow-300",
}

// Count set bits in a quest mask (0-3)
export function maskToCount(mask: number): number {
  return [0, 1, 2].filter((i) => (mask >> i) & 1).length
}
