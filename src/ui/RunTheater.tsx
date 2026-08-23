import React from 'react'
import { Bot, Gauge, Pause, Play, RotateCcw, ShieldCheck, Undo2, Wrench } from 'lucide-react'
import { AC } from '@/domain/reference'
import { AgentChip } from './domain'
import { Button, Chip, Dot } from './primitives'
import { cn, usd } from '@/lib/format'
import type { Run, RunStep } from '@/domain/types'

/* ==========================================================================
   The Run Theater (Addendum A §A7.2, D7).

   "Trust is built by visible work, not claimed accuracy."

   Nothing here is new machinery — it is the Run ledger rendered as
   performance instead of log. Because the Copilot's beat stream now projects
   onto the same `Run` shape (see domain/runProjection.ts), one player serves
   a live agent run and a seeded run from three weeks ago without knowing
   which it has.
   ========================================================================== */

const KIND_ICON: Record<RunStep['kind'], typeof Bot> = {
  agent: Bot,
  tool: Wrench,
  gate: ShieldCheck,
  verify: Gauge,
}

const STEP_TONE: Record<RunStep['state'], 'ok' | 'brand' | 'warn' | 'crit' | 'neutral'> = {
  done: 'ok',
  running: 'brand',
  pending: 'neutral',
  blocked: 'warn',
  failed: 'crit',
  skipped: 'neutral',
}

/** How long each step dwells in replay, in ms, before the playhead moves on. */
function dwellFor(step: RunStep): number {
  if (step.kind === 'gate') return 1400
  return Math.max(500, Math.min(1800, (step.durationMs ?? 1200) / 3))
}

function StepRow({
  step, index, last, revealed, active,
}: {
  step: RunStep
  index: number
  last: boolean
  revealed: boolean
  active: boolean
}) {
  const Icon = KIND_ICON[step.kind]
  // In replay a step that has not been reached yet reads as pending, whatever
  // its stored state — the playback is the point.
  const state: RunStep['state'] = revealed ? step.state : 'pending'
  const tone = active ? 'brand' : STEP_TONE[state]
  const cls = step.actionClass ? AC[step.actionClass] : undefined

  return (
    <li className={cn('flex gap-3 transition-opacity duration-300', revealed ? 'opacity-100' : 'opacity-45')}>
      {/* The spine. A gate is drawn as a barrier across it, not a bead on it. */}
      <div className="flex w-5 shrink-0 flex-col items-center">
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
            tone === 'ok' && 'border-ok/50 bg-ok/15 text-ok',
            tone === 'brand' && 'border-brand bg-brand/25 text-brand-ink',
            tone === 'warn' && 'border-warn/50 bg-warn/15 text-warn',
            tone === 'crit' && 'border-crit/50 bg-crit/15 text-crit',
            tone === 'neutral' && 'border-line-strong bg-sunken text-ink-3',
            active && 'animate-pulse-ring',
          )}
        >
          <Icon size={11} strokeWidth={2.2} />
        </span>
        {!last && (
          <span
            className={cn(
              'mt-1 w-px flex-1 transition-colors duration-500',
              revealed && state === 'done' ? 'bg-ok/40' : 'bg-line-strong/40',
            )}
          />
        )}
      </div>

      <div className="min-w-0 flex-1 pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium leading-snug text-ink">{step.label}</span>
          {step.actionClass && (
            <Chip tone="neutral" mono title={cls?.name}>{step.actionClass}</Chip>
          )}
          {step.agentId && <AgentChip id={step.agentId} />}
          {revealed && state === 'done' && step.durationMs !== undefined && (
            <span className="tnum ml-auto shrink-0 text-2xs text-ink-3">{(step.durationMs / 1000).toFixed(1)}s</span>
          )}
        </div>

        {/* Gates are physical barriers that open on approval (§A3.1). Drawn for
            every gate step — seeded runs carry the kind without the detail
            object, and a barrier with no caption still reads as a barrier. */}
        {step.kind === 'gate' && (
          <div
            className={cn(
              'mt-1.5 overflow-hidden rounded border',
              revealed && state === 'done'
                ? 'border-ok/40 bg-ok/[0.06]'
                : 'border-warn/45 bg-warn/[0.07]',
            )}
          >
            <div
              className={cn(
                'h-1 w-full',
                revealed && state === 'done'
                  ? 'bg-ok/30'
                  : 'bg-[repeating-linear-gradient(45deg,rgb(var(--c-warn)/0.35)_0_6px,transparent_6px_12px)]',
              )}
            />
            <p className="px-2.5 py-1.5 text-2xs leading-relaxed text-ink-2">
              {revealed && state === 'done' ? (
                <>Barrier opened — approved by a named human, and the approval is sealed to the chain.</>
              ) : step.gate ? (
                <>
                  Held for <span className="font-medium text-ink">{step.gate.role}</span>. Escalates to{' '}
                  {step.gate.escalatesTo} after {Math.round(step.gate.timeoutSec / 60)} minutes.
                </>
              ) : (
                <>Held at a human gate. Nothing beyond this point runs until a named person decides.</>
              )}
            </p>
          </div>
        )}

        {step.reasoning && revealed && (
          <p className="mt-1.5 line-clamp-3 border-l-2 border-agent/40 pl-2.5 text-2xs leading-relaxed text-ink-3">
            {step.reasoning}
          </p>
        )}

        {step.detail && step.kind !== 'gate' && (
          <p className="mt-1 text-2xs leading-relaxed text-ink-3">{step.detail}</p>
        )}

        {/* The compensation lane: visible, but dormant unless it fires. */}
        {step.compensation && step.compensation !== 'none' && (
          <p className="mt-1.5 flex items-start gap-1.5 text-2xs leading-relaxed text-ink-3">
            <Undo2 size={11} className="mt-px shrink-0 opacity-60" />
            <span>
              <span className="font-medium text-ink-2">Rollback ready:</span> {step.compensation}
            </span>
          </p>
        )}
      </div>
    </li>
  )
}

