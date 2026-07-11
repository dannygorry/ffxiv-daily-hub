// Ocean Fishing schedule and voyage guide data.
// Indigo schedule algorithm: confirmed from https://ffxiv.pf-n.co/ocean-fishing/about
// Ruby schedule algorithm: confirmed from https://ffxiv.oceanfishing.boats (rubyoceancalculator.js)
// Voyage zone sequences: confirmed from FFXIV wiki + community research
// Spectral trigger fish: confirmed from community data

// ─── Schedule constants ──────────────────────────────────────────────────────

// Indigo: 144-entry pattern cycling every 12 days (source: pf-n.co/ocean-fishing/about)
const PATTERN: string[] = [
  'BD','TD','ND','RD','BS','TS','NS','RS','BN','TN','NN','RN',
  'TD','ND','RD','BS','TS','NS','RS','BN','TN','NN','RN','BD',
  'ND','RD','BS','TS','NS','RS','BN','TN','NN','RN','BD','TD',
  'RD','BS','TS','NS','RS','BN','TN','NN','RN','BD','TD','ND',
  'BS','TS','NS','RS','BN','TN','NN','RN','BD','TD','ND','RD',
  'TS','NS','RS','BN','TN','NN','RN','BD','TD','ND','RD','BS',
  'NS','RS','BN','TN','NN','RN','BD','TD','ND','RD','BS','TS',
  'RS','BN','TN','NN','RN','BD','TD','ND','RD','BS','TS','NS',
  'BN','TN','NN','RN','BD','TD','ND','RD','BS','TS','NS','RS',
  'TN','NN','RN','BD','TD','ND','RD','BS','TS','NS','RS','BN',
  'NN','RN','BD','TD','ND','RD','BS','TS','NS','RS','BN','TN',
  'RN','BD','TD','ND','RD','BS','TS','NS','RS','BN','TN','NN',
]

// Ruby: 144-entry pattern, values 1-9 (source: ffxiv.oceanfishing.boats/rubyoceancalculator.js)
// 1,4,7=Thavnair  2,5,8=One River  3,6,9=Ruby Sea  (1-3=Day final, 4-6=Sunset, 7-9=Night)
const RUBY_PATTERN: number[] = [
  1,2,1,3,4,5,4,6,7,8,7,9,
  2,1,3,4,5,4,6,7,8,7,9,1,
  1,3,4,5,4,6,7,8,7,9,1,2,
  3,4,5,4,6,7,8,7,9,1,2,1,
  4,5,4,6,7,8,7,9,1,2,1,3,
  5,4,6,7,8,7,9,1,2,1,3,4,
  4,6,7,8,7,9,1,2,1,3,4,5,
  6,7,8,7,9,1,2,1,3,4,5,4,
  7,8,7,9,1,2,1,3,4,5,4,6,
  8,7,9,1,2,1,3,4,5,4,6,7,
  7,9,1,2,1,3,4,5,4,6,7,8,
  9,1,2,1,3,4,5,4,6,7,8,7,
]

const OFFSET = 88 // shared by both routes (confirmed from source code of both trackers)
const TWO_HOURS_MS = 7_200_000
const BOARDING_WINDOW_MS = 900_000 // 15 min before departure

// ─── Types ───────────────────────────────────────────────────────────────────

// B=Bloodbrine, N=Northern Strait, R=Rhotano Sea, T=Rothlyt Sound (Indigo Route)
export type VoyageCode = 'B' | 'N' | 'R' | 'T'
export type TimeOfDay = 'Day' | 'Sunset' | 'Night'

export interface BonusFish {
  category: string   // 'Sharks' | 'Octopodes' | 'Jellyfish' | 'Mantas' | 'Crabs' | 'Seadragons' | 'Balloons' | 'Shrimp' | 'Shellfish' | 'Squid' | 'Mantis Shrimp' | 'Prehistoric'
  bait: string       // 'Ragworm' | 'Krill' | 'Plump Worm'
  fish: string[]
  note?: string
}

export interface ZoneStop {
  zoneName: string
  spectralBait: string
  spectralFish: string
  intuitionFish?: string
  intuitionBait?: string
  // "spectral" = only during spectral current; "pre-spectral" = must be done before spectral
  intuitionWindow?: 'spectral' | 'pre-spectral'
  intuitionNote?: string
  bonusFish?: BonusFish[]
}

