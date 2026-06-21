// Region-aware payouts + off-peak/renewable scheduling (PLAN §7). Profitability
// depends on local electricity, so payouts surface NET = gross − electricity and
// nudge supply toward cheap/renewable regions and off-peak windows (a payout
// multiplier when the local grid is in its clean/cheap window).

const INCR_KWH = 0.2 // +200W incremental at load → 0.20 kWh/node-hour
const REQ_PRICE = 0.15 // requester $/sellable GPU-hour
const PLATFORM_FEE = 0.2
const OFFPEAK_MULTIPLIER = 1.15 // incentive to schedule into the clean/cheap window

export interface Region {
  name: string
  kwh: number
  renewablePct: number
  /** off-peak window in UTC [startHour, endHour) (may wrap past midnight) */
  offPeakUtc: [number, number]
}

export const REGIONS: Region[] = [
  { name: "Oslo, NO", kwh: 0.1, renewablePct: 98, offPeakUtc: [21, 5] },
  { name: "Toronto, CA", kwh: 0.12, renewablePct: 60, offPeakUtc: [3, 11] },
  { name: "Austin, US", kwh: 0.14, renewablePct: 35, offPeakUtc: [4, 12] },
  { name: "Lisbon, PT", kwh: 0.22, renewablePct: 60, offPeakUtc: [0, 6] },
  { name: "Tokyo, JP", kwh: 0.26, renewablePct: 25, offPeakUtc: [13, 21] },
  { name: "Berlin, DE", kwh: 0.32, renewablePct: 52, offPeakUtc: [23, 5] },
  { name: "Frankfurt, DE", kwh: 0.32, renewablePct: 52, offPeakUtc: [23, 5] },
]

export function isOffPeak(region: Region, utcHour: number): boolean {
  const [s, e] = region.offPeakUtc
  return s < e ? utcHour >= s && utcHour < e : utcHour >= s || utcHour < e // handle wrap
}

export interface RegionPayout {
  name: string
  kwh: number
  renewablePct: number
  offPeak: boolean
  electricity: number
  gross: number
  multiplier: number
  net: number // contributor NET per node-hour, USD
}

export function regionPayout(region: Region, sellable: number, utcHour: number): RegionPayout {
  const offPeak = isOffPeak(region, utcHour)
  const multiplier = offPeak ? OFFPEAK_MULTIPLIER : 1
  const electricity = INCR_KWH * region.kwh
  const gross = REQ_PRICE * sellable
  const receives = gross * (1 - PLATFORM_FEE) * multiplier
  return {
    name: region.name,
    kwh: region.kwh,
    renewablePct: region.renewablePct,
    offPeak,
    electricity: round(electricity),
    gross: round(gross),
    multiplier,
    net: round(receives - electricity),
  }
}
const round = (x: number) => Math.round(x * 1000) / 1000
