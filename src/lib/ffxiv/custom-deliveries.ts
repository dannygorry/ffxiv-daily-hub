export const DELIVERIES_PER_CLIENT = 6
export const WEEKLY_DELIVERY_CAP = 12

export interface CustomDeliveryClient {
  key: string
  name: string
  expansion: string    // spoiler key
  displayGroup: string // column key
  maxSatisfaction: number
}

export const CUSTOM_DELIVERY_CLIENTS: CustomDeliveryClient[] = [
  // Stormblood
  { key: "zhloe",      name: "Zhloe Aliapoh", expansion: "sb41",  displayGroup: "sb",  maxSatisfaction: 5 },
  { key: "mnaago",     name: "M'naago",        expansion: "sb42",  displayGroup: "sb",  maxSatisfaction: 5 },
  { key: "kurenai",    name: "Kurenai",         expansion: "sb43",  displayGroup: "sb",  maxSatisfaction: 5 },
  { key: "adkiragh",   name: "Adkiragh",        expansion: "sb44",  displayGroup: "sb",  maxSatisfaction: 5 },
  // Shadowbringers
  { key: "kai-shirr",  name: "Kai-Shirr",       expansion: "shb52", displayGroup: "shb", maxSatisfaction: 5 },
  { key: "ehll-tou",   name: "Ehll Tou",        expansion: "shb53", displayGroup: "shb", maxSatisfaction: 5 },
  { key: "charlemend", name: "Charlemend",       expansion: "shb54", displayGroup: "shb", maxSatisfaction: 5 },
  // Endwalker
  { key: "margrat",    name: "Margrat",          expansion: "ew61",  displayGroup: "ew",  maxSatisfaction: 5 },
  { key: "anden",      name: "Anden",            expansion: "ew62",  displayGroup: "ew",  maxSatisfaction: 5 },
  { key: "ameliance",  name: "Ameliance",        expansion: "ew63",  displayGroup: "ew",  maxSatisfaction: 5 },
  { key: "debroye",    name: "Debroye",          expansion: "ew64",  displayGroup: "ew",  maxSatisfaction: 5 },
  // Dawntrail
  { key: "nitowikwe",  name: "Nitowikwe",        expansion: "dt71",  displayGroup: "dt",  maxSatisfaction: 5 },
]

export const DISPLAY_GROUPS: { id: string; label: string }[] = [
  { id: "sb",  label: "Stormblood" },
  { id: "shb", label: "Shadowbringers" },
  { id: "ew",  label: "Endwalker" },
  { id: "dt",  label: "Dawntrail" },
]

export const SATISFACTION_COLORS: Record<number, string> = {
  1: "bg-secondary text-secondary-foreground",
  2: "bg-sky-500/40 text-sky-200",
  3: "bg-green-500/40 text-green-200",
  4: "bg-amber-500/40 text-amber-200",
  5: "bg-yellow-500/40 text-yellow-200",
}

export const SATISFACTION_LABELS: Record<number, string> = {
  1: "Acquaintance",
  2: "Recognized",
  3: "Trusted",
  4: "Befriended",
  5: "Satisfied",
}

export function maskToDeliveryCount(mask: number): number {
  return [0, 1, 2, 3, 4, 5].filter((i) => (mask >> i) & 1).length
}
