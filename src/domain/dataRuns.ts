import { Rng } from './rng'

/* ==========================================================================
   Run history — every scheduled run of the last thirty days, attempt by
   attempt, and how each failure was put right.

   A run is judged by one rule: did the data land by its due time. A run that
   failed and was recovered inside its window is a success, however it was
   recovered. How it was recovered is recorded separately, because that is
   the proof of who is keeping the service up: the platform's own retry, an
   agent acting under policy, a person, or a code change. A failure nobody
   has recovered yet is open, and an open failure is never counted as late
   but finished — it is still down.

   Times are held in UTC. Each schedule carries its local zone and offset,
   since a delivery window is agreed in local time.

   The seed is generated deterministically from a schedule, a duration trend
   and a handful of dated events, so the figures are identical on every load.
   ========================================================================== */

export type RecoveryPath = 'first_try' | 'retry' | 'agent' | 'human' | 'code_change' | 'open'

export const RECOVERY_LABEL: Record<RecoveryPath, string> = {
  first_try: 'First try',
  retry: 'Platform retry',
  agent: 'Agent',
  human: 'Person',
  code_change: 'Code change',
  open: 'Open',
}

/** Paths that put a failure right without a person. */
export const WITHOUT_A_PERSON: RecoveryPath[] = ['retry', 'agent']

export interface Attempt {
  startedAt: string
  endedAt: string | null
  outcome: 'succeeded' | 'failed' | 'running'
  error?: string
}

export interface Run {
  itemId: string
  /** Day index within the period; 0 is the first day, PERIOD_DAYS is today. */
  day: number
  scheduledAt: string
  dueAt: string
  attempts: Attempt[]
  /** Null while the run is still in progress. */
  path: RecoveryPath | null
  /** The agent or team that recovered it. */
  recoveredBy?: string
  landedAt: string | null
}

export interface Schedule {
  itemId: string
  /** Local start and due time, HH:MM. */
  start: string
  due: string
  tz: string
  utcOffsetHrs: number
}

export const PERIOD_DAYS = 30

/** Midnight UTC on the first local day of the period. */
const DAY0 = Date.UTC(2027, 0, 19)
const MIN = 60_000

export function localAt(s: Pick<Schedule, 'utcOffsetHrs'>, day: number, hhmm: string, plusMins = 0): string {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(DAY0 + day * 86_400_000 + ((h - s.utcOffsetHrs) * 60 + m + plusMins) * MIN).toISOString()
}

const plus = (iso: string, mins: number) => new Date(Date.parse(iso) + mins * MIN).toISOString()

type Event =
  | { t: 'slow'; extra: number }
  | { t: 'retry'; failAfter: number; error: string }
  | { t: 'agent'; failAfter: number; error: string; rerun: string; by: string }
  | { t: 'human'; failAfter: number; error: string; rerun: string; by: string; codeChange?: boolean }
  | { t: 'open'; failAfter: number; error: string; retried: boolean }
  | { t: 'running' }

interface Spec {
  schedule: Schedule
  seed: number
  baseMins: number
  /** Minutes the run lengthens by each day. */
  slopePerDay: number
  jitterMins: number
  events: Record<number, Event>
  /** Durations pinned on particular days, so the history agrees with what the register reports. */
  fixed?: Record<number, number>
}

function build(spec: Spec): Run[] {
  const { schedule: s, events } = spec
  const rng = new Rng(spec.seed)
  const runs: Run[] = []
  for (let day = 0; day <= PERIOD_DAYS; day++) {
    const jitter = rng.float(-spec.jitterMins, spec.jitterMins, 1)
    const ev = events[day]
    if (day === PERIOD_DAYS && !ev) continue
    const dur = spec.fixed?.[day] ?? Math.round(spec.baseMins + spec.slopePerDay * day + jitter)
    const start = localAt(s, day, s.start)
    const run: Run = { itemId: s.itemId, day, scheduledAt: start, dueAt: localAt(s, day, s.due), attempts: [], path: 'first_try', landedAt: null }

    if (!ev || ev.t === 'slow') {
      const end = plus(start, dur + (ev?.t === 'slow' ? ev.extra : 0))
      run.attempts = [{ startedAt: start, endedAt: end, outcome: 'succeeded' }]
      run.landedAt = end
    } else if (ev.t === 'running') {
      run.attempts = [{ startedAt: start, endedAt: null, outcome: 'running' }]
      run.path = null
    } else {
      const failed: Attempt = { startedAt: start, endedAt: plus(start, ev.failAfter), outcome: 'failed', error: ev.error }
      if (ev.t === 'retry') {
        const again = plus(start, ev.failAfter + 5)
        run.attempts = [failed, { startedAt: again, endedAt: plus(again, dur), outcome: 'succeeded' }]
        run.path = 'retry'
        run.landedAt = plus(again, dur)
      } else if (ev.t === 'open') {
        const again = plus(start, ev.failAfter + 5)
        run.attempts = ev.retried
          ? [failed, { startedAt: again, endedAt: plus(again, ev.failAfter), outcome: 'failed', error: ev.error }]
          : [failed]
        run.path = 'open'
      } else {
        const again = localAt(s, day, ev.rerun)
        run.attempts = [failed, { startedAt: again, endedAt: plus(again, dur), outcome: 'succeeded' }]
        run.path = ev.t === 'agent' ? 'agent' : ev.codeChange ? 'code_change' : 'human'
        run.recoveredBy = ev.by
        run.landedAt = plus(again, dur)
      }
    }
    runs.push(run)
  }
  return runs
}

