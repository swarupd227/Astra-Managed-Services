import { NOW, WORK_OBJECTS } from './workSeed'
import { INVENTORY, type InventoryItem } from './inventory'
import type { ISO, WorkObject } from './types'

/* ==========================================================================
   Vendors — the suppliers behind the application portfolio.

   Application support spends much of its time waiting on someone else's
   product. The platform already recorded that waiting — a work item can be
   paused on a vendor dependency — but the vendor itself was nowhere: no
   contract, no response commitment, no renewal date, so the pause could not
   be held to anything.

   A vendor is now a record linked to the applications it supplies, and its
   held work is derived from the queue rather than kept alongside it. A work
   item is held on a vendor when it is paused on a vendor dependency and
   touches one of that vendor's applications by demand class. An item
   touching two vendors' products is held on both, and the totals count it
   once.

   Hours held are measured from the item's creation, which bounds the wait
   from above: the platform does not yet record when the pause began.
   ========================================================================== */

export type SupportTier = 'premier' | 'standard' | 'basic'

export const TIER_LABEL: Record<SupportTier, string> = {
  premier: 'Premier',
  standard: 'Standard',
  basic: 'Basic',
}

export interface Vendor {
  id: string
  name: string
  supportTier: SupportTier
  /** Empty where no contract is on file. */
  contractRef: string
  /** Contracted first response, in hours. */
  responseHrs: number
  escalation: string
  renewalAt: ISO
}

const ahead = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString()

export const VENDORS: Vendor[] = [
  { id: 'ven_microsoft', name: 'Microsoft', supportTier: 'premier', contractRef: 'EA-7731 · Unified Support', responseHrs: 1, escalation: 'Customer Success Account Manager', renewalAt: ahead(212) },
  { id: 'ven_servicenow', name: 'ServiceNow', supportTier: 'premier', contractRef: 'SN-ENT-2025-114', responseHrs: 2, escalation: 'Customer Success Manager', renewalAt: ahead(61) },
  { id: 'ven_sap', name: 'SAP', supportTier: 'premier', contractRef: 'SAP Enterprise Support', responseHrs: 4, escalation: 'MaxAttention TQM', renewalAt: ahead(301) },
  { id: 'ven_oracle', name: 'Oracle', supportTier: 'standard', contractRef: 'Premier Support · CSI 20481', responseHrs: 8, escalation: 'Support Account Manager', renewalAt: ahead(44) },
  { id: 'ven_workday', name: 'Workday', supportTier: 'standard', contractRef: 'WD-SUB-2026', responseHrs: 8, escalation: 'Customer Success', renewalAt: ahead(388) },
  { id: 'ven_salesforce', name: 'Salesforce', supportTier: 'standard', contractRef: 'Signature Success · MuleSoft', responseHrs: 4, escalation: 'Success Manager', renewalAt: ahead(150) },
  { id: 'ven_alteryx', name: 'Alteryx', supportTier: 'basic', contractRef: '', responseHrs: 24, escalation: '', renewalAt: ahead(90) },
]

export const VENDOR_BY_ID = Object.fromEntries(VENDORS.map((v) => [v.id, v])) as Record<string, Vendor>

/* ------------------------------- The reading -------------------------------- */

export interface HeldItem {
  work: WorkObject
  hoursHeld: number
  beyondResponse: boolean
}

export interface VendorPosition {
  vendor: Vendor
  apps: InventoryItem[]
  held: HeldItem[]
  renewalDays: number
  noContract: boolean
}

/**
 * Matched on demand class alone. A work item's affected list names everything
 * in its blast radius, so matching on it attributed a service-catalogue
 * failure to the ERP vendor because the catalogue item touched the ERP
 * database. The demand class is the deliberate classification of what the
 * work is actually about.
 */
function touches(w: WorkObject, apps: InventoryItem[]): boolean {
  return apps.some((a) => a.demandClasses.includes(w.demandClass))
}

export function vendorPosition(v: Vendor, nowMs = NOW.getTime()): VendorPosition {
  const apps = INVENTORY.filter((i) => i.vendorId === v.id)
  const held = WORK_OBJECTS
    .filter((w) => w.pauseReason === 'vendor_dependency' && touches(w, apps))
    .map((w) => {
      const hoursHeld = Math.max(0, (nowMs - Date.parse(w.createdAt)) / 3_600_000)
      return { work: w, hoursHeld, beyondResponse: hoursHeld > v.responseHrs }
    })
  return {
    vendor: v,
    apps,
    held,
    renewalDays: Math.round((Date.parse(v.renewalAt) - nowMs) / 86_400_000),
    noContract: !v.contractRef,
  }
}

export interface VendorSummary {
  positions: VendorPosition[]
  /** Distinct work items held on any vendor. */
  heldItems: number
  /** Distinct work items held beyond the contracted response of at least one vendor. */
  beyondResponse: number
  renewalsWithin90d: number
  noContract: number
  /** Vendors supplying an application with no contract on file. */
  appsWithoutContract: number
}

export function vendorSummary(nowMs = NOW.getTime()): VendorSummary {
  const positions = VENDORS.map((v) => vendorPosition(v, nowMs))
  const held = new Set(positions.flatMap((p) => p.held.map((h) => h.work.id)))
  const beyond = new Set(positions.flatMap((p) => p.held.filter((h) => h.beyondResponse).map((h) => h.work.id)))
  return {
    positions,
    heldItems: held.size,
    beyondResponse: beyond.size,
    renewalsWithin90d: positions.filter((p) => p.renewalDays >= 0 && p.renewalDays <= 90).length,
    noContract: positions.filter((p) => p.noContract).length,
    appsWithoutContract: positions.filter((p) => p.noContract).reduce((s, p) => s + p.apps.length, 0),
  }
}
