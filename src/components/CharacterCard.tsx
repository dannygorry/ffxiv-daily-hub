import { memo } from "react"
import type { LodestoneCardData } from "@/lib/ffxiv/lodestone-card"
import { JOB_DISPLAY_ORDER, type JobRole } from "@/lib/ffxiv/ffxiv-jobs"

export interface CardSettings {
  customPortraitUrl: string | null
  cardAccentColor: string
  showJobGrid: boolean
  showMounts: boolean
  showMinions: boolean
  showEureka: boolean
}

interface CharacterCardProps {
  data: LodestoneCardData
  settings: CardSettings
}

const ROLE_COLORS: Record<JobRole, string> = {
  tank: "#4a90d9",
  healer: "#56b356",
  melee: "#c84b4b",
  physical_ranged: "#a76b2a",
  magical_ranged: "#8b5cf6",
  crafter: "#b8860b",
  gatherer: "#2d8a6e",
  limited: "#6b7280",
}


function proxySrc(url: string) {
  if (!url) return ""
  if (url.startsWith("/api/")) return url
  if (
    url.includes("img2.finalfantasyxiv.com") ||
    url.includes("img.finalfantasyxiv.com") ||
    url.includes("lds-img.finalfantasyxiv.com")
  ) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

function CollectionBar({
  label,
  owned,
  total,
  accent,
}: {
  label: string
  owned: number
  total: number
  accent: string
}) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: "#9ca3af", fontSize: 11, width: 52, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3 }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: accent,
            borderRadius: 3,
          }}
        />
      </div>
      <span style={{ color: "#e5e7eb", fontSize: 11, width: 34, textAlign: "right", flexShrink: 0 }}>
        {pct}%
      </span>
    </div>
  )
}

