export type ExpansionId =
  | "arr" | "arr21" | "arr22" | "arr23" | "arr24" | "arr25"
  | "hw"  | "hw31"  | "hw32"  | "hw33"  | "hw34"  | "hw35"
  | "sb"  | "sb41"  | "sb42"  | "sb43"  | "sb44"  | "sb45"
  | "shb" | "shb51" | "shb52" | "shb53" | "shb54" | "shb55"
  | "ew"  | "ew61"  | "ew62"  | "ew63"  | "ew64"  | "ew65"
  | "dt"  | "dt71"  | "dt72"  | "dt73"  | "dt74"  | "dt75"

export interface PatchConfig {
  id: ExpansionId
  label: string
  name: string
}

export interface ExpansionConfig {
  id: ExpansionId
  label: string
  shortLabel: string
  patches: PatchConfig[]
}

export const EXPANSION_CONFIG: ExpansionConfig[] = [
  {
    id: "arr", label: "A Realm Reborn", shortLabel: "ARR",
    patches: [
      { id: "arr21", label: "2.1", name: "A Realm Awoken" },
      { id: "arr22", label: "2.2", name: "Through the Maelstrom" },
      { id: "arr23", label: "2.3", name: "Defenders of Eorzea" },
      { id: "arr24", label: "2.4", name: "Dreams of Ice" },
      { id: "arr25", label: "2.5", name: "Before the Fall" },
    ],
  },
  {
    id: "hw", label: "Heavensward", shortLabel: "HW",
    patches: [
      { id: "hw31", label: "3.1", name: "As Goes Light, So Goes Darkness" },
      { id: "hw32", label: "3.2", name: "The Gears of Change" },
      { id: "hw33", label: "3.3", name: "Revenge of the Horde" },
      { id: "hw34", label: "3.4", name: "Soul Surrender" },
      { id: "hw35", label: "3.5", name: "The Far Edge of Fate" },
    ],
  },
  {
    id: "sb", label: "Stormblood", shortLabel: "SB",
    patches: [
      { id: "sb41", label: "4.1", name: "The Legend Returns" },
      { id: "sb42", label: "4.2", name: "Rise of a New Sun" },
      { id: "sb43", label: "4.3", name: "Under the Moonlight" },
      { id: "sb44", label: "4.4", name: "Prelude in Violet" },
      { id: "sb45", label: "4.5", name: "A Requiem for Heroes" },
    ],
  },
  {
    id: "shb", label: "Shadowbringers", shortLabel: "ShB",
    patches: [
      { id: "shb51", label: "5.1", name: "Vows of Virtue, Deeds of Cruelty" },
      { id: "shb52", label: "5.2", name: "Echoes of a Fallen Star" },
      { id: "shb53", label: "5.3", name: "Reflections in Crystal" },
      { id: "shb54", label: "5.4", name: "Futures Rewritten" },
      { id: "shb55", label: "5.5", name: "Death Unto Dawn" },
    ],
  },
  {
    id: "ew", label: "Endwalker", shortLabel: "EW",
    patches: [
      { id: "ew61", label: "6.1", name: "Newfound Adventure" },
      { id: "ew62", label: "6.2", name: "Buried Memory" },
      { id: "ew63", label: "6.3", name: "Gods Revel, Lands Tremble" },
      { id: "ew64", label: "6.4", name: "The Dark Throne" },
      { id: "ew65", label: "6.5", name: "Growing Light" },
    ],
  },
  {
    id: "dt", label: "Dawntrail", shortLabel: "DT",
    patches: [
      { id: "dt71", label: "7.1", name: "Crossroads" },
      { id: "dt72", label: "7.2", name: "Seekers of Eternity" },
      { id: "dt73", label: "7.3", name: "The Promise of Tomorrow" },
      { id: "dt74", label: "7.4", name: "The Light of Dawn" },
      { id: "dt75", label: "7.5", name: "The Dawn of Tomorrow" },
    ],
  },
]

// Update this when a new major patch releases new Expert/Level Cap content
export const LATEST_PATCH_ID: ExpansionId = "dt75"

// Flat ordered sequence of all expansion/patch IDs (chronological)
export const ORDERED_IDS: ExpansionId[] = EXPANSION_CONFIG.flatMap(
  (e) => [e.id, ...e.patches.map((p) => p.id)]
)

