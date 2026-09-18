import { DATA_ITEM_BY_ID, ancestors, type DataItem } from './dataEstate'
import {
  CAPACITY, MAINTENANCE, PERIOD_DAYS, RUNS, SCHEDULES, WITHOUT_A_PERSON, completedRuns, isOnTime, localAt,
  type CapacitySignal, type RecoveryPath, type Run, type Schedule,
} from './dataRuns'
import { NOW } from './workSeed'

/* ==========================================================================
   Data reliability — whether the data services the business depends on were
   there when they were due, whether tonight's will be, and who kept them up.

   A data service is what a consumer relies on: a set of datasets or reports
   that must be ready by a local time each day. Its tier and target are
   declared by the client's data product owner, not inferred by the platform.

   Availability is read from the run history of everything the service is
   built from. On a given day the service is ready when the last of those
   runs has landed; if that is after the due time, the gap is downtime, and
   a failure nobody has recovered keeps it down until someone does. Downtime
   inside an agreed maintenance window is planned and reported apart. Data
   that is there but failing a check on its content is degraded, a third
   figure never folded into the other two. Anything upstream with no
   telemetry cannot be vouched for, so it is named against the figure rather
   than silently counted as up; a service built on nothing observable has no
   availability figure at all.

   Tonight's risk is a projection from each run's own duration trend, so a
   run that is lengthening against a fixed window is caught before it misses
   rather than after.
   ========================================================================== */

const MIN = 60_000
const PERIOD_END = NOW.getTime()
const PERIOD_START = PERIOD_END - PERIOD_DAYS * 86_400_000
export const PERIOD_MINS = PERIOD_DAYS * 24 * 60

export type Tier = 1 | 2 | 3

export interface DataService {
  id: string
  name: string
  tier: Tier
  /** Who declared the tier and target. */
  declaredBy: string
  /** The datasets or reports a consumer relies on. */
  itemIds: string[]
  /** Local time by which the service must be ready each day. */
  due: string
  tz: string
  utcOffsetHrs: number
  /** Percentage of the period the service must be available. */
  target: number
  /** The contracted service level this service answers to, where there is one. */
  slaId?: string
}

export const DATA_SERVICES: DataService[] = [
  {
    id: 'dsv_utilisation', name: 'Utilisation reporting', tier: 1, declaredBy: 'Data product owner',
    itemIds: ['rp_utilisation'], due: '07:00', tz: 'America/Chicago', utcOffsetHrs: -6, target: 99.5,
  },
  {
    id: 'dsv_leadership', name: 'Leadership reporting', tier: 1, declaredBy: 'Data product owner',
    itemIds: ['rp_leadership'], due: '07:00', tz: 'America/Chicago', utcOffsetHrs: -6, target: 99.5,
  },
  {
    id: 'dsv_oracle_exchange', name: 'Oracle datamart exchange', tier: 1, declaredBy: 'Data product owner',
    itemIds: ['ds_oracle_dm'], due: '06:00', tz: 'America/Chicago', utcOffsetHrs: -6, target: 99.5,
  },
  {
    id: 'dsv_engagement_mart', name: 'Engagement datamart', tier: 2, declaredBy: 'Data product owner',
    itemIds: ['ds_engagement_gold', 'ds_client_dim'], due: '05:00', tz: 'America/Chicago', utcOffsetHrs: -6, target: 99.0,
    slaId: 'sla_data_delivery',
  },
]

export const DATA_SERVICE_BY_ID = Object.fromEntries(DATA_SERVICES.map((s) => [s.id, s])) as Record<string, DataService>

/* -------------------------------- Intervals --------------------------------- */

interface Interval { start: number; end: number; cause?: string }

const mins = (i: Interval) => Math.max(0, i.end - i.start) / MIN

function merge(list: Interval[]): Interval[] {
  const sorted = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start)
  const out: Interval[] = []
  for (const i of sorted) {
    const last = out[out.length - 1]
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end)
    else out.push({ ...i })
  }
  return out
}

/** The parts of `a` not covered by any of `b`. */
function subtract(a: Interval[], b: Interval[]): Interval[] {
  let out = a.map((i) => ({ ...i }))
  for (const cut of b) {
    out = out.flatMap((i) => {
      if (cut.end <= i.start || cut.start >= i.end) return [i]
      const parts: Interval[] = []
      if (cut.start > i.start) parts.push({ ...i, end: cut.start })
      if (cut.end < i.end) parts.push({ ...i, start: cut.end })
      return parts
    })
  }
  return out
}

const clip = (i: Interval): Interval => ({ ...i, start: Math.max(i.start, PERIOD_START), end: Math.min(i.end, PERIOD_END) })

