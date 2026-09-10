import React from 'react'
import { Hourglass, Truck } from 'lucide-react'
import { TIER_LABEL, vendorSummary } from '@/domain/vendors'
import { PageHeader } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import type { WorkObject } from '@/domain/types'

/* ==========================================================================
   Vendors — suppliers, their commitments, and the work waiting on them.

   Held work is read from the queue, not kept here: an item paused on a
   vendor dependency whose demand class belongs to one of the vendor's
   applications. An item spanning two vendors appears under both and is
   counted once in the totals.
   ========================================================================== */

interface HeldRow {
  work: WorkObject
  vendors: string[]
  hoursHeld: number
  beyond: boolean
}

export function Vendors() {
  const s = React.useMemo(() => vendorSummary(), [])

  const held = React.useMemo(() => {
    const rows = new Map<string, HeldRow>()
    for (const p of s.positions) {
      for (const h of p.held) {
        const row = rows.get(h.work.id) ?? { work: h.work, vendors: [], hoursHeld: h.hoursHeld, beyond: false }
        row.vendors.push(p.vendor.name)
        row.beyond = row.beyond || h.beyondResponse
        rows.set(h.work.id, row)
      }
    }
    return [...rows.values()].sort((a, b) => b.hoursHeld - a.hoursHeld)
  }, [s])

  return (
    <>
      <PageHeader title="Vendors" subtitle="Suppliers, contracts, response commitments and held work" />

      <ProducedBy agents={['agt_diagnost', 'agt_herald']} what="assembling the evidence for a vendor case, and drafting escalations" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Vendors" value={s.positions.length} />
        <Metric size="sm" label="Held on a vendor" value={s.heldItems} deltaTone={s.heldItems ? 'warn' : 'ok'} />
        <Metric size="sm" label="Beyond contracted response" value={s.beyondResponse} deltaTone={s.beyondResponse ? 'crit' : 'ok'} />
        <Metric size="sm" label="Renewals within 90 days" value={s.renewalsWithin90d} deltaTone={s.renewalsWithin90d ? 'warn' : 'ok'} />
        <Metric size="sm" label="No contract on file" value={s.noContract} deltaTone={s.noContract ? 'crit' : 'ok'} hint={`${s.appsWithoutContract} application${s.appsWithoutContract === 1 ? '' : 's'}`} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card title="Vendors" subtitle={`${s.positions.length} suppliers`} right={<Truck size={13} className="text-ink-3" />}>
          <Table>
            <thead>
              <tr>
                <Th>Vendor</Th><Th>Tier</Th><Th>Contract</Th><Th align="right">Response (h)</Th>
                <Th>Applications</Th><Th align="right">Held</Th><Th align="right">Renewal</Th>
              </tr>
            </thead>
            <tbody>
              {s.positions.map((p) => (
                <Tr key={p.vendor.id} className={p.noContract ? 'bg-crit/[0.05]' : undefined}>
                  <Td className="text-2xs text-ink">
                    {p.vendor.name}
                    {p.vendor.escalation && <span className="block text-[10px] text-ink-3">{p.vendor.escalation}</span>}
                  </Td>
                  <Td><Chip tone={p.vendor.supportTier === 'premier' ? 'brand' : 'neutral'}>{TIER_LABEL[p.vendor.supportTier]}</Chip></Td>
                  <Td className="text-2xs text-ink-2">{p.noContract ? <Chip tone="crit">None on file</Chip> : p.vendor.contractRef}</Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{p.vendor.responseHrs}</Td>
                  <Td>
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {p.apps.map((a) => <Chip key={a.id}>{a.name}</Chip>)}
                    </div>
                  </Td>
                  <Td align="right" className="tnum text-2xs text-ink">
                    {p.held.length ? (
                      <Chip tone={p.held.some((h) => h.beyondResponse) ? 'crit' : 'warn'}>{p.held.length}</Chip>
                    ) : <span className="text-ink-3">—</span>}
                  </Td>
                  <Td align="right" className="tnum text-2xs">
                    <span className={p.renewalDays <= 90 ? 'text-warn' : 'text-ink-2'}>{p.renewalDays} d</span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card className="mt-4" title="Held on a vendor" subtitle={`${held.length} work items`} right={<Hourglass size={13} className="text-ink-3" />}>
          {held.length === 0 ? (
            <p className="text-2xs text-ink-3">Nothing held.</p>
          ) : (
            <Table>
              <thead>
                <tr><Th>Work item</Th><Th>Vendor</Th><Th align="right">Held (h)</Th><Th>Response</Th></tr>
              </thead>
              <tbody>
                {held.map((h) => (
                  <Tr key={h.work.id}>
                    <Td className="max-w-[340px] text-2xs text-ink">
                      {h.work.title}
                      <span className="block font-mono text-[10px] text-ink-3">{h.work.ref}</span>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">{h.vendors.map((v) => <Chip key={v}>{v}</Chip>)}</div>
                    </Td>
                    <Td align="right" className="tnum text-2xs text-ink-2">{h.hoursHeld.toFixed(1)}</Td>
                    <Td><Chip tone={h.beyond ? 'crit' : 'ok'}>{h.beyond ? 'Beyond commitment' : 'Within commitment'}</Chip></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  )
}
