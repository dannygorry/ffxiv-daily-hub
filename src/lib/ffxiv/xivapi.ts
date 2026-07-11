const LODESTONE_BASE = "https://na.finalfantasyxiv.com/lodestone"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

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
  const params = new URLSearchParams({ q: name.trim(), order: "0" })
  if (server) params.set("worldname", server.trim())

  const res = await fetch(`${LODESTONE_BASE}/character/?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Lodestone search failed: ${res.status}`)

  const html = await res.text()
  const results: XIVAPICharacterResult[] = []

  // Each result is a <div class="entry">
  const entries = html.split('<div class="entry">')
  for (const entry of entries.slice(1)) {
    const idMatch = entry.match(/href="\/lodestone\/character\/(\d+)\//)
    const nameMatch = entry.match(/class="entry__name">([^<]+)</)
    // <p class="entry__world"><i class="..."></i>WorldName [DC]</p>
    const serverMatch = entry.match(/class="entry__world"[^>]*>[\s\S]*?<\/i>([^<]+)</)
    // Avatar img is inside <div class="entry__chara__face"><img src="...">
    const avatarMatch = entry.match(/class="entry__chara__face"[^>]*>\s*<img[^>]+src="([^"]+)"/)

    if (idMatch && nameMatch && serverMatch && avatarMatch) {
      results.push({
        ID: parseInt(idMatch[1], 10),
        Name: nameMatch[1].trim(),
        Server: serverMatch[1].trim(),
        Avatar: avatarMatch[1],
      })
    }
  }

  return results
}

export async function getCharacter(lodestoneId: number): Promise<XIVAPICharacterDetail> {
  const res = await fetch(`${LODESTONE_BASE}/character/${lodestoneId}/`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Lodestone character fetch failed: ${res.status}`)

  const html = await res.text()

  // Greedy match so nested </div> tags inside the bio don't truncate the capture.
  // The bio is user plain-text; the outer div is the first element of that class.
  const bioMatch = html.match(/class="character__selfintroduction">([\s\S]*?)<\/p>\s*<\/div>/) ??
                   html.match(/class="character__selfintroduction">([\s\S]*?)<\/div>/)
  const bio = bioMatch ? bioMatch[1].replace(/<[^>]+>/g, "").trim() : ""

  // First Lodestone face image URL
  const avatarMatch = html.match(/src="(https:\/\/img2\.finalfantasyxiv\.com\/f\/[^"]+)"/)
  const avatar = avatarMatch ? avatarMatch[1] : ""

  return {
    Character: {
      ID: lodestoneId,
      Name: "",
      Server: "",
      DC: "",
      Bio: bio,
      Avatar: avatar,
      Portrait: "",
    },
  }
}

export const DATA_CENTERS: Record<string, string[]> = {
  Aether:    ["Adamantoise","Cactuar","Faerie","Gilgamesh","Jenova","Midgardsormr","Sargatanas","Siren"],
  Crystal:   ["Balmung","Brynhildr","Coeurl","Diabolos","Goblin","Malboro","Mateus","Zalera"],
  Primal:    ["Behemoth","Excalibur","Exodus","Famfrit","Hyperion","Lamia","Leviathan","Ultros"],
  Dynamis:   ["Halicarnassus","Maduin","Marilith","Seraph","Cuchulainn","Golem","Kraken","Rafflesia"],
  Chaos:     ["Cerberus","Louisoix","Moogle","Omega","Phantom","Ragnarok","Sagittarius","Spriggan"],
  Light:     ["Alpha","Lich","Odin","Phoenix","Raiden","Shiva","Twintania","Zodiark"],
  Shadow:    ["Innocence","Pixie","Titania","Tycoon"],
  Elemental: ["Aegis","Atomos","Carbuncle","Garuda","Gungnir","Kujata","Tonberry","Typhon"],
  Gaia:      ["Alexander","Bahamut","Durandal","Fenrir","Ifrit","Ridill","Tiamat","Ultima"],
  Mana:      ["Anima","Asura","Chocobo","Hades","Ixion","Masamune","Pandaemonium","Titan"],
  Meteor:    ["Belias","Mandragora","Ramuh","Shinryu","Unicorn","Valefor","Yojimbo","Zeromus"],
  Materia:   ["Bismarck","Ravana","Sephirot","Sophia","Zurvan"],
}

export const REGIONS = [
  { name: "North America", dcs: ["Aether","Crystal","Primal","Dynamis"] },
  { name: "Europe",        dcs: ["Chaos","Light","Shadow"] },
  { name: "Japan",         dcs: ["Elemental","Gaia","Mana","Meteor"] },
  { name: "Oceania",       dcs: ["Materia"] },
]

export const WORLDS = Object.values(DATA_CENTERS).flat().sort()
