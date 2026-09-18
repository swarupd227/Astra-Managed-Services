import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUp, Bot, Maximize2, SquareArrowOutUpRight, Square, X } from 'lucide-react'
import { buildBrief, briefHeadline, readLastSeen } from '@/domain/brief'
import { AGENT_BY_ID, BUNDLE_BY_ID, TOWERS } from '@/domain/estate'
import { ROLE_BY_ID } from '@/domain/reference'
import { useAstra } from '@/domain/store'
import { Button, Chip, Dot } from '@/ui/primitives'
import { cn } from '@/lib/format'
import { ArtifactBody } from './cards/view'
import { TOOL_BY_NAME, agentName, roleHolds } from './catalogue'
import { useWorkspace } from './store'
import { threadDefs, type ThreadDef } from './threads'
import type { Artifact, Confirmation, ThreadMessage } from './types'

/* ==========================================================================
   The workspace — the conversation is the primary surface.

   Centre: the thread. Right: the card the latest message opened, at full
   size. Every card links to the page it is a view of. The global thread
   opens with Astra's account of what happened since the last session.
   ========================================================================== */

/** Inline code and bold, and nothing else: agent messages are plain language. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="whitespace-pre-line text-xs leading-relaxed text-ink [&+p]:mt-2">
          {para.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith('`') && part.endsWith('`')
              ? <code key={j} className="rounded-xs bg-sunken px-1 font-mono text-[11px] text-ink-2">{part.slice(1, -1)}</code>
              : part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
                : part,
          )}
        </p>
      ))}
    </>
  )
}

function Speaker({ id }: { id: string }) {
  const agent = AGENT_BY_ID[id]
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <span className="flex h-5 w-5 items-center justify-center rounded border border-line-strong bg-raised">
        <Bot size={11} className="text-ink-2" />
      </span>
      <span className="text-2xs font-medium text-ink">{agentName(id)}</span>
      {agent && <span className="text-[10px] text-ink-3">{agent.codename}</span>}
    </div>
  )
}

function ArtifactCard({ artifact, threadId, active, compact }: { artifact: Artifact; threadId: string; active: boolean; compact?: boolean }) {
  const openPane = useWorkspace((s) => s.openPane)
  return (
    <div className={cn('overflow-hidden rounded-md border bg-surface shadow-e1', active ? 'border-brand/60' : 'border-line')}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-2xs font-medium text-ink">{artifact.title}</span>
        {!compact && (
          <button onClick={() => openPane(threadId, artifact.id)} className="text-ink-3 hover:text-ink" title="Open beside the thread">
            <Maximize2 size={11} />
          </button>
        )}
        {artifact.route && (
          <Link to={artifact.route} className="text-ink-3 hover:text-ink" title="Open full view">
            <SquareArrowOutUpRight size={11} />
          </Link>
        )}
      </div>
      <div className="max-h-[360px] overflow-y-auto px-3 py-2.5">
        <ArtifactBody kind={artifact.kind} props={artifact.props} size="card" />
      </div>
    </div>
  )
}

function ConfirmBlock({ c, threadId, messageId }: { c: Confirmation; threadId: string; messageId: string }) {
  const decide = useWorkspace((s) => s.decide)
  return (
    <div className={cn('rounded-md border px-3 py-2.5', c.state === 'pending' ? 'border-brand/60 bg-brand/[0.05]' : 'border-line bg-raised')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip mono>{c.tool}</Chip>
        {c.state !== 'pending' && <Chip tone={c.state === 'declined' ? 'neutral' : c.state === 'running' ? 'warn' : 'ok'}>{c.state === 'declined' ? 'not now' : c.state}</Chip>}
      </div>
      <p className="mt-1.5 text-xs text-ink">{c.describe}</p>
      {c.state === 'pending' && (
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" variant="primary" onClick={() => decide(threadId, messageId, c.toolUseId, 'confirmed')}>Confirm</Button>
          <Button size="sm" variant="ghost" onClick={() => decide(threadId, messageId, c.toolUseId, 'declined')}>Not now</Button>
        </div>
      )}
    </div>
  )
}

function MessageView({ m, threadId, pane, last, onSuggest, compact }: { m: ThreadMessage; threadId: string; pane: string | null; last: boolean; onSuggest: (s: string) => void; compact?: boolean }) {
  if (m.author === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-md rounded-br-xs border border-line-strong bg-raised px-3 py-2">
          <p className="whitespace-pre-line text-xs text-ink">{m.text}</p>
          <p className="mt-0.5 text-[10px] text-ink-3">{m.speaker}</p>
        </div>
      </div>
    )
  }
  if (!m.text && !m.notice && !m.confirm?.length && !m.artifacts.length && !m.streaming) return null
  return (
    <div className="animate-rise-in">
      <Speaker id={m.speaker} />
      <div className="space-y-2 pl-6">
        {m.text && <Prose text={m.text} />}
        {m.notice && (
          <div className={cn('rounded border px-2.5 py-1.5', m.notice.tone === 'crit' ? 'border-crit/45 bg-crit/[0.06]' : 'border-warn/45 bg-warn/[0.06]')}>
            <p className="text-2xs text-ink">{m.notice.text}</p>
            {m.notice.rule && <p className="mt-0.5 text-[10px] text-ink-3">{m.notice.rule}</p>}
          </div>
        )}
        {m.confirm?.map((c) => <ConfirmBlock key={c.toolUseId} c={c} threadId={threadId} messageId={m.id} />)}
        {m.artifacts.map((a) => <ArtifactCard key={a.id} artifact={a} threadId={threadId} active={a.id === pane} compact={compact} />)}
        {m.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="label-cap mr-0.5">Sources</span>
            {m.sources.map((s) => (
              <Chip key={s.tool} tone={s.ok ? 'neutral' : 'crit'} mono title={s.error}>{agentName(s.agent)} · {s.tool}</Chip>
            ))}
          </div>
        )}
        {last && m.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {m.suggestions.map((s) => (
              <button key={s} onClick={() => onSuggest(s)} className="rounded-full border border-line-strong bg-surface px-2.5 py-1 text-2xs text-ink-2 transition-colors hover:border-brand hover:text-ink">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Openers are phrased as the user would type them, and only for tools the role holds. */