export interface VoyageData {
  code: VoyageCode
  destination: string
  stops: [ZoneStop, ZoneStop, ZoneStop]
}

export interface OceanFishingWindow {
  departure: Date
  voyageCode: VoyageCode
  destination: string
  timeOfDay: TimeOfDay
  boardingOpen: boolean
  // Ruby Route: 0-8 (value - 1 from RUBY_PATTERN). 0,3,6=Thavnair 1,4,7=OneRiver 2,5,8=RubySea
  rubyVoyageIndex: number
}

// ─── Zone data ───────────────────────────────────────────────────────────────
// Spectral trigger bait and spectral fish are per-zone (time-of-day independent).
// Fisher's Intuition fish require special conditions noted below.

const Z = {
  galadion: {
    zoneName: 'Outer Galadion Bay',
    spectralBait: 'Plump Worm',
    spectralFish: 'Spectral Megalodon',
    intuitionFish: 'Sothis',
    intuitionBait: 'Glowworm',
    intuitionWindow: 'spectral' as const,
    intuitionNote: 'Switch to Glowworm the moment spectral activates. Night only.',
    bonusFish: [
      { category: 'Octopodes', bait: 'Krill',       fish: ['Cyan Octopus', "Merman's Mane"] },
      { category: 'Sharks',    bait: 'Plump Worm',  fish: ['Tarnished Shark', 'Ghost Shark', 'Quicksilver Blade', 'Funnel Shark'] },
    ],
  },
  southern: {
    zoneName: 'The Southern Strait of Merlthor',
    spectralBait: 'Krill',
    spectralFish: 'Spectral Discus',
    bonusFish: [
      { category: 'Jellyfish',  bait: 'Ragworm', fish: ['La Noscean Jelly', 'Sea Nettle'] },
      { category: 'Seadragons', bait: 'Ragworm', fish: ['Shaggy Seadragon', 'Aetheric Seadragon'], note: 'Aetheric Seadragon requires Fisher\'s Intuition' },
      { category: 'Balloons',   bait: 'Krill',   fish: ['Marine Bomb'] },
    ],
  },
  northern: {
    zoneName: 'The Northern Strait of Merlthor',
    spectralBait: 'Ragworm',
    spectralFish: 'Spectral Sea Bo',
    bonusFish: [
      { category: 'Crabs',      bait: 'Ragworm', fish: ['Bartholomew the Chopper', 'Net Crawler'] },
      { category: 'Octopodes',  bait: 'Krill',   fish: ['Mopbeard'] },
      { category: 'Seadragons', bait: 'Ragworm', fish: ['Coral Seadragon'] },
      { category: 'Balloons',   bait: 'Krill',   fish: ['Tripod Fish'] },
    ],
  },
  rhotano: {
    zoneName: 'Open Rhotano Sea',
    spectralBait: 'Plump Worm',
    spectralFish: 'Spectral Bass',
    bonusFish: [
      { category: 'Sharks',    bait: 'Plump Worm', fish: ['Sweeper', 'Executioner', 'Chrome Hammerhead'] },
      { category: 'Jellyfish', bait: 'Krill',       fish: ['Floating Saucer'] },
      { category: 'Balloons',  bait: 'Ragworm',     fish: ['Silencer', 'Lampfish'] },
    ],
  },
  cieldalaes: {
    zoneName: 'Cieldalaes Margin',
    spectralBait: 'Ragworm',
    spectralFish: 'Spectral Butterfly',
    bonusFish: [
      { category: 'Crabs',    bait: 'Krill',      fish: ['Titanshell Crab', 'Tortoiseshell Crab'] },
      { category: 'Mantas',   bait: 'Plump Worm', fish: ['Jetborne Manta', 'Goobbue Ray'] },
      { category: 'Balloons', bait: 'Ragworm',    fish: ['Mythril Boxfish', 'Metallic Boxfish'] },
    ],
  },
  bloodbrine: {
    zoneName: 'Open Bloodbrine Sea',
    spectralBait: 'Krill',
    spectralFish: 'Spectral Eel',
    intuitionFish: 'Seafaring Toad',
    intuitionBait: 'Pill Bug',
    intuitionWindow: 'spectral' as const,
    intuitionNote: 'Switch to Pill Bug during spectral current.',
    bonusFish: [
      { category: 'Crabs',   bait: 'Ragworm',    fish: ['Exterminator', 'Oracular Crab', 'Bloodpolish Crab', 'Thaliak Crab'] },
      { category: 'Mantas',  bait: 'Krill',       fish: ['Skaldminni'] },
      { category: 'Sharks',  bait: 'Plump Worm', fish: ['Quartz Hammerhead'] },
    ],
  },
  rothlyt: {
    zoneName: 'Outer Rothlyt Sound',
    spectralBait: 'Plump Worm',
    spectralFish: 'Spectresaur',
    bonusFish: [
      { category: 'Balloons',  bait: 'Ragworm',    fish: ['Garum Jug', 'Honeycomb Fish', 'Crow Puffer', 'Pearl Bombfish'], note: 'Pearl Bombfish is Krill only' },
      { category: 'Jellyfish', bait: 'Krill',       fish: ['Living Lantern'] },
      { category: 'Mantas',    bait: 'Plump Worm', fish: ['Panoptes'] },
      { category: 'Sharks',    bait: 'Krill',       fish: ['Thavnairian Shark'] },
    ],
  },
} satisfies Record<string, ZoneStop>

