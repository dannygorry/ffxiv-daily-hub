export type WeatherCondition =
  | "Blizzards"
  | "Clear Skies"
  | "Clouds"
  | "Dust Storms"
  | "Fair Skies"
  | "Fog"
  | "Gales"
  | "Gloom"
  | "Heat Waves"
  | "Rain"
  | "Showers"
  | "Snow"
  | "Thunder"
  | "Thunderstorms"
  | "Umbral Static"
  | "Umbral Wind"
  | "Wind"

export interface WeatherWindow {
  weather: WeatherCondition
  startTime: Date
}

export interface Zone {
  id: string
  name: string
  region: string
  weatherRates: Array<{ weather: WeatherCondition; rate: number }>
}

function getWeatherTarget(date: Date): number {
  const unix = Math.floor(date.getTime() / 1000)
  const bell = unix / 175
  const increment = (Math.floor(bell) + 8 - (Math.floor(bell) % 8)) % 24
  const totalDays = Math.floor(unix / 4200)
  const calcBase = totalDays * 100 + increment
  const step1 = (calcBase << 11) ^ calcBase
  const step2 = (step1 >>> 8) ^ step1
  return step2 % 100
}

export function getWeatherForZone(zone: Zone, date: Date): WeatherCondition {
  const target = getWeatherTarget(date)
  let cumulative = 0
  for (const { weather, rate } of zone.weatherRates) {
    cumulative += rate
    if (target < cumulative) return weather
  }
  return zone.weatherRates[zone.weatherRates.length - 1].weather
}

export function getWeatherWindowStart(date: Date): Date {
  const unix = Math.floor(date.getTime() / 1000)
  const bell = unix / 175
  const windowStart = Math.floor(Math.floor(bell) / 8) * 8
  return new Date(windowStart * 175 * 1000)
}

export function getNextWeatherWindowStart(date: Date): Date {
  const current = getWeatherWindowStart(date)
  return new Date(current.getTime() + 8 * 175 * 1000)
}

export function getUpcomingWeather(zone: Zone, from: Date, count = 4): WeatherWindow[] {
  const windows: WeatherWindow[] = []
  let current = getWeatherWindowStart(from)
  for (let i = 0; i < count; i++) {
    windows.push({
      weather: getWeatherForZone(zone, current),
      startTime: new Date(current),
    })
    current = new Date(current.getTime() + 8 * 175 * 1000)
  }
  return windows
}

// Eorzea time: 1 Eorzea hour = 175 real seconds
export function getEorzeaTime(date: Date): { hours: number; minutes: number; seconds: number } {
  const eorzeaMs = date.getTime() * (1440 / 70)
  const eorzeaSeconds = Math.floor(eorzeaMs / 1000)
  const hours = Math.floor(eorzeaSeconds / 3600) % 24
  const minutes = Math.floor((eorzeaSeconds % 3600) / 60)
  const seconds = eorzeaSeconds % 60
  return { hours, minutes, seconds }
}