const CHICAGO = { tz: 'America/Chicago', utcOffsetHrs: -6 }

/* --------------------------------- The seed --------------------------------- */

const SPECS: Spec[] = [
  {
    // Lengthening by about a minute and a half a night against a fixed window.
    schedule: { itemId: 'pl_engagement_ingest', start: '01:30', due: '05:00', ...CHICAGO },
    seed: 101, baseMins: 150, slopePerDay: 1.45, jitterMins: 4,
    events: {
      8: { t: 'retry', failAfter: 20, error: 'Transient: connection reset by the datamart' },
      18: { t: 'slow', extra: 55 },
      24: { t: 'retry', failAfter: 10, error: 'Transient: throttled by the datamart' },
      30: { t: 'running' },
    },
    fixed: { 29: 192 },
  },
  {
    schedule: { itemId: 'pl_utilisation_load', start: '03:00', due: '05:30', ...CHICAGO },
    seed: 202, baseMins: 70, slopePerDay: 0, jitterMins: 6,
    events: {
      9: { t: 'human', failAfter: 8, error: 'Column mapping broken by an upstream release', rerun: '08:10', by: 'KNet Data', codeChange: true },
      15: { t: 'agent', failAfter: 12, error: 'Lookup activity timed out', rerun: '03:35', by: 'agt_custodian' },
      21: { t: 'retry', failAfter: 9, error: 'Transient: source extract not ready' },
      26: { t: 'slow', extra: 110 },
      29: { t: 'open', failAfter: 14, error: 'Schema drift: hours_minor widened in the HCM feed (v15)', retried: true },
    },
  },
  {
    schedule: { itemId: 'sm_research', start: '06:00', due: '07:00', ...CHICAGO },
    seed: 303, baseMins: 30, slopePerDay: 0, jitterMins: 5,
    events: {
      12: { t: 'retry', failAfter: 6, error: 'Gateway timeout' },
      17: { t: 'agent', failAfter: 8, error: 'Refresh rejected: capacity throttled', rerun: '06:50', by: 'agt_custodian' },
      28: { t: 'slow', extra: 38 },
    },
    fixed: { 29: 31 },
  },
  {
    schedule: { itemId: 'sm_utilisation', start: '06:15', due: '07:00', ...CHICAGO },
    seed: 404, baseMins: 20, slopePerDay: 0, jitterMins: 3,
    events: {},
    fixed: { 29: 20 },
  },
]

export const SCHEDULES: Record<string, Schedule> = Object.fromEntries(SPECS.map((s) => [s.schedule.itemId, s.schedule]))

export const RUNS: Record<string, Run[]> = Object.fromEntries(SPECS.map((s) => [s.schedule.itemId, build(s)]))

/** Runs that have finished one way or another: landed, or failed and not yet recovered. */
export const completedRuns = (itemId: string) => (RUNS[itemId] ?? []).filter((r) => r.path !== null)

export const isOnTime = (r: Run) => r.landedAt !== null && Date.parse(r.landedAt) <= Date.parse(r.dueAt)

/* ------------------------------- Maintenance -------------------------------- */

/** Downtime inside an agreed window is planned, and is reported apart from unplanned downtime. */
export interface MaintenanceWindow {
  id: string
  itemIds: string[]
  start: string
  end: string
  reason: string
  approvedBy: string
}

export const MAINTENANCE: MaintenanceWindow[] = [
  {
    id: 'mw_2027_02_06', itemIds: ['pl_engagement_ingest', 'ds_engagement_silver', 'ds_engagement_gold', 'ds_client_dim'],
    start: localAt(CHICAGO, 18, '03:00'), end: localAt(CHICAGO, 18, '06:00'),
    reason: 'Azure SQL platform maintenance', approvedBy: 'Change advisory board',
  },
]

/* --------------------------------- Capacity --------------------------------- */

/**
 * Pressure on the platform a run executes on. It is reported beside the runs
 * that share the platform and window, as a place to look, never as a cause
 * the platform has proven.
 */
export interface CapacitySignal {
  id: string
  resource: string
  platform: string
  metric: string
  /** Peak utilisation in the window over the last seven days. */
  peakPct: number
  thresholdPct: number
  /** Local window the peak falls in. */
  window: string
  /** Change in the peak over the prior seven days, in points. */
  trendPts: number
  /** Minutes of work the platform delayed or rejected in seven days, where it reports them. */
  throttledMins7d?: number
  itemIds: string[]
  watchedBy: string
}

export const CAPACITY: CapacitySignal[] = [
  {
    id: 'cap_sql_datamart', resource: 'Cloud datamart', platform: 'Azure SQL', metric: 'DTU',
    peakPct: 91, thresholdPct: 85, window: '02:00–04:30', trendPts: 14,
    itemIds: ['pl_engagement_ingest', 'ds_engagement_silver', 'ds_engagement_gold', 'ds_client_dim'], watchedBy: 'agt_bursar',
  },
  {
    id: 'cap_pbi_research', resource: 'Research & Analytics capacity', platform: 'Power BI', metric: 'Capacity units',
    peakPct: 96, thresholdPct: 90, window: '06:00–08:00', trendPts: 6, throttledMins7d: 38,
    itemIds: ['sm_research', 'sm_utilisation', 'rp_leadership', 'rp_utilisation', 'rp_practice'], watchedBy: 'agt_bursar',
  },
]
