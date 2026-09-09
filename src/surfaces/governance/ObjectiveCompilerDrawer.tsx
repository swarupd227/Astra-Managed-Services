import React from 'react'
import { Ban, Play, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { compileObjectives, type CompileResult } from '@/domain/objectiveCompiler'
import { isFunctionSuspended } from '@/domain/suspensions'
import { DEMAND_CLASSES } from '@/domain/ledgers'
import { StreamText } from '@/ui/StreamText'
import { Button, Chip, Drawer } from '@/ui/primitives'
import { cn } from '@/lib/format'

/* ==========================================================================
   The compile drawer.

   A client states objectives in prose. This turns that prose into measures
   the platform can actually take — and, just as importantly, shows what it
   could not. Three things are on screen before anything is applied: the
   measures proposed, the measures the compiler invented and which were
   therefore dropped, and the objectives left with nothing measuring them.

   Applying accepts nothing. Every objective lands proposed and still needs
   its client owner.
   ========================================================================== */

const PLACEHOLDER = `Paste the objectives as the client stated them — from the RFP, the SOW, or the transition plan. One per line or as prose.

e.g.  Cost Efficiency and Scalability: reduce the total cost of managed services year on year while absorbing growth without proportional headcount.`

export function ObjectiveCompilerDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const suspensions = useAstra((s) => s.suspensions)
  const apply = useAstra((s) => s.applyCompiledObjectives)

  const [text, setText] = React.useState('')
  const [running, setRunning] = React.useState(false)
  const [thinking, setThinking] = React.useState('')
  const [result, setResult] = React.useState<CompileResult | null>(null)
  const [refusal, setRefusal] = React.useState<{ text: string; rule: string } | null>(null)
  const [error, setError] = React.useState('')
  const [cost, setCost] = React.useState<{ usd?: number; model?: string } | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const logRef = React.useRef<HTMLDivElement>(null)

  const suspended = isFunctionSuspended(suspensions, 'compiler.objectives')

  React.useEffect(() => () => abortRef.current?.abort(), [])

  React.useEffect(() => {
    // Follow the reasoning as it arrives, the way the Copilot console does.
    const el = logRef.current
    if (el && running) el.scrollTop = el.scrollHeight
  }, [thinking, running])

  const reset = () => { setThinking(''); setResult(null); setRefusal(null); setError(''); setCost(null) }

  const run = async () => {
    reset()
    setRunning(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const run = await compileObjectives(text, setThinking, ctrl.signal)
      if (run.refusal) setRefusal(run.refusal)
      else if (run.result) setResult(run.result)
      else if (!ctrl.signal.aborted) setError('The model returned no proposal.')
      setCost({ usd: run.usd, model: run.model })
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const onApply = () => {
    if (!result) return
    apply(result, role.person)
    onClose()
    reset()
    setText('')
  }

  const unmeasured = result?.objectives.flatMap((o) => o.measures).filter((m) => m.source.kind === 'none').length ?? 0

  return (
    <Drawer
      open={open}
      onClose={() => { abortRef.current?.abort(); onClose() }}
      title="Compile objectives"
      subtitle="Propose how stated objectives will be measured, from what this platform already holds"
      width="max-w-[760px]"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xs text-ink-3">
            {cost?.model
              ? `${cost.model}${cost.usd !== undefined ? ` · $${cost.usd.toFixed(4)}` : ''}`
              : 'Nothing is accepted by applying a proposal — each objective still needs its client owner.'}
          </span>
          <span className="ml-auto flex items-center gap-2">
            {running ? (
              <Button size="sm" variant="default" onClick={() => abortRef.current?.abort()}><X size={11} /> Stop</Button>
            ) : (
              <Button size="sm" variant="default" disabled={!text.trim() || suspended} onClick={run}>
                <Play size={11} /> {result || refusal || error ? 'Compile again' : 'Compile'}
              </Button>
            )}
            <Button
              size="sm" variant="primary" disabled={!result || running}
              title={result ? 'Replace the objective set with this proposal' : 'Compile a proposal first'}
              onClick={onApply}
            >
              <Sparkles size={11} /> Apply proposal
            </Button>
          </span>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        {suspended && (
          <div className="flex items-start gap-2 rounded border border-warn/40 bg-warn/[0.06] p-3">
            <Ban size={12} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-2xs leading-relaxed text-ink-2">
              The objective compiler is suspended. No model will be called for this function until the suspension is released.
            </p>
          </div>
        )}

        <div>
          <span className="label-cap">Objectives as stated</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={8}
            disabled={running}
            className="mt-1 w-full rounded border border-line-strong bg-sunken p-2.5 text-2xs leading-relaxed text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none disabled:opacity-60"
          />
          <p className="mt-1 text-2xs leading-relaxed text-ink-3">
            This text is untrusted — it goes through the same injection classifier as anything else a model reads here. A supplier document is exactly the place an instruction would be hidden.
          </p>
        </div>

        {(running || thinking) && (
          <div>
            <div className="label-cap">Working</div>
            <div ref={logRef} className="mt-1 max-h-56 overflow-y-auto rounded border border-line bg-sunken p-2.5">
              <StreamText text={thinking} className="whitespace-pre-wrap text-2xs leading-relaxed text-ink-2" />
              {running && !thinking && <span className="text-2xs text-ink-3">Resolving the model and screening the input…</span>}
            </div>
          </div>
        )}

        {refusal && (
          <div className="rounded border border-crit/40 bg-crit/[0.06] p-3">
            <div className="flex items-center gap-1.5"><Ban size={12} className="text-crit" /><span className="label-cap text-crit">Refused</span></div>
            <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{refusal.text}</p>
            <p className="mt-1 text-2xs text-ink-3">{refusal.rule}</p>
          </div>
        )}

        {error && (
          <div className="rounded border border-crit/40 bg-crit/[0.06] p-3 text-2xs leading-relaxed text-ink-2">{error}</div>
        )}

        {result && (
          <>
            {result.note && (
              <div className="rounded border border-line bg-sunken p-3">
                <div className="label-cap">Compiler note</div>
                <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{result.note}</p>
              </div>
            )}

            {result.rejections.length > 0 && (
              <div className="rounded border border-crit/40 bg-crit/[0.06] p-3">
                <div className="flex items-center gap-1.5">
                  <TriangleAlert size={12} className="text-crit" />
                  <span className="label-cap text-crit">
                    {result.rejections.length} proposed measure{result.rejections.length === 1 ? '' : 's'} did not resolve and {result.rejections.length === 1 ? 'was' : 'were'} dropped
                  </span>
                </div>
                <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
                  The compiler named something this platform does not hold. Nothing invented becomes a measure — it is shown here rather than quietly discarded, because the objective it was meant to evidence is now thinner than it looks.
                </p>
                <ul className="mt-2 space-y-1">
                  {result.rejections.map((r, i) => (
                    <li key={i} className="text-2xs leading-relaxed text-ink-2">
                      <span className="text-ink-3">{r.objective} · </span>
                      <span className="text-ink">{r.measure}</span>
                      <span className="text-ink-3"> — {r.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 rounded border border-line bg-raised px-3 py-2">
              <Chip tone="info">{result.objectives.length} objective{result.objectives.length === 1 ? '' : 's'}</Chip>
              <Chip tone={unmeasured ? 'warn' : 'ok'}>{unmeasured} unmeasured</Chip>
              <Chip tone={result.rejections.length ? 'crit' : 'ok'}>{result.rejections.length} rejected</Chip>
              <span className="ml-auto text-2xs text-ink-3">Applying replaces the current objective set.</span>
            </div>

            <div className="space-y-3">
              {result.objectives.map((o) => (
                <div key={o.id} className="rounded border border-line bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink">{o.statement.split(':')[0]}</p>
                      <p className="mt-0.5 text-2xs leading-relaxed text-ink-3">owner {o.owner} · {o.horizon}</p>
                    </div>
                    <Chip tone="info">proposed</Chip>
                  </div>

                  <ul className="mt-2 space-y-1">
                    {o.measures.map((m) => (
                      <li
                        key={m.id}
                        className={cn('rounded px-2 py-1 text-2xs leading-relaxed', m.source.kind === 'none' ? 'bg-warn/[0.07] text-ink-2' : 'bg-sunken text-ink-2')}
                      >
                        <span className="text-ink">{m.label}</span>
                        {m.proxy && <Chip tone="warn" className="ml-1.5">proxy</Chip>}
                        {m.source.kind === 'none' ? (
                          <span className="block text-ink-3">no measure — {m.source.why}</span>
                        ) : (
                          <span className="block text-ink-3">
                            {m.source.kind.replace(/_/g, ' ')}
                            {'id' in m.source ? ` · ${m.source.id}` : ''}
                            {'field' in m.source ? ` · ${m.source.field}` : ''}
                            {'attribution' in m.source && m.source.attribution ? ` · ${m.source.attribution}` : ''}
                            {m.target !== undefined ? ` · target ${m.target} (${m.direction})` : ''}
                          </span>
                        )}
                        {m.proxyNote && <span className="block text-ink-3">{m.proxyNote}</span>}
                      </li>
                    ))}
                  </ul>

                  {o.gaps.length > 0 && (
                    <div className="mt-2 rounded border border-warn/40 bg-warn/[0.05] px-2 py-1.5">
                      <div className="label-cap text-warn">Gaps declared</div>
                      <ul className="mt-1 space-y-0.5">
                        {o.gaps.map((g) => <li key={g} className="text-2xs leading-relaxed text-ink-2">· {g}</li>)}
                      </ul>
                    </div>
                  )}

                  {(o.servedBy.demandClasses ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(o.servedBy.demandClasses ?? []).map((id) => (
                        <Chip key={id} mono title={DEMAND_CLASSES.find((d) => d.id === id)?.name}>{id}</Chip>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {!running && !result && !refusal && !error && (
          <div className="rounded border border-line bg-sunken p-3">
            <div className="label-cap">Compiler constraints</div>
            <ul className="mt-1.5 space-y-1 text-2xs leading-relaxed text-ink-2">
              <li>· It is given a catalogue of the measures this platform can actually take, and every measure it returns is resolved against that catalogue. An id that does not exist never becomes a measure.</li>
              <li>· It is required to say "no measure" with a reason where nothing evidences an objective. A compiler that always finds a measure is lying, and an objective half of which cannot be measured is the one worth knowing about before signature.</li>
              <li>· It proposes. It accepts nothing, configures nothing, and grants no autonomy — the objectives it produces arrive proposed, for a named client owner to accept or reject.</li>
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  )
}
