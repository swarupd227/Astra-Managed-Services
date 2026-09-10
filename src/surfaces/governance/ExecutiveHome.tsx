import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, BarChart3, CalendarCheck2, ChevronDown, FileSignature, MessageSquare, RefreshCw, Sparkles } from 'lucide-react'
import { CLIENT, TOWERS } from '@/domain/estate'
import { DECISIONS, INNOVATION, OBLIGATIONS, SLAS, TRANSFORM, bankedHours } from '@/domain/ledgers'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { buildPortfolio } from '@/domain/executiveBrief'
import { HISTORY, autonomyDelta, autonomyMoves, classesRetired, realisedYield } from '@/domain/metrics'
import { streamExecutiveBrief, type BriefUsage } from '@/domain/agentRuntime'
import { PageHeader, EvidenceLink, AgentChip } from '@/ui/domain'
import { Button, Card, Chip, Dot, Metric } from '@/ui/primitives'
import { LineChart, Sparkline, CHART_COLORS } from '@/ui/charts'
import { cn, num, pct, signedPct, until, usd } from '@/lib/format'

/* ==========================================================================
   The Executive Briefing Room (Addendum A §A3.2).

   Before: five metric tiles and a chart. The executive arrived and went
   looking. After: Herald opens with its account of the portfolio, the
   decisions render as actionable cards inside that brief, and the tiles
   become the appendix they always were.

   The narration is a real model call. It is given the governed figures and
   asked to make an argument about them — which is the one thing a tile
   cannot do.
   ========================================================================== */

function Tile({
  label, status, statusTone, headline, sub, narrative, to, chart,
}: {
  label: string
  status: string
  statusTone: 'ok' | 'warn' | 'crit' | 'brand'
  headline: React.ReactNode
  sub?: string
  narrative: string
  to: string
  chart?: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="group flex min-w-0 flex-col rounded-md border border-line bg-surface p-3.5 transition-colors hover:border-line-strong"
    >
      <div className="flex items-center gap-2">
        <span className="label-cap">{label}</span>
        <Chip tone={statusTone} className="ml-auto"><Dot tone={statusTone} />{status}</Chip>
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="tnum font-display text-[28px] font-semibold leading-none tracking-tight text-ink">{headline}</span>
        {sub && <span className="text-2xs text-ink-3">{sub}</span>}
      </div>
      {chart && <div className="mt-2.5">{chart}</div>}
      <p className="mt-2.5 flex-1 text-2xs leading-relaxed text-ink-3">{narrative}</p>
      <span className="mt-2.5 inline-flex items-center gap-1 text-2xs text-ink-3 transition-colors group-hover:text-brand-ink">
        Open <ArrowUpRight size={11} />
      </span>
    </Link>
  )
}

/**
 * The prompt fixes the closing heading, so the argument and the asks can be
 * shown as what they are: prose, then the cards that discharge it.
 */
