/**
 * Astra agent gateway.
 *
 * The browser never sees the API key. This process holds it, calls Claude, and
 * streams the result back as server-sent events. It deliberately does not make
 * policy decisions — it returns the agent's reasoning and its proposed plan,
 * and the Autonomy Policy Engine in the client decides what may happen next.
 *
 * Bound to loopback only. The key is held in memory, and written to .env.local
 * only when the operator explicitly asks for it to be remembered.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'

// Azure App Service injects PORT and expects the process to bind 0.0.0.0.
// Locally neither is set, so the loopback default is preserved.
const PORT = Number(process.env.PORT ?? process.env.ASTRA_AGENT_PORT ?? 8787)
const HOST = process.env.PORT ? '0.0.0.0' : '127.0.0.1'
/** In production the gateway also serves the built SPA; in dev, Vite does. */
const SERVE_STATIC = process.env.ASTRA_SERVE_STATIC === '1' || Boolean(process.env.PORT)
// fileURLToPath, not url.pathname — the latter stays percent-encoded, so any
// space in the project path would resolve ROOT to a directory that isn't there.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = path.join(ROOT, '.env.local')

let MODEL = process.env.ASTRA_MODEL ?? 'claude-opus-5'

/* ------------------------------ Key management ----------------------------- */

function readEnvFile() {
  try {
    const out = {}
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
    return out
  } catch {
    return {}
  }
}

function writeEnvFile(patch) {
  const current = readEnvFile()
  const merged = { ...current, ...patch }
  const body = Object.entries(merged)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  fs.writeFileSync(ENV_FILE, `${body}\n`, { mode: 0o600 })
}

const fileEnv = readEnvFile()

/** Where the active key came from, so the UI can say so honestly. */
let keySource = null
let apiKey = null

if (process.env.ANTHROPIC_API_KEY) {
  apiKey = process.env.ANTHROPIC_API_KEY
  keySource = 'environment'
} else if (fileEnv.ANTHROPIC_API_KEY) {
  apiKey = fileEnv.ANTHROPIC_API_KEY
  keySource = 'file'
}
if (fileEnv.ASTRA_MODEL && !process.env.ASTRA_MODEL) MODEL = fileEnv.ASTRA_MODEL

let client = apiKey ? new Anthropic({ apiKey }) : null

const mask = (k) => (k ? `${k.slice(0, 7)}…${k.slice(-4)}` : null)

function setKey(key, persist) {
  apiKey = key
  client = new Anthropic({ apiKey: key })
  keySource = persist ? 'file' : 'session'
  if (persist) writeEnvFile({ ANTHROPIC_API_KEY: key, ASTRA_MODEL: MODEL })
}

function clearKey() {
  apiKey = null
  client = null
  keySource = null
  if (fs.existsSync(ENV_FILE)) writeEnvFile({ ANTHROPIC_API_KEY: '' })
}

/* ---------------------------------- Tools ---------------------------------- */

