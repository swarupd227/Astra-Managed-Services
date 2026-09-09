import React from 'react'
import { CircleAlert, Info, LifeBuoy, ShieldCheck } from 'lucide-react'
import {
  CONSUMER, cohortExperience, issuesAffecting, selfServeOffers, workplaceLimits,
} from '@/domain/workplace'
import { useAstra } from '@/domain/store'
import { PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Metric } from '@/ui/primitives'
import { num, pct } from '@/lib/format'
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
  const limits = React.useMemo(() => workplaceLimits(), [])

  const available = offers.filter((o) => o.available)
  const raisedTotal = CONSUMER.raised.reduce((s, r) => s + r.count, 0)

  return (
    <>
      <PageHeader
        title="My workplace"
        subtitle={`${CONSUMER.name} · ${CONSUMER.title} · ${CONSUMER.office}`}
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-4">
        <Metric size="sm" label="Affecting your systems" value={issues.length} deltaTone={issues.length ? 'warn' : 'ok'} hint="already known — no need to report" />
        <Metric size="sm" label="Raised by you" value={raisedTotal} hint={`this period, across ${CONSUMER.raised.length} kinds of problem`} />
        <Metric size="sm" label="Self-service available" value={`${available.length} / ${offers.length}`} deltaTone={available.length ? 'ok' : 'warn'} hint="routes that actually exist today" />
        <Metric size="sm" label="Service against target" value={`${experience.filter((e) => e.meeting).length} / ${experience.length}`} deltaTone={experience.every((e) => e.meeting) ? 'ok' : 'warn'} hint="for everyone, not for you" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card
          title="Known issues"
          subtitle="Matched through the systems you depend on"
          right={<CircleAlert size={13} className="text-ink-3" />}
        >
          {issues.length === 0 ? (
            <p className="text-2xs leading-relaxed text-ink-2">Nothing open against the systems on your list. That is not the same as nothing being wrong — it means nothing has been reported and detected against them.</p>
          ) : (
            <>
              <p className="mb-2 text-2xs leading-relaxed text-ink-2">
                These are open against something you use. If one of them is what you were about to report, it is already in hand and reporting it again will not move it.
              </p>
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
          subtitle="Raised repeatedly, and whether a route exists yet"
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
                {o.unavailableReason && (
                  <p className="mt-1.5 text-[10px] leading-snug text-ink-3">{o.unavailableReason}</p>
                )}
                {o.available && o.projectedRemoval !== null && (
                  <p className="mt-1.5 text-[10px] leading-snug text-ink-3">
                    Around {pct(o.projectedRemoval * 100, 0)} of this kind of request is expected to stop needing anyone at all.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card
          className="mt-4"
          title="Service performance"
          subtitle="For everyone it covers — not a measure of your week"
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
                <p className="mt-0.5 text-[10px] leading-snug text-ink-3">
                  Across {num(e.volumeMtd)} this month. Yours is one of them.
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          className="mt-4"
          title="Limits of this view"
          subtitle="The absences are deliberate"
          right={<Info size={13} className="text-ink-3" />}
        >
          <ul className="space-y-1.5">
            {limits.map((l) => (
              <li key={l} className="text-2xs leading-relaxed text-ink-2">· {l}</li>
            ))}
          </ul>

          <div className="mt-3 flex items-start gap-2 rounded border border-info/40 bg-info/[0.06] p-3">
            <ShieldCheck size={12} className="mt-0.5 shrink-0 text-info" />
            <p className="text-2xs leading-relaxed text-ink-2">
              Everywhere else in this platform an engineer sits between an agent and the person who acts on what it said, and that engineer is the last place a wrong answer gets caught. On this page there is nobody. So an answer written for you is held to a higher standard of evidence than the same answer shown to an engineer — where the knowledge behind it has not been checked by a person, the agent is not allowed to give it to you on its own.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}