/* ------------------------------ Service reading ----------------------------- */

export type BudgetState = 'within' | 'burning' | 'exhausted'

export interface ServiceReading {
  service: DataService
  /** Everything it is built from, itself included. */
  chain: DataItem[]
  /** Items in the chain with no telemetry. */
  unobserved: DataItem[]
  /** False when the service itself cannot be observed. */
  measured: boolean
  availabilityPct: number | null
  unplannedMins: number
  plannedMins: number
  degradedMins: number
  budget: { allowedMins: number; usedMins: number; state: BudgetState }
  /** Downtime still running now. */
  open: { since: string; cause: DataItem | null } | null
  outages: { start: string; end: string; mins: number; planned: boolean; cause: DataItem | null }[]
  meetsTarget: boolean | null
}

/** A failure that stays open ends when the same item next lands, or not at all. */
function recoveredAt(itemId: string, from: Run): number {
  const later = (RUNS[itemId] ?? []).find((r) => r.day > from.day && r.landedAt)
  return later ? Date.parse(later.landedAt!) : PERIOD_END
}

export function readService(s: DataService): ServiceReading {
  const seen = new Map<string, DataItem>()
  for (const id of s.itemIds) {
    const own = DATA_ITEM_BY_ID[id]
    if (own) seen.set(id, own)
    for (const a of ancestors(id)) seen.set(a.id, a)
  }
  const chain = [...seen.values()]
  const unobserved = chain.filter((i) => !i.telemetry)
  const measured = s.itemIds.some((id) => DATA_ITEM_BY_ID[id]?.telemetry)
  const scheduled = chain.filter((i) => SCHEDULES[i.id])

  const down: Interval[] = []
  for (let day = 0; day <= PERIOD_DAYS; day++) {
    const due = Date.parse(localAt(s, day, s.due))
    if (due > PERIOD_END || due < PERIOD_START) continue
    const runs = scheduled.map((i) => (RUNS[i.id] ?? []).find((r) => r.day === day)).filter((r): r is Run => Boolean(r))
    if (!runs.length) continue
    const open = runs.find((r) => r.path === 'open')
    if (open) {
      down.push({ start: due, end: recoveredAt(open.itemId, open), cause: open.itemId })
      continue
    }
    const latest = runs.filter((r) => r.landedAt).sort((a, b) => Date.parse(b.landedAt!) - Date.parse(a.landedAt!))[0]
    if (latest && Date.parse(latest.landedAt!) > due) down.push({ start: due, end: Date.parse(latest.landedAt!), cause: latest.itemId })
  }
  const outagesAll = merge(down.map(clip))
  // merge() keeps the first cause of a merged run of intervals, which is the one that began it.

  const chainIds = new Set(chain.map((i) => i.id))
  const windows = MAINTENANCE.filter((w) => w.itemIds.some((id) => chainIds.has(id)))
    .map((w) => ({ start: Date.parse(w.start), end: Date.parse(w.end) }))
  const unplanned = subtract(outagesAll, windows)
  const unplannedMins = unplanned.reduce((n, i) => n + mins(i), 0)
  const plannedMins = outagesAll.reduce((n, i) => n + mins(i), 0) - unplannedMins

  const failing: Interval[] = chain.flatMap((i) =>
    (i.contract?.checks ?? []).filter((c) => !c.passed && c.failingSince).map((c) => clip({ start: Date.parse(c.failingSince!), end: PERIOD_END })))
  const degradedMins = subtract(merge(failing), outagesAll).reduce((n, i) => n + mins(i), 0)

  const allowedMins = PERIOD_MINS * (1 - s.target / 100)
  const availabilityPct = measured ? 100 * (1 - unplannedMins / PERIOD_MINS) : null
  const last = outagesAll[outagesAll.length - 1]
  const open = last && last.end >= PERIOD_END ? { since: new Date(last.start).toISOString(), cause: last.cause ? DATA_ITEM_BY_ID[last.cause] ?? null : null } : null

  return {
    service: s, chain, unobserved, measured, availabilityPct,
    unplannedMins: Math.round(unplannedMins), plannedMins: Math.round(plannedMins), degradedMins: Math.round(degradedMins),
    budget: {
      allowedMins: Math.round(allowedMins), usedMins: Math.round(unplannedMins),
      state: unplannedMins >= allowedMins ? 'exhausted' : unplannedMins >= allowedMins / 2 ? 'burning' : 'within',
    },
    open,
    outages: outagesAll.map((i) => {
      const u = subtract([i], windows).reduce((n, x) => n + mins(x), 0)
      return { start: new Date(i.start).toISOString(), end: new Date(i.end).toISOString(), mins: Math.round(mins(i)), planned: u === 0, cause: i.cause ? DATA_ITEM_BY_ID[i.cause] ?? null : null }
    }),
    meetsTarget: availabilityPct === null ? null : availabilityPct >= s.target,
  }
}

