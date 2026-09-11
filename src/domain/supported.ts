import { INVENTORY, KIND_LABEL, LIFECYCLE, type Lifecycle } from './inventory'
import { DATA_ITEM_BY_ID, DATA_KIND_LABEL, DATA_LIFECYCLE, contractState, descendants, type DataKind } from './dataEstate'

/* ==========================================================================
   Supported items — anything the service changes, whichever register holds
   it. Releases and work orders take an application or a data item alike,
   and the rules they apply come from the item's lifecycle rather than from
   the register it sits in.
   ========================================================================== */

/** How a change to each kind of data item is shipped and undone. */
const DATA_CHANGE: Record<DataKind, Lifecycle> = {
  // A source is changed by the system that emits it, and we cannot roll that back.
  source: { codeReleasedBy: 'vendor', canRollBackCode: false, vendorRole: 'primary', configScope: 'interface contract' },
  pipeline: { codeReleasedBy: 'us', canRollBackCode: true, vendorRole: 'none', configScope: 'codebase' },
  // Rows once written stay written: a schema change is compensated, not reversed.
  dataset: { codeReleasedBy: 'us', canRollBackCode: false, compensable: true, vendorRole: 'none', configScope: 'schema' },
  semantic_model: { codeReleasedBy: 'us', canRollBackCode: true, vendorRole: 'none', configScope: 'model definition' },
  report: { codeReleasedBy: 'us', canRollBackCode: true, vendorRole: 'none', configScope: 'report definition' },
}

export interface SupportedItem {
  id: string
  name: string
  register: 'application' | 'data'
  kindLabel: string
  lifecycle: Lifecycle
  /** Data items held to a contract: the state of the one a change is verified against. */
  contract?: 'enforced' | 'declared' | 'none'
  /** Data items: how many items read from it, directly or not. */
  downstream?: number
}

export function supportedItem(id: string): SupportedItem | undefined {
  const app = INVENTORY.find((i) => i.id === id)
  if (app) return { id, name: app.name, register: 'application', kindLabel: KIND_LABEL[app.kind], lifecycle: LIFECYCLE[app.kind] }
  const d = DATA_ITEM_BY_ID[id]
  if (!d) return undefined
  return {
    id,
    name: d.name,
    register: 'data',
    kindLabel: DATA_KIND_LABEL[d.kind],
    lifecycle: DATA_CHANGE[d.kind],
    contract: DATA_LIFECYCLE[d.kind].contracted ? contractState(d) : undefined,
    downstream: descendants(id).length,
  }
}
