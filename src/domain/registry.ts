/* ==========================================================================
   The approved models, read once.

   The gateway enforces an AI system registry: which models may be called, for
   what, and under whose approval. Anything that needs to know which models
   are approved reads it here, so a page and the tool behind it cannot arrive
   at different answers — which is exactly what happened when each fetched and
   parsed the registry for itself.

   A registry that cannot be reached returns undefined, and every reader is
   expected to report that as not known rather than as a failing check.
   ========================================================================== */

const TTL_MS = 60_000

let cached: { models: string[] | undefined; at: number } | null = null
let inFlight: Promise<string[] | undefined> | null = null

interface RegistrySystem {
  status: string
  model: string
}

/** The models the gateway will serve, or undefined where the registry could not be read. */
export async function approvedModels(signal?: AbortSignal): Promise<string[] | undefined> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.models
  if (inFlight) return inFlight
  inFlight = fetch('/api/agent/registry', signal ? { signal } : undefined)
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { systems?: RegistrySystem[] } | null) => {
      const models = j?.systems ? j.systems.filter((s) => s.status === 'approved').map((s) => s.model) : undefined
      cached = { models, at: Date.now() }
      return models
    })
    .catch(() => {
      cached = { models: undefined, at: Date.now() }
      return undefined
    })
    .finally(() => { inFlight = null })
  return inFlight
}

/** What the last read returned, for a caller that cannot wait. Undefined until one completes. */
export const approvedModelsNow = () => cached?.models