function openers(def: ThreadDef, roleId: string): string[] {
  const has = (tool: string) => Boolean(TOOL_BY_NAME[tool] && roleHolds(roleId, TOOL_BY_NAME[tool]))
  const out: string[] = []
  if (def.group === 'view') {
    const byView: Record<string, [string, string][]> = {
      'view-approvals': [['get_approvals', 'Which gates are past their SLA?'], ['get_approvals', 'Which of these carry a tier-0 blast radius?']],
      'view-proposals': [['get_proposals', 'Which proposals expire soonest?'], ['get_proposals', 'Which proposal would save the most hours?']],
      'view-privacy': [['get_privacy_requests', 'Which requests are due this week?'], ['get_privacy_requests', 'Why do requests have search gaps?']],
      'view-work-orders': [['get_work_orders', 'Which orders are in delivery without authorisation?'], ['get_work_orders', 'Which orders are over estimate?']],
    }
    return (byView[def.id] ?? []).filter(([tool]) => has(tool)).map(([, s]) => s)
  }
  if (def.group === 'bundle') {
    const id = def.id.replace('bundle-', '').toUpperCase()
    const towers = TOWERS.filter((t) => t.bundle === id)
    if (has('get_estate_overview')) out.push(`How is ${BUNDLE_BY_ID[id]?.name ?? id} running?`)
    if (has('get_coverage')) out.push(`Which ${id} functions have no owning agent?`)
    if (towers.some((t) => t.line === 'data') && has('get_data_reliability')) out.push('Which data services are below their availability target?')
    if (towers.some((t) => t.line === 'data') && has('get_data_estate')) out.push('What is in breach in the data estate?')
    if (towers.some((t) => t.line === 'data') && has('get_privacy_requests')) out.push('Which privacy requests are due this week?')
    if (towers.some((t) => t.line === 'swpe') && has('get_releases')) out.push('Which releases are blocked?')
    if (has('get_work_queue')) out.push(`What is most at risk of breaching in ${id}?`)
    return out.slice(0, 4)
  }
  if (has('get_my_workplace')) out.push('Is anything affecting the systems I use?')
  if (has('get_approvals')) out.push('What is waiting for my approval?')
  if (has('get_objectives') && !has('get_approvals')) out.push('Which objectives are at risk?')
  if (has('get_verification_queue') && !has('get_approvals')) out.push('What knowledge is waiting for me to verify?')
  if (has('get_sla')) out.push('Which service levels are below target?')
  if (has('get_data_reliability')) out.push('Will tonight’s data loads land on time?')
  if (has('get_data_estate')) out.push('What is broken in the data estate?')
  if (has('get_tech_debt')) out.push('What should we pay down next quarter?')
  if (has('get_estate_overview')) out.push('How is the service running overall?')
  return out.slice(0, 4)
}

