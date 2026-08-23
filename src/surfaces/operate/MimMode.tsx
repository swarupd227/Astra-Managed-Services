import React from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, Megaphone, ShieldAlert, Siren, Square, CheckSquare } from 'lucide-react'
import { useAstra, useWorkList } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { PageHeader, PriorityChip, EvidenceLink } from '@/ui/domain'
import { Button, Card, Chip, Dot, Empty, Metric, Tabs, inputClass } from '@/ui/primitives'
import { cn, ago, dateTime, mins } from '@/lib/format'
import { AUDIENCES } from '@/domain/mimSeed'
import { ProducedBy } from '@/ui/ProducedBy'


export function MimMode() {
  const mi = useAstra((s) => s.mi)
  const declareMi = useAstra((s) => s.declareMi)
  const closeMi = useAstra((s) => s.closeMi)
  const toggleAction = useAstra((s) => s.toggleMiAction)
  const pushToast = useAstra((s) => s.pushToast)
  const brake = useAstra((s) => s.brake)
  const roleId = useAstra((s) => s.roleId)
  const work = useWorkList()
  const role = ROLE_BY_ID[roleId]

  const [audience, setAudience] = React.useState('status')
  const [draft, setDraft] = React.useState(AUDIENCES[0].draft)

  React.useEffect(() => {
    setDraft(AUDIENCES.find((a) => a.id === audience)!.draft)
  }, [audience])

  const candidates = work
    .filter((w) => ['P1', 'P2'].includes(w.priority) && !['resolved', 'learned'].includes(w.state))
    .sort((a, b) => b.breachProbability - a.breachProbability)
    .slice(0, 8)

  if (!mi.active) {
    return (
      <>
        <PageHeader
          title="Major Incident Mode"
          subtitle="No incident declared"
          meta={<Chip tone="ok"><Dot tone="ok" />No major incident open</Chip>}
        />

        <ProducedBy
          agents={["agt_sentinel", "agt_diagnost", "agt_herald"]}
          what="scribing this timeline, holding the causal chain, and drafting each audience update"
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl">
            <Card title="Declare a major incident" subtitle="Open P1 and P2 work objects">
              {candidates.length === 0 ? (
                <Empty title="No P1 or P2 candidates open" />
              ) : (
                <ul className="space-y-1.5">
                  {candidates.map((w) => (
                    <li key={w.id} className="flex items-center gap-2 rounded border border-line bg-sunken px-2.5 py-2">
                      <PriorityChip p={w.priority} />
                      <span className="min-w-0 flex-1">
                        <Link to={`/operate/work/${w.id}`} className="block truncate text-xs text-ink hover:text-brand-ink">{w.title}</Link>
                        <span className="mt-0.5 block font-mono text-2xs text-ink-3">{w.ref} · {w.service}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!role.canApprove}
                        onClick={() => declareMi(w.id, role.person)}
                      >
                        <Siren size={11} /> Declare
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {!role.canApprove && (
                <p className="mt-3 text-2xs text-ink-3">
                  {role.title} cannot declare a major incident. Declaration sits with the Major Incident Manager, the SDM or the shift lead.
                </p>
              )}
            </Card>
          </div>
        </div>
      </>
    )
  }

  const wo = mi.workObjectId ? work.find((w) => w.id === mi.workObjectId) : undefined
  const elapsed = mi.declaredAt ? (Date.now() - new Date(mi.declaredAt).getTime()) / 60000 : 0

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><Siren size={15} className="text-crit" />Incident room</span>}
        subtitle={mi.title}
        meta={<Chip tone="crit"><Dot tone="crit" pulse />declared {ago(mi.declaredAt!)}</Chip>}
        actions={
          <>
            <Chip tone="warn"><ShieldAlert size={10} />autonomy capped at L1</Chip>
            {role.canApprove && <Button size="sm" variant="primary" onClick={() => closeMi(role.person)}>Close & generate PIR</Button>}
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1.1fr_1fr_0.9fr] lg:overflow-hidden">
        <section className="flex min-h-0 flex-col border-r border-line bg-surface">
          <div className="shrink-0 border-b border-line px-3 py-2">
            <h3 className="font-display text-[13px] font-semibold text-ink">Auto-scribed timeline</h3>
            <p className="mt-0.5 text-2xs text-ink-3">Assembled from sealed evidence records</p>
          </div>
          <ol className="min-h-0 flex-1 overflow-y-auto p-3">
            {[...mi.timeline, ...(wo?.narrative ?? [])]
              .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
              .map((n) => (
                <li key={n.id} className="flex gap-2.5 pb-3">
                  <span className="mt-1.5 shrink-0"><Dot tone={n.level === 'crit' ? 'crit' : n.level === 'warn' ? 'warn' : n.level === 'ok' ? 'ok' : n.actorKind === 'agent' ? 'agent' : 'neutral'} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={cn('text-2xs font-medium', n.actorKind === 'agent' ? 'text-agent' : 'text-ink-2')}>{n.actor}</span>
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-3" title={dateTime(n.at)}>{dateTime(n.at).slice(-5)}</span>
                    </span>
                    <p className="mt-0.5 text-2xs leading-relaxed text-ink-3">{n.text}</p>
                    {n.evidenceId && <EvidenceLink id={n.evidenceId} className="mt-0.5" />}
                  </span>
                </li>
              ))}
          </ol>
        </section>

        <section className="flex min-h-0 flex-col border-r border-line bg-surface">
          <div className="shrink-0 border-b border-line px-3 py-2">
            <h3 className="font-display text-[13px] font-semibold text-ink">Communications</h3>
            <p className="mt-0.5 text-2xs text-ink-3">Drafted per audience · a named human publishes</p>
          </div>
          <div className="shrink-0 border-b border-line px-3 py-1.5">
            <Tabs value={audience} onChange={setAudience} tabs={AUDIENCES.map((a) => ({ id: a.id, label: a.label }))} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              className="w-full resize-none rounded border border-line-strong bg-sunken p-2.5 text-2xs leading-relaxed text-ink focus:border-brand focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="primary"
                disabled={!role.canApprove}
                onClick={() => pushToast({ title: `Published to ${AUDIENCES.find((a) => a.id === audience)!.label}`, body: 'Publication recorded as an evidence record with the exact text sent.', tone: 'ok' })}
              >
                <Megaphone size={12} /> Publish
              </Button>
              <span className="text-2xs text-ink-3">next update due in {mins(Math.max(0, 30 - elapsed))}</span>
            </div>

            <div className="mt-4 rounded border border-line bg-sunken p-2.5">
              <div className="label-cap">Roles</div>
              <ul className="mt-1.5 space-y-1 text-2xs">
                {mi.roles.map((r) => (
                  <li key={r.role} className="flex items-center justify-between gap-2">
                    <span className="text-ink-3">{r.role}</span>
                    <span className="text-ink-2">{r.person}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col overflow-y-auto bg-surface">
          <div className="border-b border-line px-3 py-2.5">
            <div className="label-cap">Autonomy brake</div>
            <div className="mt-1.5 flex items-center gap-2">
              <Chip tone="crit"><ShieldAlert size={10} />L1 Advise · platform-wide</Chip>
            </div>
            <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
              Applied by policy override. {brake.global ? 'A manual brake is also in force. ' : ''}Releases on incident close.
            </p>
          </div>

          <div className="border-b border-line px-3 py-2.5">
            <div className="label-cap">Action tracker</div>
            <ul className="mt-2 space-y-1.5">
              {mi.actions.map((a) => (
                <li key={a.id}>
                  <button onClick={() => toggleAction(a.id)} className="flex w-full items-start gap-2 rounded px-1 py-1 text-left hover:bg-raised">
                    {a.done ? <CheckSquare size={13} className="mt-px shrink-0 text-ok" /> : <Square size={13} className="mt-px shrink-0 text-ink-3" />}
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-2xs', a.done ? 'text-ink-3 line-through' : 'text-ink-2')}>{a.text}</span>
                      <span className="mt-0.5 block text-[10px] text-ink-3">{a.owner} · due in {a.dueMins}m</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-3 py-2.5">
            <div className="label-cap">Post-incident review</div>
            <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
              Pre-assembled and updating live. Closing the incident issues it.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Metric size="sm" label="Evidence records" value={(wo?.narrative.length ?? 0) + mi.timeline.length} />
              <Metric size="sm" label="Elapsed" value={mins(elapsed)} />
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
