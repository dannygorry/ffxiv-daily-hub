// Run with: node scripts/seed-test-users.js
const fs = require("fs")
const path = require("path")

// Parse .env.local
const envPath = path.join(__dirname, "..", ".env.local")
const env = {}
for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
  const match = line.match(/^([^#=\s][^=]*)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim()
}

const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TEST_PASSWORD = "TestPassword123!"

const USERS = [
  { email: "test-nochar1@ffxiv-test.local" },
  { email: "test-nochar2@ffxiv-test.local" },
  {
    email: "test-char1@ffxiv-test.local",
    character: {
      lodestone_id: 12345678,
      name: "Aether Wyrmblood",
      server: "Balmung",
      data_center: "Crystal",
      avatar_url: null,
      verified: true,
      is_primary: true,
    },
  },
  {
    email: "test-char2@ffxiv-test.local",
    character: {
      lodestone_id: 87654321,
      name: "Luna Starfall",
      server: "Gilgamesh",
      data_center: "Aether",
      avatar_url: null,
      verified: true,
      is_primary: true,
    },
  },
]

async function main() {
  console.log("Creating test accounts...\n")

  for (const user of USERS) {
    process.stdout.write(`  ${user.email} ... `)

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    })

    if (error) {
      console.log(`FAILED — ${error.message}`)
      continue
    }

    const userId = data.user.id

    if (user.character) {
      const { error: charError } = await supabase.from("characters").insert({
        user_id: userId,
        ...user.character,
      })

      if (charError) {
        console.log(`created (user OK, character FAILED — ${charError.message})`)
        continue
      }

      console.log(`created + character linked (${user.character.name} @ ${user.character.server})`)
    } else {
      console.log("created (no character)")
    }
  }

  console.log(`
Done! All accounts use password: ${TEST_PASSWORD}

  test-nochar1@ffxiv-test.local  — no character
  test-nochar2@ffxiv-test.local  — no character
  test-char1@ffxiv-test.local    — Aether Wyrmblood @ Balmung (Crystal)
  test-char2@ffxiv-test.local    — Luna Starfall @ Gilgamesh (Aether)
`)
}

main().catch(console.error)