// ─── Indigo Route voyage types ────────────────────────────────────────────────
// 3-stop sequences confirmed from FFXIV wiki and community research.
// Letter codes confirmed from pf-n.co/ocean-fishing/about PATTERN.

export const VOYAGES: Record<VoyageCode, VoyageData> = {
  N: {
    code: 'N',
    destination: 'Northern Strait of Merlthor',
    stops: [Z.southern, Z.galadion, Z.northern],
  },
  R: {
    code: 'R',
    destination: 'Rhotano Sea',
    stops: [Z.galadion, Z.southern, Z.rhotano],
  },
  B: {
    code: 'B',
    destination: 'Bloodbrine Sea',
    stops: [Z.cieldalaes, Z.northern, Z.bloodbrine],
  },
  T: {
    code: 'T',
    destination: 'Rothlyt Sound',
    stops: [Z.cieldalaes, Z.rhotano, Z.rothlyt],
  },
}

// ─── Ruby Route data ──────────────────────────────────────────────────────────
// Ruby Route departs every 2 hours simultaneously with Indigo from Limsa Lominsa.
// Zone sequences confirmed from FFXIV wiki. Schedule timing uses a separate
// algorithm not yet documented publicly; voyage types shown for reference.

export interface RubyVoyageData {
  destination: string
  stops: [ZoneStop, ZoneStop, ZoneStop]
}

const RZ = {
  sirensong: {
    zoneName: 'Open Sirensong Sea',
    spectralBait: 'Plump Worm',
    spectralFish: 'Spectral Coelacanth',
    intuitionFish: 'Taniwha',
    intuitionBait: 'Mackerel Strip',
    intuitionWindow: 'spectral' as const,
    intuitionNote: 'Switch to Mackerel Strip during spectral current.',
    bonusFish: [
      { category: 'Shrimp',       bait: 'Krill',      fish: ['Pink Shrimp', 'Vivid Pink Shrimp'] },
      { category: 'Shellfish',     bait: 'Ragworm',   fish: ['Sirensong Mussel', 'Mermaid Scale'] },
      { category: 'Squid',         bait: 'Krill',      fish: ['Arrowhead', 'Broadhead'], note: 'Broadhead prefers Plump Worm' },
      { category: 'Mantis Shrimp', bait: 'Krill',      fish: ['Jade Mantis Shrimp'] },
      { category: 'Prehistoric',   bait: 'Plump Worm', fish: ['Black-jawed Helicoprion'] },
    ],
  },
  kugane: {
    zoneName: 'Kugane Coast',
    spectralBait: 'Ragworm',
    spectralFish: 'Spectral Wrasse',
    bonusFish: [
      { category: 'Shellfish', bait: 'Ragworm',   fish: ['Maelstrom Turban', 'Whirlpool Turban'] },
      { category: 'Shrimp',    bait: 'Ragworm',   fish: ['Silkweft Prawn', 'Leopard Prawn'] },
      { category: 'Squid',     bait: 'Plump Worm', fish: ['Spear Squid', 'Swordtip Squid'] },
    ],
  },
  rubySea: {
    zoneName: 'Open Ruby Sea',
    spectralBait: 'Krill',
    spectralFish: 'Spectral Snake Eel',
    bonusFish: [
      { category: 'Shrimp', bait: 'Ragworm',   fish: ['Barded Lobster', 'Bowbarb Lobster'] },
      { category: 'Squid',  bait: 'Plump Worm', fish: ['Flying Squid', 'Fleeting Squid', 'Reef Squid'], note: 'Reef Squid prefers Krill' },
    ],
  },
  oneRiver: {
    zoneName: 'Lower One River',
    spectralBait: 'Krill',
    spectralFish: 'Spectral Kotsu Zetsu',
    bonusFish: [
      { category: 'Shellfish', bait: 'Ragworm', fish: ['Crowshadow Mussel'] },
      { category: 'Shrimp',    bait: 'Ragworm', fish: ['Singular Shrimp', 'Gensui Shrimp'] },
    ],
  },
  unnamed: {
    zoneName: 'Unnamed Island',
    spectralBait: 'Ragworm',
    spectralFish: 'Spectral Starfish',
    bonusFish: [
      { category: 'Mantis Shrimp', bait: 'Ragworm',   fish: ["Captain's Finger", "First Mate's Finger"] },
      { category: 'Prehistoric',   bait: 'Plump Worm', fish: ['Renegade Rhotanosaurus', 'Tylosaurus', 'Rhotanosaurus', 'Akupara'], note: 'Akupara requires Fisher\'s Intuition' },
    ],
  },
  thavnair: {
    zoneName: 'Thavnair',
    spectralBait: 'Krill',
    spectralFish: 'Spectral Grouper',
    bonusFish: [
      { category: 'Mantis Shrimp', bait: 'Ragworm',   fish: ['Tiger Mantis', 'Great Red Mantis', 'Red Mantis'] },
      { category: 'Prehistoric',   bait: 'Plump Worm', fish: ['Satrapsaurus', 'Simolestes', 'Pliosaurus', 'Thavnasaurus', 'Manasvin'], note: 'Thavnasaurus takes Krill; Manasvin requires a special bait' },
    ],
  },
} satisfies Record<string, ZoneStop>

