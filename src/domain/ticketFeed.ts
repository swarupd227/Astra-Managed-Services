import { loadedTicketFeeds } from './config'
import { ENGAGEMENT } from './engagement'
import type { Priority } from './types'

/* ==========================================================================
   The client's incident feed: how their dump is read, and what it contained.

   The ticket history next door holds aggregates — a count, eight themes,
   twenty-two recurring phrasings. Those describe demand. This holds the thing
   they were counted from, and one field in particular that the platform had
   no way to use: how many times each of the client's own sub-categories has
   actually arrived.

   That number is the strongest classification signal in the whole extract and
   it was sitting unused. Two and a half thousand account lockouts are a far
   better reason to believe the next lockout is a lockout than any overlap
   between its wording and a stored example — and the classifier was matching
   on wording alone, which is why the client's two largest classes could not
   be classified confidently enough to touch. A ticket reading "Account
   locked" shares almost no words with a stored phrasing, so it reached only
   its theme, scored 45%, and went to a person; and it would have gone to a
   person 2,484 times.

   Two kinds of thing live here and the difference is load-bearing.
   `incidents` is counted from the dump. `classId` and `nodeIds` are declared
   by a person — which costed class a sub-category's demand belongs to, and
   which component in the estate it lands on. Nothing can derive the second
   from the first, and the declaration is what decides which tower, and so
   which approval policy, an arriving ticket falls under.
   ========================================================================== */

/** One of the client's own sub-categories, with what arrived under it. */
export interface SubCategoryVolume {
  /** Case-folded `category|subCategory`, as the register keys it. */
  key: string
  category: string
  subCategory: string
  /** Arrivals counted under it in the dump. */
  incidents: number
  /** The costed class somebody declared this to be, where one is declared. */
  classId?: string
  /** The estate components this demand lands on, as declared with the class. */
  nodeIds?: string[]
  declaredBy?: string
}

export interface TicketFeed {
  engagementId: string
  /** The system that handed the dump over, as configured. */
  system: string
  source: string | null
  /** Which column fed which field, as a person confirmed it. */
  columnMap: Record<string, string>
  /** What the profiler said about each column, kept so a reviewer can check. */
  because: Record<string, { confidence: number; on: string; why: string }>
  confirmedBy: string
  confirmedAt: string
  loaded: { tickets: number; unreadable: number; foldedRows: number }
  /** The client's priority words, and what each was declared to mean. */
  priorities: Record<string, Priority>
  subCategories: SubCategoryVolume[]
}

const FEEDS = () => loadedTicketFeeds() as TicketFeed[]

export function feedFor(engagementId = ENGAGEMENT.id): TicketFeed | null {
  return FEEDS().find((f) => f.engagementId === engagementId) ?? null
}

/** Whether a dump has been loaded at all. Screens say so rather than guessing. */
export const feedLoaded = (engagementId = ENGAGEMENT.id) => Boolean(feedFor(engagementId)?.loaded.tickets)

export const subCategoryKey = (category: string, subCategory: string) =>
  `${category}|${subCategory}`.toLowerCase().trim()

/**
 * What the client has filed under this category and sub-category before.
 *
 * Keyed case-insensitively, because the dumps file the same category both
 * ways and an arriving ticket will be spelled however the agent who raised it
 * spelled it.
 */
export function volumeFor(
  category: string,
  subCategory: string,
  engagementId = ENGAGEMENT.id,
): SubCategoryVolume | null {
  const feed = feedFor(engagementId)
  if (!feed) return null
  const key = subCategoryKey(category, subCategory)
  return feed.subCategories.find((s) => s.key === key) ?? null
}

/** Sub-categories somebody has declared against a costed class, largest first. */
export function declaredVolumes(engagementId = ENGAGEMENT.id): SubCategoryVolume[] {
  return (feedFor(engagementId)?.subCategories ?? [])
    .filter((s) => s.classId)
    .sort((a, b) => b.incidents - a.incidents)
}

/**
 * How many arrivals a sub-category needs before the platform treats it as a
 * pattern rather than a handful of tickets.
 *
 * Ten, because that is already what this platform means by recurring — the
 * ingested history counts its clusters over ten and nothing else. Reusing it
 * rather than choosing a second number means the two cannot disagree about
 * what "recurs" means.
 */
export const RECURS_AT = 10

/** The largest declared sub-category, which the volume signal is scaled against. */
export const largestDeclared = (engagementId = ENGAGEMENT.id) =>
  Math.max(...declaredVolumes(engagementId).map((s) => s.incidents), 1)