/* ------------------------------- Run reading -------------------------------- */

export type Risk = 'miss' | 'tight' | 'clear' | 'blocked'

export interface RunReading {
  item: DataItem
  schedule: Schedule
  runs: number
  onTime: number
  failures: Record<RecoveryPath, number>
  /** Of the failures already recovered, the share put right without a person. */
  withoutPersonPct: number | null
  medianRecoverMins: number | null
  duration: {
    /** Fitted duration today, from the trend. */
    fittedMins: number
    /** Minutes the run lengthens by each day. */
    slopePerDay: number
    windowMins: number
    /** Days until the fitted duration no longer fits the window, where it is lengthening. */
    daysToMiss: number | null
  }
  tonight: {
    state: 'running' | 'scheduled' | 'blocked' | 'landed'
    projectedAt: string | null
    marginMins: number | null
    risk: Risk
    /** The failure holding it, where it is blocked. */
    blockedBy: DataItem | null
  }
  capacity: CapacitySignal[]
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0
}

/** Theil–Sen: the median of pairwise slopes, so one slow night does not bend the trend. */
function trend(points: { x: number; y: number }[]) {
  const slopes: number[] = []
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (points[j].x !== points[i].x) slopes.push((points[j].y - points[i].y) / (points[j].x - points[i].x))
  }
  const slope = median(slopes) ?? 0
  const intercept = median(points.map((p) => p.y - slope * p.x)) ?? 0
  const residuals = points.map((p) => p.y - (intercept + slope * p.x))
  return { slope, intercept, p90: Math.max(0, quantile(residuals, 0.9)) }
}

const minsBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / MIN

const inMaintenance = (r: Run) =>
  MAINTENANCE.some((w) => w.itemIds.includes(r.itemId) && Date.parse(r.scheduledAt) < Date.parse(w.end) && Date.parse(r.dueAt) > Date.parse(w.start))

function openFailure(itemId: string): boolean {
  const done = completedRuns(itemId)
  return done[done.length - 1]?.path === 'open'
}

export function readRuns(itemId: string): RunReading | null {
  const schedule = SCHEDULES[itemId]
  const item = DATA_ITEM_BY_ID[itemId]
  if (!schedule || !item) return null
  const all = RUNS[itemId] ?? []
  const done = completedRuns(itemId)

  const failures = { first_try: 0, retry: 0, agent: 0, human: 0, code_change: 0, open: 0 } as Record<RecoveryPath, number>
  for (const r of done) failures[r.path!]++
  const failed = done.filter((r) => r.path !== 'first_try')
  const recovered = failed.filter((r) => r.path !== 'open')
  const withoutPerson = recovered.filter((r) => WITHOUT_A_PERSON.includes(r.path!))
  const recoverMins = recovered.map((r) => minsBetween(r.attempts[0].endedAt!, r.landedAt!))

  // The trend is read from the attempt that succeeded, outside maintenance.
  const points = done
    .filter((r) => r.landedAt && !inMaintenance(r))
    .map((r) => ({ x: r.day, y: minsBetween(r.attempts[r.attempts.length - 1].startedAt, r.landedAt!) }))
  const t = trend(points)
  const windowMins = minsBetween(localAt(schedule, 0, schedule.start), localAt(schedule, 0, schedule.due))
  const fittedToday = t.intercept + t.slope * PERIOD_DAYS
  const lengthening = t.slope > 0.25
  const daysToMiss = lengthening && fittedToday < windowMins ? Math.ceil((windowMins - fittedToday) / t.slope) : lengthening ? 0 : null

  // Tonight.
  const today = all.find((r) => r.day === PERIOD_DAYS)
  const blocker = openFailure(itemId)
    ? item
    : ancestors(itemId).find((a) => SCHEDULES[a.id] && openFailure(a.id)) ?? null
  const dueToday = Date.parse(localAt(schedule, PERIOD_DAYS, schedule.due))
  const project = (startIso: string) => {
    const at = Date.parse(startIso) + (fittedToday + t.p90) * MIN
    const margin = (dueToday - at) / MIN
    const risk: Risk = margin < 0 ? 'miss' : margin < Math.max(15, windowMins * 0.1) ? 'tight' : 'clear'
    return { projectedAt: new Date(at).toISOString(), marginMins: Math.round(margin), risk }
  }
  let tonight: RunReading['tonight']
  if (blocker) tonight = { state: 'blocked', projectedAt: null, marginMins: null, risk: 'blocked', blockedBy: blocker }
  else if (today?.path === null) tonight = { state: 'running', ...project(today.attempts[0].startedAt), blockedBy: null }
  else if (today?.landedAt) tonight = { state: 'landed', projectedAt: today.landedAt, marginMins: Math.round((dueToday - Date.parse(today.landedAt)) / MIN), risk: 'clear', blockedBy: null }
  else tonight = { state: 'scheduled', ...project(localAt(schedule, PERIOD_DAYS, schedule.start)), blockedBy: null }

  return {
    item, schedule,
    runs: done.length, onTime: done.filter(isOnTime).length,
    failures,
    withoutPersonPct: recovered.length ? (100 * withoutPerson.length) / recovered.length : null,
    medianRecoverMins: median(recoverMins),
    duration: { fittedMins: Math.round(fittedToday), slopePerDay: Math.round(t.slope * 100) / 100, windowMins, daysToMiss },
    tonight,
    capacity: CAPACITY.filter((c) => c.itemIds.includes(itemId)),
  }
}

