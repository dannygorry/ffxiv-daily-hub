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
      // Lodestone renders race/clan with a <br> between them: "Au Ra<br>Xaela / ♀"
      // cheerio's .text() collapses the <br> to nothing → "Au RaXaela / ♀".
      // Split the raw HTML on <br> to preserve the race/clan boundary.
      const rawHtml = nameEl.html() ?? ""
      const brParts = rawHtml
        .split(/<br\s*\/?>/i)
        .map((p) => load(p).text().trim())
        .filter(Boolean)
      if (brParts.length >= 2) {
        race = brParts[0]
        clan = brParts[1].split("/")[0].trim() // strip trailing " / ♀"
      } else {
        // Fallback: old single-line "Au Ra / Xaela / ♀" format
        const parts = blockText.split("/").map((s) => s.trim())
        race = parts[0] ?? ""
        clan = parts[1] ?? ""
      }
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

  // Eureka Elemental Level / Bozja Resistance Rank
  let eurekaLevel: number | null = null
  let bozjaRank: number | null = null

  // Try structured selectors — class names vary by Lodestone version
  $(".character__level, .character__spec, [class*='character__level']").each((_, el) => {
    const blockText = $(el).text()
    const lower = blockText.toLowerCase()
    const numMatch = blockText.match(/\b(\d+)\b/)
    const num = numMatch ? parseInt(numMatch[1], 10) : null
    if (!num) return
    if ((lower.includes("elemental") || lower.includes("eureka")) && eurekaLevel === null) {
      eurekaLevel = num
    } else if ((lower.includes("resistance rank") || lower.includes("bozja")) && bozjaRank === null) {
      bozjaRank = num
    }
  })

  // Fallback: <dt>Label</dt><dd>N</dd> pattern (Lodestone uses definition lists)
  if (eurekaLevel === null || bozjaRank === null) {
    $("dt").each((_, el) => {
      const label = $(el).text().trim().toLowerCase()
      const dd = $(el).next("dd")
      if (!dd.length) return
      const num = parseInt(dd.text().trim(), 10)
      if (!num || num <= 0) return
      if (label.includes("elemental") && eurekaLevel === null) eurekaLevel = num
      else if (label.includes("resistance rank") && bozjaRank === null) bozjaRank = num
    })
  }

  // Text-scan fallback — inline "Elemental Level 69" or "Resistance Rank 25" format
  if (eurekaLevel === null) {
    $("p, div, span").each((_, el) => {
      if (eurekaLevel !== null) return
      const text = $(el).text().trim()
      const m = text.match(/elemental level[:\s]+(\d+)/i)
      if (m) eurekaLevel = parseInt(m[1], 10)
    })
  }
  if (bozjaRank === null) {
    $("p, div, span").each((_, el) => {
      if (bozjaRank !== null) return
      const text = $(el).text().trim()
      const m = text.match(/resistance rank[:\s]+(\d+)/i)
      if (m) bozjaRank = parseInt(m[1], 10)
    })
  }

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

  return jobs
}

// Fallback totals used when the ffxivcollect.com API is unreachable.
// Update after each major patch if needed.
const FALLBACK_TOTALS = { mount: 375, minion: 494 }

// Fetch current game totals from ffxivcollect.com.
// Next.js caches each response for 24 h so the full list is only downloaded
// once per day regardless of how many Lodestone refreshes happen.
async function fetchGameTotals(): Promise<{ mount: number; minion: number }> {
  const pluck = (data: unknown): number | null => {
    if (!data || typeof data !== "object") return null
    const d = data as Record<string, unknown>
    // DRF-style: { count: N, results: [...] } — N is the TOTAL when no limit is applied
    if (typeof d.count === "number" && d.count > 0) return d.count
    // Some APIs expose a separate total field
    if (typeof d.total === "number" && d.total > 0) return d.total
    // Last resort: length of a results array
    if (Array.isArray(d.results) && d.results.length > 0) return d.results.length
    if (Array.isArray(d) && (d as unknown[]).length > 0) return (d as unknown[]).length
    return null
  }
  try {
    const [mountRes, minionRes] = await Promise.all([
      fetch("https://ffxivcollect.com/api/mounts", { next: { revalidate: 86400 } }),
      fetch("https://ffxivcollect.com/api/minions", { next: { revalidate: 86400 } }),
    ])
    if (!mountRes.ok || !minionRes.ok) return FALLBACK_TOTALS
    const [m, n] = await Promise.all([mountRes.json(), minionRes.json()])
    return {
      mount: pluck(m) ?? FALLBACK_TOTALS.mount,
      minion: pluck(n) ?? FALLBACK_TOTALS.minion,
    }
  } catch {
    return FALLBACK_TOTALS
  }
}

async function scrapeCollection(
  lodestoneId: number,
  type: "mount" | "minion",
  gameTotals: { mount: number; minion: number }
): Promise<[number, number]> {
  const html = await fetchPage(`/character/${lodestoneId}/${type}/`)
  const $ = load(html)

  // Lodestone only renders owned items server-side; the N/M total is injected
  // by JavaScript. Count the owned li items and use the live game total.
  const listClass = type === "mount" ? "mount__list_icon" : "minion__list_icon"
  const owned = $(`li.${listClass}`).length
  return [owned, gameTotals[type]]
}

export async function scrapeLodestoneCardData(
  lodestoneId: number
): Promise<LodestoneCardData> {
  const gameTotals = await fetchGameTotals()
  const [mainData, jobs, mountCounts, minionCounts] = await Promise.all([
    scrapeMainPage(lodestoneId).catch(() => null),
    scrapeClassJobs(lodestoneId).catch(() => [] as JobEntry[]),
    scrapeCollection(lodestoneId, "mount", gameTotals).catch(() => [0, 0] as [number, number]),
    scrapeCollection(lodestoneId, "minion", gameTotals).catch(() => [0, 0] as [number, number]),
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
