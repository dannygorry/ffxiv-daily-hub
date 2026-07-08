// Applies migration 003 (beast tribe tables) to the remote Supabase project.
// Run with: node scripts/apply-beast-tribe-migration.js
const fs = require("fs")
const path = require("path")

const envPath = path.join(__dirname, "..", ".env.local")
const env = {}
for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
  const match = line.match(/^([^#=\s][^=]*)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim()
}

const SQL = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations", "003_beast_tribe_progress.sql"),
  "utf-8"
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  // Supabase REST API doesn't support arbitrary DDL via PostgREST.
  // Use the management API endpoint if available, or print SQL for manual execution.
  const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!projectRef) {
    console.error("Could not determine project ref from SUPABASE_URL")
    process.exit(1)
  }

  console.log("Applying migration 003 to project:", projectRef)
  console.log()

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({ query: SQL }),
  })

  if (res.ok) {
    console.log("Migration applied successfully!")
    return
  }

  const err = await res.text()
  console.warn("Management API not available or returned an error:", err)
  console.log()
  console.log("━━━ Please run the following SQL manually in your Supabase SQL Editor ━━━")
  console.log()
  console.log(SQL)
}

main().catch(console.error)
