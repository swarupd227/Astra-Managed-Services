import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutList, Target } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { TOWERS } from '@/domain/estate'
import { buildAsks } from '@/domain/brief'
import { PageHeader } from '@/ui/domain'
import { ActivityStream } from '@/ui/ActivityStream'
import { WorkforcePanel } from '@/ui/WorkforcePanel'
import { NeedsYouStack } from '@/ui/NeedsYou'
import { Button, Chip, Dot, selectClass } from '@/ui/primitives'

/* ==========================================================================
   The Operations Room (Addendum A §A3.1).

   Three zones, with the workforce as the centre of gravity: who is on shift,
   what is being done right now, and what is needed from you. The board,
   queues and SLA analytics are still one click away — demoted from home to
   reference, not removed.
   ========================================================================== */

export function OperationsRoom() {
  const nav = useNavigate()
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId] ?? ROLE_BY_ID.sdm
  const work = useAstra((s) => s.work)
  const assertions = useAstra((s) => s.assertions)
  const proposals = useAstra((s) => s.proposals)
  const tick = useAstra((s) => s.tick)

  const [tower, setTower] = React.useState('all')

  const asks = React.useMemo(
    () =>
      buildAsks({
        work: Object.values(work).filter((w) => tower === 'all' || w.tower === tower),
        assertions,
        proposals: Object.values(proposals),
        role,
      }),
    [work, assertions, proposals, role, tower, tick],
  )

  const yours = asks.filter((a) => a.yours).length
  const scope = tower === 'all' ? TOWERS.filter((t) => t.state === 'S4') : TOWERS.filter((t) => t.id === tower)
  // Already a percentage in the estate seed — do not scale it again.
  const autonomy = scope.length ? scope.reduce((s, t) => s + t.autonomyEligibleVolume, 0) / scope.length : 0

  return (
    <>
      <PageHeader
        title="Operations Room"
        subtitle="Who is working, on what, and what is needed from you"
        meta={
          <Chip tone={yours ? 'warn' : 'ok'}>
            <Dot tone={yours ? 'warn' : 'ok'} pulse={yours > 0} />
            {yours ? `${yours} need${yours === 1 ? 's' : ''} you` : 'nothing needs you'}
          </Chip>
        }
        actions={
          <>
            <select value={tower} onChange={(e) => setTower(e.target.value)} className={selectClass}>
              <option value="all">All towers</option>
              {TOWERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Button size="sm" variant="ghost" onClick={() => nav('/operate/board')}>
              <LayoutList size={11} /> Board
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 gap-px bg-line lg:grid-cols-[minmax(210px,0.8fr)_minmax(0,2fr)_minmax(230px,1fr)]">
        {/* Zone 1 — the workforce. */}
        <section className="flex min-h-0 flex-col bg-canvas">
          <WorkforcePanel tower={tower} />
        </section>

        {/* Zone 2 — live operations, the narrated stream of work being done. */}
        <section className="flex min-h-0 flex-col bg-canvas">
          <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-2">
            <span className="label-cap">Live operations</span>
            <Chip tone="brand"><Dot tone="brand" pulse />live</Chip>
            <span className="ml-auto text-2xs text-ink-3">every line opens its work object</span>
          </div>
          <ActivityStream tower={tower} limit={40} />
        </section>

        {/* Zone 3 — the ranked obligation stream, with Delegate pinned beneath. */}
        <section className="flex min-h-0 flex-col bg-canvas">
          <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-2">
            <span className="label-cap">Needs you</span>
            <Chip tone={yours ? 'warn' : 'ok'}>{yours}</Chip>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            <NeedsYouStack asks={asks} limit={10} autonomyPct={autonomy} />
          </div>
          {/* D4 — Delegate is the primary action, pinned where it cannot be missed. */}
          <div className="shrink-0 border-t border-line p-2.5">
            <Button variant="primary" className="w-full justify-center" onClick={() => nav('/missions')}>
              <Target size={12} /> Delegate…
            </Button>
            <p className="mt-1.5 text-center text-2xs text-ink-3">
              Hand the workforce a goal, not a ticket
            </p>
          </div>
        </section>
      </div>
    </>
  )
}
