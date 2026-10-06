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

export function setConfig(engagements: Engagement[]) {
  if (!engagements.length) throw new Error('The configuration holds no engagements.')
  loaded = engagements
}

export function configuredEngagements(): Engagement[] {
  if (!loaded) {
    throw new Error(
      'The engagement configuration was read before it was loaded. The domain must only be imported after the bootstrap has fetched /api/config.',
    )
  }
  return loaded
}

export const isLoaded = () => loaded !== null
