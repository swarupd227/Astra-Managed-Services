import React from 'react'
import { Share2 } from 'lucide-react'
import {
  DATA_ITEM_BY_ID, DATA_KIND_LABEL, ancestors, descendants, impact, isBreach, ownState,
  type DataItem,
} from '@/domain/dataEstate'
import { Card, Chip, Empty, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { Lineage, type LineageNode } from '@/ui/lineage'
import { num } from '@/lib/format'
import { Band, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   What breaks if this fails.

   The question an evaluator asks and nobody can usually answer without a
   morning of tracing. The walk itself already existed; this is the half that
   makes it legible — who is downstream, who owns each of them, and how many
   people read the far end.

   Owners are named by role rather than by person, which is how the estate
   register holds them and how a notification should go out: a named
   individual who has left still owns forty things in most CMDBs.
   ========================================================================== */

function useSlice(props: Record<string, unknown>) {
  const id = String(props.id ?? '')
  return React.useMemo(() => {
    const focus = DATA_ITEM_BY_ID[id]
    if (!focus) return null
    const down = descendants(focus.id)
    const up = ancestors(focus.id)
    const x = impact(focus.id)

    const nodes: LineageNode[] = [
      ...up.map((i) => ({ item: i, broken: isBreach(ownState(i)) })),
      { item: focus, focus: true },
      ...down.map((i) => ({
        item: i,
        downstream: true,
        broken: isBreach(ownState(i)),
        audience: i.consumers ?? null,
      })),
    ]

    // Only the links inside the slice: an edge to something not drawn is a
    // line into nothing.
    const inSlice = new Set(nodes.map((n) => n.item.id))
    const edges = nodes.flatMap((n) =>
      (n.item.upstream ?? []).filter((u) => inSlice.has(u)).map((u) => ({ from: u, to: n.item.id })),
    )

    return { focus, up, down, impact: x, nodes, edges }
  }, [id])
}

/** Who answers for a thing, as the register holds it. */
const owners = (items: DataItem[]) => {
  const seen = new Map<string, DataItem[]>()
  for (const i of items) {
    const who = i.steward ?? i.owner
    if (!who) continue
    seen.set(who, [...(seen.get(who) ?? []), i])
  }
  return [...seen].sort((a, b) => b[1].length - a[1].length)
}

function LineageMetrics({ props, size }: CardProps) {
  const s = useSlice(props)
  if (!s) return null
  return (
    <Band size={size} cols={4}>
      <Metric size="sm" label="Downstream" value={s.down.length} deltaTone={s.down.length ? 'warn' : 'ok'} hint="items that read it" />
      <Metric size="sm" label="Reports affected" value={s.impact.reports.length} />
      <Metric size="sm" label="Outside the estate" value={s.impact.recipients.length} deltaTone={s.impact.recipients.length ? 'crit' : 'ok'} hint="external recipients" />
      <Metric
        size="sm"
        label="Largest readership"
        value={s.impact.largestAudience === null ? '—' : num(s.impact.largestAudience)}
        hint={s.impact.largestAudience === null ? 'not recorded' : 'readers behind one report'}
      />
    </Band>
  )
}

function LineageBody({ props, size }: CardProps) {
  const s = useSlice(props)
  if (!s) return <Empty title="No such item in the estate" />
  if (!s.down.length && !s.up.length) {
    return <Empty title={`${s.focus.name} has nothing mapped either side of it`} />
  }

  const byOwner = owners(s.impact.consumers)

  return (
    <>
      <Card
        title={`If ${s.focus.name} fails`}
        subtitle={`${s.down.length} downstream · ${s.impact.reports.length} report${s.impact.reports.length === 1 ? '' : 's'} · ${s.impact.recipients.length} external`}
        right={<Share2 size={13} className="text-ink-3" />}
      >
        <Lineage nodes={s.nodes} edges={s.edges} />
      </Card>

      {size !== 'card' && s.impact.consumers.length > 0 && (
        <Card className="mt-4" title="What stops, and who answers for it" subtitle="Ranked by readership">
          <Table>
            <thead><tr><Th>Stops</Th><Th>What it is</Th><Th>Owner</Th><Th align="right">Readers</Th></tr></thead>
            <tbody>
              {[...s.impact.consumers]
                .sort((a, b) => (b.consumers ?? 0) - (a.consumers ?? 0))
                .map((c) => (
                  <Tr key={c.id}>
                    <Td className="text-2xs text-ink">{c.name}</Td>
                    <Td className="text-2xs text-ink-3">
                      {DATA_KIND_LABEL[c.kind]}{c.party ? ` · ${c.party}` : ''}
                    </Td>
                    <Td className="text-2xs text-ink-2">{c.steward ?? c.owner ?? <span className="text-ink-3">unassigned</span>}</Td>
                    <Td align="right" className="tnum text-2xs text-ink-2">{c.consumers ? num(c.consumers) : '—'}</Td>
                  </Tr>
                ))}
            </tbody>
          </Table>
        </Card>
      )}

      {size !== 'card' && byOwner.length > 0 && (
        <Card className="mt-4" title="Who to tell" subtitle="By role, as the register holds it">
          <div className="flex flex-wrap gap-2">
            {byOwner.map(([who, items]) => (
              <Chip key={who} tone="neutral">
                {who} · {items.length} affected
              </Chip>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}

export const lineageView: ArtifactView = {
  Body: LineageBody,
  Metrics: LineageMetrics,
  page: {
    title: 'What breaks',
    subtitle: 'One item, everything downstream of it, who answers for each and how many people read the far end',
    agents: ['agt_archivist', 'agt_custodian'],
    what: 'walking the lineage the estate already holds',
  },
}