// Default cutoff: end of ARR (arr25) — everything after is hidden
export const DEFAULT_HIDDEN: ExpansionId[] = ORDERED_IDS.filter(
  (_, i) => i > ORDERED_IDS.indexOf("arr25")
)

// Patch → parent expansion lookup (built at module load)
export const PATCH_PARENT: Partial<Record<ExpansionId, ExpansionId>> = {}
for (const exp of EXPANSION_CONFIG) {
  for (const patch of exp.patches) {
    PATCH_PARENT[patch.id] = exp.id
  }
}

// Weather zone ID → expansion
export const ZONE_EXPANSION: Partial<Record<string, ExpansionId>> = {
  "limsa-lominsa": "arr", "middle-la-noscea": "arr", "lower-la-noscea": "arr",
  "eastern-la-noscea": "arr", "western-la-noscea": "arr", "upper-la-noscea": "arr",
  "outer-la-noscea": "arr", "ul-dah": "arr", "central-thanalan": "arr",
  "eastern-thanalan": "arr", "southern-thanalan": "arr", "northern-thanalan": "arr",
  "gridania": "arr", "central-shroud": "arr", "east-shroud": "arr",
  "south-shroud": "arr", "north-shroud": "arr", "coerthas-central": "arr",
  "mor-dhona": "arr",
  "coerthas-western": "hw", "sea-of-clouds": "hw",
  "dravanian-forelands": "hw", "churning-mists": "hw",
  "fringes": "sb", "peaks": "sb", "azim-steppe": "sb", "ruby-sea": "sb",
  "lakeland": "shb", "il-mheg": "shb", "tempest": "shb",
  "labyrinthos": "ew", "thavnair": "ew", "garlemald": "ew",
  "mare-lamentorum": "ew", "elpis": "ew", "ultima-thule": "ew",
  "urqopacha": "dt", "kozamauka": "dt", "yak-tel": "dt",
  "shaaloani": "dt", "heritage-found": "dt",
}

// Checklist item name → expansion (unlisted items always show)
export const ITEM_EXPANSION: Partial<Record<string, ExpansionId>> = {
  // ARR beast tribes
  "Beast Tribe: Amalj'aa": "arr",
  "Beast Tribe: Sylph": "arr",
  "Beast Tribe: Kobold": "arr",
  "Beast Tribe: Sahagin": "arr",
  "Beast Tribe: Ixal": "arr22",
  // HW
  "Beast Tribe: Vanu Vanu": "hw",
  "Beast Tribe: Vath": "hw",
  "Beast Tribe: Moogles": "hw32",
  "Squadron Mission": "hw35",
  // SB
  "Beast Tribe: Kojin": "sb",
  "Beast Tribe: Ananta": "sb",
  "Beast Tribe: Namazu": "sb44",
  "Custom Deliveries": "sb42",
  "Custom Deliveries (Weekly Cap)": "sb42",
  // ShB
  "Beast Tribe: Pixie": "shb51",
  "Beast Tribe: Qitari": "shb51",
  "Beast Tribe: Dwarf": "shb51",
  "Wondrous Tails Book": "shb51",
  // EW
  "Beast Tribe: Arkasodara": "ew",
  "Beast Tribe: Omicron": "ew61",
  "Beast Tribe: Loporrits": "ew62",
  // DT 7.0
  "Beast Tribe: Pelupelu": "dt",
  "Beast Tribe: Rroneek": "dt",
  // Expert and Level Cap Dungeons always require the latest patch content —
  // update LATEST_PATCH_ID above when a new patch drops new Expert dungeons
  "Expert": LATEST_PATCH_ID,
  "Level Cap Dungeons": LATEST_PATCH_ID,
  "Normal Raid: Floor 1": "dt",
  "Normal Raid: Floor 2": "dt",
  "Normal Raid: Floor 3": "dt",
  "Normal Raid: Floor 4": "dt",
  "Savage Raid: Floor 1": "dt",
  "Savage Raid: Floor 2": "dt",
  "Savage Raid: Floor 3": "dt",
  "Savage Raid: Floor 4": "dt",
  // DT 7.1
  "Beast Tribe: Moblins": "dt71",
  "Alliance Raid (Tomestone Bonus)": "dt71",
}

export function isExpansionHidden(
  id: ExpansionId | undefined,
  hidden: Set<ExpansionId>
): boolean {
  if (!id) return false
  if (hidden.has(id)) return true
  const parent = PATCH_PARENT[id]
  return parent !== undefined && hidden.has(parent)
}
