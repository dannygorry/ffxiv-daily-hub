export const DAILY_RESET_HOUR_UTC = 15
export const SECONDARY_RESET_HOUR_UTC = 20
export const WEEKLY_RESET_DAY = 2 // Tuesday (0=Sun, 1=Mon, 2=Tue)
export const WEEKLY_RESET_HOUR_UTC = 8

export function getNextDailyReset(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(0)
  d.setUTCHours(DAILY_RESET_HOUR_UTC)
  if (from >= d) d.setUTCDate(d.getUTCDate() + 1)
  return d
}

export function getNextWeeklyReset(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(0)
  d.setUTCHours(WEEKLY_RESET_HOUR_UTC)
  const day = d.getUTCDay()
  const daysUntilTuesday = (WEEKLY_RESET_DAY - day + 7) % 7
  d.setUTCDate(d.getUTCDate() + daysUntilTuesday)
  if (daysUntilTuesday === 0 && from >= d) {
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return d
}

// Jumbo Cactpot draw: Saturday 20:00 JST = Saturday 11:00 UTC
export function getNextJumboReset(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(0)
  d.setUTCHours(11) // 11:00 UTC = 20:00 JST
  const day = d.getUTCDay()
  const daysUntilSaturday = (6 - day + 7) % 7
  d.setUTCDate(d.getUTCDate() + daysUntilSaturday)
  if (daysUntilSaturday === 0 && from >= d) {
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return d
}

export function getDailyResetPeriod(from: Date = new Date()): string {
  const d = new Date(from)
  const reset = new Date(d)
  reset.setUTCSeconds(0, 0)
  reset.setUTCMinutes(0)
  reset.setUTCHours(DAILY_RESET_HOUR_UTC)
  if (d < reset) reset.setUTCDate(reset.getUTCDate() - 1)
  return reset.toISOString().slice(0, 10)
}

export function getWeeklyResetPeriod(from: Date = new Date()): string {
  const d = new Date(from)
  const reset = new Date(d)
  reset.setUTCSeconds(0, 0)
  reset.setUTCMinutes(0)
  reset.setUTCHours(WEEKLY_RESET_HOUR_UTC)
  const day = reset.getUTCDay()
  const daysSinceTuesday = (day - WEEKLY_RESET_DAY + 7) % 7
  reset.setUTCDate(reset.getUTCDate() - daysSinceTuesday)
  if (d < reset) reset.setUTCDate(reset.getUTCDate() - 7)
  return reset.toISOString().slice(0, 10)
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00"
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":")
}