function Opening({ def, onSuggest }: { def: ThreadDef; onSuggest: (s: string) => void }) {
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const holdsBrief = def.group === 'astra' && roleHolds(roleId, TOOL_BY_NAME.get_brief)
  // Read once: the opening is an account of a moment, not a live readout.
  const [brief] = React.useState(() => {
    if (!holdsBrief) return null
    const s = useAstra.getState()
    return buildBrief({ work: Object.values(s.work), assertions: s.assertions, proposals: Object.values(s.proposals), role, ...readLastSeen() })
  })
  const briefArtifact: Artifact | null = brief ? { id: 'opening-brief', kind: 'brief', title: 'While you were away', props: { since: brief.since, firstVisit: brief.firstVisit }, route: '/brief' } : null
  const suggestions = openers(def, roleId)
  return (
    <div className="animate-rise-in">
      <Speaker id={brief ? 'agt_herald' : 'astra'} />
      <div className="space-y-2 pl-6">
        {brief && <Prose text={briefHeadline(brief, role.person.split(' ').slice(-1)[0])} />}
        {briefArtifact && <ArtifactCard artifact={briefArtifact} threadId={def.id} active={false} />}
        {brief && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="label-cap mr-0.5">Sources</span>
            <Chip mono>Herald · get_brief</Chip>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {suggestions.map((s) => (
            <button key={s} onClick={() => onSuggest(s)} className="rounded-full border border-line-strong bg-surface px-2.5 py-1 text-2xs text-ink-2 transition-colors hover:border-brand hover:text-ink">
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Pane({ artifact, threadId }: { artifact: Artifact; threadId: string }) {
  const openPane = useWorkspace((s) => s.openPane)
  return (
    <aside className="hidden min-h-0 w-[480px] shrink-0 flex-col border-l border-line bg-surface xl:flex">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{artifact.title}</span>
        {artifact.route && (
          <Link to={artifact.route} className="flex items-center gap-1 text-2xs text-ink-2 hover:text-ink">
            Open full view <SquareArrowOutUpRight size={11} />
          </Link>
        )}
        <button onClick={() => openPane(threadId, null)} className="text-ink-3 hover:text-ink" aria-label="Close"><X size={13} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <ArtifactBody kind={artifact.kind} props={artifact.props} size="pane" />
      </div>
    </aside>
  )
}

export function Workspace() {
  const params = useParams()
  const threadId = params.threadId ?? 'astra'
  const missions = useAstra((s) => s.missions)
  const mi = useAstra((s) => s.mi)
  const def = React.useMemo(() => threadDefs(Object.values(missions), mi).find((d) => d.id === threadId) ?? { id: threadId, title: 'Conversation', group: 'astra' as const }, [missions, mi, threadId])
  const thread = useWorkspace((s) => s.threads[threadId])
  const paneArtifact = React.useMemo(() => {
    if (!thread?.pane) return null
    for (const m of thread.messages) for (const a of m.artifacts) if (a.id === thread.pane) return a
    return null
  }, [thread?.pane, thread?.messages])

  return (
    <div className="flex min-h-0 flex-1">
      <ThreadView def={def} />
      {paneArtifact && <Pane artifact={paneArtifact} threadId={threadId} />}
    </div>
  )
}

/**
 * The thread itself — messages, the working row and the composer. The
 * workspace shows it beside its pane; a page where decisions are made
 * embeds it compact, scoped to that page, so the conversation is never
 * more than a click away from the view it is about.
 */
export function ThreadView({ def, compact }: { def: ThreadDef; compact?: boolean }) {
  const threadId = def.id
  const thread = useWorkspace((s) => s.threads[threadId])
  const send = useWorkspace((s) => s.send)
  const stop = useWorkspace((s) => s.stop)
  const clear = useWorkspace((s) => s.clear)
  const [input, setInput] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const messages = thread?.messages ?? []
  const running = Boolean(thread?.running)
  const pending = Boolean(thread?.pending)

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, thread?.working, messages[messages.length - 1]?.text])

  const submit = (text: string) => {
    const t = text.trim()
    if (!t || running || pending) return
    send(threadId, t)
    setInput('')
  }

  const lastAgent = [...messages].reverse().find((m) => m.author === 'agent')

  return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid={compact ? 'thread-panel' : 'workspace-thread'}>
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
          {!compact && <span className="min-w-0 truncate text-xs font-medium text-ink">{def.title}</span>}
          {running && <Chip><Dot tone="brand" pulse />working</Chip>}
          {pending && !running && <Chip tone="warn">awaiting confirmation</Chip>}
          <span className="ml-auto flex items-center gap-1">
            {running && <Button size="sm" variant="ghost" onClick={() => stop(threadId)}><Square size={10} />Stop</Button>}
            {messages.length > 0 && !running && <Button size="sm" variant="ghost" onClick={() => clear(threadId)}>Clear</Button>}
          </span>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.length === 0 && <Opening def={def} onSuggest={submit} />}
            {messages.map((m) => (
              <MessageView key={m.id} m={m} threadId={threadId} pane={compact ? null : thread?.pane ?? null} last={m.id === lastAgent?.id && !running} onSuggest={submit} compact={compact} />
            ))}
            {running && thread?.working && (
              <div className="flex items-center gap-2.5 pl-6">
                <Dot tone="brand" pulse />
                <span className="text-2xs text-ink-2">{thread.working}</span>
                <span className="relative h-[3px] w-14 overflow-hidden rounded-full bg-sunken">
                  <span className="absolute inset-y-0 w-1/3 animate-agent-work rounded-full bg-brand" />
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-line bg-surface px-4 py-3">
          <form onSubmit={(e) => { e.preventDefault(); submit(input) }} className="relative mx-auto max-w-3xl">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input) } }}
              rows={2}
              disabled={pending}
              placeholder={pending ? 'Confirm or decline above' : `Message ${def.group === 'astra' ? 'Astra' : def.title}`}
              data-testid="workspace-composer"
              className="w-full resize-none rounded-md border border-line-strong bg-sunken px-3 py-2 pr-11 text-xs leading-relaxed text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || running || pending}
              className="absolute bottom-3 right-2 flex h-7 w-7 items-center justify-center rounded bg-brand text-[#1B1B1E] transition-opacity disabled:opacity-30"
              aria-label="Send"
            >
              <ArrowUp size={14} strokeWidth={2.5} />
            </button>
          </form>
        </div>
      </section>
  )
}
