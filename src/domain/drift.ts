import type { Agent } from './types'

/* ==========================================================================
   Drift monitoring.

   An agent's live-success series is the signal the platform already keeps.
   Drift is a sustained decline in it — a negative trend that has left the
   series' own peak behind by more than noise — not a single bad day. The
   alarm is computed here, never seeded, and what it did to the agent's
   ceiling is a policy rule the operator can read.
   ========================================================================== */

export interface DriftWindow {
  agentId: string
  metric: 'liveSuccess'
  points: number
  baseline: number
  peak: number
  current: number
  /** Least-squares slope per observation — negative means declining. */
  slope: number
  /** Standard score of the current point against the series. */
  z: number
  dropFromPeak: number
  alarm: boolean
  reason: string
}

export interface DriftReport {
  at?: string
  windows: DriftWindow[]
  minDrop: number
}

const MIN_POINTS = 4
const DEFAULT_MIN_DROP = 0.005

function stats(xs: number[]) {
  const n = xs.length
  const mean = xs.reduce((s, x) => s + x, 0) / n
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1))
  const xbar = (n - 1) / 2
  const slope = xs.reduce((s, x, i) => s + (i - xbar) * (x - mean), 0) / xs.reduce((s, _x, i) => s + (i - xbar) ** 2, 0)
  return { mean, sd, slope }
}

export function driftWindow(agent: Agent, minDrop = DEFAULT_MIN_DROP): DriftWindow {
  // Zeros are "not yet measured" (an onboarding agent), not a collapse.
  const xs = agent.trend.filter((x) => x > 0)
  const base = { agentId: agent.id, metric: 'liveSuccess' as const, points: xs.length, minDrop }
  if (xs.length < MIN_POINTS) {
    const current = xs.at(-1) ?? 0
    return { ...base, baseline: current, peak: current, current, slope: 0, z: 0, dropFromPeak: 0, alarm: false, reason: `Only ${xs.length} measured point${xs.length === 1 ? '' : 's'} — too few to judge.` }
  }
  const { mean, sd, slope } = stats(xs)
  const peak = Math.max(...xs)
  const current = xs.at(-1)!
  const dropFromPeak = peak - current
  const z = sd > 0 ? (current - mean) / sd : 0
  const alarm = slope < 0 && dropFromPeak >= minDrop
  const reason = alarm
    ? `Declining — ${(dropFromPeak * 100).toFixed(1)} pts below the series peak of ${(peak * 100).toFixed(1)}% with a negative trend (slope ${slope.toFixed(4)}/obs).`
    : slope < 0
      ? `Slight decline within noise — ${(dropFromPeak * 100).toFixed(1)} pts below peak, under the ${(minDrop * 100).toFixed(1)}-pt threshold.`
      : `Stable or improving — current ${(current * 100).toFixed(1)}% against a mean of ${(mean * 100).toFixed(1)}%.`
  return { ...base, baseline: mean, peak, current, slope, z, dropFromPeak, alarm, reason }
}

export function driftReport(agents: Agent[], minDrop = DEFAULT_MIN_DROP): DriftReport {
  return { windows: agents.map((a) => driftWindow(a, minDrop)), minDrop }
}
