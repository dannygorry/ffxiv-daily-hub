// Run with: node scripts/update-roulette-names.js
const fs = require("fs")
const path = require("path")

const envPath = path.join(__dirname, "..", ".env.local")
const env = {}
for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
  const match = line.match(/^([^#=\s][^=]*)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim()
}

const { createClient } = require("@supabase/supabase-js")
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const RENAMES = [
  { from: "Duty Roulette: Expert",                    to: "Expert" },
  { from: "Duty Roulette: Level 90 Dungeons",         to: "Level Cap Dungeons" },
  { from: "Duty Roulette: Level 50/60/70/80 Dungeons",to: "High-level Dungeons" },
  { from: "Duty Roulette: Leveling",                  to: "Leveling" },
  { from: "Duty Roulette: Main Scenario",             to: "Main Scenario" },
  { from: "Duty Roulette: Trials",                    to: "Trials" },
  { from: "Duty Roulette: Alliance Raids",            to: "Alliance Raids" },
  { from: "Duty Roulette: Normal Raids",              to: "Normal Raids" },
  { from: "Duty Roulette: Frontline",                 to: "Frontline" },
  { from: "Duty Roulette: Guildhest",                 to: "Guildhests" },
  { from: "Duty Roulette: Mentor",                    to: "Mentor" },
]

async function main() {
  console.log("Updating duty roulette names...\n")
  for (const { from, to } of RENAMES) {
    const { error } = await supabase.from("checklist_items").update({ name: to }).eq("name", from)
    console.log(error ? `  FAILED  ${from} → ${to}: ${error.message}` : `  OK      ${to}`)
  }
  console.log("\nDone!")
}

main().catch(console.error)