export const ZONES: Zone[] = [
  // La Noscea
  {
    id: "limsa-lominsa",
    name: "Limsa Lominsa",
    region: "La Noscea",
    weatherRates: [
      { weather: "Clouds", rate: 20 },
      { weather: "Clear Skies", rate: 30 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Fog", rate: 10 },
      { weather: "Rain", rate: 10 },
    ],
  },
  {
    id: "middle-la-noscea",
    name: "Middle La Noscea",
    region: "La Noscea",
    weatherRates: [
      { weather: "Clouds", rate: 20 },
      { weather: "Clear Skies", rate: 30 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Wind", rate: 10 },
      { weather: "Rain", rate: 10 },
    ],
  },
  {
    id: "lower-la-noscea",
    name: "Lower La Noscea",
    region: "La Noscea",
    weatherRates: [
      { weather: "Clouds", rate: 20 },
      { weather: "Clear Skies", rate: 30 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Wind", rate: 10 },
      { weather: "Rain", rate: 10 },
    ],
  },
  {
    id: "eastern-la-noscea",
    name: "Eastern La Noscea",
    region: "La Noscea",
    weatherRates: [
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clear Skies", rate: 20 },
      { weather: "Clouds", rate: 10 },
      { weather: "Fog", rate: 10 },
      { weather: "Rain", rate: 20 },
      { weather: "Showers", rate: 10 },
    ],
  },
  {
    id: "western-la-noscea",
    name: "Western La Noscea",
    region: "La Noscea",
    weatherRates: [
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clear Skies", rate: 20 },
      { weather: "Clouds", rate: 20 },
      { weather: "Fog", rate: 10 },
      { weather: "Wind", rate: 10 },
      { weather: "Gales", rate: 10 },
    ],
  },
  {
    id: "upper-la-noscea",
    name: "Upper La Noscea",
    region: "La Noscea",
    weatherRates: [
      { weather: "Clear Skies", rate: 30 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clouds", rate: 20 },
      { weather: "Thunder", rate: 10 },
      { weather: "Thunderstorms", rate: 10 },
    ],
  },
  {
    id: "outer-la-noscea",
    name: "Outer La Noscea",
    region: "La Noscea",
    weatherRates: [
      { weather: "Clear Skies", rate: 30 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clouds", rate: 30 },
      { weather: "Rain", rate: 10 },
    ],
  },
  // Thanalan
  {
    id: "ul-dah",
    name: "Ul'dah",
    region: "Thanalan",
    weatherRates: [
      { weather: "Clear Skies", rate: 40 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Clouds", rate: 20 },
      { weather: "Fog", rate: 10 },
      { weather: "Rain", rate: 10 },
    ],
  },
  {
    id: "central-thanalan",
    name: "Central Thanalan",
    region: "Thanalan",
    weatherRates: [
      { weather: "Dust Storms", rate: 30 },
      { weather: "Clear Skies", rate: 20 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Clouds", rate: 10 },
      { weather: "Fog", rate: 10 },
      { weather: "Rain", rate: 10 },
    ],
  },
  {
    id: "eastern-thanalan",
    name: "Eastern Thanalan",
    region: "Thanalan",
    weatherRates: [
      { weather: "Clear Skies", rate: 40 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Clouds", rate: 10 },
      { weather: "Fog", rate: 10 },
      { weather: "Rain", rate: 10 },
      { weather: "Showers", rate: 10 },
    ],
  },
  {
    id: "southern-thanalan",
    name: "Southern Thanalan",
    region: "Thanalan",
    weatherRates: [
      { weather: "Heat Waves", rate: 40 },
      { weather: "Clear Skies", rate: 20 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Clouds", rate: 10 },
      { weather: "Dust Storms", rate: 10 },
    ],
  },
  {
    id: "northern-thanalan",
    name: "Northern Thanalan",
    region: "Thanalan",
    weatherRates: [
      { weather: "Clear Skies", rate: 5 },
      { weather: "Fair Skies", rate: 15 },
      { weather: "Clouds", rate: 20 },
      { weather: "Fog", rate: 20 },
      { weather: "Heat Waves", rate: 40 },
    ],
  },
  // The Black Shroud
  {
    id: "gridania",
    name: "Gridania",
    region: "The Black Shroud",
    weatherRates: [
      { weather: "Rain", rate: 20 },
      { weather: "Fog", rate: 20 },
      { weather: "Clouds", rate: 20 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Clear Skies", rate: 20 },
    ],
  },
  {
    id: "central-shroud",
    name: "Central Shroud",
    region: "The Black Shroud",
    weatherRates: [
      { weather: "Thunder", rate: 15 },
      { weather: "Rain", rate: 30 },
      { weather: "Fog", rate: 10 },
      { weather: "Clouds", rate: 15 },
      { weather: "Fair Skies", rate: 15 },
      { weather: "Clear Skies", rate: 15 },
    ],
  },
  {
    id: "east-shroud",
    name: "East Shroud",
    region: "The Black Shroud",
    weatherRates: [
      { weather: "Thunder", rate: 15 },
      { weather: "Rain", rate: 30 },
      { weather: "Fog", rate: 10 },
      { weather: "Clouds", rate: 15 },
      { weather: "Fair Skies", rate: 15 },
      { weather: "Clear Skies", rate: 15 },
    ],
  },
  {
    id: "south-shroud",
    name: "South Shroud",
    region: "The Black Shroud",
    weatherRates: [
      { weather: "Fog", rate: 5 },
      { weather: "Rain", rate: 20 },
      { weather: "Showers", rate: 25 },
      { weather: "Clouds", rate: 15 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Clear Skies", rate: 15 },
    ],
  },
  {
    id: "north-shroud",
    name: "North Shroud",
    region: "The Black Shroud",
    weatherRates: [
      { weather: "Fog", rate: 5 },
      { weather: "Showers", rate: 10 },
      { weather: "Rain", rate: 15 },
      { weather: "Clouds", rate: 20 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clear Skies", rate: 20 },
    ],
  },
  // Coerthas / Ishgard
  {
    id: "coerthas-central",
    name: "Coerthas Central Highlands",
    region: "Coerthas",
    weatherRates: [
      { weather: "Blizzards", rate: 20 },
      { weather: "Snow", rate: 30 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Clear Skies", rate: 20 },
      { weather: "Clouds", rate: 10 },
    ],
  },
  {
    id: "coerthas-western",
    name: "Coerthas Western Highlands",
    region: "Coerthas",
    weatherRates: [
      { weather: "Blizzards", rate: 20 },
      { weather: "Snow", rate: 30 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Clear Skies", rate: 20 },
      { weather: "Clouds", rate: 10 },
    ],
  },
  // Mor Dhona
  {
    id: "mor-dhona",
    name: "Mor Dhona",
    region: "Mor Dhona",
    weatherRates: [
      { weather: "Clouds", rate: 30 },
      { weather: "Fog", rate: 30 },
      { weather: "Gloom", rate: 10 },
      { weather: "Clear Skies", rate: 15 },
      { weather: "Fair Skies", rate: 15 },
    ],
  },
  // Heavensward
  {
    id: "sea-of-clouds",
    name: "The Sea of Clouds",
    region: "Abalathia",
    weatherRates: [
      { weather: "Clear Skies", rate: 30 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clouds", rate: 20 },
      { weather: "Fog", rate: 10 },
      { weather: "Wind", rate: 10 },
    ],
  },
  {
    id: "dravanian-forelands",
    name: "The Dravanian Forelands",
    region: "Dravania",
    weatherRates: [
      { weather: "Clear Skies", rate: 10 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Clouds", rate: 10 },
      { weather: "Fog", rate: 10 },
      { weather: "Rain", rate: 10 },
      { weather: "Showers", rate: 10 },
      { weather: "Wind", rate: 10 },
      { weather: "Gales", rate: 10 },
      { weather: "Thunderstorms", rate: 10 },
    ],
  },
  {
    id: "churning-mists",
    name: "The Churning Mists",
    region: "Dravania",
    weatherRates: [
      { weather: "Clouds", rate: 30 },
      { weather: "Gales", rate: 20 },
      { weather: "Clear Skies", rate: 20 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Umbral Static", rate: 10 },
    ],
  },
  // Stormblood
  {
    id: "fringes",
    name: "The Fringes",
    region: "Gyr Abania",
    weatherRates: [
      { weather: "Clear Skies", rate: 20 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clouds", rate: 20 },
      { weather: "Fog", rate: 10 },
      { weather: "Wind", rate: 10 },
      { weather: "Thunder", rate: 10 },
    ],
  },
  {
    id: "peaks",
    name: "The Peaks",
    region: "Gyr Abania",
    weatherRates: [
      { weather: "Clear Skies", rate: 20 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clouds", rate: 20 },
      { weather: "Fog", rate: 10 },
      { weather: "Wind", rate: 10 },
      { weather: "Dust Storms", rate: 10 },
    ],
  },
  {
    id: "azim-steppe",
    name: "The Azim Steppe",
    region: "Othard",
    weatherRates: [
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clear Skies", rate: 20 },
      { weather: "Clouds", rate: 20 },
      { weather: "Rain", rate: 10 },
      { weather: "Wind", rate: 10 },
      { weather: "Thunder", rate: 10 },
    ],
  },
  {
    id: "ruby-sea",
    name: "The Ruby Sea",
    region: "Othard",
    weatherRates: [
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clear Skies", rate: 20 },
      { weather: "Clouds", rate: 20 },
      { weather: "Rain", rate: 15 },
      { weather: "Thunder", rate: 15 },
    ],
  },
  // Shadowbringers
  {
    id: "lakeland",
    name: "Lakeland",
    region: "Norvrandt",
    weatherRates: [
      { weather: "Clear Skies", rate: 30 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clouds", rate: 10 },
      { weather: "Fog", rate: 10 },
      { weather: "Thunderstorms", rate: 10 },
      { weather: "Gloom", rate: 10 },
    ],
  },
  {
    id: "il-mheg",
    name: "Il Mheg",
    region: "Norvrandt",
    weatherRates: [
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clear Skies", rate: 20 },
      { weather: "Clouds", rate: 20 },
      { weather: "Rain", rate: 15 },
      { weather: "Fog", rate: 15 },
    ],
  },
  {
    id: "tempest",
    name: "The Tempest",
    region: "Norvrandt",
    weatherRates: [
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clear Skies", rate: 30 },
      { weather: "Clouds", rate: 30 },
      { weather: "Fog", rate: 10 },
    ],
  },
  // Endwalker
  {
    id: "labyrinthos",
    name: "Labyrinthos",
    region: "Sharlayan",
    weatherRates: [
      { weather: "Clear Skies", rate: 20 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clouds", rate: 20 },
      { weather: "Rain", rate: 15 },
      { weather: "Fog", rate: 15 },
    ],
  },
  {
    id: "thavnair",
    name: "Thavnair",
    region: "Near East",
    weatherRates: [
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clear Skies", rate: 20 },
      { weather: "Clouds", rate: 20 },
      { weather: "Rain", rate: 20 },
      { weather: "Showers", rate: 10 },
    ],
  },
  {
    id: "garlemald",
    name: "Garlemald",
    region: "Ilsabard",
    weatherRates: [
      { weather: "Snow", rate: 30 },
      { weather: "Blizzards", rate: 20 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Clouds", rate: 20 },
      { weather: "Fog", rate: 10 },
    ],
  },
  {
    id: "mare-lamentorum",
    name: "Mare Lamentorum",
    region: "The Moon",
    weatherRates: [
      { weather: "Fair Skies", rate: 50 },
      { weather: "Clear Skies", rate: 50 },
    ],
  },
  {
    id: "elpis",
    name: "Elpis",
    region: "Elpis",
    weatherRates: [
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clear Skies", rate: 30 },
      { weather: "Clouds", rate: 20 },
      { weather: "Rain", rate: 20 },
    ],
  },
  {
    id: "ultima-thule",
    name: "Ultima Thule",
    region: "Ultima Thule",
    weatherRates: [
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clear Skies", rate: 30 },
      { weather: "Umbral Wind", rate: 20 },
      { weather: "Snow", rate: 20 },
    ],
  },
  // Dawntrail
  {
    id: "urqopacha",
    name: "Urqopacha",
    region: "Tural",
    weatherRates: [
      { weather: "Clear Skies", rate: 30 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clouds", rate: 20 },
      { weather: "Wind", rate: 10 },
      { weather: "Dust Storms", rate: 10 },
    ],
  },
  {
    id: "kozamauka",
    name: "Kozama'uka",
    region: "Tural",
    weatherRates: [
      { weather: "Clear Skies", rate: 20 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clouds", rate: 20 },
      { weather: "Rain", rate: 20 },
      { weather: "Showers", rate: 10 },
    ],
  },
  {
    id: "yak-tel",
    name: "Yak T'el",
    region: "Tural",
    weatherRates: [
      { weather: "Clouds", rate: 20 },
      { weather: "Rain", rate: 20 },
      { weather: "Showers", rate: 20 },
      { weather: "Fair Skies", rate: 20 },
      { weather: "Clear Skies", rate: 20 },
    ],
  },
  {
    id: "shaaloani",
    name: "Shaaloani",
    region: "Tural",
    weatherRates: [
      { weather: "Clear Skies", rate: 30 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clouds", rate: 20 },
      { weather: "Heat Waves", rate: 10 },
      { weather: "Wind", rate: 10 },
    ],
  },
  {
    id: "heritage-found",
    name: "Heritage Found",
    region: "Tural",
    weatherRates: [
      { weather: "Clear Skies", rate: 30 },
      { weather: "Fair Skies", rate: 30 },
      { weather: "Clouds", rate: 20 },
      { weather: "Thunder", rate: 10 },
      { weather: "Thunderstorms", rate: 10 },
    ],
  },
]

export const WEATHER_ICON: Record<WeatherCondition, string> = {
  "Blizzards": "🌨️",
  "Clear Skies": "☀️",
  "Clouds": "☁️",
  "Dust Storms": "🌪️",
  "Fair Skies": "🌤️",
  "Fog": "🌫️",
  "Gales": "💨",
  "Gloom": "🌑",
  "Heat Waves": "🌡️",
  "Rain": "🌧️",
  "Showers": "⛈️",
  "Snow": "❄️",
  "Thunder": "⚡",
  "Thunderstorms": "🌩️",
  "Umbral Static": "🌀",
  "Umbral Wind": "🌬️",
  "Wind": "🍃",
}

export const REGIONS = Array.from(new Set(ZONES.map((z) => z.region)))
