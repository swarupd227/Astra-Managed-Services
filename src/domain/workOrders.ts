import { NOW } from './workSeed'
import type { ISO } from './types'

/* ==========================================================================
   Project work orders — development that sits outside the run service.

   A managed application service carries a small, separately authorised
   stream of development alongside its run work. Two things go wrong with it
   routinely, and both are controls rather than reports.

   Work starts before it is authorised. An enhancement that ships without a
   signed work order has been paid for out of the run service, which quietly
   inflates the effort the run is measured on and leaves nobody accountable
   for scope. Here a release carrying enhancement work must name authorised
   work orders, and one that does not is flagged at the release gate.

   Burn outruns estimate without anyone deciding it should. On a fixed-price
   order that is the provider's problem; on time and materials it is the
   client's money, and an overrun with no change request behind it is spend
   nobody agreed.
   ========================================================================== */

export type PwoState = 'requested' | 'estimated' | 'authorised' | 'in_delivery' | 'accepted' | 'declined'
export type Commercial = 'fixed_price' | 'time_and_materials'

export const PWO_STATE_LABEL: Record<PwoState, string> = {
  requested: 'requested',
  estimated: 'estimated',
  authorised: 'authorised',
  in_delivery: 'in delivery',
  accepted: 'accepted',
  declined: 'declined',
}

export const COMMERCIAL_LABEL: Record<Commercial, string> = {
  fixed_price: 'Fixed price',
  time_and_materials: 'T&M',
}

export interface WorkOrder {
  id: string
  title: string
  /** The supported item the work changes — an application or a data item. */
  itemId: string
  requestedBy: string
  authorisedBy?: string
  authorisedAt?: ISO
  commercial: Commercial
  estimateHrs: number
  burnHrs: number
  state: PwoState
  raisedAt: ISO
  targetAt: ISO
  changeRequests: number
  objectiveId?: string
}

const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
const ahead = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString()

export const WORK_ORDERS: WorkOrder[] = [
  {
    id: 'PWO-0142', title: 'Time entry cutover from IEM to Concur', itemId: 'inv_concur',
    requestedBy: 'R. Castellano', authorisedBy: 'E. Whitfield', authorisedAt: ago(40),
    commercial: 'fixed_price', estimateHrs: 640, burnHrs: 412, state: 'in_delivery',
    raisedAt: ago(52), targetAt: ahead(118), changeRequests: 1, objectiveId: 'obj_modernization',
  },
  {
    id: 'PWO-0147', title: 'Rate-card billing rules', itemId: 'inv_focus',
    requestedBy: 'J. Whitcombe', authorisedBy: 'J. Whitcombe', authorisedAt: ago(30),
    commercial: 'time_and_materials', estimateHrs: 120, burnHrs: 138, state: 'in_delivery',
    raisedAt: ago(34), targetAt: ahead(12), changeRequests: 0,
  },
  {
    id: 'PWO-0151', title: 'Integration bridge — second owner and monitoring', itemId: 'inv_mulesoft',
    requestedBy: 'R. Castellano',
    commercial: 'fixed_price', estimateHrs: 96, burnHrs: 0, state: 'estimated',
    raisedAt: ago(9), targetAt: ahead(60), changeRequests: 0, objectiveId: 'obj_modernization',
  },
  {
    id: 'PWO-0153', title: 'Post-cutover HR report pack', itemId: 'inv_workday',
    requestedBy: 'S. Raghunathan',
    commercial: 'time_and_materials', estimateHrs: 0, burnHrs: 0, state: 'requested',
    raisedAt: ago(3), targetAt: ahead(75), changeRequests: 0,
  },
  {
    id: 'PWO-0138', title: 'HCM data archive before decommission', itemId: 'inv_peoplesoft',
    requestedBy: 'R. Castellano', authorisedBy: 'E. Whitfield', authorisedAt: ago(90),
    commercial: 'fixed_price', estimateHrs: 220, burnHrs: 204, state: 'accepted',
    raisedAt: ago(96), targetAt: ago(10), changeRequests: 0, objectiveId: 'obj_modernization',
  },
  {
    id: 'PWO-0156', title: 'Service catalogue redesign', itemId: 'inv_servicenow',
    requestedBy: 'M. Okafor',
    commercial: 'time_and_materials', estimateHrs: 80, burnHrs: 46, state: 'in_delivery',
    raisedAt: ago(14), targetAt: ahead(20), changeRequests: 0,
  },
  {
    id: 'PWO-0158', title: 'One net-revenue definition across Research & Analytics', itemId: 'sm_research',
    requestedBy: 'S. Okafor', authorisedBy: 'S. Okafor', authorisedAt: ago(12),
    commercial: 'fixed_price', estimateHrs: 64, burnHrs: 22, state: 'in_delivery',
    raisedAt: ago(20), targetAt: ahead(25), changeRequests: 0,
  },
  {
    id: 'PWO-0159', title: 'Practice staffing feed into the utilisation load', itemId: 'pl_utilisation_load',
    requestedBy: 'S. Okafor',
    commercial: 'time_and_materials', estimateHrs: 0, burnHrs: 0, state: 'requested',
    raisedAt: ago(5), targetAt: ahead(70), changeRequests: 0,
  },
]

