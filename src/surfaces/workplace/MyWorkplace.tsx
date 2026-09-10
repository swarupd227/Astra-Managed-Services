import React from 'react'
import { CircleAlert, LifeBuoy } from 'lucide-react'
import {
  CONSUMER, cohortExperience, issuesAffecting, selfServeOffers,
} from '@/domain/workplace'
import { useAstra } from '@/domain/store'
import { PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Metric } from '@/ui/primitives'
import { pct } from '@/lib/format'
import { cn } from '@/lib/format'

/* ==========================================================================
   My workplace — the consultant's page.

   The whole design problem here is restraint. It would be easy to give an
   end user a cheerful dashboard of green ticks drawn from the same ledgers
   that tell the provider something more complicated, and that is precisely
   the failure to avoid: two audiences, two stories, no truth.

   So this page shows the same figures the provider is held to, says plainly
   which of them are about a population rather than about this person, and
   offers a self-service route only where the fix behind it genuinely
   exists. Where it cannot help, it says so and hands over to a human.
   ========================================================================== */

const PRIORITY_TONE: Record<string, 'crit' | 'warn' | 'info' | 'neutral'> = {
  P1: 'crit', P2: 'warn', P3: 'info', P4: 'neutral',
}

export function MyWorkplace() {
  const pushToast = useAstra((s) => s.pushToast)
  const issues = React.useMemo(() => issuesAffecting(), [])
  const offers = React.useMemo(() => selfServeOffers(), [])
  const experience = React.useMemo(() => cohortExperience(), [])

  const available = offers.filter((o) => o.available)
  const raisedTotal = CONSUMER.raised.reduce((s, r) => s + r.count, 0)

  return (
    <>
      <PageHeader
        title="My workplace"
        subtitle={`${CONSUMER.name} · ${CONSUMER.title} · ${CONSUMER.office}`}
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-4">
        <Metric size="sm" label="Affecting your systems" value={issues.length} deltaTone={issues.length ? 'warn' : 'ok'} />
        <Metric size="sm" label="Raised by you" value={raisedTotal} hint={`${CONSUMER.raised.length} kinds`} />
        <Metric size="sm" label="Self-service available" value={`${available.length} / ${offers.length}`} deltaTone={available.length ? 'ok' : 'warn'} />
        <Metric size="sm" label="Service against target" value={`${experience.filter((e) => e.meeting).length} / ${experience.length}`} deltaTone={experience.every((e) => e.meeting) ? 'ok' : 'warn'} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card
          title="Known issues"
         
          right={<CircleAlert size={13} className="text-ink-3" />}
        >
          {issues.length === 0 ? (
            <p className="text-2xs text-ink-3">Nothing open against the systems on your list.</p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {issues.slice(0, 6).map((i) => (
                  <li key={i.work.id} className="rounded border border-line bg-sunken p-2.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Chip tone={PRIORITY_TONE[i.work.priority] ?? 'neutral'}>{i.work.priority}</Chip>
                      <span className="text-2xs text-ink">{i.work.title}</span>
                      <Chip tone="neutral" className="ml-auto">{i.work.state}</Chip>
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-ink-3">
                      Affects your {i.viaNames.join(', ')}
                      {i.work.assigneeKind === 'agent' && ' · an agent is working it now'}
                    </p>
                  </li>
                ))}
              </ul>
              {issues.length > 6 && (
                <p className="mt-2 text-2xs text-ink-3">and {issues.length - 6} more against systems you depend on.</p>
              )}
            </>
          )}
        </Card>

        <Card
          className="mt-4"
          title="Recurring requests"
         
          right={<LifeBuoy size={13} className="text-ink-3" />}
        >
          <ul className="space-y-2">
            {offers.map((o) => (
              <li
                key={o.demandClass}
                className={cn('rounded border p-3', o.available ? 'border-ok/40 bg-ok/[0.05]' : 'border-line bg-sunken')}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xs text-ink">{o.name}</span>
                  <span className="text-2xs text-ink-3">you raised this {o.raisedByThem} {o.raisedByThem === 1 ? 'time' : 'times'}</span>
                  <span className="ml-auto">
                    {o.available ? (
                      <Button
                        size="sm" variant="default"
                        onClick={() => pushToast({
                          title: 'Sorted without a ticket',
                          body: 'This went through the self-service route rather than the service desk. It is recorded as avoided demand, which is what the glidepath counts.',
                          tone: 'ok',
                        })}
                      >
                        Do it now
                      </Button>
                    ) : (
                      <Chip tone="warn">needs a person</Chip>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          className="mt-4"
          title="Service performance"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {experience.map((e) => (
              <div key={e.slaId} className="rounded border border-line bg-sunken p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xs text-ink">{e.name}</span>
                  <Chip tone={e.meeting ? 'ok' : 'warn'}>{e.meeting ? 'at target' : 'below target'}</Chip>
                </div>
                <p className="tnum mt-1 text-sm text-ink">
                  {['nps_score', 'trust_score', 'friction_index'].includes(e.metric) ? e.attainment.toFixed(1) : pct(e.attainment)}
                  <span className="ml-1.5 text-2xs text-ink-3">target {e.target}</span>
                </p>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </>
  )
}
