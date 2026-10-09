import React from 'react'
import { KeyRound } from 'lucide-react'
import {
  PRODUCTS, RULE_DEFAULTS, RULE_META, SEATS_HELD_AT_TAKEOVER, seatsFree,
} from '@/domain/entitlement'
import { useAstra } from '@/domain/store'
import { Bar, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { num, usd } from '@/lib/format'
import { Band, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Seats, and the policy they are given under.

   The figure that matters is free, and it is only honest if what the vendor
   already held is counted. A pool read from the platform's own grants would
   report forty seats free on a product with three.
   ========================================================================== */

function usePools() {
  const assigned = useAstra((s) => s.seatAssignments)
  return React.useMemo(
    () => PRODUCTS.map((p) => {
      const held = SEATS_HELD_AT_TAKEOVER[p.id] ?? 0
      const mine = assigned.filter((a) => a.productId === p.id).length
      return { product: p, held, mine, free: seatsFree(p.id, assigned) }
    }),
    [assigned],
  )
}

function EntitlementMetrics({ size }: CardProps) {
  const pools = usePools()
  const free = pools.reduce((n, p) => n + p.free, 0)
  const assignedHere = pools.reduce((n, p) => n + p.mine, 0)
  const tightest = [...pools].sort((a, b) => a.free - b.free)[0]
  return (
    <Band size={size} cols={4}>
      <Metric size="sm" label="Seats free" value={num(free)} deltaTone={free > 0 ? 'ok' : 'crit'} />
      <Metric size="sm" label="Tightest" value={tightest ? `${tightest.free} left` : '—'} hint={tightest?.product.name} deltaTone={tightest && tightest.free <= 2 ? 'warn' : undefined} />
      <Metric size="sm" label="Assigned here" value={num(assignedHere)} hint="since takeover" />
      <Metric size="sm" label="Rules in force" value={Object.keys(RULE_DEFAULTS).length} />
    </Band>
  )
}

function EntitlementBody({ size }: CardProps) {
  const pools = usePools()
  return (
    <>
      <Card title="Seats" subtitle="What the vendor already held is counted" right={<KeyRound size={13} className="text-ink-3" />}>
        <Table>
          <thead><tr><Th>Product</Th><Th align="right">Seats</Th><Th align="right">Held at takeover</Th><Th align="right">Assigned here</Th><Th align="right">Free</Th><Th>Use</Th></tr></thead>
          <tbody>
            {pools.map(({ product, held, mine, free }) => (
              <Tr key={product.id}>
                <Td className="text-2xs text-ink">{product.name}</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{num(product.seatsTotal)}</Td>
                <Td align="right" className="tnum text-2xs text-ink-3">{num(held)}</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{num(mine)}</Td>
                <Td align="right" className={free > 0 ? 'tnum text-2xs text-ok' : 'tnum text-2xs text-crit'}>{num(free)}</Td>
                <Td className="w-28"><Bar value={((held + mine) / product.seatsTotal) * 100} tone={free > 0 ? 'brand' : 'crit'} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {size !== 'card' && (
        <Card className="mt-4" title="The rules" subtitle="What each one checks, and why it is there">
          <Table>
            <thead><tr><Th>Rule</Th><Th align="right">Value</Th><Th>Why</Th><Th>Stated by</Th></tr></thead>
            <tbody>
              {(Object.keys(RULE_DEFAULTS) as (keyof typeof RULE_DEFAULTS)[]).map((k) => (
                <Tr key={k}>
                  <Td className="text-2xs text-ink">{RULE_META[k].label}</Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{String(RULE_DEFAULTS[k])}</Td>
                  <Td className="max-w-[320px] text-2xs text-ink-3">{RULE_META[k].because}</Td>
                  <Td><Chip tone="warn">the platform</Chip></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {size !== 'card' && (
        <Card className="mt-4" title="Who may hold what" subtitle="By role, before any approval">
          <Table>
            <thead><tr><Th>Product</Th><Th>Eligible roles</Th><Th align="right">A seat a year</Th></tr></thead>
            <tbody>
              {PRODUCTS.map((p) => (
                <Tr key={p.id}>
                  <Td className="text-2xs text-ink">{p.name}</Td>
                  <Td className="max-w-[360px] text-2xs text-ink-2">{p.eligibleRoles.join(', ')}</Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{usd(p.annualCost)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  )
}

export const entitlementView: ArtifactView = {
  Body: EntitlementBody,
  Metrics: EntitlementMetrics,
  page: {
    title: 'Seats and policy',
    subtitle: 'What exists, what is already held, what is free, and the rules a request is decided against',
    agents: ['agt_concierge'],
    what: 'deciding requests against the directory, the pool and the policy',
  },
}
