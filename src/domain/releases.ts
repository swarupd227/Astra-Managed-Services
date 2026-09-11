import { NOW } from './workSeed'
import { supportedItem, type SupportedItem } from './supported'
import { WORK_ORDERS, isAuthorised } from './workOrders'
import type { ISO } from './types'

/* ==========================================================================
   Releases — changes grouped into something that ships in a window.

   The platform executed individual changes and gated each one, but had no
   release: nothing grouped changes into a version, placed it in a window,
   checked the window against a freeze, or tied it to the regression evidence
   that justified shipping it.

   Every rule here keys off the item's lifecycle, not its name or the
   register it sits in. The vendor ships a SaaS product's code, and nobody
   else can roll it back — so for a SaaS vendor release the regression pack
   run before adoption is the only control there is, and a release with no
   rollback path is flagged as such rather than dressed as low risk. An
   internal code release into a SaaS product is not a release at all; tenant
   configuration is. A vendor release on something we build ourselves has no
   vendor to come from.

   A data item adds two things. A dataset cannot be rolled back once rows
   are written, so a change to it is compensated rather than reversed, and
   that is said plainly. And a change to a data item is verified against its
   contract; one with no enforced contract has nothing to verify against.

   And an enhancement ships against authorised work orders or it is stopped.
   ========================================================================== */

export type ReleaseOrigin = 'vendor' | 'internal'
export type ReleaseScope = 'code' | 'configuration'
export type ReleasePurpose = 'vendor_update' | 'maintenance' | 'enhancement'
export type ReleaseState = 'planned' | 'testing' | 'approved' | 'held' | 'deployed' | 'verified' | 'rolled_back'

export const RELEASE_STATE_LABEL: Record<ReleaseState, string> = {
  planned: 'planned',
  testing: 'testing',
  approved: 'approved',
  held: 'held',
  deployed: 'deployed',
  verified: 'verified',
  rolled_back: 'rolled back',
}

export const PURPOSE_LABEL: Record<ReleasePurpose, string> = {
  vendor_update: 'Vendor update',
  maintenance: 'Maintenance',
  enhancement: 'Enhancement',
}

export interface Regression {
  selected: number
  passed: number
  failed: number
  /** The agent that selected and ran the pack. */
  runBy: string
}

export interface Release {
  id: string
  /** The supported item the release changes — an application or a data item. */
  itemId: string
  origin: ReleaseOrigin
  scope: ReleaseScope
  purpose: ReleasePurpose
  version: string
  windowStart: ISO
  windowEnd: ISO
  state: ReleaseState
  regression: Regression | null
  rollback: 'tested' | 'untested'
  pwoIds: string[]
  approvedBy?: string
}

export interface Freeze {
  id: string
  name: string
  start: ISO
  end: ISO
}

const at = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString()

export const FREEZES: Freeze[] = [
  { id: 'frz_close', name: 'Month-end close', start: at(8), end: at(13) },
]