/* ------------------------------ Failure record ------------------------------ */

export interface FailureRow {
  run: Run
  item: DataItem
  error: string
  path: RecoveryPath
  recoveredBy: string | null
  /** From the first failure to the attempt that recovered it. Null while open. */
  restartMins: number | null
  /** From the first failure to landing, or to now while open. */
  recoverMins: number
  onTime: boolean
}

export function failureRows(): FailureRow[] {
  return Object.keys(RUNS)
    .flatMap((id) => completedRuns(id).filter((r) => r.path !== 'first_try'))
    .map((r) => ({
      run: r,
      item: DATA_ITEM_BY_ID[r.itemId],
      error: r.attempts.find((a) => a.outcome === 'failed')?.error ?? '',
      path: r.path!,
      recoveredBy: r.recoveredBy ?? null,
      restartMins: r.landedAt ? Math.round(minsBetween(r.attempts[0].endedAt!, r.attempts[r.attempts.length - 1].startedAt)) : null,
      recoverMins: Math.round(((r.landedAt ? Date.parse(r.landedAt) : PERIOD_END) - Date.parse(r.attempts[0].endedAt!)) / MIN),
      onTime: isOnTime(r),
    }))
    .sort((a, b) => Date.parse(b.run.scheduledAt) - Date.parse(a.run.scheduledAt))
}

/* --------------------------------- Summary ---------------------------------- */

export interface ReliabilitySummary {
  services: ServiceReading[]
  runs: RunReading[]
  failures: FailureRow[]
  measured: number
  meetingTarget: number
  openOutages: number
  budgetsExhausted: number
  totalRuns: number
  onTime: number
  byPath: Record<RecoveryPath, number>
  withoutPersonPct: number | null
  medianRecoverMins: number | null
  medianRestartMins: number | null
  atRisk: number
  lengthening: number
  capacityPressure: number
}

export function reliabilitySummary(): ReliabilitySummary {
  const services = DATA_SERVICES.map(readService).sort((a, b) => a.service.tier - b.service.tier || (a.availabilityPct ?? 101) - (b.availabilityPct ?? 101))
  const runs = Object.keys(SCHEDULES).map(readRuns).filter((r): r is RunReading => Boolean(r))
  const failures = failureRows()
  const byPath = { first_try: 0, retry: 0, agent: 0, human: 0, code_change: 0, open: 0 } as Record<RecoveryPath, number>
  for (const r of runs) for (const p of Object.keys(byPath) as RecoveryPath[]) byPath[p] += r.failures[p]
  const recovered = failures.filter((f) => f.path !== 'open')
  return {
    services, runs, failures,
    measured: services.filter((s) => s.measured).length,
    meetingTarget: services.filter((s) => s.meetsTarget).length,
    openOutages: services.filter((s) => s.open).length,
    budgetsExhausted: services.filter((s) => s.measured && s.budget.state === 'exhausted').length,
    totalRuns: runs.reduce((n, r) => n + r.runs, 0),
    onTime: runs.reduce((n, r) => n + r.onTime, 0),
    byPath,
    withoutPersonPct: recovered.length ? (100 * recovered.filter((f) => WITHOUT_A_PERSON.includes(f.path)).length) / recovered.length : null,
    medianRecoverMins: median(recovered.map((f) => f.recoverMins)),
    medianRestartMins: median(recovered.map((f) => f.restartMins!)),
    atRisk: runs.filter((r) => r.tonight.risk === 'miss' || r.tonight.risk === 'tight').length,
    lengthening: runs.filter((r) => r.duration.daysToMiss !== null).length,
    capacityPressure: CAPACITY.filter((c) => c.peakPct >= c.thresholdPct).length,
  }
}
