import { ENGAGEMENT, ENGAGEMENT_BY_ID } from './engagement'

/* ==========================================================================
   The numbers that decide behaviour.

   A threshold buried in the code that reads it is invisible: nobody can see
   what the platform is holding itself to, nobody can argue with it, and a
   second client silently inherits the first one's terms. Every number here
   changes what the platform reports or when it complains, so each one is
   named, carries what it means and where it came from, and can be stated per
   engagement.

   Only numbers that are genuinely a policy live here. A figure that
   describes the seeded data rather than a decision — how many days of run
   history the simulation generated, say — is not a threshold and stays with
   the data it describes, because making it configurable would let a
   configuration claim a window the records cannot fill.
   ========================================================================== */

export interface Thresholds {
  /** How recently a dimension must have had a recommendation to count as covered. */
  recommendationWindowDays: number
  /** How often a procedure must be reviewed, where the procedure does not state its own. */
  procedureReviewDays: number
  /** How many times a phrasing must recur before a problem record is expected for it. */
  recurringClusterThreshold: number
  /** How recently the successor pack must have been produced to count as produced. */
  successorPackEveryDays: number
  /** The window a brief covers on a first-ever visit, before there is a last-seen to use. */
  firstBriefWindowHrs: number
}

export interface ThresholdMeta {
  label: string
  /** What moves if this number moves. */
  effect: string
}

export const THRESHOLD_META: Record<keyof Thresholds, ThresholdMeta> = {
  recommendationWindowDays: {
    label: 'Recommendation cadence window',
    effect: 'An improvement area with nothing raised inside it reads as silent, and the cadence commitment goes behind',
  },
  procedureReviewDays: {
    label: 'Procedure review period',
    effect: 'A procedure not reviewed inside it reads as overdue, and its area stops counting as covered',
  },
  recurringClusterThreshold: {
    label: 'Problem-record threshold',
    effect: 'A repeating phrasing at or above it is expected to carry a named cause; below it, it is noise',
  },
  successorPackEveryDays: {
    label: 'Successor pack frequency',
    effect: 'A pack older than this stops counting, and the commitment that it is produced rather than promised goes behind',
  },
  firstBriefWindowHrs: {
    label: 'First-visit brief window',
    effect: 'How far back the first brief of a session looks when there is no previous visit to measure from',
  },
}

/**
 * What the platform holds itself to where a contract says nothing. These are
 * ours: a client that negotiates different terms states them on its
 * engagement and the defaults give way.
 */
export const PLATFORM_DEFAULTS: Thresholds = {
  recommendationWindowDays: 90,
  procedureReviewDays: 180,
  recurringClusterThreshold: 10,
  successorPackEveryDays: 365,
  firstBriefWindowHrs: 12,
}

export interface ThresholdReading {
  key: keyof Thresholds
  label: string
  effect: string
  value: number
  /** Whether this engagement states it, or takes ours. */
  source: 'contract' | 'platform default'
}

/** The thresholds in force for an engagement: its own where stated, ours otherwise. */
export function thresholdsFor(engagementId: string = ENGAGEMENT.id): Thresholds {
  const stated = ENGAGEMENT_BY_ID[engagementId]?.thresholds ?? {}
  return { ...PLATFORM_DEFAULTS, ...stated }
}

/** The same, with where each number came from, for anyone who asks. */
export function readThresholds(engagementId: string = ENGAGEMENT.id): ThresholdReading[] {
  const stated = ENGAGEMENT_BY_ID[engagementId]?.thresholds ?? {}
  const live = thresholdsFor(engagementId)
  return (Object.keys(PLATFORM_DEFAULTS) as (keyof Thresholds)[]).map((key) => ({
    key,
    label: THRESHOLD_META[key].label,
    effect: THRESHOLD_META[key].effect,
    value: live[key],
    source: stated[key] === undefined ? 'platform default' : 'contract',
  }))
}
