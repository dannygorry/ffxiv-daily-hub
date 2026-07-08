export interface ChecklistItem {
  id: string
  name: string
  description?: string
  category: "daily" | "weekly"
  subcategory: string
  sort_order: number
  is_active: boolean
}

export const DAILY_ITEMS: Omit<ChecklistItem, "id" | "is_active">[] = [
  // Duty Roulettes
  { name: "Expert", description: "High-level tomestones", category: "daily", subcategory: "duty_roulette", sort_order: 10 },
  { name: "Level Cap Dungeons", description: "Level cap dungeons", category: "daily", subcategory: "duty_roulette", sort_order: 20 },
  { name: "High-level Dungeons", description: "", category: "daily", subcategory: "duty_roulette", sort_order: 30 },
  { name: "Leveling", description: "Exp bonus", category: "daily", subcategory: "duty_roulette", sort_order: 40 },
  { name: "Main Scenario", description: "Tomestones + exp", category: "daily", subcategory: "duty_roulette", sort_order: 50 },
  { name: "Trials", description: "", category: "daily", subcategory: "duty_roulette", sort_order: 60 },
  { name: "Alliance Raids", description: "Tomestones bonus", category: "daily", subcategory: "duty_roulette", sort_order: 70 },
  { name: "Normal Raids", description: "", category: "daily", subcategory: "duty_roulette", sort_order: 80 },
  { name: "Frontline", description: "Wolf Marks + PvP EXP", category: "daily", subcategory: "duty_roulette", sort_order: 90 },
  { name: "Guildhests", description: "", category: "daily", subcategory: "duty_roulette", sort_order: 100 },
  { name: "Mentor", description: "Requires Mentor status", category: "daily", subcategory: "duty_roulette", sort_order: 110 },
  // Cactpot
  { name: "Mini Cactpot 1/3", description: "Buy a scratch ticket at the Cactpot Broker", category: "daily", subcategory: "cactpot", sort_order: 200 },
  { name: "Mini Cactpot 2/3", description: "Buy a scratch ticket at the Cactpot Broker", category: "daily", subcategory: "cactpot", sort_order: 210 },
  { name: "Mini Cactpot 3/3", description: "Buy a scratch ticket at the Cactpot Broker", category: "daily", subcategory: "cactpot", sort_order: 220 },
  // Hunts
  { name: "Daily Hunt Bills", description: "3 hunts from your Grand Company", category: "daily", subcategory: "hunt", sort_order: 300 },
  // Beast Tribes
  { name: "Beast Tribe: Amalj'aa", description: "3 quests (ARR)", category: "daily", subcategory: "beast_tribe", sort_order: 400 },
  { name: "Beast Tribe: Sylph", description: "3 quests (ARR)", category: "daily", subcategory: "beast_tribe", sort_order: 410 },
  { name: "Beast Tribe: Kobold", description: "3 quests (ARR)", category: "daily", subcategory: "beast_tribe", sort_order: 420 },
  { name: "Beast Tribe: Sahagin", description: "3 quests (ARR)", category: "daily", subcategory: "beast_tribe", sort_order: 430 },
  { name: "Beast Tribe: Ixal", description: "3 quests (ARR, Crafters)", category: "daily", subcategory: "beast_tribe", sort_order: 440 },
  { name: "Beast Tribe: Vanu Vanu", description: "3 quests (HW)", category: "daily", subcategory: "beast_tribe", sort_order: 450 },
  { name: "Beast Tribe: Vath", description: "3 quests (HW)", category: "daily", subcategory: "beast_tribe", sort_order: 460 },
  { name: "Beast Tribe: Moogles", description: "3 quests (HW, Crafters)", category: "daily", subcategory: "beast_tribe", sort_order: 470 },
  { name: "Beast Tribe: Kojin", description: "3 quests (SB)", category: "daily", subcategory: "beast_tribe", sort_order: 480 },
  { name: "Beast Tribe: Ananta", description: "3 quests (SB)", category: "daily", subcategory: "beast_tribe", sort_order: 490 },
  { name: "Beast Tribe: Namazu", description: "3 quests (SB, DoH/DoL)", category: "daily", subcategory: "beast_tribe", sort_order: 500 },
  { name: "Beast Tribe: Pixie", description: "3 quests (ShB)", category: "daily", subcategory: "beast_tribe", sort_order: 510 },
  { name: "Beast Tribe: Qitari", description: "3 quests (ShB, DoH/DoL)", category: "daily", subcategory: "beast_tribe", sort_order: 520 },
  { name: "Beast Tribe: Dwarf", description: "3 quests (ShB, Crafters)", category: "daily", subcategory: "beast_tribe", sort_order: 530 },
  { name: "Beast Tribe: Arkasodara", description: "3 quests (EW)", category: "daily", subcategory: "beast_tribe", sort_order: 540 },
  { name: "Beast Tribe: Omicron", description: "3 quests (EW, DoH/DoL)", category: "daily", subcategory: "beast_tribe", sort_order: 550 },
  { name: "Beast Tribe: Loporrits", description: "3 quests (EW, Crafters)", category: "daily", subcategory: "beast_tribe", sort_order: 560 },
  { name: "Beast Tribe: Pelupelu", description: "3 quests (DT)", category: "daily", subcategory: "beast_tribe", sort_order: 570 },
  { name: "Beast Tribe: Moblins", description: "3 quests (DT, DoH/DoL)", category: "daily", subcategory: "beast_tribe", sort_order: 580 },
  { name: "Beast Tribe: Rroneek", description: "3 quests (DT)", category: "daily", subcategory: "beast_tribe", sort_order: 590 },
  // Other
  { name: "Custom Deliveries", description: "Up to 6 HQ deliveries to your client", category: "daily", subcategory: "other", sort_order: 700 },
  { name: "Squadron Mission", description: "Send your squadron on a mission", category: "daily", subcategory: "other", sort_order: 710 },
  { name: "GC Expert Delivery", description: "Turn in HQ items for seals", category: "daily", subcategory: "other", sort_order: 720 },
]

