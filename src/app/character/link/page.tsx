import { Navbar } from "@/components/Navbar"
import { LinkCharacterClient } from "./LinkCharacterClient"

export default function LinkCharacterPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <LinkCharacterClient />
    </div>
  )
}
