const XIVAPI_BASE = "https://xivapi.com"

export interface XIVAPICharacterResult {
  ID: number
  Name: string
  Server: string
  Avatar: string
}

export interface XIVAPICharacterDetail {
  Character: {
    ID: number
    Name: string
    Server: string
    DC: string
    Bio: string
    Avatar: string
    Portrait: string
  }
}

export async function searchCharacter(
  name: string,
  server?: string
): Promise<XIVAPICharacterResult[]> {
  const params = new URLSearchParams({ name: name.trim() })
  if (server) params.set("server", server.trim())

  const res = await fetch(`${XIVAPI_BASE}/character/search?${params}`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`XIVAPI search failed: ${res.status}`)
  const data = await res.json()
  return (data.Results ?? []) as XIVAPICharacterResult[]
}

export async function getCharacter(lodestoneId: number): Promise<XIVAPICharacterDetail> {
  const res = await fetch(`${XIVAPI_BASE}/character/${lodestoneId}`, {
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`XIVAPI character fetch failed: ${res.status}`)
  return res.json()
}

export const WORLDS = [
  // Aether
  "Adamantoise","Cactuar","Faerie","Gilgamesh","Jenova","Midgardsormr","Sargatanas","Siren",
  // Crystal
  "Balmung","Brynhildr","Coeurl","Diabolos","Goblin","Malboro","Mateus","Zalera",
  // Primal
  "Behemoth","Excalibur","Exodus","Famfrit","Hyperion","Lamia","Leviathan","Ultros",
  // Dynamis
  "Halicarnassus","Maduin","Marilith","Seraph","Cuchulainn","Golem","Kraken","Rafflesia",
  // Chaos
  "Cerberus","Louisoix","Moogle","Omega","Phantom","Ragnarok","Sagittarius","Spriggan",
  // Light
  "Alpha","Lich","Odin","Phoenix","Raiden","Shiva","Twintania","Zodiark",
  // Shadow
  "Innocence","Pixie","Titania","Tycoon",
  // Elemental
  "Aegis","Atomos","Carbuncle","Garuda","Gungnir","Kujata","Tonberry","Typhon",
  // Gaia
  "Alexander","Bahamut","Durandal","Fenrir","Ifrit","Ridill","Tiamat","Ultima",
  // Mana
  "Anima","Asura","Chocobo","Hades","Ixion","Masamune","Pandaemonium","Titan",
  // Meteor
  "Belias","Mandragora","Ramuh","Shinryu","Unicorn","Valefor","Yojimbo","Zeromus",
  // Materia
  "Bismarck","Ravana","Sephirot","Sophia","Zurvan",
].sort()
