import { load } from "cheerio"
import { JOB_ROLES, BASE_CLASS_TO_JOB, type JobRole } from "./ffxiv-jobs"

export type { JobRole }

const LODESTONE_BASE = "https://na.finalfantasyxiv.com/lodestone"
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

export interface JobEntry {
  name: string
  level: number
  role: JobRole
  iconUrl: string
}

export interface LodestoneCardData {
  name: string
  title: string | null
  server: string
  dataCenter: string
  portraitUrl: string
  race: string
  clan: string
  guardian: string
  grandCompany: string | null
  grandCompanyRank: string | null
  freeCompany: string | null
  freeCompanyTag: string | null
  jobs: JobEntry[]
  mountsOwned: number
  mountsTotal: number
  minionsOwned: number
  minionsTotal: number
  eurekaLevel: number | null
  bozjaRank: number | null
}

async function fetchPage(path: string): Promise<string> {
  const res = await fetch(`${LODESTONE_BASE}${path}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Lodestone fetch failed: ${res.status} for ${path}`)
  return res.text()
}

function parseCount(text: string): [number, number] {
  const m = text.match(/(\d+)\s*\/\s*(\d+)/)
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)]
  return [0, 0]
}

async function scrapeMainPage(lodestoneId: number) {
  const html = await fetchPage(`/character/${lodestoneId}/`)
  const $ = load(html)

  const name = $("p.frame__chara__name").first().text().trim()
  const title = $("p.frame__chara__title").first().text().trim() || null

  // Server text is like "Brynhildr [Crystal]" — strip the icon element first
  const worldEl = $("p.frame__chara__world").first()
  worldEl.find("i").remove()
  const worldText = worldEl.text().trim()
  const serverMatch = worldText.match(/^([^\[]+)\s*\[([^\]]+)\]/)
  const server = serverMatch ? serverMatch[1].trim() : worldText
  const dataCenter = serverMatch ? serverMatch[2].trim() : ""

  // Full portrait URL — the big portrait has _gt.jpg in its src
  let portraitUrl = ""
  $("img").each((_, el) => {
    const src = $(el).attr("src") ?? ""
    if (src.includes("img2.finalfantasyxiv.com") && src.includes("_gt.jpg") && !portraitUrl) {
      portraitUrl = src
    }
  })
  // Fallback: first img2.finalfantasyxiv.com/f/ image
  if (!portraitUrl) {
    $("img").each((_, el) => {
      const src = $(el).attr("src") ?? ""
      if (src.includes("img2.finalfantasyxiv.com/f/") && !portraitUrl) {
        portraitUrl = src
      }
    })
  }

  // Character attribute blocks: iterate over character-block elements
  let race = "", clan = "", guardian = ""
  let grandCompany: string | null = null, grandCompanyRank: string | null = null

  $(".character-block").each((_, el) => {
    const titleEl = $(el).find(".character-block__title").first()
    const nameEl = $(el).find(".character-block__name").first()
    const blockTitle = titleEl.text().trim().toLowerCase()
    const blockText = nameEl.text().trim()

    if (blockTitle.includes("race") || blockTitle.includes("clan")) {
      // "Au Ra / Xaela / ♀" — split by /
      const parts = blockText.split("/").map((s) => s.trim())
      race = parts[0] ?? ""
      clan = parts[1] ?? ""
    } else if (blockTitle.includes("guardian")) {
      guardian = blockText
    } else if (blockTitle.includes("grand company")) {
      // "Maelstrom/First Storm Lieutenant"
      const gcParts = blockText.split("/")
      grandCompany = gcParts[0]?.trim() ?? null
      grandCompanyRank = gcParts[1]?.trim() ?? null
    }
  })

  // Free Company — link text is "Company Name «TAG»"
  let freeCompany: string | null = null
  let freeCompanyTag: string | null = null
  const fcLink = $(".character__freecompany__name a").first()
  if (fcLink.length) {
    const fcText = fcLink.text().trim()
    const fcMatch = fcText.match(/^(.+?)\s*«([^»]+)»\s*$/)
    if (fcMatch) {
      freeCompany = fcMatch[1].trim()
      freeCompanyTag = fcMatch[2].trim()
    } else {
      freeCompany = fcText
    }
  }

  // Eureka Elemental Level — shown in a special section
  let eurekaLevel: number | null = null
  let bozjaRank: number | null = null
  $(".character__spec").each((_, el) => {
    const specTitle = $(el).find(".character__spec__title, h3, .title").text().trim().toLowerCase()
    const specLevel = $(el).find(".character__spec__level, .level").text().trim()
    if (specTitle.includes("eureka") || specTitle.includes("elemental")) {
      eurekaLevel = parseInt(specLevel, 10) || null
    } else if (specTitle.includes("bozja") || specTitle.includes("resistance")) {
      bozjaRank = parseInt(specLevel, 10) || null
    }
  })

  return {
    name,
    title,
    server,
    dataCenter,
    portraitUrl,
    race,
    clan,
    guardian,
    grandCompany,
    grandCompanyRank,
    freeCompany,
    freeCompanyTag,
    eurekaLevel,
    bozjaRank,
  }
}