const PROPOSE_ACTION = {
  name: 'propose_action',
  description:
    'Record the routing decision, the finding, and — when the intent requires the estate to be changed — the concrete plan. ' +
    'Call this exactly once, before writing your response. You are proposing only: the Autonomy Policy Engine decides ' +
    'whether the plan executes, waits at a human gate, or is refused. Never state or imply that you have already acted.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      intent: { type: 'string', description: 'Dotted intent, e.g. remediate.incident, diagnose.service, analyse.economics, data.purge' },
      intent_confidence: { type: 'number', description: '0 to 1' },
      routed_agent: { type: 'string', description: 'Agent id from the roster' },
      routing_note: { type: 'string', description: 'One sentence on why this agent and what it matched' },
      requires_action: { type: 'boolean', description: 'True only if the estate must be mutated. False for diagnosis, analysis and reporting.' },
      context_used: {
        type: 'object',
        additionalProperties: false,
        properties: {
          assertions: { type: 'integer' },
          human_verified: { type: 'integer' },
          runbooks: { type: 'integer' },
          prior_incidents: { type: 'integer' },
          verification_floor: { type: 'string', enum: ['unverified', 'machine_corroborated', 'human_verified'] },
        },
        required: ['assertions', 'human_verified', 'runbooks', 'prior_incidents', 'verification_floor'],
      },
      finding: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          confidence: { type: 'number' },
          severity: { type: 'string', enum: ['info', 'warn', 'crit'] },
        },
        required: ['title', 'detail', 'confidence', 'severity'],
      },
      action_class: { type: 'string', description: 'Action class id such as AC-31, or the string none when no mutation is proposed' },
      blast_radius: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tier: { type: 'integer', description: '0 is most critical, 3 least' },
          services: { type: 'integer' },
          dependents: { type: 'integer' },
          data_mutation: { type: 'boolean' },
        },
        required: ['tier', 'services', 'dependents', 'data_mutation'],
      },
      plan_confidence: { type: 'number' },
      has_compensation: { type: 'boolean', description: 'True only if every mutating step declares a tested rollback' },
      skill: { type: 'string', description: 'Skill id from the registry, or none' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string' },
            action_class: { type: 'string' },
            compensation: { type: 'string', description: 'Rollback, or the string none' },
          },
          required: ['label', 'action_class', 'compensation'],
        },
      },
    },
    required: [
      'intent', 'intent_confidence', 'routed_agent', 'routing_note', 'requires_action',
      'context_used', 'finding', 'action_class', 'blast_radius', 'plan_confidence',
      'has_compensation', 'skill', 'steps',
    ],
  },
}

/* -------------------------------- Prompting -------------------------------- */

function systemPrompt(estate) {
  return `You are the agent runtime of Astra, the managed-services platform Artizent operates for ${estate.client.name}.

An operator has stated an intent. Route it to the right agent, retrieve the context that decision needs, reason in the open, and propose a plan. You are running inside a governed platform, so the following are facts about your situation, not style preferences:

- You propose. The Autonomy Policy Engine disposes. It evaluates your proposed action class, its blast radius, the acting agent's grade, plan confidence and the context conditions, and returns an execution mode. You never decide your own autonomy and you must never claim to have executed anything.
- Action classes carry platform floors that no policy can loosen. AC-71 (data deletion) is irreversible and can never be agent-executed at any level. AC-37 (code fix) always requires human pull-request review. AC-58 (entitlement change) always requires a second human control.
- A mutating step must declare a tested rollback, or it is forced through a human gate.
- A data asset with no contract cannot have a backfill verified against it, so pipeline mutations on such assets are capped at Advise.
- Retrieval enforces a verification floor proportional to risk: diagnosis may cite unverified assertions; a mutating plan at Supervised or Autonomous may only rely on human-verified or multiply-corroborated ones.

THE ESTATE
${JSON.stringify(estate, null, 1)}

HOW TO WORK
1. Think about what is actually being asked, which service and component it touches, and which agent's charter covers it. Consider and rule out alternative causes rather than seizing the first plausible one. Say what you ruled out and why.
2. Ground your reasoning in the estate above. Refer to real service, component, agent, skill and demand-class ids. Do not invent identifiers.
3. Call propose_action exactly once with your routing, finding and — only if the estate must actually be changed — the concrete plan with a rollback on every mutating step.
4. Then write your response to the operator.

VOICE
Write as a senior engineer reporting to a colleague. Plain, specific, unhurried. State what you found, what you propose, and what you are waiting on. No marketing language, no exclamation, no "I'd be happy to". Do not describe the platform's virtues — the operator built it. British spelling. Never claim an action has happened when it has not.`
}

