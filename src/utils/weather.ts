export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'
export type WeatherKind = 'clear' | 'cloudy' | 'haze' | 'rain' | 'storm'
export type LocalWeather = { phase: DayPhase; kind: WeatherKind; slot: number }

const weatherSlotMs = 45 * 60 * 1000
const hash = (value: string) => [...value].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 17)

export function localWeather(now = new Date()): LocalWeather {
  const hour = now.getHours() + now.getMinutes() / 60
  const phase: DayPhase = hour < 5.5 || hour >= 20 ? 'night' : hour < 7.5 ? 'dawn' : hour < 17.5 ? 'day' : 'dusk'
  const slot = Math.floor(now.getTime() / weatherSlotMs)
  const roll = hash(`${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${slot}-${now.getTimezoneOffset()}`) % 100
  const kind: WeatherKind = roll < 50 ? 'clear' : roll < 73 ? 'cloudy' : roll < 86 ? 'haze' : roll < 96 ? 'rain' : 'storm'
  return { phase, kind, slot }
}