function splitBrief(text: string): { argument: string; asks: string[] } {
  const i = text.search(/(^|\n)[#*\s]*what i need from you/i)
  const clean = (s: string) =>
    s
      .replace(/\*\*/g, '')
      .replace(/^#{1,6}\s*/gm, '')
      .trim()

  if (i < 0) return { argument: clean(text), asks: [] }

  // The model writes its asks as a list; the heading itself is already the
  // card's title, so only the items are kept.
  const asks = clean(text.slice(i))
    .replace(/^what i need from you:?/i, '')
    .split(/\n+|(?<=\.)\s+-\s+/)
    .map((l) => l.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)

  return { argument: clean(text.slice(0, i)), asks }
}

export function ExecutiveHome() {
  const nav = useNavigate()
  const proposalMap = useAstra((s) => s.proposals)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]

  const runTowers = TOWERS.filter((t) => t.state === 'S4')
  const slaAtRisk = SLAS.filter((s) => s.kind === 'sla' && s.attainmentMtd < s.attainmentTarget)
  const glidepathActual = runTowers.reduce((s, t) => s + t.glidepathActual * t.baselineHrsPerQtr, 0) / runTowers.reduce((s, t) => s + t.baselineHrsPerQtr, 0)
  const glidepathContracted = runTowers.reduce((s, t) => s + t.glidepathContracted * t.baselineHrsPerQtr, 0) / runTowers.reduce((s, t) => s + t.baselineHrsPerQtr, 0)
  const autonomyEligible = runTowers.reduce((s, t) => s + t.autonomyEligibleVolume, 0) / runTowers.length
  const verifiedInnovation = INNOVATION.filter((i) => i.verdict === 'verified').reduce((s, i) => s + (i.realisedValueUsd ?? 0), 0)
  const openDecisions = DECISIONS.filter((d) => d.followThrough && d.followThrough.state !== 'green')
  const overdueObligations = OBLIGATIONS.filter((o) => o.state === 'red')
  const openProposals = Object.values(proposalMap).filter((p) => p.state === 'open')
  const credits = TRANSFORM.reduce((s, t) => s + (t.creditsAccrued + t.creditsCarriedIn - t.creditsConsumed), 0)
  const frozen = TRANSFORM.filter((t) => t.freezeState === 'frozen')
  const moves = autonomyMoves()

  const quarters = [...HISTORY.quarters]
  const glideSeries = [
    { key: 'contract', label: 'Contracted', color: CHART_COLORS.ink3, values: [...HISTORY.glidepathContracted], dashed: true },
    { key: 'actual', label: 'Delivered', color: CHART_COLORS.ok, values: [...HISTORY.glidepathActual], area: true },
  ]

  /* ------------------------------- the brief ------------------------------- */

  const [text, setText] = React.useState('')
  const [state, setState] = React.useState<'idle' | 'streaming' | 'done' | 'offline' | 'error'>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const [usage, setUsage] = React.useState<BriefUsage | null>(null)
  const [appendix, setAppendix] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)

  const run = React.useCallback(async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setText('')
    setError(null)
    setUsage(null)
    setState('streaming')

    // The portfolio is snapshotted at the moment of asking. A brief whose
    // figures move underneath it while it is being written is not a brief.
    const portfolio = buildPortfolio(
      Object.values(useAstra.getState().work),
      Object.values(useAstra.getState().proposals),
      useAstra.getState().objectives,
    )

    try {
      const u = await streamExecutiveBrief(portfolio, setText, ac.signal)
      if (ac.signal.aborted) return
      setUsage(u)
      setState('done')
    } catch (e) {
      if (ac.signal.aborted) return
      setError(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }, [])

  // Open with the brief already being written — D2, "the platform speaks
  // first". If the runtime is not connected the room degrades to its
  // appendix rather than to an error.
  React.useEffect(() => {
    let cancelled = false
    fetch('/api/agent/health')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.configured) void run()
        else {
          setState('offline')
          setAppendix(true)
        }
      })
      .catch(() => {
        if (cancelled) return
        setState('offline')
        setAppendix(true)
      })
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [run])

  const { argument, asks } = splitBrief(text)
  const awaiting = openDecisions.length + overdueObligations.length + openProposals.length

  return (
    <>
      <PageHeader
        title="Briefing room"
        subtitle={`${CLIENT.name} · ${CLIENT.contract} · month ${CLIENT.monthsElapsed} · ${CLIENT.topology}`}
        meta={<Chip tone="ok">Every figure evidence-linked</Chip>}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => nav('/copilot')}>
              <MessageSquare size={12} /> Ask Herald
            </Button>
            <Button size="sm" variant="default" onClick={() => nav('/governance/reports')}>
              <FileSignature size={12} /> Monthly pack
            </Button>
            <Button size="sm" variant="primary" onClick={() => nav('/governance/registers')}>
              <CalendarCheck2 size={12} /> {awaiting} awaiting you
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl space-y-4">
          {/* ---------------------------- the brief ---------------------------- */}

          <Card
            title="Herald · portfolio brief"
            subtitle={`${CLIENT.name} · generated from the ledgers at open`}
            right={
              <span className="flex shrink-0 items-center gap-2">
                {state === 'streaming' && <Chip tone="agent"><Dot tone="agent" pulse />writing</Chip>}
                {state === 'done' && usage && (
                  <span className="tnum text-2xs text-ink-3" title={`${usage.inputTokens.toLocaleString('en-GB')} in / ${usage.outputTokens.toLocaleString('en-GB')} out · ${usage.model}`}>
                    ${usage.usd.toFixed(3)}
                  </span>
                )}
                {(state === 'done' || state === 'error') && (
                  <Button size="sm" variant="ghost" onClick={run} title="Regenerate from the current ledgers">
                    <RefreshCw size={11} />
                  </Button>
                )}
              </span>
            }
          >
            {state === 'offline' ? (
              <div className="flex flex-wrap items-center gap-2 rounded border border-line-strong bg-sunken px-3 py-2.5">
                <p className="min-w-0 flex-1 text-2xs leading-relaxed text-ink-2">
                  The agent runtime is not connected, so Herald cannot brief. The figures below are
                  live and unaffected — connect the runtime to have them argued rather than listed.
                </p>
                <Button size="sm" variant="default" onClick={() => nav('/settings/connection')}>Connect</Button>
              </div>
            ) : state === 'error' ? (
              <div className="rounded border border-crit/40 bg-crit/[0.06] px-3 py-2.5">
                <p className="text-2xs font-medium text-crit">The brief could not be written</p>
                <p className="mt-1 text-2xs leading-relaxed text-ink-2">{error}</p>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2.5">
                  <AgentChip id="agt_herald" className="mt-0.5" />
                  <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {argument || (state === 'streaming' ? '' : '')}
                    {state === 'streaming' && <span className="ml-0.5 inline-block h-[13px] w-[6px] animate-caret bg-brand-ink align-middle" />}
                  </p>
                </div>
                {state === 'streaming' && !argument && (
                  <p className="mt-2 text-2xs text-ink-3">Reading the ledgers…</p>
                )}
              </>
            )}
          </Card>

          {/* §A3.2 — decisions are the destination. The executive discharges
              governance from the briefing itself. */}
          <Card
            title="Awaiting your decision"
            subtitle="Open conditions, overdue obligations, and proposals the workforce raised"
            right={<Chip tone={awaiting ? 'warn' : 'ok'}>{awaiting}</Chip>}
          >
            {/* Herald's own closing asks, then the cards that discharge them. */}
            {asks.length > 0 && (
              <ul className="mb-3 space-y-1.5 border-b border-line pb-3">
                {asks.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-2xs leading-relaxed text-ink-2">
                    <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-brand-ink" />
                    <span className="min-w-0 flex-1">{a}</span>
                  </li>
                ))}
              </ul>
            )}

            <ul className="space-y-2">
              {openDecisions.map((d) => (
                <li key={d.id} className="flex flex-wrap items-start gap-3 rounded border border-line bg-sunken p-3">
                  <Chip tone={d.followThrough!.state === 'red' ? 'crit' : 'warn'}>{d.followThrough!.state}</Chip>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink">{d.subject}</p>
                    <p className="mt-1 text-2xs text-ink-3">
                      {d.forum} · condition: {d.condition ?? d.followThrough!.text} · <span className="text-ink-2">{d.followThrough!.progress}</span>
                    </p>
                  </div>
                  <EvidenceLink id={d.evidenceId} />
                  <Button size="sm" variant="default" onClick={() => nav('/governance/registers')}>Review</Button>
                </li>
              ))}

              {openProposals.slice(0, 3).map((p) => (
                <li key={p.id} className="flex flex-wrap items-start gap-3 rounded border border-line bg-sunken p-3">
                  <Chip tone="brand">proposed</Chip>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink">{p.claim}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-ink-3">
                      raised by <AgentChip id={p.from} /> · {p.requestedDecision}
                    </p>
                  </div>
                  <Button size="sm" variant="default" onClick={() => nav('/governance/proposals')}>Decide</Button>
                </li>
              ))}

              {overdueObligations.map((o) => (
                <li key={o.id} className="flex flex-wrap items-start gap-3 rounded border border-crit/35 bg-crit/[0.05] p-3">
                  <Chip tone="crit">obligation overdue</Chip>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink">{o.title}</p>
                    <p className="mt-1 text-2xs text-ink-3">{o.owner} · {until(o.dueAt)} · evidence required: {o.evidenceRequirement}</p>
                  </div>
                  <Button size="sm" variant="default" onClick={() => nav('/governance/registers')}>Open register</Button>
                </li>
              ))}
            </ul>
            {role.readOnly && (
              <p className="mt-3 text-2xs text-ink-3">
                Read-only session — decisions are recorded by their named owner.
              </p>
            )}
          </Card>

          {/* ----------------------------- appendix ---------------------------- */}

          <button
            type="button"
            onClick={() => setAppendix((a) => !a)}
            aria-expanded={appendix}
            className="flex w-full items-center gap-2 rounded-md border border-line bg-surface px-3.5 py-2.5 text-left shadow-e1 transition-colors hover:border-line-strong"
          >
            <BarChart3 size={13} className="shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-ink">The figures behind the brief</span>
              <span className="mt-0.5 block text-2xs text-ink-3">
                Service, economics, autonomy, innovation and the transform ledger — the reference the
                brief argues from
              </span>
            </span>
            <ChevronDown size={14} className={cn('shrink-0 text-ink-3 transition-transform', appendix && 'rotate-180')} />
          </button>

          {appendix && (
            <div className="space-y-4 animate-fade-up">
              <div className="grid gap-3 lg:grid-cols-5">
                <Tile
                  label="Service"
                  status={slaAtRisk.length ? `${slaAtRisk.length} SLA at risk` : 'all attaining'}
                  statusTone={slaAtRisk.length ? 'warn' : 'ok'}
                  headline={pct(SLAS.filter((s) => s.kind === 'sla').reduce((s, x) => s + x.attainmentMtd, 0) / SLAS.filter((s) => s.kind === 'sla').length)}
                  sub="SLA attainment MTD"
                  narrative={
                    slaAtRisk.length
                      ? `${slaAtRisk[0].name} is below target with no headroom left this month. Predictive jeopardy has already escalated the at-risk objects it is permitted to.`
                      : 'Every contracted service level is attaining with headroom. Two experience measures are below target and carry commercial weight.'
                  }
                  to="/governance/sla"
                  chart={<Sparkline data={[...HISTORY.slaAttainment]} tone="ok" showLast width={120} height={22} />}
                />

                <Tile
                  label="Economics"
                  status={glidepathActual <= glidepathContracted ? 'ahead of contract' : 'behind contract'}
                  statusTone={glidepathActual <= glidepathContracted ? 'ok' : 'crit'}
                  headline={signedPct(glidepathActual)}
                  sub={`vs ${signedPct(glidepathContracted)} contracted`}
                  narrative={`${num(bankedHours())} hours banked against the countersigned baseline, decomposed by cause. Nothing is banked until its demand class shows verified volume decay for 60 to 90 days.`}
                  to="/governance/glidepath"
                  chart={<Sparkline data={[...HISTORY.glidepathActual]} tone="ok" showLast width={120} height={22} />}
                />

                <Tile
                  label="Autonomy"
                  status="trajectory positive"
                  statusTone="brand"
                  headline={pct(autonomyEligible)}
                  sub="autonomy-eligible volume"
                  narrative={`${moves.promotions} promotion${moves.promotions === 1 ? '' : 's'} and ${moves.demotions} demotion${moves.demotions === 1 ? '' : 's'} recorded, each with countersigned evidence${moves.refused ? `; ${moves.refused} promotion refused outright` : ''}.`}
                  to="/governance/autonomy"
                  chart={<Sparkline data={[...HISTORY.autonomyEligible, autonomyEligible]} tone="brand" showLast width={120} height={22} />}
                />

                <Tile
                  label="Innovation"
                  status={`${INNOVATION.filter((i) => i.stage === 'funded').length} in flight`}
                  statusTone="ok"
                  headline={usd(verifiedInnovation)}
                  sub="verified value"
                  narrative={`${INNOVATION.filter((i) => i.verdict === 'failed').length} funded experiments failed and remain in the register.`}
                  to="/governance/innovation"
                  chart={<Sparkline data={[...HISTORY.innovationValueK, verifiedInnovation / 1000]} tone="agent" showLast width={120} height={22} />}
                />

                <Tile
                  label="Initiative"
                  status={openProposals.length ? `${openProposals.length} open` : 'none open'}
                  statusTone={openProposals.length ? 'brand' : 'ok'}
                  headline={openProposals.length}
                  sub="agent proposals"
                  narrative="Work the workforce raised unprompted — eliminations, risks, cost reductions and its own requests for more autonomy."
                  to="/governance/proposals"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                <Card
                  title="Productivity glidepath against contract"
                  subtitle="Reduction in measured effort versus the countersigned baseline, by quarter"
                  right={<EvidenceLink id="ev_gp_root" label="ledger" />}
                >
                  <LineChart
                    labels={quarters}
                    series={glideSeries}
                    height={210}
                    zeroLine
                    yFormat={(n) => `${n.toFixed(0)}%`}
                    markers={[{ index: 2, label: 'ta_007 delivered' }]}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-2xs text-ink-3">
                    {glideSeries.map((s) => (
                      <span key={s.key} className="flex items-center gap-1.5">
                        <span className="h-[2px] w-4 rounded-full" style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }} />
                        {s.label}
                      </span>
                    ))}
                    <span className="ml-auto">Delivered is ahead of contract in every quarter since transition.</span>
                  </div>
                </Card>

                <Card title="Run funds Transform" subtitle="Capacity credits, allocation and the reliability circuit breaker">
                  <div className="grid grid-cols-2 gap-3">
                    <Metric size="sm" label="Credits available" value={num(credits)} hint="1 credit = 1 banked hour" />
                    <Metric size="sm" label="Allocated this quarter" value={num(TRANSFORM.reduce((s, t) => s + t.allocations.reduce((a, x) => a + x.credits, 0), 0))} />
                    <Metric size="sm" label="Returned as price reduction" value={num(Math.round(TRANSFORM.reduce((s, t) => s + (t.bankedSavingsHrs * t.priceReductionPct) / 100, 0)))} unit="hrs" hint="60/40 split" />
                    <Metric size="sm" label="Realised vs. promised yield" value={realisedYield() === null ? '—' : signedPct(realisedYield()!, 0)} deltaTone="ok" />
                  </div>

                  {frozen.length > 0 && (
                    <div className="mt-3 rounded border border-crit/40 bg-crit/[0.07] p-2.5">
                      <p className="text-2xs font-medium text-crit">Credit allocation frozen — {frozen.length} tower</p>
                      <p className="mt-1 text-2xs leading-relaxed text-ink-2">{frozen[0].freezeReason}</p>
                    </div>
                  )}

                  <div className="mt-3 border-t border-line pt-3">
                    <div className="flex items-center gap-1.5"><Sparkles size={11} className="text-brand-ink" /><span className="label-cap">The flywheel, as reported numbers</span></div>
                    <ul className="mt-2 space-y-1.5 text-2xs leading-relaxed text-ink-3">
                      <li className="flex justify-between gap-2"><span>F1 Knowledge → Autonomy</span><span className="tnum text-ok">{signedPct(autonomyDelta(), 1)} vs. last quarter</span></li>
                      <li className="flex justify-between gap-2"><span>F2 Autonomy → Savings</span><span className="tnum text-ok">{num(bankedHours())} hrs banked</span></li>
                      <li className="flex justify-between gap-2"><span>F3 Savings → Transform</span><span className="tnum text-ok">{num(credits)} credits available</span></li>
                      <li className="flex justify-between gap-2"><span>F4 Transform → Simpler Run</span><span className="tnum text-ok">{classesRetired()} demand classes retired</span></li>
                    </ul>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