export const WEEKLY_ITEMS: Omit<ChecklistItem, "id" | "is_active">[] = [
  // Raids
  { name: "Alliance Raid (Tomestone Bonus)", description: "Weekly tomestone bonus from alliance raid", category: "weekly", subcategory: "raids", sort_order: 10 },
  { name: "Normal Raid: Floor 1", description: "Weekly loot lockout", category: "weekly", subcategory: "raids", sort_order: 20 },
  { name: "Normal Raid: Floor 2", description: "Weekly loot lockout", category: "weekly", subcategory: "raids", sort_order: 30 },
  { name: "Normal Raid: Floor 3", description: "Weekly loot lockout", category: "weekly", subcategory: "raids", sort_order: 40 },
  { name: "Normal Raid: Floor 4", description: "Weekly loot lockout", category: "weekly", subcategory: "raids", sort_order: 50 },
  { name: "Savage Raid: Floor 1", description: "Weekly loot lockout", category: "weekly", subcategory: "raids", sort_order: 60 },
  { name: "Savage Raid: Floor 2", description: "Weekly loot lockout", category: "weekly", subcategory: "raids", sort_order: 70 },
  { name: "Savage Raid: Floor 3", description: "Weekly loot lockout", category: "weekly", subcategory: "raids", sort_order: 80 },
  { name: "Savage Raid: Floor 4", description: "Weekly loot lockout", category: "weekly", subcategory: "raids", sort_order: 90 },
  // Cactpot
  { name: "Jumbo Cactpot", description: "Buy a Jumbo Cactpot ticket (drawn Saturday 20:00 JST)", category: "weekly", subcategory: "cactpot", sort_order: 200 },
  // Other
  { name: "Wondrous Tails Book", description: "Complete your Wondrous Tails book (16 stickers)", category: "weekly", subcategory: "other", sort_order: 300 },
  { name: "Weekly Hunt Bills", description: "S-rank and A-rank weekly marks", category: "weekly", subcategory: "hunt", sort_order: 310 },
  { name: "Challenge Log", description: "Complete challenges for bonus EXP and rewards", category: "weekly", subcategory: "other", sort_order: 320 },
  { name: "Treasure Maps", description: "Dig up your treasure maps", category: "weekly", subcategory: "other", sort_order: 330 },
  { name: "Custom Deliveries (Weekly Cap)", description: "12 deliveries per week across all clients", category: "weekly", subcategory: "other", sort_order: 340 },
]

export const SUBCATEGORY_LABELS: Record<string, string> = {
  duty_roulette: "Duty Roulettes",
  cactpot: "Cactpot",
  hunt: "Hunts",
  beast_tribe: "Beast Tribes",
  raids: "Raids",
  other: "Other",
}
