/**
 * The AI-system registry — the platform's AI Bill of Materials.
 *
 * The gateway is the only place a model is called, so this is the only place
 * a whitelist needs enforcing to be complete. Every call resolves the model it
 * is about to use against the registry for the purpose it is about to use it
 * for; a miss is refused before a vendor stream is opened. Nothing in here
 * knows which client the registry belongs to — the contract references, the
 * exhibit name, the residency rules and the approved systems are all data in
 * the registry file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** The packaged seed. Deployments may point ASTRA_AI_REGISTRY at durable storage instead. */
export const REGISTRY_FILE = path.join(HERE, 'ai-registry.json')

/** Which registry purpose each gateway phase consumes. */
export const PHASE_PURPOSE = { plan: 'plan_synthesis', outcome: 'narrative', brief: 'narrative', compile: 'plan_synthesis' }

/** The AI function each gateway phase belongs to — the unit a customer may suspend. */
export const PHASE_FUNCTION = { plan: 'copilot.plan', outcome: 'herald.outcome', brief: 'herald.brief', compile: 'compiler.objectives' }

export const STATUSES = ['approved', 'pending', 'revoked']
export const HOSTINGS = ['vendor_cloud', 'client_tenant', 'artizent_dedicated']

const EMPTY = { version: 0, exhibit: 'AI-system whitelist', policyRef: 'AI-system whitelist', noticeHours: 72, residency: null, systems: [] }

export function loadRegistry(file = REGISTRY_FILE) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return { ...EMPTY, ...parsed, systems: Array.isArray(parsed.systems) ? parsed.systems : [] }
  } catch {
    return { ...EMPTY }
  }
}

export function saveRegistry(registry, file = REGISTRY_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(registry, null, 2)}\n`)
}

/** A system may be addressed by its registry id or by the model id it wraps. */
export function findSystem(registry, modelOrId) {
  return registry.systems.find((s) => s.id === modelOrId || s.model === modelOrId) ?? null
}

/** Whether a system sits inside the residency rules, and why not if it does not. */
export function residencyCheck(registry, system) {
  const r = registry.residency
  if (!r) return { ok: true }
  const rule = `${r.policyRef ?? 'Data residency'} — data may only be processed in permitted regions`
  if (Array.isArray(r.allowedRegions) && r.allowedRegions.length && !r.allowedRegions.includes(system.region)) {
    return { ok: false, rule, reason: `${system.vendor} ${system.model} is hosted in ${system.region}; permitted regions are ${r.allowedRegions.join(', ')}.` }
  }
  if (r.zeroRetentionRequired && !system.attestations?.zeroRetention) {
    return { ok: false, rule: `${r.policyRef ?? 'Data residency'} — zero-retention configuration is required`, reason: `${system.vendor} ${system.model} has no zero-retention attestation on file.` }
  }
  return { ok: true }
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
  const residency = residencyCheck(registry, system)
  if (!residency.ok) {
    return { ok: false, system, rule: residency.rule, reason: `${residency.reason} No vendor request was made.` }
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

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

/**
 * Registers a new system as pending. The notice period starts now; approval
 * cannot land before it ends without an explicit, recorded override.
 */
export function requestSystem(registry, input, by, reason, at = new Date().toISOString()) {
  const vendor = String(input?.vendor ?? '').trim()
  const model = String(input?.model ?? '').trim()
  const purposes = Array.isArray(input?.purposes) ? input.purposes.map(String).filter(Boolean) : []
  if (!vendor || !model) throw new Error('A request needs a vendor and a model id')
  if (!purposes.length) throw new Error('A request needs at least one purpose')
  if (findSystem(registry, model)) throw new Error(`Model "${model}" is already in the registry`)
  const hosting = HOSTINGS.includes(input?.hosting) ? input.hosting : 'vendor_cloud'
  const noticeHours = Number(registry.noticeHours ?? 72)
  const noticeDueAt = new Date(new Date(at).getTime() + noticeHours * 3600 * 1000).toISOString()
  const id = `ais_${slug(vendor)}_${String(registry.systems.length + 1).padStart(2, '0')}`
  const system = {
    id, vendor, model,
    version: String(input?.version ?? 'unspecified'),
    hosting,
    region: String(input?.region ?? 'unspecified'),
    purposes,
    status: 'pending',
    requestedBy: by, requestedAt: at, noticeDueAt,
    attestations: {
      zeroRetention: Boolean(input?.attestations?.zeroRetention),
      noTrainingOnCustomerData: Boolean(input?.attestations?.noTrainingOnCustomerData),
      ref: String(input?.attestations?.ref ?? 'none on file'),
    },
    supplyChain: Array.isArray(input?.supplyChain) ? input.supplyChain : [],
    history: [{ at, by, from: 'none', to: 'pending', reason: `${reason || 'Requested'} — ${noticeHours}-hour notice running` }],
  }
  return { registry: { ...registry, version: (registry.version ?? 0) + 1, systems: [...registry.systems, system] }, system }
}

/**
 * Changes a system's status, keeping the history the exhibit's revision log
 * needs. Approving a pending system inside its notice period requires an
 * override, and the override is itself part of the record.
 */
export function setStatus(registry, id, status, by, reason, at = new Date().toISOString(), { override = false } = {}) {
  if (!STATUSES.includes(status)) throw new Error(`Unknown status "${status}"`)
  const system = registry.systems.find((s) => s.id === id)
  if (!system) throw new Error(`Unknown system "${id}"`)
  const from = system.status
  let overridden = false
  if (status === 'approved' && from === 'pending' && system.noticeDueAt && new Date(system.noticeDueAt) > new Date(at)) {
    if (!override) throw new Error(`The notice period for ${system.model} runs until ${system.noticeDueAt}; approval needs a recorded override before then`)
    overridden = true
  }
  const updated = {
    ...system,
    status,
    ...(status === 'approved' ? { approvedBy: by, approvedAt: at } : {}),
    history: [...(system.history ?? []), { at, by, from, to: status, reason: overridden ? `${reason} (override — notice period not elapsed)` : reason, ...(overridden ? { override: true } : {}) }],
  }
  return {
    registry: { ...registry, version: (registry.version ?? 0) + 1, systems: registry.systems.map((s) => (s.id === id ? updated : s)) },
    system: updated,
    from,
    overridden,
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
    noticeHours: registry.noticeHours ?? 72,
    residency: registry.residency ?? null,
    servedModel: servedModel ?? null,
    systems: registry.systems.map((s) => ({ ...s, residency: residencyCheck(registry, s) })),
  }
}