export function RunTheater({ run, className }: { run: Run; className?: string }) {
  const finished = ['complete', 'aborted', 'compensated'].includes(run.state)
  const liveDone = run.steps.filter((s) => s.state !== 'pending').length

  const [replay, setReplay] = React.useState(finished)
  const [playing, setPlaying] = React.useState(false)
  const [speed, setSpeed] = React.useState(1)
  const [head, setHead] = React.useState(finished ? 0 : liveDone)

  // Live runs follow the store; replay runs follow the playhead.
  const revealedCount = replay ? head : liveDone

  React.useEffect(() => {
    if (!replay || !playing) return
    if (head >= run.steps.length) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setHead((h) => h + 1), dwellFor(run.steps[head]) / speed)
    return () => clearTimeout(t)
  }, [replay, playing, head, speed, run.steps])

  const restart = () => {
    setHead(0)
    setPlaying(true)
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Chip tone={finished ? 'ok' : 'brand'}>
          <Dot tone={finished ? 'ok' : 'brand'} pulse={!finished} />
          {finished ? 'replay' : 'live'}
        </Chip>
        <span className="font-mono text-2xs text-ink-3">{run.id}</span>
        <span className="tnum text-2xs text-ink-3">
          {revealedCount}/{run.steps.length} steps · {usd(run.tokensUsd)}
        </span>

        {finished && (
          <span className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => (playing ? setPlaying(false) : head >= run.steps.length ? restart() : setPlaying(true))}>
              {playing ? <Pause size={11} /> : <Play size={11} />}
              {playing ? 'Pause' : head >= run.steps.length ? 'Replay' : 'Play'}
            </Button>
            <Button size="sm" variant="ghost" onClick={restart} title="Restart playback">
              <RotateCcw size={11} />
            </Button>
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  'rounded-xs border px-1.5 py-0.5 font-mono text-2xs transition-colors',
                  speed === s ? 'border-brand bg-brand/15 text-ink' : 'border-line text-ink-3 hover:border-line-strong',
                )}
              >
                {s}×
              </button>
            ))}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <ol className="flex flex-col">
          {run.steps.map((s, i) => (
            <StepRow
              key={s.id}
              step={s}
              index={i}
              last={i === run.steps.length - 1}
              revealed={i < revealedCount}
              active={replay && playing && i === head}
            />
          ))}
        </ol>

        {run.steps.length === 0 && (
          <p className="py-6 text-center text-2xs text-ink-3">This run has no recorded steps.</p>
        )}
      </div>
    </div>
  )
}