/** Authorised, and in a state where that authorisation still stands. */
export function isAuthorised(w: WorkOrder): boolean {
  return Boolean(w.authorisedBy) && ['authorised', 'in_delivery', 'accepted'].includes(w.state)
}

/* ------------------------------- The reading -------------------------------- */

export type PwoFlag = 'unauthorised_delivery' | 'tm_overrun_no_cr' | 'fixed_overrun' | 'past_target'

export const PWO_FLAG_LABEL: Record<PwoFlag, string> = {
  unauthorised_delivery: 'In delivery without authorisation',
  tm_overrun_no_cr: 'T&M overrun, no change request',
  fixed_overrun: 'Fixed-price overrun',
  past_target: 'Past target date',
}

export interface WorkOrderReading {
  pwo: WorkOrder
  burnPct: number | null
  flags: PwoFlag[]
}

export function readWorkOrder(w: WorkOrder, nowMs = NOW.getTime()): WorkOrderReading {
  const flags: PwoFlag[] = []
  if (w.state === 'in_delivery' && !w.authorisedBy) flags.push('unauthorised_delivery')
  if (w.commercial === 'time_and_materials' && w.estimateHrs > 0 && w.burnHrs > w.estimateHrs && w.changeRequests === 0) flags.push('tm_overrun_no_cr')
  if (w.commercial === 'fixed_price' && w.estimateHrs > 0 && w.burnHrs > w.estimateHrs) flags.push('fixed_overrun')
  if (['authorised', 'in_delivery'].includes(w.state) && Date.parse(w.targetAt) < nowMs) flags.push('past_target')
  return { pwo: w, burnPct: w.estimateHrs > 0 ? (w.burnHrs / w.estimateHrs) * 100 : null, flags }
}

export interface WorkOrderSummary {
  readings: WorkOrderReading[]
  open: number
  inDelivery: number
  unauthorisedInDelivery: number
  overrun: number
  authorisedEstimateHrs: number
  burnHrs: number
  awaitingAuthorisation: number
}

export function workOrderSummary(nowMs = NOW.getTime()): WorkOrderSummary {
  const readings = WORK_ORDERS.map((w) => readWorkOrder(w, nowMs))
  const open = WORK_ORDERS.filter((w) => !['accepted', 'declined'].includes(w.state))
  return {
    readings,
    open: open.length,
    inDelivery: WORK_ORDERS.filter((w) => w.state === 'in_delivery').length,
    unauthorisedInDelivery: readings.filter((r) => r.flags.includes('unauthorised_delivery')).length,
    overrun: readings.filter((r) => r.flags.includes('tm_overrun_no_cr') || r.flags.includes('fixed_overrun')).length,
    authorisedEstimateHrs: WORK_ORDERS.filter(isAuthorised).reduce((s, w) => s + w.estimateHrs, 0),
    burnHrs: WORK_ORDERS.reduce((s, w) => s + w.burnHrs, 0),
    awaitingAuthorisation: WORK_ORDERS.filter((w) => ['requested', 'estimated'].includes(w.state)).length,
  }
}
