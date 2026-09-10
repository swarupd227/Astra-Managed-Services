import React from 'react'
import { ArrowUpRight, Cpu, IdCard } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { changeLog } from '@/domain/changeLog'
import { agentCard, systemCard, type CardContext, type ModelCard } from '@/domain/modelCard'
import { PageHeader, AgentChip } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Button, Card, Chip } from '@/ui/primitives'
import { cn } from '@/lib/format'

/* ==========================================================================
   Model Cards — one per agent and per registered AI system, generated from
   stored records at the moment they are viewed. There is nothing to edit
   here: to change a card, change the record it is read from.
   ========================================================================== */

type RegistryView = { residency: CardContext['residency']; systems: NonNullable<CardContext['systems']> }

export function ModelCards() {
  const agents = useAstra((s) => s.agents)
  const redTeam = useAstra((s) => s.redTeam)
  const bias = useAstra((s) => s.bias)
  const drift = useAstra((s) => s.drift)
  const incidents = useAstra((s) => s.aiIncidents)
  const modelChanges = useAstra((s) => s.modelChanges)
  const pushToast = useAstra((s) => s.pushToast)

  const [registry, setRegistry] = React.useState<RegistryView | null>(null)
  const [selected, setSelected] = React.useState<string>(Object.keys(agents)[0] ?? '')

  React.useEffect(() => {
    fetch('/api/agent/registry').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setRegistry({ residency: j.residency, systems: j.systems }) }).catch(() => setRegistry({ residency: null, systems: [] }))
  }, [])

  const ctx: CardContext = React.useMemo(() => ({
    redTeam, bias, drift: drift?.windows, incidents,
    systems: registry?.systems ?? [],
    residency: registry?.residency ?? null,
    changes: changeLog({ registrySystems: registry?.systems ?? [], modelChanges }),
  }), [redTeam, bias, drift, incidents, registry, modelChanges])

  const card: ModelCard | null = React.useMemo(() => {
    const a = agents[selected]
    if (a) return agentCard(a, ctx)
    const s = (registry?.systems ?? []).find((x) => x.id === selected)
    return s ? systemCard(s, ctx) : null
  }, [selected, agents, registry, ctx])

  return (
    <>
      <PageHeader
        title="Model Cards"
        subtitle="Generated from stored records"
        actions={
          <Button size="sm" variant="default" disabled={!card} onClick={() => pushToast({ title: `Model card exported — ${card?.title}`, body: 'Every field on the card traces to a stored record; the export carries their ids.', tone: 'ok' })}>
            <ArrowUpRight size={12} /> Export card
          </Button>
        }
      />
      <ProducedBy agents={['agt_herald']} what="assembling each card from stored records" />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[300px_1fr] lg:overflow-hidden">
        <aside className="min-h-0 overflow-y-auto border-r border-line bg-surface">
          <div className="border-b border-line px-3 py-2"><span className="label-cap">Agents</span></div>
          <ul>
            {Object.values(agents).map((a) => (
              <li key={a.id}>
                <button onClick={() => setSelected(a.id)} className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-raised', selected === a.id && 'bg-brand/10')}>
                  <AgentChip id={a.id} />
                  <span className="ml-auto text-[10px] text-ink-3">{a.state}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-y border-line px-3 py-2"><span className="label-cap">AI systems</span></div>
          <ul>
            {(registry?.systems ?? []).map((s) => (
              <li key={s.id}>
                <button onClick={() => setSelected(s.id)} className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-2xs hover:bg-raised', selected === s.id && 'bg-brand/10')}>
                  <Cpu size={11} className="shrink-0 text-ink-3" />
                  <span className="text-ink">{s.vendor} {s.model}</span>
                  <span className="ml-auto text-[10px] text-ink-3">{s.status}</span>
                </button>
              </li>
            ))}
            {registry && registry.systems.length === 0 && <li className="px-3 py-2 text-2xs text-ink-3">Registry unavailable — start the gateway.</li>}
          </ul>
        </aside>

        <section className="min-h-0 overflow-y-auto p-4">
          {card ? (
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="rounded-md border border-line bg-surface p-4">
                <div className="flex items-center gap-2">
                  <IdCard size={15} className="text-brand-ink" />
                  <h2 className="font-display text-sm font-semibold text-ink">{card.title}</h2>
                  <Chip tone={card.kind === 'agent' ? 'agent' : 'brand'}>{card.kind}</Chip>
                </div>
                <p className="mt-1 font-mono text-2xs text-ink-3">{card.subtitle}</p>
              </div>

              {card.sections.map((sec) => (
                <Card key={sec.title} title={sec.title}>
                  <dl className="divide-y divide-line">
                    {sec.rows.map((r) => (
                      <div key={r.label} className="grid gap-1 py-1.5 sm:grid-cols-[200px_1fr]">
                        <dt className="text-2xs text-ink-3">{r.label}</dt>
                        <dd className={cn('text-2xs leading-relaxed', r.tone === 'ok' ? 'text-ok' : r.tone === 'warn' ? 'text-warn' : r.tone === 'crit' ? 'text-crit' : 'text-ink-2')}>{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              ))}

              <Card title="Recent changes" subtitle="Last five related changes">
                {card.changes.length ? (
                  <ul className="space-y-1">
                    {card.changes.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-baseline gap-2 text-2xs">
                        <span className="text-ink-3">{c.at.slice(0, 10)}</span>
                        <Chip mono>{c.kind}</Chip>
                        <span className="text-ink-2">{c.summary}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-2xs text-ink-3">No changes recorded.</p>
                )}
              </Card>

            </div>
          ) : (
            <p className="text-2xs text-ink-3">Select an agent or a system.</p>
          )}
        </section>
      </div>
    </>
  )
}
