/**
 * The AI-system registry — the platform's AI Bill of Materials.
 *
 * The gateway is the only place a model is called, so this is the only place
 * a whitelist needs enforcing to be complete. Every call resolves the model it
 * is about to use against the registry for the purpose it is about to use it
 * for; a miss is refused before a vendor stream is opened. Nothing in here
 * knows which client the registry belongs to — the contract reference, the
 * exhibit name and the approved systems are all data in the registry file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const REGISTRY_FILE = process.env.ASTRA_AI_REGISTRY ?? path.join(HERE, 'ai-registry.json')

/** Which registry purpose each gateway phase consumes. */
export const PHASE_PURPOSE = { plan: 'plan_synthesis', outcome: 'narrative', brief: 'narrative' }

/** The AI function each gateway phase belongs to — the unit a customer may suspend. */
export const PHASE_FUNCTION = { plan: 'copilot.plan', outcome: 'herald.outcome', brief: 'herald.brief' }

export const STATUSES = ['approved', 'pending', 'revoked']

const EMPTY = { version: 0, exhibit: 'AI-system whitelist', policyRef: 'AI-system whitelist', systems: [] }

export function loadRegistry(file = REGISTRY_FILE) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return { ...EMPTY, ...parsed, systems: Array.isArray(parsed.systems) ? parsed.systems : [] }
  } catch {
    return { ...EMPTY }
  }
}

export function saveRegistry(registry, file = REGISTRY_FILE) {
  fs.writeFileSync(file, `${JSON.stringify(registry, null, 2)}\n`)
}

/** A system may be addressed by its registry id or by the model id it wraps. */
export function findSystem(registry, modelOrId) {
  return registry.systems.find((s) => s.id === modelOrId || s.model === modelOrId) ?? null
}

/**
 * Resolves a model for a purpose. Returns the system on success, or the reason
 * and the rule that refused it — the refusal is what the operator sees, so it
 * names the exhibit and the clause rather than saying "not allowed".
 */
export function resolveSystem(registry, modelOrId, purpose) {
  const rule = `${registry.policyRef} — only systems listed in Exhibit ${registry.exhibit} may be used`
  const system = findSystem(registry, modelOrId)
  if (!system) {
    return { ok: false, rule, reason: `Model "${modelOrId}" is not in the approved AI-system registry (Exhibit ${registry.exhibit}). No vendor request was made.` }
  }
  if (system.status !== 'approved') {
    return {
      ok: false, rule, system,
      reason: `${system.vendor} ${system.model} (${system.id}) is ${system.status} in Exhibit ${registry.exhibit}${system.status === 'pending' && system.noticeDueAt ? ` — approval cannot land before ${system.noticeDueAt}` : ''}. No vendor request was made.`,
    }
  }
  if (purpose && !(system.purposes ?? []).includes(purpose)) {
    return {
      ok: false, system,
      rule: `${registry.policyRef} — approval is per purpose`,
      reason: `${system.vendor} ${system.model} is approved for ${(system.purposes ?? []).join(', ') || 'no purposes'} but not for ${purpose}. No vendor request was made.`,
    }
  }
  return { ok: true, system }
}

/** Changes a system's status, keeping the history the exhibit's revision log needs. */
export function setStatus(registry, id, status, by, reason, at = new Date().toISOString()) {
  if (!STATUSES.includes(status)) throw new Error(`Unknown status "${status}"`)
  const system = registry.systems.find((s) => s.id === id)
  if (!system) throw new Error(`Unknown system "${id}"`)
  const from = system.status
  const updated = {
    ...system,
    status,
    ...(status === 'approved' ? { approvedBy: by, approvedAt: at } : {}),
    history: [...(system.history ?? []), { at, by, from, to: status, reason }],
  }
  return {
    registry: { ...registry, version: (registry.version ?? 0) + 1, systems: registry.systems.map((s) => (s.id === id ? updated : s)) },
    system: updated,
    from,
  }
}

/**
 * The currency check: did the vendor serve the model the registry says it is?
 * Vendors update silently; comparing what came back with what was approved is
 * the whole of the detection.
 */
export function currency(system, servedModel) {
  const registered = system?.model ?? null
  return { registered, served: servedModel ?? null, mismatch: Boolean(registered && servedModel && registered !== servedModel) }
}

/** What the browser needs to show the registry — no secrets live here, so it is the whole thing. */
export function publicView(registry, servedModel) {
  return {
    version: registry.version,
    exhibit: registry.exhibit,
    policyRef: registry.policyRef,
    servedModel: servedModel ?? null,
    systems: registry.systems,
  }
}