async function scrapeClassJobs(lodestoneId: number): Promise<JobEntry[]> {
  const html = await fetchPage(`/character/${lodestoneId}/class_job/`)
  const $ = load(html)
  const jobs: JobEntry[] = []

  // Correct selector based on Lodestone HTML: <ul class="character__job clearfix"><li>
  $("ul.character__job li").each((_, el) => {
    // Name is in .character__job__name or its data-tooltip attribute
    const nameEl = $(el).find(".character__job__name")
    const rawName = (nameEl.attr("data-tooltip") ?? nameEl.text()).trim()
    if (!rawName) return

    // Lodestone combines job + base class: "Paladin / Gladiator" → take the job part
    let name = rawName.includes(" / ") ? rawName.split(" / ")[0].trim() : rawName
    // Strip " (Limited Job)" suffix from limited jobs
    name = name.replace(/\s*\(Limited Job\)\s*$/, "").trim()
    // If only the base class was scraped (no job stone), map to the job name
    name = BASE_CLASS_TO_JOB[name] ?? name

    const levelText = $(el).find(".character__job__level").text().trim()
    // "-" means the job is not yet leveled — show as 0, don't skip
    const level = levelText === "-" || levelText === "--" ? 0 : (parseInt(levelText, 10) || 0)

    // Icons are usually a CSS background-image on the div, not an <img> tag
    const iconEl = $(el).find(".character__job__icon")
    let iconUrl = iconEl.find("img").attr("src") ?? ""
    if (!iconUrl) {
      const style = iconEl.attr("style") ?? ""
      const m = style.match(/url\(["']?([^"')]+)["']?\)/)
      if (m) iconUrl = m[1]
    }
    const role: JobRole = JOB_ROLES[name] ?? "melee"
    jobs.push({ name, level, role, iconUrl })
  })

  console.log("[lodestone-card] scraped jobs:", jobs.map((j) => `${j.name}(${j.level})`).join(", "))
  return jobs
}

async function scrapeCollection(
  lodestoneId: number,
  type: "mount" | "minion"
): Promise<[number, number]> {
  const html = await fetchPage(`/character/${lodestoneId}/${type}/`)
  const $ = load(html)

  // Look for "X / Y" pattern in the heading or a count element
  let owned = 0, total = 0

  // Try dedicated count element first
  const countEl = $(".character__collection__count, .total, .count").first()
  if (countEl.length) {
    ;[owned, total] = parseCount(countEl.text())
  }

  // Fallback: scan all text for "digits / digits" pattern
  if (total === 0) {
    $("h1, h2, h3, p").each((_, el) => {
      const text = $(el).text()
      if (text.match(/\d+\s*\/\s*\d+/) && total === 0) {
        ;[owned, total] = parseCount(text)
      }
    })
  }

  // Last resort: count the actual items listed
  if (total === 0) {
    const items = $(".mount__list li, .minion__list li, .character__minion li, .character__mount li").length
    if (items > 0) {
      owned = items
      total = items
    }
  }

  return [owned, total]
}

export async function scrapeLodestoneCardData(
  lodestoneId: number
): Promise<LodestoneCardData> {
  const [mainData, jobs, mountCounts, minionCounts] = await Promise.all([
    scrapeMainPage(lodestoneId).catch(() => null),
    scrapeClassJobs(lodestoneId).catch(() => [] as JobEntry[]),
    scrapeCollection(lodestoneId, "mount").catch(() => [0, 0] as [number, number]),
    scrapeCollection(lodestoneId, "minion").catch(() => [0, 0] as [number, number]),
  ])

  return {
    name: mainData?.name ?? "",
    title: mainData?.title ?? null,
    server: mainData?.server ?? "",
    dataCenter: mainData?.dataCenter ?? "",
    portraitUrl: mainData?.portraitUrl ?? "",
    race: mainData?.race ?? "",
    clan: mainData?.clan ?? "",
    guardian: mainData?.guardian ?? "",
    grandCompany: mainData?.grandCompany ?? null,
    grandCompanyRank: mainData?.grandCompanyRank ?? null,
    freeCompany: mainData?.freeCompany ?? null,
    freeCompanyTag: mainData?.freeCompanyTag ?? null,
    jobs,
    mountsOwned: mountCounts[0],
    mountsTotal: mountCounts[1],
    minionsOwned: minionCounts[0],
    minionsTotal: minionCounts[1],
    eurekaLevel: mainData?.eurekaLevel ?? null,
    bozjaRank: mainData?.bozjaRank ?? null,
  }
}
