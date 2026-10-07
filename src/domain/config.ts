import type { Engagement } from './engagement'

/* ==========================================================================
   The configuration the application was started with.

   Engagements are read from the database before anything else is imported,
   and left here for the domain to pick up synchronously. That ordering is
   what lets every reader stay as it was: nothing had to become asynchronous
   because the contract moved out of the code.

   There is no default and no fallback. Reading this before the bootstrap has
   filled it is a programming error — an import that runs too early — and it
   throws rather than handing back an empty engagement that would quietly
   read as a client with no contract.
   ========================================================================== */

let loaded: Engagement[] | null = null
let records: Record<string, unknown[]> = {}
let engagementId = ''

export function setConfig(engagements: Engagement[]) {
  if (!engagements.length) throw new Error('The configuration holds no engagements.')
  loaded = engagements
  // The engagement the operational surfaces read: whichever has an estate.
  engagementId = (engagements.find((e) => e.ingested?.estate) ?? engagements[0]).id
}

/** What people had recorded, as the database held it when the application started. */
export function setRecords(registers: Record<string, unknown[]>) {
  records = registers ?? {}
}

export const loadedRecords = (): Record<string, unknown[]> => records

/** The engagement records are written against. */
export const recordEngagementId = () => engagementId

export function configuredEngagements(): Engagement[] {
  if (!loaded) {
    throw new Error(
      'The engagement configuration was read before it was loaded. The domain must only be imported after the bootstrap has fetched /api/config.',
    )
  }
  return loaded
}

export const isLoaded = () => loaded !== null
