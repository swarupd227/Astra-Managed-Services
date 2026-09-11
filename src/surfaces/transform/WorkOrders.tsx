import React from 'react'
import { ClipboardList } from 'lucide-react'
import {
  COMMERCIAL_LABEL, PWO_FLAG_LABEL, PWO_STATE_LABEL, workOrderSummary, type PwoState,
} from '@/domain/workOrders'
import { supportedItem } from '@/domain/supported'
import { PageHeader } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Bar, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { num } from '@/lib/format'

/* ==========================================================================
   Work orders — separately authorised development.

   Two controls surface here as flags: work in delivery with no authorisation
   behind it, and burn beyond estimate that nobody agreed. The release gate
   reads the same authorisation, so an enhancement cannot ship against an
   order that was never signed.
   ========================================================================== */

const STATE_TONE: Record<PwoState, 'neutral' | 'info' | 'brand' | 'agent' | 'ok'> = {
  requested: 'neutral', estimated: 'info', authorised: 'brand', in_delivery: 'agent', accepted: 'ok', declined: 'neutral',
}

export function WorkOrders() {
  const s = React.useMemo(() => workOrderSummary(), [])
  const itemName = (id: string) => supportedItem(id)?.name ?? id

  return (
    <>
      <PageHeader title="Work orders" subtitle="Separately authorised development against applications and the data estate" />

      <ProducedBy agents={['agt_forge']} what="estimating, and generating code and tests" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Open" value={s.open} />
        <Metric size="sm" label="In delivery" value={s.inDelivery} />
        <Metric size="sm" label="Unauthorised in delivery" value={s.unauthorisedInDelivery} deltaTone={s.unauthorisedInDelivery ? 'crit' : 'ok'} />
        <Metric size="sm" label="Overrun" value={s.overrun} deltaTone={s.overrun ? 'warn' : 'ok'} />
        <Metric size="sm" label="Awaiting authorisation" value={s.awaitingAuthorisation} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card title="Work orders" subtitle={`${s.readings.length} orders · ${num(s.authorisedEstimateHrs)} h authorised · ${num(s.burnHrs)} h burned`} right={<ClipboardList size={13} className="text-ink-3" />}>
          <Table>
            <thead>
              <tr>
                <Th>Order</Th><Th>Item</Th><Th>State</Th><Th>Authorised by</Th>
                <Th align="right">Estimate (h)</Th><Th>Burn</Th><Th>Flags</Th>
              </tr>
            </thead>
            <tbody>
              {s.readings.map(({ pwo, burnPct, flags }) => (
                <Tr key={pwo.id} className={flags.includes('unauthorised_delivery') ? 'bg-crit/[0.05]' : undefined}>
                  <Td className="max-w-[240px] text-2xs text-ink">
                    {pwo.title}
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-3"><span className="font-mono">{pwo.id}</span><span>· {COMMERCIAL_LABEL[pwo.commercial]}</span></span>
                  </Td>
                  <Td className="text-2xs text-ink-2">{itemName(pwo.itemId)}</Td>
                  <Td><Chip tone={STATE_TONE[pwo.state]}>{PWO_STATE_LABEL[pwo.state]}</Chip></Td>
                  <Td className="text-2xs text-ink-2">
                    {pwo.authorisedBy ?? <Chip tone={pwo.state === 'in_delivery' ? 'crit' : 'neutral'}>Not authorised</Chip>}
                  </Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{pwo.estimateHrs ? num(pwo.estimateHrs) : '—'}</Td>
                  <Td className="min-w-[120px]">
                    {burnPct === null ? (
                      <span className="text-2xs text-ink-3">—</span>
                    ) : (
                      <>
                        <span className="tnum text-2xs text-ink-2">{num(pwo.burnHrs)} h · {Math.round(burnPct)}%</span>
                        <Bar value={Math.min(burnPct, 100)} tone={burnPct > 100 ? 'crit' : 'brand'} height={3} className="mt-1" />
                      </>
                    )}
                  </Td>
                  <Td>
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {flags.map((f) => (
                        <Chip key={f} tone={f === 'unauthorised_delivery' ? 'crit' : 'warn'}>{PWO_FLAG_LABEL[f]}</Chip>
                      ))}
                      {!flags.length && <span className="text-2xs text-ink-3">—</span>}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  )
}