function briefPrompt(portfolio) {
  return `You are Herald, the service-intelligence agent of Astra, briefing ${portfolio.client} on the managed service Artizent operates for them.

You are speaking to the client's executive — the CIO or their service owner. They are not an operator. They want to know whether the service is on track, what it cost, what changed, and what they personally must decide today.

THE PORTFOLIO
${JSON.stringify(portfolio, null, 1)}

HOW TO BRIEF
1. Open with the single most important thing. Not a greeting, not a summary of what you are about to say.
2. Make an argument, not a list. Say what the figures mean, and where two figures disagree, say which one you believe and why.
3. Every number you cite must be one from the portfolio above. Never invent or round beyond what is given. If a figure is missing, say you do not have it.
4. Name what is going wrong as plainly as what is going right. A brief that only reports good news is not worth reading.
5. Close with a section headed exactly "What I need from you" listing the decisions that require this person, each in one sentence. If nothing needs them, say so.

VOICE
Write as a senior partner reporting to a client executive. Plain, specific, unhurried. British spelling. No marketing language, no exclamation, no congratulation. Do not describe the platform's virtues — they bought it. Do not use headings other than the closing one. Around 200 words.`
}

function outcomePrompt(estate) {
  return `You are Herald, the service-intelligence agent of Astra at ${estate.client.name}.

A gated plan has just been approved by a named human and executed. Report the outcome to the operator in one short paragraph: what changed, how it was verified (machine verification, not the absence of an alarm), what was written back to the client's ITSM, and — if the demand class recurs — what the durable fix would be.

Be specific and factual. Do not congratulate anyone. Do not describe the platform's virtues. British spelling. Under 90 words.`
}

/* --------------------------------- Helpers --------------------------------- */

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function sse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  return (event) => res.write(`data: ${JSON.stringify(event)}\n\n`)
}

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'The API rejected this key. Check that it is a valid, active key.'
  if (err instanceof Anthropic.PermissionDeniedError) return 'The key is valid but not permitted to use this model.'
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited. The key works — retry in a moment.'
  if (err instanceof Anthropic.NotFoundError) return `Model "${MODEL}" was not found for this account.`
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the Anthropic API. Check network or proxy.'
  if (err instanceof Anthropic.APIError) return `API error ${err.status}: ${err.message}`
  return err?.message ?? String(err)
}

/* --------------------------------- Handlers -------------------------------- */

async function handleTest(res, candidateKey) {
  const testClient = candidateKey ? new Anthropic({ apiKey: candidateKey }) : client
  if (!testClient) return json(res, 200, { ok: false, error: 'No API key configured.' })

  const started = Date.now()
  try {
    const msg = await testClient.messages.create({
      model: MODEL,
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
    })
    const text = msg.content.find((b) => b.type === 'text')?.text?.trim() ?? ''
    return json(res, 200, {
      ok: true,
      model: msg.model,
      reply: text,
      latencyMs: Date.now() - started,
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    })
  } catch (err) {
    console.error('[astra-agent] connection test failed:', err?.status ?? '', err?.message ?? err)
    return json(res, 200, { ok: false, error: describeError(err), latencyMs: Date.now() - started })
  }
}

async function handleAgent(body, res) {
  const send = sse(res)
  const { phase = 'plan', utterance, estate, approved, portfolio } = body

  if (!client) {
    send({ type: 'error', message: 'No API key configured. Open Connection settings to add one.' })
    res.end()
    return
  }

  try {
    // Three phases share this endpoint. Only `plan` proposes an action, so
    // only `plan` gets the tool and the high effort budget.
    const isOutcome = phase === 'outcome'
    const isBrief = phase === 'brief'
    const narrating = isOutcome || isBrief

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: isOutcome ? 1024 : isBrief ? 1600 : 8000,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: isOutcome ? 'low' : isBrief ? 'medium' : 'high' },
      system: isBrief ? briefPrompt(portfolio) : isOutcome ? outcomePrompt(estate) : systemPrompt(estate),
      tools: narrating ? undefined : [PROPOSE_ACTION],
      messages: isBrief
        ? [{ role: 'user', content: 'Brief me.' }]
        : isOutcome
          ? [{
              role: 'user',
              content: `Operator intent: ${utterance}\n\nApproved and executed plan:\n${JSON.stringify(approved, null, 1)}`,
            }]
          : [{ role: 'user', content: utterance }],
    })

    stream.on('streamEvent', (event) => {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'thinking_delta') send({ type: 'thinking', text: event.delta.thinking })
        else if (event.delta.type === 'text_delta') send({ type: 'text', text: event.delta.text })
      }
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        send({ type: 'tool_start' })
      }
    })

    const final = await stream.finalMessage()

    for (const block of final.content) {
      if (block.type === 'tool_use' && block.name === 'propose_action') {
        send({ type: 'proposal', input: block.input })
      }
    }

    send({
      type: 'usage',
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      cacheRead: final.usage.cache_read_input_tokens ?? 0,
      model: final.model,
      stopReason: final.stop_reason,
    })
    send({ type: 'done' })
  } catch (err) {
    console.error('[astra-agent]', err?.status ?? '', err?.message ?? err)
    send({ type: 'error', message: describeError(err) })
  } finally {
    res.end()
  }
}

