import React from 'react'
import { CalendarDays, FileDown, Send, Sparkles } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { SLAS, TRANSFORM, bankedHours } from '@/domain/ledgers'
import { TOWERS } from '@/domain/estate'
import { PageHeader, EvidenceLink } from '@/ui/domain'
import { Button, Card, Chip, Metric, Table, Tabs, Td, Th, Tr, inputClass } from '@/ui/primitives'
import { cn, num, pct, signedPct } from '@/lib/format'
import { CATALOG, METRICS, SAMPLE_ANSWERS } from '@/domain/reportingSeed'
import { ProducedBy } from '@/ui/ProducedBy'

export function Reports() {
  const pushToast = useAstra((s) => s.pushToast)
  const [tab, setTab] = React.useState<'catalog' | 'semantic' | 'herald'>('herald')
  const [question, setQuestion] = React.useState('')
  const [asked, setAsked] = React.useState<typeof SAMPLE_ANSWERS[number] | null>(SAMPLE_ANSWERS[0])
  const [refused, setRefused] = React.useState<string | null>(null)

  const ask = (text: string) => {
    const needle = text.toLowerCase()
    const match = SAMPLE_ANSWERS.find((a) => {
      const words = a.q.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
      return words.filter((w) => needle.includes(w)).length >= 2
    })
    if (match) {
      setAsked(match)
      setRefused(null)
    } else {
      setAsked(null)
      setRefused(text)
    }
  }

  return (
    <>
      <PageHeader
        title="Reports & Ask Herald"
        subtitle="Governed semantic layer · signed extracts"
        actions={
          <Button size="sm" variant="primary" onClick={() => pushToast({ title: 'Monthly governance pack issued', body: 'Frozen T-2, distributed T-1. Every figure hyperlinked to evidence. Zero restatements this contract year.', tone: 'ok', evidenceId: 'ev_pack_2027_02' })}>
            <Send size={12} /> Issue monthly pack
          </Button>
        }
      />

      <ProducedBy
        agents={["agt_herald"]}
        what="generating every figure here from the semantic layer, and signing the extracts"
      />

      <div className="shrink-0 border-b border-line bg-surface px-4 py-1.5">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'herald', label: 'Ask Herald' },
            { id: 'catalog', label: 'Report catalog', count: CATALOG.length },
            { id: 'semantic', label: 'Semantic layer', count: METRICS.length },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'herald' && (
          <div className="mx-auto max-w-3xl space-y-3">
            <Card title="Ask Herald" subtitle="Natural language over the governed semantic layer">
              <form
                onSubmit={(e) => { e.preventDefault(); if (question.trim()) ask(question.trim()) }}
                className="flex gap-2"
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. show P2 MTTR for Security vs last quarter, excluding the MI week"
                  className={cn(inputClass, 'h-9 flex-1')}
                />
                <Button type="submit" variant="primary" size="lg"><Sparkles size={12} /> Ask</Button>
              </form>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {SAMPLE_ANSWERS.map((s) => (
                  <button
                    key={s.q}
                    onClick={() => { setQuestion(s.q); ask(s.q) }}
                    className="rounded-xs border border-line bg-sunken px-2 py-1 text-2xs text-ink-3 transition-colors hover:border-brand hover:text-ink"
                  >
                    {s.q}
                  </button>
                ))}
                <button
                  onClick={() => { setQuestion('what is our customer delight score'); ask('what is our customer delight score') }}
                  className="rounded-xs border border-line bg-sunken px-2 py-1 text-2xs text-ink-3 transition-colors hover:border-crit hover:text-ink"
                >
                  try an ungoverned measure →
                </button>
              </div>
            </Card>

            {asked && (
              <Card title="Answer" subtitle={asked.metric} right={<EvidenceLink id={asked.evidence} />}>
                <div className="rounded border border-line bg-sunken p-3">
                  <div className="label-cap">Filters applied</div>
                  <ul className="mt-1.5 space-y-0.5">
                    {asked.filters.map((f) => <li key={f} className="font-mono text-2xs text-ink-2">{f}</li>)}
                  </ul>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink">{asked.answer}</p>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <Button size="sm" variant="default" onClick={() => pushToast({ title: 'Saved as a subscribed micro-report', body: 'Delivered weekly to the client service owner, in console and Teams.', tone: 'ok' })}>
                    <CalendarDays size={11} /> Save &amp; subscribe
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => pushToast({ title: 'Extract generated', body: 'Row-level security mirrors platform RBAC.', tone: 'info' })}>
                    <FileDown size={11} /> Extract
                  </Button>
                  <span className="ml-auto text-2xs text-ink-3">Every figure decomposes to ledger and evidence records.</span>
                </div>
              </Card>
            )}

            {refused && (
              <Card title="Herald declines to answer" subtitle="No governed measure matched">
                <p className="text-xs leading-relaxed text-ink-2">
                  There is no governed measure named “{refused}”. I will not synthesise one, because a number that has no definition,
                  grain or source cannot be defended at a review and cannot be reconciled against the ledgers.
                </p>
                <div className="mt-3 rounded border border-info/35 bg-info/[0.06] p-3">
                  <div className="label-cap">Closest governed metrics</div>
                  <ul className="mt-1.5 space-y-1 text-2xs text-ink-2">
                    <li><span className="font-mono text-ink">xla_friction_index</span> — requester friction: touches, repeats and reassignments per work object</li>
                    <li><span className="font-mono text-ink">csat_score</span> — survey instrument, monthly, with language-model-scored interaction tone sampled for human review</li>
                    <li><span className="font-mono text-ink">time_to_productive</span> — new-joiner readiness, an experience measure carrying commercial weight</li>
                  </ul>
                </div>
              </Card>
            )}

          </div>
        )}

        {tab === 'catalog' && (
          <Card title="Standard report catalog" subtitle="Scheduled and on-demand">
            <Table>
              <thead>
                <tr>
                  <Th>Cadence</Th>
                  <Th>Report</Th>
                  <Th>Audience</Th>
                  <Th>Contents</Th>
                  <Th>Issue</Th>
                </tr>
              </thead>
              <tbody>
                {CATALOG.map((r) => (
                  <Tr key={r.name}>
                    <Td><Chip tone={r.cadence === 'Daily' ? 'neutral' : r.cadence === 'Weekly' ? 'info' : r.cadence === 'Monthly' ? 'brand' : r.cadence === 'Quarterly' ? 'ok' : 'agent'}>{r.cadence}</Chip></Td>
                    <Td className="text-ink">
                      <span className="flex items-center gap-1.5">
                        {r.name}
                        {r.signed && <Chip tone="ok">signed extract</Chip>}
                      </span>
                    </Td>
                    <Td className="text-2xs">{r.audience}</Td>
                    <Td className="max-w-[420px] text-2xs text-ink-3">{r.contents}</Td>
                    <Td>
                      <Button size="sm" variant="ghost" onClick={() => pushToast({ title: `${r.name} generated`, body: r.signed ? 'Signed extract — hashed, versioned, reproducible.' : 'Delivered to subscribers.', tone: 'ok' })}>
                        Generate
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {tab === 'semantic' && (
          <>
            <Card title="Governed metrics store" subtitle="Definition, grain, clock rules and source">
              <Table>
                <thead>
                  <tr>
                    <Th>Metric</Th>
                    <Th>Grain</Th>
                    <Th>Clock rules</Th>
                    <Th>Source of record</Th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((m) => (
                    <Tr key={m.name}>
                      <Td className="font-mono text-ink">{m.name}</Td>
                      <Td className="text-2xs">{m.grain}</Td>
                      <Td className="text-2xs text-ink-3">{m.clock}</Td>
                      <Td className="text-2xs">{m.source}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card className="mt-4" title="This month at a glance" subtitle="Current period">
              <div className="grid gap-4 md:grid-cols-4">
                <Metric size="sm" label="SLA attainment" value={pct(SLAS.filter((s) => s.kind === 'sla').reduce((a, s) => a + s.attainmentMtd, 0) / SLAS.filter((s) => s.kind === 'sla').length)} />
                <Metric size="sm" label="Banked savings" value={`${num(bankedHours())} h`} />
                <Metric size="sm" label="Credits available" value={num(TRANSFORM.reduce((s, t) => s + t.creditsAccrued + t.creditsCarriedIn - t.creditsConsumed, 0))} />
                <Metric size="sm" label="Glidepath vs. contract" value={signedPct(-14.6)} deltaTone="ok" delta="ahead" />
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