function JobGrid({ jobs }: { jobs: LodestoneCardData["jobs"] }) {
  const jobMap = new Map(jobs.map((j) => [j.name, j]))

  // Group by role rows
  const rows: Array<{ label: string; role: JobRole; names: string[] }> = [
    { label: "TANK", role: "tank", names: ["Paladin", "Warrior", "Dark Knight", "Gunbreaker"] },
    { label: "HEALER", role: "healer", names: ["White Mage", "Scholar", "Astrologian", "Sage"] },
    {
      label: "MELEE",
      role: "melee",
      names: ["Monk", "Dragoon", "Ninja", "Samurai", "Reaper", "Viper"],
    },
    {
      label: "RANGE",
      role: "physical_ranged",
      names: ["Bard", "Machinist", "Dancer"],
    },
    {
      label: "MAGIC",
      role: "magical_ranged",
      names: ["Black Mage", "Summoner", "Red Mage", "Pictomancer"],
    },
    {
      label: "CRAFT",
      role: "crafter",
      names: ["Carpenter", "Blacksmith", "Armorer", "Goldsmith", "Leatherworker", "Weaver", "Alchemist", "Culinarian"],
    },
    { label: "GATHER", role: "gatherer", names: ["Miner", "Botanist", "Fisher"] },
    { label: "LIMIT", role: "limited", names: ["Blue Mage", "Beastmaster"] },
  ]

  // Keep only rows that have at least one job in the data
  const activeRows = rows.filter((r) => r.names.some((n) => jobMap.has(n)))
  if (activeRows.length === 0) {
    // Fallback: show all jobs from JOB_DISPLAY_ORDER that exist
    const orderedJobs = JOB_DISPLAY_ORDER.flatMap((name) => {
      const j = jobMap.get(name)
      return j ? [j] : []
    })
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {orderedJobs.map((j) => (
          <JobChip key={j.name} job={j} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {activeRows.map((row) => (
        <div key={row.role} style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span
            style={{
              fontSize: 8,
              color: ROLE_COLORS[row.role],
              width: 36,
              flexShrink: 0,
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            {row.label}
          </span>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {row.names.map((name) => {
              const job = jobMap.get(name)
              if (!job) return null
              return <JobChip key={name} job={job} />
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function JobChip({ job }: { job: NonNullable<LodestoneCardData["jobs"][number]> }) {
  const roleColor = ROLE_COLORS[job.role]
  const dim = job.level === 0
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "rgba(255,255,255,0.06)",
        borderRadius: 3,
        padding: "3px 4px 2px",
        minWidth: 30,
        opacity: dim ? 0.35 : 1,
        borderTop: `2px solid ${roleColor}`,
        gap: 1,
      }}
    >
      {job.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxySrc(job.iconUrl)}
          alt={job.name}
          width={20}
          height={20}
          crossOrigin="anonymous"
          style={{ display: "block", imageRendering: "auto" }}
        />
      ) : (
        <span style={{ fontSize: 8, color: "#9ca3af", lineHeight: "20px" }}>
          {job.name.slice(0, 3).toUpperCase()}
        </span>
      )}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: dim ? "#6b7280" : "#f3f4f6",
          lineHeight: 1,
        }}
      >
        {job.level > 0 ? job.level : "--"}
      </span>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
      <span style={{ color: "#6b7280", fontSize: 10, flexShrink: 0, width: 88, paddingTop: 1 }}>
        {label}
      </span>
      <span style={{ color: "#e5e7eb", fontSize: 11, lineHeight: 1.4 }}>{value}</span>
    </div>
  )
}

export const CharacterCard = memo(function CharacterCard({ data, settings }: CharacterCardProps) {
  const {
    customPortraitUrl,
    cardAccentColor: accent,
    showJobGrid,
    showMounts,
    showMinions,
    showEureka,
  } = settings

  const portraitSrc = customPortraitUrl
    ? customPortraitUrl
    : data.portraitUrl
    ? proxySrc(data.portraitUrl)
    : ""

  const hasMounts = showMounts && data.mountsTotal > 0
  const hasMinions = showMinions && data.minionsTotal > 0
  const hasCollections = hasMounts || hasMinions
  const hasJobs = showJobGrid && data.jobs.length > 0
  const hasEureka = showEureka && (data.eurekaLevel != null || data.bozjaRank != null)

  return (
    <div
      style={{
        width: 1080,
        height: 600,
        display: "flex",
        fontFamily: "'Geist Sans', 'Inter', sans-serif",
        background: "#1a1a1a",
        borderRadius: 8,
        overflow: "hidden",
        position: "relative",
        color: "#f3f4f6",
      }}
    >
      {/* Portrait panel */}
      <div
        style={{
          width: 342,
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {portraitSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portraitSrc}
            alt={data.name}
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "top center",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, ${accent}22, #0f172a)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#4b5563", fontSize: 13 }}>No portrait</span>
          </div>
        )}
        {/* Right-edge gradient fade into stats panel */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, transparent 60%, #1a1a1a)",
          }}
        />
        {/* Bottom gradient for readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)",
          }}
        />
      </div>

      {/* Stats panel */}
      <div
        style={{
          flex: 1,
          padding: "20px 20px 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflowY: "hidden",
          background: "rgba(15,15,20,0.7)",
        }}
      >
        {/* Name + title + server */}
        <div>
          {data.title && (
            <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2, letterSpacing: "0.04em" }}>
              {data.title}
            </p>
          )}
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: accent,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {data.name || "Unknown Character"}
          </h1>
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            {data.server}
            {data.dataCenter ? ` (${data.dataCenter})` : ""}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: `${accent}44` }} />

        {/* Character details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <StatRow
            label="Race & Clan"
            value={[data.race, data.clan].filter(Boolean).join(", ") || null}
          />
          <StatRow label="Guardian" value={data.guardian || null} />
          {data.grandCompany && (
            <StatRow
              label="Grand Company"
              value={
                data.grandCompanyRank
                  ? `${data.grandCompany} · ${data.grandCompanyRank}`
                  : data.grandCompany
              }
            />
          )}
          {data.freeCompany && (
            <StatRow
              label="Free Company"
              value={
                data.freeCompanyTag
                  ? `${data.freeCompany} «${data.freeCompanyTag}»`
                  : data.freeCompany
              }
            />
          )}
          {hasEureka && (
            <>
              {data.eurekaLevel != null && (
                <StatRow label="Elemental Lv." value={`Level ${data.eurekaLevel}`} />
              )}
              {data.bozjaRank != null && (
                <StatRow label="Resistance Rank" value={`Rank ${data.bozjaRank}`} />
              )}
            </>
          )}
        </div>

        {/* Collections */}
        {hasCollections && (
          <>
            <div style={{ height: 1, background: `${accent}44` }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {hasMounts && (
                <CollectionBar
                  label="Mounts"
                  owned={data.mountsOwned}
                  total={data.mountsTotal}
                  accent={accent}
                />
              )}
              {hasMinions && (
                <CollectionBar
                  label="Minions"
                  owned={data.minionsOwned}
                  total={data.minionsTotal}
                  accent={accent}
                />
              )}
            </div>
          </>
        )}

        {/* Job grid */}
        {hasJobs && (
          <>
            <div style={{ height: 1, background: `${accent}44` }} />
            <div style={{ flex: 1, overflow: "hidden" }}>
              <JobGrid jobs={data.jobs} />
            </div>
          </>
        )}

        {/* Footer watermark */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "auto",
            paddingTop: 4,
          }}
        >
          <span style={{ fontSize: 9, color: "#374151" }}>FFXIV Hub</span>
        </div>
      </div>
    </div>
  )
})