export const RELEASES: Release[] = [
  {
    id: 'REL-2027-031', itemId: 'inv_workday', origin: 'vendor', scope: 'code', purpose: 'vendor_update',
    version: '2027 R1', windowStart: at(6), windowEnd: at(6.3), state: 'testing',
    regression: { selected: 412, passed: 409, failed: 3, runBy: 'agt_sentryq' }, rollback: 'untested', pwoIds: [],
  },
  {
    id: 'REL-2027-033', itemId: 'inv_servicenow', origin: 'vendor', scope: 'code', purpose: 'vendor_update',
    version: 'Washington DC · patch 4', windowStart: at(9), windowEnd: at(9.2), state: 'approved',
    regression: { selected: 286, passed: 286, failed: 0, runBy: 'agt_sentryq' }, rollback: 'untested', pwoIds: [], approvedBy: 'R. Castellano',
  },
  {
    id: 'REL-2027-034', itemId: 'inv_focus', origin: 'internal', scope: 'code', purpose: 'enhancement',
    version: 'focus-24.12.0', windowStart: at(10), windowEnd: at(10.2), state: 'planned',
    regression: null, rollback: 'tested', pwoIds: ['PWO-0147'],
  },
  {
    id: 'REL-2027-029', itemId: 'inv_mulesoft', origin: 'vendor', scope: 'code', purpose: 'vendor_update',
    version: 'Anypoint 4.6.0', windowStart: at(-1), windowEnd: at(-0.8), state: 'held',
    regression: { selected: 188, passed: 180, failed: 8, runBy: 'agt_sentryq' }, rollback: 'tested', pwoIds: [],
  },
  {
    id: 'REL-2027-036', itemId: 'inv_sap', origin: 'vendor', scope: 'code', purpose: 'vendor_update',
    version: 'S/4HANA 2023 FPS03', windowStart: at(21), windowEnd: at(22), state: 'planned',
    regression: null, rollback: 'untested', pwoIds: [],
  },
  {
    id: 'REL-2027-024', itemId: 'inv_peoplesoft', origin: 'vendor', scope: 'code', purpose: 'vendor_update',
    version: 'PUM 48', windowStart: at(-12), windowEnd: at(-11.8), state: 'verified',
    regression: { selected: 940, passed: 940, failed: 0, runBy: 'agt_sentryq' }, rollback: 'tested', pwoIds: [], approvedBy: 'R. Castellano',
  },
  {
    id: 'REL-2027-027', itemId: 'inv_m365', origin: 'vendor', scope: 'code', purpose: 'vendor_update',
    version: 'Monthly Enterprise Channel 2502', windowStart: at(-4), windowEnd: at(-3.8), state: 'verified',
    regression: { selected: 1120, passed: 1120, failed: 0, runBy: 'agt_sentryq' }, rollback: 'untested', pwoIds: [], approvedBy: 'P. Lindegaard',
  },
  {
    id: 'REL-2027-026', itemId: 'inv_iem', origin: 'internal', scope: 'code', purpose: 'maintenance',
    version: 'iem-2019.4.1', windowStart: at(-6), windowEnd: at(-5.9), state: 'rolled_back',
    regression: { selected: 64, passed: 61, failed: 3, runBy: 'agt_sentryq' }, rollback: 'tested', pwoIds: [], approvedBy: 'R. Castellano',
  },
  {
    id: 'REL-2027-038', itemId: 'inv_concur', origin: 'internal', scope: 'configuration', purpose: 'enhancement',
    version: 'Time entry cutover', windowStart: at(30), windowEnd: at(30.5), state: 'planned',
    regression: null, rollback: 'tested', pwoIds: ['PWO-0142'],
  },
  {
    id: 'REL-2027-035', itemId: 'inv_servicenow', origin: 'internal', scope: 'configuration', purpose: 'enhancement',
    version: 'Catalogue redesign', windowStart: at(15), windowEnd: at(15.2), state: 'testing',
    regression: { selected: 142, passed: 142, failed: 0, runBy: 'agt_sentryq' }, rollback: 'tested', pwoIds: ['PWO-0156'],
  },
  {
    id: 'REL-2027-039', itemId: 'pl_utilisation_load', origin: 'internal', scope: 'code', purpose: 'maintenance',
    version: 'Schema-drift guard on the HCM feed', windowStart: at(1), windowEnd: at(1.1), state: 'testing',
    regression: { selected: 36, passed: 36, failed: 0, runBy: 'agt_custodian' }, rollback: 'tested', pwoIds: [],
  },
  {
    id: 'REL-2027-040', itemId: 'sm_research', origin: 'internal', scope: 'code', purpose: 'enhancement',
    version: 'One net-revenue definition', windowStart: at(11), windowEnd: at(11.1), state: 'planned',
    regression: null, rollback: 'tested', pwoIds: ['PWO-0158'],
  },
  {
    id: 'REL-2027-041', itemId: 'ds_client_dim', origin: 'internal', scope: 'code', purpose: 'maintenance',
    version: 'client_ref widened to 64 characters', windowStart: at(4), windowEnd: at(4.1), state: 'approved',
    regression: { selected: 22, passed: 22, failed: 0, runBy: 'agt_custodian' }, rollback: 'untested', pwoIds: [], approvedBy: 'S. Okafor',
  },
  {
    id: 'REL-2027-042', itemId: 'ds_engagement_silver', origin: 'internal', scope: 'code', purpose: 'maintenance',
    version: 'Monthly partitioning', windowStart: at(18), windowEnd: at(18.2), state: 'planned',
    regression: null, rollback: 'untested', pwoIds: [],
  },
]

/* ------------------------------- The reading -------------------------------- */

export type ReleaseFlag =
  | 'code_into_saas' | 'vendor_on_custom' | 'approved_failing' | 'unauthorised_pwo'
  | 'no_rollback' | 'compensate_only' | 'untested_rollback' | 'no_contract' | 'in_freeze'

export const RELEASE_FLAG_LABEL: Record<ReleaseFlag, string> = {
  code_into_saas: 'Internal code into vendor product',
  vendor_on_custom: 'Vendor release on in-house build',
  approved_failing: 'Approved with failing tests',
  unauthorised_pwo: 'No authorised work order',
  no_rollback: 'No rollback path',
  compensate_only: 'Compensation only',
  untested_rollback: 'Rollback untested',
  no_contract: 'No enforced contract',
  in_freeze: 'Inside change freeze',
}

