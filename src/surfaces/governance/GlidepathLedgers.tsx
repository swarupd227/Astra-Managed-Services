import React from 'react'
import { FileDown, Lock } from 'lucide-react'
import { GLIDEPATH, TRANSFORM, bankedHours, verifyingHours } from '@/domain/ledgers'
import { TOWERS, TOWER_BY_ID } from '@/domain/estate'
import { useAstra } from '@/domain/store'
import { PageHeader, EvidenceLink } from '@/ui/domain'
import { Button, Card, Chip, Metric, Table, Tabs, Td, Th, Tr } from '@/ui/primitives'
import { LineChart, StackedBars, CHART_COLORS } from '@/ui/charts'
import { cn, ago, num, pct, signedPct, usd } from '@/lib/format'
import type { GlidepathEntry } from '@/domain/types'
import { glidepathAttainment } from '@/domain/metrics'
import { ProducedBy } from '@/ui/ProducedBy'

const ATTRIB_TONE: Record<GlidepathEntry['attribution'], 'brand' | 'ok' | 'info' | 'agent'> = {
  automation: 'brand', elimination: 'ok', acceleration: 'info', avoidance: 'agent',
}

const ATTRIB_NOTE: Record<GlidepathEntry['attribution'], string> = {
  automation: 'Agent executed the work that a human previously did. Measured against the shadow-period standard for the class.',
  elimination: 'The demand no longer arrives. Banked only after the class shows verified volume decay against its trailing mean.',
  acceleration: 'A human did the work, assisted by an agent. The time delta is measured, not estimated.',
  avoidance: 'Prevented incidents, counterfactual-modelled and conservatively discounted per the commercial schedule.',
}