/* ------------------------------ Static serving ------------------------------ */

const DIST = path.join(ROOT, 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

function serveStatic(url, res) {
  const clean = (url.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  // Resolve inside dist and verify: a request may not escape the web root.
  const candidate = path.resolve(DIST, '.' + (clean === '/' ? '/index.html' : clean))
  const target = candidate.startsWith(DIST) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ? candidate
    : path.join(DIST, 'index.html')

  if (!fs.existsSync(target)) {
    return json(res, 404, { error: 'build not found — run npm run build' })
  }

  const ext = path.extname(target)
  const immutable = target.includes(`${path.sep}assets${path.sep}`)
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  fs.createReadStream(target).pipe(res)
}

/* ---------------------------------- Server --------------------------------- */

http
  .createServer((req, res) => {
    const url = req.url ?? ''

    if (req.method === 'GET' && url === '/api/agent/health') {
      return json(res, 200, {
        ok: true,
        configured: Boolean(client),
        source: keySource,
        maskedKey: mask(apiKey),
        model: MODEL,
        envFile: keySource === 'file' ? '.env.local' : null,
      })
    }

    if (req.method === 'DELETE' && url === '/api/agent/key') {
      clearKey()
      return json(res, 200, { ok: true, configured: false })
    }

    // Anything that is not an API call is the SPA. Unknown paths fall back to
    // index.html so a deep link still boots the app.
    if (req.method === 'GET' && SERVE_STATIC && !url.startsWith('/api/')) {
      return serveStatic(url, res)
    }

    if (req.method !== 'POST') return json(res, 404, { error: 'not found' })

    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', async () => {
      let body
      try {
        body = raw ? JSON.parse(raw) : {}
      } catch {
        return json(res, 400, { error: 'bad json' })
      }

      try {
        if (url === '/api/agent/key') {
          const key = String(body.key ?? '').trim()
          if (!key.startsWith('sk-ant-')) {
            return json(res, 200, { ok: false, error: 'That does not look like an Anthropic API key — they begin with sk-ant-.' })
          }
          if (body.model) MODEL = String(body.model)
          setKey(key, Boolean(body.persist))
          return json(res, 200, { ok: true, configured: true, source: keySource, maskedKey: mask(apiKey), model: MODEL })
        }

        if (url === '/api/agent/test') {
          const candidate = body.key ? String(body.key).trim() : null
          if (body.model) MODEL = String(body.model)
          return handleTest(res, candidate)
        }

        if (url.startsWith('/api/agent')) return handleAgent(body, res)

        return json(res, 404, { error: 'not found' })
      } catch (err) {
        // Never let a handler fault take the gateway down — the browser would
        // only see a dropped socket, which reads as "gateway unreachable".
        console.error('[astra-agent]', url, err?.message ?? err)
        if (!res.headersSent) return json(res, 200, { ok: false, error: describeError(err) })
        return res.end()
      }
    })
  })
  .listen(PORT, HOST, () => {
    console.log(`  Astra agent gateway on http://${HOST}:${PORT}  ·  model ${MODEL}`)
    if (SERVE_STATIC) console.log(`  Serving the built app from ${DIST}`)
    console.log(
      client
        ? `  API key loaded from ${keySource === 'environment' ? 'ANTHROPIC_API_KEY' : '.env.local'} (${mask(apiKey)})`
        : '  No API key yet — add one in the app under Connection settings.',
    )
  })