/** Flags that stop a release, as opposed to ones that inform the decision. */
export const RELEASE_FLAG_BLOCKS: Record<ReleaseFlag, boolean> = {
  code_into_saas: true,
  vendor_on_custom: true,
  approved_failing: true,
  unauthorised_pwo: true,
  no_rollback: false,
  compensate_only: false,
  untested_rollback: false,
  no_contract: false,
  in_freeze: false,
}

export interface ReleaseReading {
  release: Release
  item?: SupportedItem
  freeze: Freeze | null
  gate: 'pass' | 'fail' | 'pending'
  flags: ReleaseFlag[]
  blocked: boolean
  upcoming: boolean
  /** Data items: how many items read from the one being changed. */
  downstream: number | null
}

const overlaps = (a0: ISO, a1: ISO, b0: ISO, b1: ISO) =>
  Date.parse(a0) < Date.parse(b1) && Date.parse(b0) < Date.parse(a1)

export function readRelease(r: Release, nowMs = NOW.getTime()): ReleaseReading {
  const item = supportedItem(r.itemId)
  const lc = item?.lifecycle
  const freeze = FREEZES.find((f) => overlaps(r.windowStart, r.windowEnd, f.start, f.end)) ?? null
  const gate: ReleaseReading['gate'] = !r.regression ? 'pending' : r.regression.failed > 0 ? 'fail' : 'pass'

  const flags: ReleaseFlag[] = []
  if (lc && lc.codeReleasedBy === 'vendor' && !lc.canRollBackCode && r.origin === 'internal' && r.scope === 'code') flags.push('code_into_saas')
  if (lc && lc.vendorRole === 'none' && r.origin === 'vendor') flags.push('vendor_on_custom')
  if (['approved', 'deployed', 'verified'].includes(r.state) && gate === 'fail') flags.push('approved_failing')
  if (r.purpose === 'enhancement') {
    const orders = r.pwoIds.map((id) => WORK_ORDERS.find((w) => w.id === id))
    if (!orders.length || orders.some((o) => !o || !isAuthorised(o))) flags.push('unauthorised_pwo')
  }
  // Rollback, contract and freeze bear on a release that has not shipped.
  // Once it is verified or rolled back they are history, and flagging them
  // is noise.
  const pending = ['planned', 'testing', 'approved', 'held'].includes(r.state)
  // The lifecycle, not the seed, decides whether a rollback path exists: code
  // that cannot be rolled back, shipped by whoever ships it.
  const irreversible = Boolean(lc && !lc.canRollBackCode && r.scope === 'code' && (r.origin === 'vendor' || lc.codeReleasedBy === 'us'))
  if (pending && irreversible) flags.push(lc?.compensable ? 'compensate_only' : 'no_rollback')
  else if (pending && r.rollback === 'untested') flags.push('untested_rollback')
  if (pending && item?.contract && item.contract !== 'enforced') flags.push('no_contract')
  if (pending && freeze) flags.push('in_freeze')

  return {
    release: r,
    item,
    freeze,
    gate,
    flags,
    blocked: flags.some((f) => RELEASE_FLAG_BLOCKS[f]),
    upcoming: Date.parse(r.windowStart) > nowMs,
    downstream: item?.downstream ?? null,
  }
}

export interface ReleaseSummary {
  readings: ReleaseReading[]
  upcoming: number
  next14d: number
  gateFail: number
  blocked: number
  inFreeze: number
  /** Verified against verified plus rolled back. Null until one has completed. */
  changeSuccessPct: number | null
}

export function releaseSummary(nowMs = NOW.getTime()): ReleaseSummary {
  const readings = RELEASES.map((r) => readRelease(r, nowMs))
    .sort((a, b) => Date.parse(a.release.windowStart) - Date.parse(b.release.windowStart))
  const verified = RELEASES.filter((r) => r.state === 'verified').length
  const rolledBack = RELEASES.filter((r) => r.state === 'rolled_back').length
  const horizon = nowMs + 14 * 86_400_000
  return {
    readings,
    upcoming: readings.filter((r) => r.upcoming).length,
    next14d: readings.filter((r) => r.upcoming && Date.parse(r.release.windowStart) <= horizon).length,
    gateFail: readings.filter((r) => r.gate === 'fail').length,
    blocked: readings.filter((r) => r.blocked).length,
    inFreeze: readings.filter((r) => r.freeze).length,
    changeSuccessPct: verified + rolledBack ? (verified / (verified + rolledBack)) * 100 : null,
  }
}
