import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { buildBrief, briefHeadline, estateNow, markSeen, readLastSeen } from '@/domain/brief'
import { PageHeader } from '@/ui/domain'
import { ActivityStream } from '@/ui/ActivityStream'
import { AskRow, NeedsYouStack } from '@/ui/NeedsYou'
import { Button, Card, Chip, Dot, Metric } from '@/ui/primitives'
import { StreamText } from '@/ui/StreamText'
import { cn, ago } from '@/lib/format'

/* ==========================================================================
   The session opener (Addendum A §A6, D2).

   Replaces the role redirect. Every role now lands on the platform's account
   of what happened and what it needs, and the role's previous home is one
   click away rather than the destination.
   ========================================================================== */

export function BriefHome() {
  const nav = useNavigate()
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId] ?? ROLE_BY_ID.sdm

  // The window is fixed for the life of the screen. Recomputing `since` on every
  // tick would make the delta shrink as you read it.
  const [window] = React.useState(readLastSeen)

  // A brief is an account of a moment, not a live readout. Snapshotting it at
  // session open keeps the prose and the figures describing the same instant —
  // letting the metrics tick on underneath a frozen headline produced a card
  // that said "nothing closed" above a count of six. Ongoing work belongs to
  // the live stream beside it, which is where the eye should go for movement.
  const [brief] = React.useState(() =>
    buildBrief({
      work: Object.values(useAstra.getState().work),
      assertions: useAstra.getState().assertions,
      proposals: Object.values(useAstra.getState().proposals),
      role,
      ...window,
    }),
  )

  const firstName = role.person.split(' ').slice(-1)[0]
  const [headline] = React.useState(() => briefHeadline(brief, firstName))

  // Stamp the visit on unmount, so the next session's delta starts here rather
  // than resetting the moment this screen renders.
  React.useEffect(() => () => markSeen(estateNow(useAstra.getState().clockOffsetMins)), [])

  const yours = brief.asks.filter((a) => a.yours)
  const others = brief.asks.filter((a) => !a.yours)

  return (
    <>
      <PageHeader
        title="While you were away"
        subtitle={
          brief.firstVisit
            ? `${role.title} · last twelve hours`
            : `${role.title} · everything since your last session, ${ago(brief.since)}`
        }
        meta={
          <Chip tone={yours.length ? 'warn' : 'ok'}>
            <Dot tone={yours.length ? 'warn' : 'ok'} />
            {yours.length ? `${yours.length} need${yours.length === 1 ? 's' : ''} you` : 'nothing needs you'}
          </Chip>
        }
        actions={
          <Button size="sm" variant="ghost" onClick={() => nav(role.home)}>
            Skip to {role.title}<ArrowRight size={11} />
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <Card
              title="While you were away"
              subtitle="Computed from the ledgers"
              right={<Sparkles size={13} className="text-brand-ink" />}
            >
              <p className="text-sm leading-relaxed text-ink">
                <StreamText text={headline} />
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-4">
                <Metric size="sm" label="Closed" value={brief.resolved} hint={`${brief.autonomous} unaided`} />
                <Metric size="sm" label="Hours displaced" value={brief.hoursSaved.toFixed(1)} />
                <Metric size="sm" label="Avoided" value={brief.prevented} />
                <Metric size="sm" label="Proposed" value={brief.proposed} />
              </div>
            </Card>

            {/* §A6: every brief ends in asks. A report that creates no
                obligations proves it was information, not operations. */}
            <Card
              title="Awaiting your decision"
              subtitle={yours.length ? 'Ranked by SLA urgency, blast radius and age' : undefined}
              right={<Chip tone={yours.length ? 'warn' : 'ok'}>{yours.length}</Chip>}
            >
              <NeedsYouStack asks={brief.asks} limit={5} />

              {others.length > 0 && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="label-cap mb-2">Waiting on other owners</p>
                  <div className="flex flex-col gap-2">
                    {others.slice(0, 3).map((a) => <AskRow key={`${a.kind}-${a.id}`} ask={a} />)}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <Card
            title="Live operations"
            subtitle="The workforce, now"
            right={<Chip tone="brand"><Dot tone="brand" pulse />live</Chip>}
            bodyClass="flex min-h-[420px] flex-col p-0"
          >
            <ActivityStream limit={24} />
          </Card>
        </div>
      </div>
    </>
  )
}
