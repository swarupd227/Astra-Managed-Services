import React from 'react'
import { Check, Eye, EyeOff, KeyRound, Loader2, Plug, Trash2, X } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Dot, Field, Metric, inputClass, selectClass } from '@/ui/primitives'
import { cn, usd } from '@/lib/format'

interface Health {
  configured: boolean
  source: 'environment' | 'file' | 'session' | null
  maskedKey: string | null
  model: string
  envFile: string | null
}

interface TestResult {
  ok: boolean
  model?: string
  reply?: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  error?: string
}

const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', note: 'Default — reasoning-critical steps' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Lower cost, faster' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'Cheapest — classification and extraction' },
]

const SOURCE_LABEL: Record<string, string> = {
  environment: 'ANTHROPIC_API_KEY environment variable',
  file: '.env.local in the project folder',
  session: 'this gateway session only',
}

export function Connection() {
  const pushToast = useAstra((s) => s.pushToast)
  const [health, setHealth] = React.useState<Health | null>(null)
  const [reachable, setReachable] = React.useState<boolean | null>(null)
  const [key, setKey] = React.useState('')
  const [reveal, setReveal] = React.useState(false)
  const [persist, setPersist] = React.useState(true)
  const [model, setModel] = React.useState('claude-opus-5')
  const [busy, setBusy] = React.useState<'test' | 'save' | 'clear' | null>(null)
  const [result, setResult] = React.useState<TestResult | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch('/api/agent/health')
      if (!r.ok) throw new Error()
      const h: Health = await r.json()
      setHealth(h)
      setModel(h.model)
      setReachable(true)
    } catch {
      setReachable(false)
      setHealth(null)
    }
  }, [])

  React.useEffect(() => { void refresh() }, [refresh])

  const test = async () => {
    setBusy('test')
    setResult(null)
    try {
      const r = await fetch('/api/agent/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() || undefined, model }),
      })
      const j: TestResult = await r.json()
      setResult(j)
      if (j.ok) pushToast({ title: 'Connection verified', body: `${j.model} replied in ${j.latencyMs} ms.`, tone: 'ok' })
    } catch {
      setResult({ ok: false, error: 'Could not reach the agent gateway.' })
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    setBusy('save')
    try {
      const r = await fetch('/api/agent/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), persist, model }),
      })
      const j = await r.json()
      if (!j.ok) {
        setResult({ ok: false, error: j.error })
        return
      }
      setKey('')
      await refresh()
      pushToast({
        title: 'API key saved',
        body: persist ? 'Written to .env.local — it will load on the next gateway start.' : 'Held for this gateway session only.',
        tone: 'ok',
      })
    } catch {
      setResult({ ok: false, error: 'Could not reach the agent gateway.' })
    } finally {
      setBusy(null)
    }
  }

  const clear = async () => {
    setBusy('clear')
    try {
      await fetch('/api/agent/key', { method: 'DELETE' })
      await refresh()
      setResult(null)
      pushToast({ title: 'API key removed', body: 'The gateway will refuse agent runs until a key is added.', tone: 'warn' })
    } finally {
      setBusy(null)
    }
  }

  const configured = Boolean(health?.configured)

  return (
    <>
      <PageHeader
        title="Connection"
        subtitle={reachable === false ? 'Agent gateway unreachable' : health ? `Gateway on :8787 · ${health.model}` : undefined}
        meta={
          <Chip tone={reachable === false ? 'crit' : configured ? 'ok' : 'warn'}>
            <Dot tone={reachable === false ? 'crit' : configured ? 'ok' : 'warn'} />
            {reachable === false ? 'gateway offline' : configured ? 'connected' : 'no key'}
          </Chip>
        }
        actions={<Button size="sm" variant="ghost" onClick={() => void refresh()}>Refresh</Button>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {reachable === false && (
            <div className="rounded-md border border-crit/45 bg-crit/[0.06] p-3">
              <p className="text-xs font-medium text-ink">The agent gateway is not running.</p>
              <p className="mt-1 text-2xs leading-relaxed text-ink-2">
                It holds the API key so the browser never sees it. Start it from the project folder:
              </p>
              <pre className="mt-2 rounded border border-line bg-sunken px-2.5 py-1.5 font-mono text-2xs text-ink">npm run dev</pre>
              <p className="mt-1.5 text-2xs text-ink-3">That starts the gateway and this app together.</p>
            </div>
          )}

          <Card title="Anthropic API key" subtitle="Held by the local gateway process, never sent to the browser">
            {configured && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-ok/40 bg-ok/[0.06] px-3 py-2">
                <Check size={13} className="shrink-0 text-ok" />
                <span className="font-mono text-2xs text-ink">{health?.maskedKey}</span>
                <span className="text-2xs text-ink-3">from {SOURCE_LABEL[health!.source ?? 'session']}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  disabled={busy !== null || health?.source === 'environment'}
                  title={health?.source === 'environment' ? 'Set in the environment — unset the variable to remove it' : 'Remove the stored key'}
                  onClick={() => void clear()}
                >
                  <Trash2 size={11} /> Remove
                </Button>
              </div>
            )}

            <Field
              label={configured ? 'Replace key' : 'API key'}
              hint="Create one at console.anthropic.com under API Keys."
            >
              <div className="relative">
                <KeyRound size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  type={reveal ? 'text' : 'password'}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="sk-ant-..."
                  autoComplete="off"
                  spellCheck={false}
                  className={cn(inputClass, 'pl-7 pr-9 font-mono')}
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                  aria-label={reveal ? 'Hide key' : 'Show key'}
                >
                  {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </Field>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Model">
                <select value={model} onChange={(e) => setModel(e.target.value)} className={selectClass}>
                  {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
              <div className="flex items-end pb-1">
                <label className="flex items-start gap-2 text-2xs leading-relaxed text-ink-2">
                  <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} className="mt-0.5 accent-brand" />
                  <span>
                    Remember on this machine
                    <span className="block text-ink-3">Writes <span className="font-mono">.env.local</span>, which is git-ignored. Leave unchecked to hold it for this session only.</span>
                  </span>
                </label>
              </div>
            </div>

            <p className="mt-2 text-2xs text-ink-3">{MODELS.find((m) => m.id === model)?.note}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Button
                variant="default"
                disabled={busy !== null || reachable === false || (!key.trim() && !configured)}
                onClick={() => void test()}
              >
                {busy === 'test' ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
                Test connection
              </Button>
              <Button
                variant="primary"
                disabled={busy !== null || reachable === false || !key.trim()}
                onClick={() => void save()}
              >
                {busy === 'save' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save key
              </Button>
              <span className="text-2xs text-ink-3">Test uses the pasted key if present, otherwise the stored one.</span>
            </div>
          </Card>

          {result && (
            <Card
              title={result.ok ? 'Connection verified' : 'Connection failed'}
              right={<Chip tone={result.ok ? 'ok' : 'crit'}>{result.ok ? 'ok' : 'error'}</Chip>}
            >
              {result.ok ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric size="sm" label="Model" value={result.model?.replace('claude-', '') ?? '—'} />
                    <Metric size="sm" label="Round trip" value={`${result.latencyMs} ms`} />
                    <Metric size="sm" label="Tokens" value={`${result.inputTokens} / ${result.outputTokens}`} hint="in / out" />
                    <Metric
                      size="sm"
                      label="Cost"
                      value={usd(((result.inputTokens ?? 0) / 1e6) * 5 + ((result.outputTokens ?? 0) / 1e6) * 25)}
                      hint="this call"
                    />
                  </div>
                  <p className="mt-3 rounded border border-line bg-sunken px-2.5 py-1.5 font-mono text-2xs text-ink-2">
                    reply: {result.reply}
                  </p>
                </>
              ) : (
                <div className="flex items-start gap-2">
                  <X size={13} className="mt-px shrink-0 text-crit" />
                  <p className="text-2xs leading-relaxed text-ink-2">{result.error}</p>
                </div>
              )}
            </Card>
          )}

          <Card title="Key handling" subtitle="Local gateway, loopback only">
            <ul className="space-y-1.5 text-2xs leading-relaxed text-ink-2">
              <li>· The key is held by the gateway process on <span className="font-mono">127.0.0.1:8787</span>. It is never included in the browser bundle and is never returned by any endpoint — the app only ever sees a masked form.</li>
              <li>· <span className="font-mono">ANTHROPIC_API_KEY</span> in the environment takes precedence over anything saved here.</li>
              <li>· "Remember on this machine" writes <span className="font-mono">.env.local</span> with owner-only permissions. It is git-ignored.</li>
              <li>· Model choice applies to agent runs on the Copilot. Opus 5 is the default; the platform's own routing would place cheaper tiers on extraction and drafting steps.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