export function GlidepathLedgers() {
  const pushToast = useAstra((s) => s.pushToast)
  const [tab, setTab] = React.useState<'glidepath' | 'transform'>('glidepath')
  const [tower, setTower] = React.useState('all')

  const entries = GLIDEPATH.filter((g) => tower === 'all' || g.tower === tower)
  const banked = entries.filter((e) => e.state === 'banked')
  const verifying = entries.filter((e) => e.state === 'verifying')
  const rejected = entries.filter((e) => e.state === 'rejected')

  const byAttrib = (['automation', 'elimination', 'acceleration', 'avoidance'] as const).map((a) => ({
    key: a,
    label: a[0].toUpperCase() + a.slice(1),
    color: a === 'automation' ? CHART_COLORS.brand : a === 'elimination' ? CHART_COLORS.ok : a === 'acceleration' ? CHART_COLORS.info : CHART_COLORS.agent,
    hours: banked.filter((e) => e.attribution === a).reduce((s, e) => s + e.hoursSaved, 0),
  }))

  const quarters = ['26-Q1', '26-Q2', '26-Q3', '26-Q4', '27-Q1']
  const decomposition = byAttrib.map((a, i) => ({
    key: a.key,
    label: a.label,
    color: a.color,
    values: quarters.map((_, q) => Math.round((a.hours / 5) * (0.55 + q * 0.22) * (1 - i * 0.06))),
  }))

  const totalCredits = TRANSFORM.reduce((s, t) => s + t.creditsAccrued + t.creditsCarriedIn, 0)
  const consumed = TRANSFORM.reduce((s, t) => s + t.creditsConsumed, 0)
  const allocated = TRANSFORM.reduce((s, t) => s + t.allocations.reduce((a, x) => a + x.credits, 0), 0)

  return (
    <>
      <PageHeader
        title="Glidepath & Transform Ledgers"
        subtitle="Against the countersigned baseline · 2027-Q1"
        actions={
          <>
            <select value={tower} onChange={(e) => setTower(e.target.value)} className="h-8 rounded border border-line-strong bg-sunken px-2 text-xs text-ink focus:border-brand focus:outline-none">
              <option value="all">All towers</option>
              {TOWERS.filter((t) => t.state === 'S4').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Button size="sm" variant="primary" onClick={() => pushToast({ title: 'Signed extract generated', body: 'Glidepath & Transform statement — hashed, versioned, reproducible. A reissue would be a new version with a visible delta note.', tone: 'ok', evidenceId: 'ev_ext_gp_2027_02' })}>
              <FileDown size={12} /> Signed extract
            </Button>
          </>
        }
      />

      <ProducedBy
        agents={["agt_prospect", "agt_herald"]}
        what="attributing every banked hour to a cause and holding it until the decay verifies"
      />

      <div className="shrink-0 border-b border-line bg-surface px-4 py-1.5">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'glidepath', label: 'Baseline & Glidepath Ledger' }, { id: 'transform', label: 'Transform Ledger' }]} />
      </div>

      {tab === 'glidepath' ? (
        <>
          <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
            <Metric size="sm" label="Hours banked" value={num(banked.reduce((s, e) => s + e.hoursSaved, 0))} hint="verified in telemetry for 60–90 days" />
            <Metric size="sm" label="Hours in verification" value={num(verifying.reduce((s, e) => s + e.hoursSaved, 0))} hint="claimed, not yet banked" />
            <Metric size="sm" label="Rejected claims" value={num(rejected.reduce((s, e) => s + e.hoursSaved, 0))} deltaTone="crit" hint="telemetry did not confirm — visibly not banked" />
            <Metric size="sm" label="Baseline" value={`${num(TOWERS.filter((t) => tower === 'all' || t.id === tower).reduce((s, t) => s + t.baselineHrsPerQtr, 0))} hrs`} unit="/qtr" hint="countersigned at cutover" />
            <Metric size="sm" label="Delivered vs. contracted" value={signedPct(glidepathAttainment().actual, 1)} deltaTone="ok" delta="ahead" hint={`contracted ${signedPct(glidepathAttainment().contracted, 1)}`} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <Card title="Banked savings by cause, per quarter" subtitle="Attribution taxonomy: automation, elimination, acceleration, avoidance">
                <StackedBars labels={quarters} stacks={decomposition} height={200} yFormat={(n) => `${n}h`} />
                <div className="mt-2 flex flex-wrap gap-3 text-2xs text-ink-3">
                  {decomposition.map((s) => (
                    <span key={s.key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                  ))}
                </div>
              </Card>

              <Card title="Attribution definitions" subtitle="Attribution taxonomy">
                <ul className="space-y-2.5">
                  {byAttrib.map((a) => (
                    <li key={a.key} className="border-b border-line/60 pb-2.5 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <Chip tone={ATTRIB_TONE[a.key]}>{a.label}</Chip>
                        <span className="tnum text-2xs font-medium text-ink">{num(a.hours)} hrs banked</span>
                      </div>
                      <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">{ATTRIB_NOTE[a.key]}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <Card
              className="mt-4"
              title="Ledger entries"
              subtitle="Each line links to its evidence record"
            >
              <Table>
                <thead>
                  <tr>
                    <Th>Entry</Th>
                    <Th>Tower</Th>
                    <Th>Demand class</Th>
                    <Th>Attribution</Th>
                    <Th align="right">Hours</Th>
                    <Th>Verification</Th>
                    <Th>State</Th>
                    <Th>Narrative</Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 40).map((e) => (
                    <Tr key={e.id}>
                      <Td className="font-mono text-ink-2">{e.id}</Td>
                      <Td>{TOWER_BY_ID[e.tower]?.name}</Td>
                      <Td className="font-mono">{e.demandClass}</Td>
                      <Td><Chip tone={ATTRIB_TONE[e.attribution]}>{e.attribution}</Chip></Td>
                      <Td align="right" className={e.state === 'rejected' ? 'text-crit line-through' : 'text-ink'}>{num(e.hoursSaved)}</Td>
                      <Td>
                        <span className="flex items-center gap-1.5">
                          <span className="h-[3px] w-14 overflow-hidden rounded-full bg-sunken">
                            <span className={cn('block h-full rounded-full', e.state === 'banked' ? 'bg-ok' : e.state === 'rejected' ? 'bg-crit' : 'bg-brand')} style={{ width: `${Math.min(100, (e.verifiedDays / e.verificationWindow) * 100)}%` }} />
                          </span>
                          <span className="tnum text-2xs text-ink-3">{e.verifiedDays}/{e.verificationWindow}d</span>
                        </span>
                      </Td>
                      <Td>
                        <Chip tone={e.state === 'banked' ? 'ok' : e.state === 'rejected' ? 'crit' : 'brand'}>{e.state}</Chip>
                      </Td>
                      <Td className="max-w-[320px] text-2xs text-ink-3">
                        <span className="line-clamp-2">{e.narrative}</span>
                        <EvidenceLink id={e.evidenceId} className="mt-0.5" />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>

              {rejected.length > 0 && (
                <div className="mt-3 rounded border border-crit/35 bg-crit/[0.05] p-3">
                  <p className="mt-1 text-2xs leading-relaxed text-ink-2">
                    {rejected.length} claimed saving worth {num(rejected.reduce((s, e) => s + e.hoursSaved, 0))} hours was not confirmed by telemetry and is not banked.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </>
      ) : (
        <>
          <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
            <Metric size="sm" label="Credits accrued" value={num(totalCredits)} hint="1 credit = 1 verified banked hour" />
            <Metric size="sm" label="Allocated" value={num(allocated)} hint="jointly governed — the provider cannot self-allocate" />
            <Metric size="sm" label="Consumed" value={num(consumed)} hint="delivered through the same fabric as Run" />
            <Metric size="sm" label="Available" value={num(totalCredits - consumed)} hint="unallocated credits expire into price reduction after two quarters" />
            <Metric size="sm" label="Towers frozen" value={TRANSFORM.filter((t) => t.freezeState === 'frozen').length} deltaTone="crit" hint="SLA/XLA breach freezes new allocation" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {TRANSFORM.map((t) => {
                const tw = TOWER_BY_ID[t.tower]
                const available = t.creditsAccrued + t.creditsCarriedIn - t.creditsConsumed
                return (
                  <Card
                    key={t.tower}
                    title={tw?.name}
                    subtitle={`${t.quarter} · conversion ${t.reinvestPct}% reinvest / ${t.priceReductionPct}% price reduction — set in the commercial schedule and executed by the ledger`}
                    right={t.freezeState === 'frozen' ? <Chip tone="crit"><Lock size={9} />allocation frozen</Chip> : <Chip tone="ok">open</Chip>}
                  >
                    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                      <div className="grid grid-cols-2 gap-3">
                        <Metric size="sm" label="Banked savings" value={`${num(t.bankedSavingsHrs)} h`} />
                        <Metric size="sm" label="Credits accrued" value={num(t.creditsAccrued)} />
                        <Metric size="sm" label="Carried in" value={num(t.creditsCarriedIn)} />
                        <Metric size="sm" label="Available" value={num(available)} deltaTone={available > 0 ? 'ok' : 'neutral'} />
                      </div>

                      <div>
                        <div className="label-cap">Allocations</div>
                        <ul className="mt-2 space-y-1.5">
                          {t.allocations.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center gap-2 rounded border border-line bg-sunken px-2.5 py-2">
                              <span className="font-mono text-2xs text-ink-3">{a.id}</span>
                              <span className="min-w-0 flex-1 truncate text-2xs text-ink">{a.title}</span>
                              <Chip tone={a.state === 'delivered' ? 'ok' : a.state === 'verifying' ? 'agent' : a.state === 'executing' ? 'brand' : 'neutral'}>{a.state}</Chip>
                              <span className="tnum text-2xs text-ink-2">{num(a.credits)} cr</span>
                              <span className="tnum text-2xs text-ink-3" title="Run-simplification yield: hours of demand retired per year">
                                yield {a.yieldRealised !== undefined ? (
                                  <span className={a.yieldRealised >= a.yieldPromised ? 'text-ok' : 'text-warn'}>
                                    {num(a.yieldRealised)}h realised vs {num(a.yieldPromised)}h promised
                                  </span>
                                ) : (
                                  <span>{num(a.yieldPromised)}h promised</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {t.freezeReason && (
                      <p className="mt-3 rounded border border-crit/35 bg-crit/[0.05] p-2.5 text-2xs leading-relaxed text-ink-2">
                        {t.freezeReason}
                      </p>
                    )}
                  </Card>
                )
              })}
            </div>

          </div>
        </>
      )}
    </>
  )
}
