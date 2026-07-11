export type RelicCategory = "weapon" | "armor" | "tool"

export interface RelicJob {
  key: string
  label: string
}

export interface RelicStep {
  key: string
  label: string
  stage: string
}

export interface RelicMaterial {
  key: string
  label: string
  /** Amount needed per job/slot that has not yet completed gateStep */
  perJob: number
  /** Once a job has this step in its completed_steps, it no longer needs this material */
  gateStep: string
  isCurrency?: boolean
  /**
   * Override the wiki URL slug (path after /wiki/).
   * undefined  → auto-generate from label (spaces → underscores)
   * null       → suppress the wiki link entirely
   * string     → use this exact slug
   */
  wikiSlug?: string | null
}

export interface RelicTrack {
  expansionKey: string
  category: RelicCategory
  expansionLabel: string
  categoryLabel: string
  jobs: RelicJob[]
  steps: RelicStep[]
  materials: RelicMaterial[]
}

// ─── Job lists ───────────────────────────────────────────────────────────────

const ARR_COMBAT_JOBS: RelicJob[] = [
  { key: "Paladin", label: "Paladin" },
  { key: "Warrior", label: "Warrior" },
  { key: "Monk", label: "Monk" },
  { key: "Dragoon", label: "Dragoon" },
  { key: "Ninja", label: "Ninja" },
  { key: "Bard", label: "Bard" },
  { key: "White Mage", label: "White Mage" },
  { key: "Scholar", label: "Scholar" },
  { key: "Black Mage", label: "Black Mage" },
  { key: "Summoner", label: "Summoner" },
]

const HW_COMBAT_JOBS: RelicJob[] = [
  ...ARR_COMBAT_JOBS,
  { key: "Dark Knight", label: "Dark Knight" },
  { key: "Machinist", label: "Machinist" },
  { key: "Astrologian", label: "Astrologian" },
]

const SB_COMBAT_JOBS: RelicJob[] = [
  ...HW_COMBAT_JOBS,
  { key: "Samurai", label: "Samurai" },
  { key: "Red Mage", label: "Red Mage" },
]

const SHB_COMBAT_JOBS: RelicJob[] = [
  { key: "Paladin", label: "Paladin" },
  { key: "Warrior", label: "Warrior" },
  { key: "Dark Knight", label: "Dark Knight" },
  { key: "Gunbreaker", label: "Gunbreaker" },
  { key: "White Mage", label: "White Mage" },
  { key: "Scholar", label: "Scholar" },
  { key: "Astrologian", label: "Astrologian" },
  { key: "Sage", label: "Sage" },
  { key: "Monk", label: "Monk" },
  { key: "Dragoon", label: "Dragoon" },
  { key: "Ninja", label: "Ninja" },
  { key: "Samurai", label: "Samurai" },
  { key: "Reaper", label: "Reaper" },
  { key: "Bard", label: "Bard" },
  { key: "Machinist", label: "Machinist" },
  { key: "Dancer", label: "Dancer" },
  { key: "Black Mage", label: "Black Mage" },
  { key: "Summoner", label: "Summoner" },
  { key: "Red Mage", label: "Red Mage" },
]

const EW_COMBAT_JOBS: RelicJob[] = SHB_COMBAT_JOBS

const DT_COMBAT_JOBS: RelicJob[] = [
  ...EW_COMBAT_JOBS,
  { key: "Viper", label: "Viper" },
  { key: "Pictomancer", label: "Pictomancer" },
]

const DOH_DOL_JOBS: RelicJob[] = [
  { key: "Carpenter", label: "Carpenter" },
  { key: "Blacksmith", label: "Blacksmith" },
  { key: "Armorer", label: "Armorer" },
  { key: "Goldsmith", label: "Goldsmith" },
  { key: "Leatherworker", label: "Leatherworker" },
  { key: "Weaver", label: "Weaver" },
  { key: "Alchemist", label: "Alchemist" },
  { key: "Culinarian", label: "Culinarian" },
  { key: "Miner", label: "Miner" },
  { key: "Botanist", label: "Botanist" },
  { key: "Fisher", label: "Fisher" },
]

const ARMOR_SLOTS: RelicJob[] = [
  { key: "Head", label: "Head" },
  { key: "Body", label: "Body" },
  { key: "Hands", label: "Hands" },
  { key: "Legs", label: "Legs" },
  { key: "Feet", label: "Feet" },
]