// Index 0=Thavnair, 1=One River, 2=Ruby Sea  (matches RUBY_PATTERN value groups 1/4/7, 2/5/8, 3/6/9)
export const RUBY_VOYAGES: RubyVoyageData[] = [
  { destination: 'Thavnair',  stops: [RZ.unnamed,   RZ.sirensong, RZ.thavnair] },
  { destination: 'One River', stops: [RZ.sirensong, RZ.kugane,   RZ.oneRiver]  },
  { destination: 'Ruby Sea',  stops: [RZ.sirensong, RZ.kugane,   RZ.rubySea]   },
]

// ─── Schedule functions ───────────────────────────────────────────────────────

const TIME_CODE: Record<string, TimeOfDay> = { D: 'Day', S: 'Sunset', N: 'Night' }

export function getNextOceanFishingWindows(count: number, now: Date): OceanFishingWindow[] {
  const nowMs = now.getTime()
  // The next departure slot is always strictly in the future
  const nextVoyageNumber = Math.floor(nowMs / TWO_HOURS_MS) + 1
  const windows: OceanFishingWindow[] = []

  for (let i = 0; windows.length < count; i++) {
    const vn = nextVoyageNumber + i
    const departureMs = vn * TWO_HOURS_MS
    const code = PATTERN[(OFFSET + vn) % PATTERN.length]
    const voyageCode = code[0] as VoyageCode
    const timeOfDay = TIME_CODE[code[1]]
    const boardingOpen = nowMs >= departureMs - BOARDING_WINDOW_MS
    const rubyVoyageIndex = RUBY_PATTERN[(OFFSET + vn) % RUBY_PATTERN.length] - 1

    windows.push({
      departure: new Date(departureMs),
      voyageCode,
      destination: VOYAGES[voyageCode].destination,
      timeOfDay,
      boardingOpen,
      rubyVoyageIndex,
    })
  }

  return windows
}

export function formatOceanFishingCountdown(window: OceanFishingWindow, now: Date): string {
  const diffMs = window.departure.getTime() - now.getTime()

  if (window.boardingOpen) {
    const sec = Math.max(0, Math.floor(diffMs / 1000))
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `Departs in ${m}:${String(s).padStart(2, '0')}`
  }

  // Time until boarding opens
  const boardMs = diffMs - BOARDING_WINDOW_MS
  const sec = Math.max(0, Math.floor(boardMs / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `Boards in ${h}h ${String(m).padStart(2, '0')}m`
  return `Boards in ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}
