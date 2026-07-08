export const DAILY_QUEST_LIMIT = 12
export const QUESTS_PER_TRIBE = 3

export interface BeastTribe {
  key: string
  name: string
  expansion: string  // expansion/patch ID for spoiler filtering
  displayGroup: string  // base expansion for column grouping
  ranks: string[]
}

// ARR and most HW tribes unlock at Neutral; Vath and all Stormblood+ unlock at Friendly
const RANKS_FROM_NEUTRAL  = ["Neutral", "Recognized", "Friendly", "Trusted", "Respected", "Honored", "Sworn", "Allied"]
const RANKS_FROM_FRIENDLY = ["Friendly", "Trusted", "Respected", "Honored", "Sworn", "Allied"]

export const BEAST_TRIBES: BeastTribe[] = [
  // A Realm Reborn — unlock at Neutral
  { key: "amaljaa",    name: "Amalj'aa",   expansion: "arr",   displayGroup: "arr", ranks: RANKS_FROM_NEUTRAL  },
  { key: "sylphs",     name: "Sylphs",     expansion: "arr",   displayGroup: "arr", ranks: RANKS_FROM_NEUTRAL  },
  { key: "kobolds",    name: "Kobolds",    expansion: "arr",   displayGroup: "arr", ranks: RANKS_FROM_NEUTRAL  },
  { key: "sahagin",    name: "Sahagin",    expansion: "arr",   displayGroup: "arr", ranks: RANKS_FROM_NEUTRAL  },
  { key: "ixal",       name: "Ixal",       expansion: "arr22", displayGroup: "arr", ranks: RANKS_FROM_NEUTRAL  },
  // Heavensward — Vanu Vanu and Moogles unlock at Neutral; Vath unlocks at Friendly
  { key: "vanu_vanu",  name: "Vanu Vanu",  expansion: "hw",    displayGroup: "hw",  ranks: RANKS_FROM_NEUTRAL  },
  { key: "vath",       name: "Vath",       expansion: "hw",    displayGroup: "hw",  ranks: RANKS_FROM_FRIENDLY },
  { key: "moogles",    name: "Moogles",    expansion: "hw32",  displayGroup: "hw",  ranks: RANKS_FROM_NEUTRAL  },
  // Stormblood — unlock at Friendly
  { key: "kojin",      name: "Kojin",      expansion: "sb",    displayGroup: "sb",  ranks: RANKS_FROM_FRIENDLY },
  { key: "ananta",     name: "Ananta",     expansion: "sb",    displayGroup: "sb",  ranks: RANKS_FROM_FRIENDLY },
  { key: "namazu",     name: "Namazu",     expansion: "sb44",  displayGroup: "sb",  ranks: RANKS_FROM_FRIENDLY },
  // Shadowbringers — unlock at Friendly
  { key: "pixies",     name: "Pixies",     expansion: "shb51", displayGroup: "shb", ranks: RANKS_FROM_FRIENDLY },
  { key: "qitari",     name: "Qitari",     expansion: "shb51", displayGroup: "shb", ranks: RANKS_FROM_FRIENDLY },
  { key: "dwarves",    name: "Dwarves",    expansion: "shb51", displayGroup: "shb", ranks: RANKS_FROM_FRIENDLY },
  // Endwalker — unlock at Friendly
  { key: "arkasodara", name: "Arkasodara", expansion: "ew",    displayGroup: "ew",  ranks: RANKS_FROM_FRIENDLY },
  { key: "omicrons",   name: "Omicrons",   expansion: "ew61",  displayGroup: "ew",  ranks: RANKS_FROM_FRIENDLY },
  { key: "loporrits",  name: "Loporrits",  expansion: "ew62",  displayGroup: "ew",  ranks: RANKS_FROM_FRIENDLY },
  // Dawntrail — unlock at Friendly
  { key: "pelupelu",   name: "Pelupelu",   expansion: "dt",    displayGroup: "dt",  ranks: RANKS_FROM_FRIENDLY },
  { key: "mamool_ja",  name: "Mamool Ja",  expansion: "dt71",  displayGroup: "dt",  ranks: RANKS_FROM_FRIENDLY },
  { key: "yok_huy",    name: "Yok Huy",    expansion: "dt",    displayGroup: "dt",  ranks: RANKS_FROM_FRIENDLY },
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
  Neutral:    "bg-secondary text-secondary-foreground",
  Recognized: "bg-slate-500/40 text-slate-200",
  Friendly:   "bg-green-500/40 text-green-200",
  Trusted:    "bg-sky-500/40 text-sky-200",
  Respected:  "bg-blue-600/40 text-blue-200",
  Honored:    "bg-amber-500/40 text-amber-200",
  Sworn:      "bg-rose-500/40 text-rose-200",
  Allied:     "bg-yellow-500/40 text-yellow-200",
}

// Count set bits in a quest mask (0-3)
export function maskToCount(mask: number): number {
  return [0, 1, 2].filter((i) => (mask >> i) & 1).length
}