// ─── Track definitions ───────────────────────────────────────────────────────

export const RELIC_TRACKS: RelicTrack[] = [
  // ── ARR: Zodiac Weapons ──────────────────────────────────────────────────
  {
    expansionKey: "arr",
    category: "weapon",
    expansionLabel: "A Realm Reborn",
    categoryLabel: "Zodiac Weapons",
    jobs: ARR_COMBAT_JOBS,
    steps: [
      { key: "relic", label: "A Relic Reborn", stage: "Relic" },
      { key: "relic_oil", label: "Radz-at-Han Quenching Oil", stage: "Relic" },
      { key: "zenith", label: "Zenith", stage: "Zenith" },
      { key: "atma", label: "Atma", stage: "Atma" },
      { key: "animus", label: "Animus (Books)", stage: "Animus" },
      { key: "novus_ink", label: "Superior Enchanted Ink", stage: "Novus" },
      { key: "novus_materia", label: "Materia Melding", stage: "Novus" },
      { key: "nexus", label: "Nexus (Light Farm)", stage: "Nexus" },
      { key: "zodiac_flesh", label: "A Ponze of Flesh", stage: "Zodiac" },
      { key: "zodiac_mother", label: "A Treasured Mother", stage: "Zodiac" },
      { key: "zodiac_love", label: "Labor of Love", stage: "Zodiac" },
      { key: "zodiac_malice", label: "Method in His Malice", stage: "Zodiac" },
      { key: "zeta", label: "Zeta (Mahatma)", stage: "Zeta" },
      { key: "kettle_alexandrite", label: "Alexandrite", stage: "Kettle to the Mettle" },
      { key: "kettle_mist", label: "Thavnairian Mist", stage: "Kettle to the Mettle" },
      { key: "kettle_ex", label: "EX Trial Runs", stage: "Kettle to the Mettle" },
    ],
    materials: [
      { key: "quenching_oil", label: "Radz-at-Han Quenching Oil", perJob: 1, gateStep: "relic_oil" },
      { key: "thav_mist", label: "Thavnairian Mist", perJob: 3, gateStep: "zenith" },
      { key: "atma", label: "Atma", perJob: 12, gateStep: "atma", wikiSlug: "Atma_of_the_Ram" },
      { key: "books", label: "Books of Mythology", perJob: 9, gateStep: "animus", wikiSlug: "Book_of_Skyfire_I" },
      { key: "enc_ink", label: "Superior Enchanted Ink", perJob: 3, gateStep: "novus_ink" },
      { key: "materia", label: "Materia (any grade)", perJob: 75, gateStep: "novus_materia", wikiSlug: "Materia" },
      { key: "alexandrite", label: "Alexandrite", perJob: 75, gateStep: "nexus" },
      { key: "bombard_core", label: "Bombard Core", perJob: 4, gateStep: "zodiac_malice" },
      { key: "sacred_water", label: "Sacred Spring Water", perJob: 4, gateStep: "zodiac_malice" },
      { key: "bronze_crystal", label: "Bronze Lake Crystal", perJob: 1, gateStep: "zodiac_malice" },
      { key: "hq_firewood", label: "HQ Perfect Firewood", perJob: 1, gateStep: "zodiac_malice", wikiSlug: "Perfect_Firewood" },
      { key: "hq_ring", label: "HQ Furnace Ring", perJob: 1, gateStep: "zodiac_malice", wikiSlug: "Furnace_Ring" },
      { key: "brass_kettle", label: "Brass Kettle", perJob: 1, gateStep: "zodiac_malice" },
      { key: "hq_eel_pie", label: "HQ Tailor-made Eel Pie", perJob: 1, gateStep: "zodiac_malice", wikiSlug: "Tailor-made_Eel_Pie" },
      { key: "hq_cloth", label: "HQ Perfect Cloth", perJob: 1, gateStep: "zodiac_malice", wikiSlug: "Perfect_Cloth" },
      { key: "allagan_resin", label: "Allagan Resin", perJob: 1, gateStep: "zodiac_malice" },
      { key: "hq_mortar", label: "HQ Perfect Mortar", perJob: 1, gateStep: "zodiac_malice", wikiSlug: "Perfect_Mortar" },
      { key: "hq_pestle", label: "HQ Perfect Pestle", perJob: 1, gateStep: "zodiac_malice", wikiSlug: "Perfect_Pestle" },
      { key: "furite_sand", label: "Furite Sand", perJob: 1, gateStep: "zodiac_malice" },
      { key: "hq_vellum", label: "HQ Perfect Vellum", perJob: 1, gateStep: "zodiac_malice", wikiSlug: "Perfect_Vellum" },
      { key: "hq_pounce", label: "HQ Perfect Pounce", perJob: 1, gateStep: "zodiac_malice", wikiSlug: "Perfect_Pounce" },
      { key: "mahatma", label: "Mahatma", perJob: 12, gateStep: "zeta", wikiSlug: "Zodiac_Zeta_Weapons/Quest" },
      { key: "poetics", label: "Tomestones of Poetics", perJob: 3575, gateStep: "zeta", isCurrency: true, wikiSlug: "Allagan_Tomestone_of_Poetics" },
      { key: "company_seals", label: "Company Seals", perJob: 80000, gateStep: "zeta", isCurrency: true },
      { key: "allied_seals", label: "Allied Seals", perJob: 3750, gateStep: "zeta", isCurrency: true },
    ],
  },

  // ── HW: Anima Weapons ────────────────────────────────────────────────────
  {
    expansionKey: "hw",
    category: "weapon",
    expansionLabel: "Heavensward",
    categoryLabel: "Anima Weapons",
    jobs: HW_COMBAT_JOBS,
    steps: [
      { key: "animated", label: "Animated (Elemental Crystals)", stage: "Animated" },
      { key: "awoken", label: "Awoken (Dungeons)", stage: "Awoken" },
      { key: "anima_rubber", label: "Enchanted Rubber", stage: "Anima" },
      { key: "anima_coating", label: "Fast-drying Carboncoat", stage: "Anima" },
      { key: "anima_water", label: "Divine Water", stage: "Anima" },
      { key: "anima_catalyst", label: "Fast-acting Allagan Catalyst", stage: "Anima" },
      { key: "hyperconductive", label: "Hyperconductive (Aether Oil)", stage: "Hyperconductive" },
      { key: "reconditioned", label: "Reconditioned (Umbrite & Crystal Sand)", stage: "Reconditioned" },
      { key: "sharpened", label: "Sharpened (Singing Cluster)", stage: "Sharpened" },
      { key: "complete_assembly", label: "Some Assembly Required", stage: "Complete" },
      { key: "complete_trial", label: "Trial Grind", stage: "Complete" },
      { key: "lux", label: "Lux (Archaic Enchanted Ink)", stage: "Lux" },
    ],
    materials: [
      { key: "elem_crystals", label: "Elemental Crystals (each type)", perJob: 6, gateStep: "animated", wikiSlug: "Fire_Crystal" },
      { key: "unid_bone", label: "Unidentifiable Bone", perJob: 10, gateStep: "anima_rubber" },
      { key: "ada_francesca", label: "Adamantite Francesca", perJob: 4, gateStep: "anima_rubber" },
      { key: "unid_shell", label: "Unidentifiable Shell", perJob: 10, gateStep: "anima_coating" },
      { key: "titanium_mirror", label: "Titanium Alloy Mirror", perJob: 4, gateStep: "anima_coating" },
      { key: "unid_ore", label: "Unidentifiable Ore", perJob: 10, gateStep: "anima_water" },
      { key: "dispelling_arrow", label: "Dispelling Arrow", perJob: 4, gateStep: "anima_water" },
      { key: "unid_seeds", label: "Unidentifiable Seeds", perJob: 10, gateStep: "anima_catalyst" },
      { key: "kingcake", label: "Kingcake", perJob: 4, gateStep: "anima_catalyst" },
      { key: "aether_oil", label: "Aether Oil", perJob: 5, gateStep: "hyperconductive" },
      { key: "umbrite", label: "Umbrite", perJob: 60, gateStep: "reconditioned" },
      { key: "crystal_sand", label: "Crystal Sand", perJob: 60, gateStep: "reconditioned" },
      { key: "singing_cluster", label: "Singing Cluster", perJob: 50, gateStep: "sharpened" },
      { key: "pneumite", label: "Pneumite", perJob: 15, gateStep: "complete_assembly" },
      { key: "archaic_ink", label: "Archaic Enchanted Ink", perJob: 1, gateStep: "lux" },
      { key: "poetics", label: "Tomestones of Poetics", perJob: 16250, gateStep: "lux", isCurrency: true, wikiSlug: "Allagan_Tomestone_of_Poetics" },
      { key: "company_seals", label: "Company Seals", perJob: 140000, gateStep: "lux", isCurrency: true },
      { key: "allied_seals", label: "Allied Seals", perJob: 6000, gateStep: "lux", isCurrency: true },
    ],
  },

  // ── SB: Eurekan Weapons ──────────────────────────────────────────────────
  {
    expansionKey: "sb",
    category: "weapon",
    expansionLabel: "Stormblood",
    categoryLabel: "Eurekan Weapons",
    jobs: SB_COMBAT_JOBS,
    steps: [
      { key: "anemos_base", label: "Base Weapon", stage: "Anemos" },
      { key: "anemos_1", label: "Weapon +1", stage: "Anemos" },
      { key: "anemos_2", label: "Weapon +2", stage: "Anemos" },
      { key: "anemos_weapon", label: "Anemos Weapon", stage: "Anemos" },
      { key: "pagos_weapon", label: "Pagos Weapon", stage: "Pagos" },
      { key: "pagos_1", label: "Pagos Weapon +1", stage: "Pagos" },
      { key: "pagos_elemental", label: "Elemental Weapon", stage: "Pagos" },
      { key: "pyros_1", label: "Elemental Weapon +1", stage: "Pyros" },
      { key: "pyros_2", label: "Elemental Weapon +2", stage: "Pyros" },
      { key: "pyros_weapon", label: "Pyros Weapon", stage: "Pyros" },
      { key: "hydatos_weapon", label: "Hydatos Weapon", stage: "Hydatos" },
      { key: "hydatos_1", label: "Hydatos Weapon +1", stage: "Hydatos" },
      { key: "hydatos_complete", label: "Complete Weapon", stage: "Hydatos" },
      { key: "eureka_weapon", label: "Eureka Weapon", stage: "Hydatos" },
      { key: "physeos", label: "Physeos Weapon", stage: "Baldesion Arsenal" },
    ],
    materials: [
      { key: "protean", label: "Protean Crystals", perJob: 1300, gateStep: "anemos_1", wikiSlug: "Protean_Crystal" },
      { key: "pazuzu_feather", label: "Pazuzu's Feather", perJob: 3, gateStep: "anemos_1" },
      { key: "frosted", label: "Frosted Protean Crystals", perJob: 31, gateStep: "anemos_2", wikiSlug: "Frosted_Protean_Crystal" },
      { key: "pagos_crystals", label: "Pagos Crystals", perJob: 500, gateStep: "anemos_weapon", wikiSlug: "Pagos_Crystal" },
      { key: "louhi_ice", label: "Louhi's Ice", perJob: 5, gateStep: "pagos_weapon" },
      { key: "pyros_crystals", label: "Pyros Crystals", perJob: 650, gateStep: "pagos_1", wikiSlug: "Pyros_Crystal" },
      { key: "penth_flame", label: "Penthesilea's Flame", perJob: 5, gateStep: "pyros_1" },
      { key: "hydatos_crystals", label: "Hydatos Crystals", perJob: 350, gateStep: "pyros_2", wikiSlug: "Hydatos_Crystal" },
      { key: "cryst_scale", label: "Crystalline Scale", perJob: 5, gateStep: "pyros_weapon" },
      { key: "eureka_frags", label: "Eureka Fragments", perJob: 100, gateStep: "hydatos_weapon", wikiSlug: "Eureka_Fragment" },
    ],
  },

  // ── SB: Eurekan Armor ────────────────────────────────────────────────────
  {
    expansionKey: "sb",
    category: "armor",
    expansionLabel: "Stormblood",
    categoryLabel: "Eurekan Armor",
    jobs: ARMOR_SLOTS,
    steps: [
      { key: "anemos_base", label: "Base Armor", stage: "Anemos" },
      { key: "anemos_1", label: "Armor +1", stage: "Anemos" },
      { key: "anemos_2", label: "Armor +2", stage: "Anemos" },
      { key: "anemos_armor", label: "Anemos Armor", stage: "Anemos" },
      { key: "pagos_armor", label: "Pagos Armor", stage: "Pagos" },
      { key: "pagos_1", label: "Pagos Armor +1", stage: "Pagos" },
      { key: "pagos_elemental", label: "Elemental Armor", stage: "Pagos" },
      { key: "pyros_1", label: "Elemental Armor +1", stage: "Pyros" },
      { key: "pyros_2", label: "Elemental Armor +2", stage: "Pyros" },
      { key: "pyros_armor", label: "Pyros Armor", stage: "Pyros" },
      { key: "hydatos_armor", label: "Hydatos Armor", stage: "Hydatos" },
      { key: "hydatos_1", label: "Hydatos Armor +1", stage: "Hydatos" },
      { key: "hydatos_complete", label: "Complete Armor", stage: "Hydatos" },
      { key: "eureka_armor", label: "Eureka Armor", stage: "Hydatos" },
      { key: "physeos", label: "Physeos Armor", stage: "Baldesion Arsenal" },
    ],
    // Amounts per armor slot differ — verify against the spreadsheet DoH/DoL sheet
    materials: [
      { key: "protean", label: "Protean Crystals", perJob: 9000, gateStep: "anemos_1", wikiSlug: "Protean_Crystal" },
      { key: "pazuzu_feather", label: "Pazuzu's Feather", perJob: 9, gateStep: "anemos_1" },
      { key: "frosted", label: "Frosted Protean Crystals", perJob: 93, gateStep: "anemos_2", wikiSlug: "Frosted_Protean_Crystal" },
      { key: "pagos_crystals", label: "Pagos Crystals", perJob: 1500, gateStep: "anemos_armor", wikiSlug: "Pagos_Crystal" },
      { key: "louhi_ice", label: "Louhi's Ice", perJob: 15, gateStep: "pagos_armor" },
      { key: "pyros_crystals", label: "Pyros Crystals", perJob: 1950, gateStep: "pagos_1", wikiSlug: "Pyros_Crystal" },
      { key: "penth_flame", label: "Penthesilea's Flame", perJob: 15, gateStep: "pyros_1" },
      { key: "hydatos_crystals", label: "Hydatos Crystals", perJob: 1050, gateStep: "pyros_2", wikiSlug: "Hydatos_Crystal" },
      { key: "cryst_scale", label: "Crystalline Scale", perJob: 15, gateStep: "pyros_armor" },
      { key: "eureka_frags", label: "Eureka Fragments", perJob: 300, gateStep: "hydatos_armor", wikiSlug: "Eureka_Fragment" },
    ],
  },

  // ── ShB: Resistance Weapons ──────────────────────────────────────────────
  {
    expansionKey: "shb",
    category: "weapon",
    expansionLabel: "Shadowbringers",
    categoryLabel: "Resistance Weapons",
    jobs: SHB_COMBAT_JOBS,
    steps: [
      { key: "resistance", label: "Resistance Weapon", stage: "Resistance" },
      { key: "augmented", label: "Augmented Resistance", stage: "Augmented" },
      { key: "recollection", label: "Recollection", stage: "Recollection" },
      { key: "laws_order", label: "Law's Order", stage: "Law's Order" },
      { key: "augmented_laws", label: "Augmented Law's Order", stage: "Law's Order" },
      { key: "blades", label: "Blade's", stage: "Blade's" },
    ],
    materials: [
      { key: "scalepowder", label: "Thavnairian Scalepowder", perJob: 4, gateStep: "resistance" },
      { key: "tortured_mem", label: "Tortured Memories of the Dying", perJob: 20, gateStep: "recollection", wikiSlug: "Tortured_Memory_of_the_Dying" },
      { key: "sorrowful_mem", label: "Sorrowful Memories of the Dying", perJob: 20, gateStep: "recollection", wikiSlug: "Sorrowful_Memory_of_the_Dying" },
      { key: "harrowing_mem", label: "Harrowing Memories of the Dying", perJob: 20, gateStep: "recollection", wikiSlug: "Harrowing_Memory_of_the_Dying" },
      { key: "bitter_mem", label: "Bitter Memories of the Dying", perJob: 6, gateStep: "augmented", wikiSlug: "Bitter_Memory_of_the_Dying" },
      { key: "loathsome_mem", label: "Loathsome Memories of the Dying", perJob: 15, gateStep: "laws_order", wikiSlug: "Loathsome_Memory_of_the_Dying" },
      { key: "timeworn", label: "Timeworn Artifacts", perJob: 15, gateStep: "laws_order", wikiSlug: "Timeworn_Artifact" },
      { key: "raw_emotions", label: "Raw Emotions", perJob: 15, gateStep: "blades", wikiSlug: "Raw_Emotion" },
      { key: "poetics", label: "Tomestones of Poetics", perJob: 1000, gateStep: "blades", isCurrency: true, wikiSlug: "Allagan_Tomestone_of_Poetics" },
    ],
  },

  // ── ShB: Bozjan Armor ────────────────────────────────────────────────────
  {
    expansionKey: "shb",
    category: "armor",
    expansionLabel: "Shadowbringers",
    categoryLabel: "Bozjan Armor",
    jobs: ARMOR_SLOTS,
    steps: [
      { key: "resistance", label: "Resistance Armor", stage: "Resistance" },
      { key: "augmented", label: "Augmented Resistance", stage: "Augmented" },
      { key: "laws_order", label: "Law's Order", stage: "Law's Order" },
    ],
    // Amounts per armor slot — verify against the spreadsheet
    materials: [
      { key: "bozjan_coin", label: "Bozjan Coins", perJob: 3596, gateStep: "laws_order", isCurrency: true, wikiSlug: "Bozjan_Coin" },
      { key: "gold_coin", label: "Gold Coins", perJob: 12, gateStep: "laws_order", isCurrency: true, wikiSlug: "Bozjan_Gold_Coin" },
      { key: "runner_plating", label: "Runner's Plating", perJob: 50, gateStep: "laws_order", wikiSlug: "Runner's_Plating_(Head_Gear)" },
      { key: "platinum_coin", label: "Platinum Coins", perJob: 36, gateStep: "laws_order", isCurrency: true, wikiSlug: "Bozjan_Platinum_Coin" },
    ],
  },

  // ── EW: Manderville Weapons ──────────────────────────────────────────────
  {
    expansionKey: "ew",
    category: "weapon",
    expansionLabel: "Endwalker",
    categoryLabel: "Manderville Weapons",
    jobs: EW_COMBAT_JOBS,
    steps: [
      { key: "manderville", label: "Manderville Weapon", stage: "Manderville" },
      { key: "amazing", label: "Amazing Manderville", stage: "Amazing" },
      { key: "majestic", label: "Majestic Manderville", stage: "Majestic" },
      { key: "mandervillous", label: "Mandervillous", stage: "Mandervillous" },
    ],
    materials: [
      { key: "manderium_met", label: "Manderium Meteorite", perJob: 3, gateStep: "manderville" },
      { key: "comp_chondrite", label: "Complementary Chondrite", perJob: 3, gateStep: "amazing" },
      { key: "amp_achondrite", label: "Amplifying Achondrite", perJob: 3, gateStep: "majestic" },
      { key: "cosmic_cryst", label: "Cosmic Crystallite", perJob: 3, gateStep: "mandervillous" },
      { key: "poetics", label: "Tomestones of Poetics", perJob: 6000, gateStep: "mandervillous", isCurrency: true, wikiSlug: "Allagan_Tomestone_of_Poetics" },
    ],
  },

  // ── DT: Cosmic Weapons ───────────────────────────────────────────────────
  {
    expansionKey: "dt",
    category: "weapon",
    expansionLabel: "Dawntrail",
    categoryLabel: "Cosmic Weapons",
    jobs: DT_COMBAT_JOBS,
    steps: [
      { key: "penumbrae", label: "Penumbrae", stage: "Penumbrae" },
      { key: "umbrae", label: "Umbrae", stage: "Umbrae" },
      { key: "obscurum", label: "Obscurum", stage: "Obscurum" },
      { key: "obscurum_plus", label: "Obscurum+", stage: "Obscurum+" },
    ],
    // Verify exact Arcanite variant names and per-weapon counts against the spreadsheet DT sheet
    materials: [
      { key: "heliometry", label: "Heliometry", perJob: 6000, gateStep: "obscurum_plus", isCurrency: true, wikiSlug: "Allagan_Tomestone_of_Heliometry" },
    ],
  },

  // ── DT: Arcanaut's Armor ─────────────────────────────────────────────────
  {
    expansionKey: "dt",
    category: "armor",
    expansionLabel: "Dawntrail",
    categoryLabel: "Arcanaut's Armor",
    jobs: ARMOR_SLOTS,
    steps: [
      { key: "base", label: "Base Armor", stage: "Base" },
      { key: "plus1", label: "Armor +1", stage: "+1" },
      { key: "plus2", label: "Armor +2", stage: "+2" },
    ],
    // Verify Arcanite Silver/Gold per-slot counts against the spreadsheet DT sheet
    materials: [
      { key: "e_silver", label: "E. Silver Pieces", perJob: 53200, gateStep: "plus2", isCurrency: true, wikiSlug: "Enlightenment_Silver_Piece" },
      { key: "e_gold", label: "E. Gold Pieces", perJob: 33600, gateStep: "plus2", isCurrency: true, wikiSlug: "Enlightenment_Gold_Piece" },
      { key: "aetherspun_silver", label: "Aetherspun Silver", perJob: 21, gateStep: "plus1" },
      { key: "aetherspun_gold", label: "Aetherspun Gold", perJob: 21, gateStep: "plus2" },
    ],
  },

  // ── ARR Tools: Mastercraft / Lucis ───────────────────────────────────────
  {
    expansionKey: "arr",
    category: "tool",
    expansionLabel: "A Realm Reborn",
    categoryLabel: "Mastercraft Tools",
    jobs: DOH_DOL_JOBS,
    steps: [
      { key: "mastercraft", label: "Mastercraft", stage: "Mastercraft" },
      { key: "supra", label: "Supra", stage: "Supra" },
      { key: "lucis", label: "Lucis", stage: "Lucis" },
    ],
    // Verify material amounts against the spreadsheet DoH/DoL sheet
    materials: [
      { key: "darksteel_nugget", label: "Darksteel Nugget", perJob: 3, gateStep: "supra" },
      { key: "hallowed_water", label: "Hallowed Water", perJob: 1, gateStep: "lucis" },
      { key: "fieldcraft_demi", label: "Fieldcraft Demimateria III", perJob: 5, gateStep: "lucis" },
    ],
  },

  // ── ShB Tools: Skysteel / Dragonsung ─────────────────────────────────────
  {
    expansionKey: "shb",
    category: "tool",
    expansionLabel: "Shadowbringers",
    categoryLabel: "Skysteel Tools",
    jobs: DOH_DOL_JOBS,
    steps: [
      { key: "skysteel", label: "Skysteel", stage: "Skysteel" },
      { key: "skysteel_1", label: "Skysteel +1", stage: "Skysteel" },
      { key: "dragonsung", label: "Dragonsung", stage: "Dragonsung" },
      { key: "aug_dragonsung", label: "Augmented Dragonsung", stage: "Dragonsung" },
      { key: "skysung", label: "Skysung", stage: "Skysung" },
      { key: "skybuilders", label: "Skybuilders'", stage: "Skybuilders'" },
    ],
    // Verify amounts against the spreadsheet DoH/DoL sheet
    materials: [
      { key: "skybuilders_mat", label: "Skybuilders' Material", perJob: 100, gateStep: "skybuilders", wikiSlug: "Skybuilders'_Stone" },
      { key: "poetics", label: "Tomestones of Poetics", perJob: 2000, gateStep: "skybuilders", isCurrency: true, wikiSlug: "Allagan_Tomestone_of_Poetics" },
    ],
  },

  // ── EW Tools: Splendorous / Lodestar ─────────────────────────────────────
  {
    expansionKey: "ew",
    category: "tool",
    expansionLabel: "Endwalker",
    categoryLabel: "Splendorous Tools",
    jobs: DOH_DOL_JOBS,
    steps: [
      { key: "splendorous", label: "Splendorous", stage: "Splendorous" },
      { key: "aug_splendorous", label: "Augmented Splendorous", stage: "Splendorous" },
      { key: "crystalline", label: "Crystalline", stage: "Crystalline" },
      { key: "chora_zoi", label: "Chora-Zoi's Crystalline", stage: "Crystalline" },
      { key: "brilliant", label: "Brilliant", stage: "Brilliant" },
      { key: "vrandtic", label: "Vrandtic Visionary's", stage: "Lodestar" },
      { key: "lodestar", label: "Lodestar", stage: "Lodestar" },
    ],
    // Verify amounts against the spreadsheet DoH/DoL sheet
    materials: [
      { key: "immutable_solution", label: "Immutable Solution", perJob: 3, gateStep: "aug_splendorous" },
      { key: "choco_fiber", label: "Chocobo-fat Grease", perJob: 3, gateStep: "crystalline", wikiSlug: null },
      { key: "multifaceted_lens", label: "Multifaceted Alchemic Lens", perJob: 3, gateStep: "chora_zoi", wikiSlug: "Multifaceted_Alchemic" },
      { key: "brilliant_component", label: "Brilliant Component", perJob: 3, gateStep: "brilliant", wikiSlug: "Splendorous_Tools" },
      { key: "customized_part", label: "Customized Part", perJob: 3, gateStep: "lodestar", wikiSlug: "Splendorous_Tools" },
      { key: "poetics", label: "Tomestones of Poetics", perJob: 3000, gateStep: "lodestar", isCurrency: true, wikiSlug: "Allagan_Tomestone_of_Poetics" },
    ],
  },

  // ── DT Tools: Cosmic Tools ───────────────────────────────────────────────
  {
    expansionKey: "dt",
    category: "tool",
    expansionLabel: "Dawntrail",
    categoryLabel: "Cosmic Tools",
    jobs: DOH_DOL_JOBS,
    steps: [
      { key: "proto_v01", label: "Prototype Cosmic v0.1", stage: "Cosmic" },
      { key: "proto_v02", label: "Prototype Cosmic v0.2", stage: "Cosmic" },
      { key: "proto_v03", label: "Prototype Cosmic v0.3", stage: "Cosmic" },
      { key: "proto_v04", label: "Prototype Cosmic v0.4", stage: "Cosmic" },
      { key: "proto_v05", label: "Prototype Cosmic v0.5", stage: "Cosmic" },
      { key: "proto_v06", label: "Prototype Cosmic v0.6", stage: "Cosmic" },
      { key: "proto_v07", label: "Prototype Cosmic v0.7", stage: "Cosmic" },
      { key: "proto_v08", label: "Prototype Cosmic v0.8", stage: "Cosmic" },
      { key: "cosmic", label: "Cosmic", stage: "Cosmic" },
      { key: "cosmic_v11", label: "Cosmic v1.1", stage: "Stellar" },
      { key: "cosmic_v12", label: "Cosmic v1.2", stage: "Stellar" },
      { key: "cosmic_v13", label: "Cosmic v1.3", stage: "Stellar" },
      { key: "cosmic_v14", label: "Cosmic v1.4", stage: "Stellar" },
      { key: "stellar", label: "Stellar", stage: "Stellar" },
      { key: "stellar_v11", label: "Stellar v1.1", stage: "Hyper" },
      { key: "stellar_v12", label: "Stellar v1.2", stage: "Hyper" },
      { key: "hyper", label: "Hyper", stage: "Hyper" },
      { key: "hyper_v11", label: "Hyper v1.1", stage: "Stars" },
      { key: "hyper_v12", label: "Hyper v1.2", stage: "Stars" },
      { key: "stars", label: "Stars", stage: "Stars" },
    ],
    // Verify amounts against the spreadsheet DT/DoH sheet
    materials: [
      { key: "heliometry", label: "Heliometry", perJob: 6000, gateStep: "stars", isCurrency: true, wikiSlug: "Allagan_Tomestone_of_Heliometry" },
    ],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getTrack(
  expansionKey: string,
  category: RelicCategory
): RelicTrack | undefined {
  return RELIC_TRACKS.find(
    (t) => t.expansionKey === expansionKey && t.category === category
  )
}

export function getExpansionTracks(expansionKey: string): RelicTrack[] {
  return RELIC_TRACKS.filter((t) => t.expansionKey === expansionKey)
}

export function getProgressPercent(
  completedSteps: string[],
  steps: RelicStep[]
): number {
  if (steps.length === 0) return 0
  return Math.round((completedSteps.length / steps.length) * 100)
}

/** Unique expansions in display order for the tab bar */
export const EXPANSION_TABS = [
  { key: "arr", label: "ARR" },
  { key: "hw", label: "HW" },
  { key: "sb", label: "SB" },
  { key: "shb", label: "ShB" },
  { key: "ew", label: "EW" },
  { key: "dt", label: "DT" },
] as const

/** Tool tracks only, in expansion order */
export const TOOL_TRACKS = RELIC_TRACKS.filter((t) => t.category === "tool")
