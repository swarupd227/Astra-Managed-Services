import React from 'react'
import { AlertTriangle, Check, ChevronRight, PenLine, X } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { TOWER_BY_ID } from '@/domain/estate'
import { PageHeader, EvidenceLink } from '@/ui/domain'
import { LearningFeed } from '@/ui/LearningFeed'
import { Button, Card, Chip, Empty, Metric, inputClass } from '@/ui/primitives'
import { cn, ago, pct } from '@/lib/format'
import type { Assertion } from '@/domain/types'
import { OPERATIONAL } from '@/domain/metrics'

const SOURCE_LABEL: Record<Assertion['source'], string> = {
  code_analysis: 'Code analysis',
  telemetry_inference: 'Telemetry inference',
  ticket_mining: 'Ticket mining',
  human_statement: 'SME interview',
}

/**
 * One assertion at a time: the claim, its provenance, the corroborating
 * evidence, and three keys. Median task under sixty seconds — because the
 * verification queue is the rate limiter on the entire autonomy trajectory.
 */
export function VerificationQueue() {
  const assertions = useAstra((s) => s.assertions)
  const verify = useAstra((s) => s.verifyAssertion)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]

  const [index, setIndex] = React.useState(0)
  const [correcting, setCorrecting] = React.useState(false)
  const [correction, setCorrection] = React.useState('')
  const [done, setDone] = React.useState(0)

  const queue = assertions.filter((a) => a.verification === 'unverified' || a.verification === 'machine_corroborated')
  const current = queue[Math.min(index, Math.max(0, queue.length - 1))]

  React.useEffect(() => {
    setCorrecting(false)
    setCorrection(current?.object ?? '')
  }, [current?.id])

  const act = React.useCallback(
    (verdict: 'verify' | 'correct' | 'reject') => {
      if (!current) return
      verify(current.id, verdict, role.person, verdict === 'correct' ? correction : undefined)
      setDone((d) => d + 1)
      setIndex((i) => Math.min(i, Math.max(0, queue.length - 2)))
    },
    [current, verify, role.person, correction, queue.length],
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 'a' || e.key === 'A') act('verify')
      if (e.key === 'c' || e.key === 'C') setCorrecting(true)
      if (e.key === 'r' || e.key === 'R') act('reject')
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(queue.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, queue.length])

  const lessons = useAstra((s) => s.lessons)
  const verified = assertions.filter((a) => a.verification === 'human_verified').length
  const unlocked = (verified / Math.max(1, assertions.length)) * 100

  return (
    <>
      <PageHeader
        title="Verification Queue"
        subtitle="Keyboard: A verify · C correct · R reject"
        meta={<Chip tone={queue.length ? 'brand' : 'ok'}>{queue.length} awaiting</Chip>}
        actions={<span className="text-2xs text-ink-3">Verifier: {role.person}</span>}
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-4">
        <Metric size="sm" label="Verified this session" value={done} hint="keyboard: A verify · C correct · R reject" />
        <Metric size="sm" label="Human-verified overall" value={verified} hint={`of ${assertions.length} in this slice`} />
        <Metric size="sm" label="Median task time" value={`${OPERATIONAL.medianVerificationSec}s`} hint="target under 60 seconds" />
        <div className="min-w-0">
          <div className="label-cap">Your impact (coupling F1)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tnum font-display text-lg font-semibold leading-none text-ink">{pct(unlocked, 1)}</span>
            <span className="text-2xs text-ink-3">of this slice unlocked for autonomy</span>
          </div>
          <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${unlocked}%` }} />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!current ? (
          <Empty
            title="Queue clear"
            body="Every assertion in this slice carries a human verdict. Archivist will raise re-verification work objects as TTLs lapse or telemetry contradicts what the graph believes."
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs text-ink-3">
                Assertion {Math.min(index + 1, queue.length)} of {queue.length} · {TOWER_BY_ID[current.tower]?.name}
              </span>
              <span className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>Prev</Button>
                <Button size="sm" variant="ghost" onClick={() => setIndex((i) => Math.min(queue.length - 1, i + 1))} disabled={index >= queue.length - 1}>
                  Skip <ChevronRight size={11} />
                </Button>
              </span>
            </div>

            <article className="overflow-hidden rounded-md border border-line bg-surface">
              <header className="border-b border-line px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={current.tier === 0 ? 'crit' : current.tier === 1 ? 'warn' : 'neutral'}>tier {current.tier}</Chip>
                  <Chip tone={current.verification === 'machine_corroborated' ? 'info' : 'neutral'}>
                    {current.verification === 'machine_corroborated' ? 'machine-corroborated' : 'unverified'}
                  </Chip>
                  <Chip mono>{current.id}</Chip>
                  {current.conflictsWith && <Chip tone="crit"><AlertTriangle size={9} />conflict</Chip>}
                </div>

                <div className="mt-3 rounded border border-line bg-sunken p-3">
                  <div className="label-cap">The claim</div>
                  <p className="mt-1.5 font-mono text-xs leading-relaxed text-ink">
                    <span className="text-brand-ink">{current.subject}</span>{' '}
                    <span className="text-ink-3">{current.predicate}</span>{' '}
                    <span className="text-ok">{current.object}</span>
                  </p>
                  <p className="mt-2 text-2xs leading-relaxed text-ink-2">{current.narrative}</p>
                </div>
              </header>

              <div className="grid gap-0 sm:grid-cols-2">
                <div className="border-b border-line px-4 py-3 sm:border-b-0 sm:border-r">
                  <div className="label-cap">Provenance</div>
                  <dl className="mt-1.5 space-y-1.5 text-2xs">
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">Source</dt><dd className="text-ink-2">{SOURCE_LABEL[current.source]}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">Method</dt><dd className="max-w-[60%] text-right text-ink-2">{current.method}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">Confidence</dt><dd className="tnum text-ink-2">{current.confidence.toFixed(2)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">Asserted</dt><dd className="text-ink-2">{ago(current.assertedAt)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-ink-3">TTL</dt><dd className="text-ink-2">{current.ttlDays} days</dd></div>
                  </dl>
                  {current.provenance && (
                    <div className="mt-2 rounded border border-line bg-sunken p-2">
                      <div className="label-cap">Go and look</div>
                      <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-ink-2">{current.provenance.sourceRef}</p>
                      <p className="mt-1 text-[10px] text-ink-3">
                        read {ago(current.provenance.retrievedAt)} · claim hash <span className="font-mono">{current.provenance.contentHash.slice(0, 12)}…</span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-4 py-3">
                  <div className="label-cap">Verification checklist</div>
                  {current.conflictsWith ? (
                    <div className="mt-1.5 rounded border border-crit/40 bg-crit/[0.07] p-2.5">
                      <p className="text-2xs font-medium text-crit">Contradiction detected</p>
                      <p className="mt-1 text-2xs leading-relaxed text-ink-2">{current.conflictsWith}</p>
                      <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
                        Telemetry and the declared record disagree. Your verdict decides which the graph carries.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
                      Is this true today, and safe for an agent to cite on a tier-{current.tier} service? Verifying raises it to human-verified.
                    </p>
                  )}
                </div>
              </div>

              {correcting && (
                <div className="border-t border-line bg-raised px-4 py-3">
                  <div className="label-cap">Corrected object</div>
                  <div className="mt-1.5 flex gap-2">
                    <input autoFocus value={correction} onChange={(e) => setCorrection(e.target.value)} className={cn(inputClass, 'font-mono')} />
                    <Button variant="primary" onClick={() => act('correct')}>Save &amp; verify</Button>
                    <Button variant="ghost" onClick={() => setCorrecting(false)}>Cancel</Button>
                  </div>
                  <p className="mt-1.5 text-2xs text-ink-3">The original value is retained in the evidence record — corrections are history, not overwrites.</p>
                </div>
              )}

              <footer className="flex flex-wrap items-center gap-1.5 border-t border-line bg-raised px-4 py-2.5">
                <Button variant="primary" onClick={() => act('verify')}>
                  <Check size={12} /> Verify <kbd className="ml-1 rounded border border-ink-inv/30 px-1 font-mono text-[9px]">A</kbd>
                </Button>
                <Button variant="default" onClick={() => setCorrecting(true)}>
                  <PenLine size={12} /> Correct <kbd className="ml-1 rounded border border-line px-1 font-mono text-[9px]">C</kbd>
                </Button>
                <Button variant="default" onClick={() => act('reject')}>
                  <X size={12} /> Reject <kbd className="ml-1 rounded border border-line px-1 font-mono text-[9px]">R</kbd>
                </Button>
                <span className="ml-auto text-2xs text-ink-3">keyboard-first · no mouse required</span>
              </footer>
            </article>

            {/* D8 — the loop the correction closes, shown where corrections
                are made rather than on a separate screen. */}
            <Card
              title="Your verifications"
              subtitle="Each correction, and what the platform computed it reaches"
              right={<Chip tone={lessons.length ? 'ok' : 'neutral'}>{lessons.length}</Chip>}
            >
              <LearningFeed limit={4} />
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
