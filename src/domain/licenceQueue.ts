import { ENGAGEMENT } from './engagement'
import { PRODUCTS, readLicenceRequest } from './entitlement'

/* ==========================================================================
   The licence demand the client actually has.

   Written because a figure was quoted that nothing could produce. The claim
   was a number of Alteryx requests waiting; the platform held the incident
   extract, where licence traffic barely appears, and the requests those
   figures came from had never been loaded. A demonstration that says "like
   the N in your queue" has to be able to show the N.

   So this counts, and counts only what is there. Every figure is read from
   the client's own request extract through the same reader that decides a
   single request, which means the split it reports — what the platform would
   decide, what has no pool to draw on, what still needs a person — is the
   split that would actually happen, not an estimate of it.
   ========================================================================== */

export interface QueueRow {
  ref: string
  text: string
  state: string
  openedAt: string | null
}

export interface ProductDemand {
  product: string
  /** True where the platform holds a pool and could decide it. */
  pooled: boolean
  requests: number
}

export interface LicenceQueue {
  /** Requests loaded for this engagement, in total. */
  loaded: number
  /** Of those, the ones whose text mentions a licence. */
  mentioningLicence: number
  distinctTexts: number
  wouldDecide: number
  noPoolHeld: number
  needsAPerson: number
  notARequest: number
  byProduct: ProductDemand[]
  sample: QueueRow[]
}

interface Row { ref: string; shortDescription: string; state: string; openedAt: string | null }

/** Nothing loaded is a different answer from nothing matching, and says so. */
export class NoRequestsLoaded extends Error {
  constructor() {
    super('No service requests have been loaded for this engagement. Licence requests are raised as requests, not incidents, and the request extract is loaded separately from the incident dump.')
    this.name = 'NoRequestsLoaded'
  }
}

async function page(q: string, limit: number, offset: number): Promise<{ total: number; requests: Row[] }> {
  const params = new URLSearchParams({ engagement: ENGAGEMENT.id, limit: String(limit), offset: String(offset) })
  if (q) params.set('q', q)
  const res = await fetch(`/api/requests?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? body.error ?? `/api/requests answered ${res.status}`)
  }
  return res.json()
}

/**
 * What is waiting, and what the platform would do with it.
 *
 * Reads every licence-mentioning request rather than a sample, because the
 * figure is the point and a sampled figure would be an estimate wearing a
 * precise number's clothes. Two hundred at a time, which is what the endpoint
 * will give.
 */
export async function readLicenceQueue(match = 'licen'): Promise<LicenceQueue> {
  const first = await page('', 1, 0)
  if (first.total === 0) throw new NoRequestsLoaded()

  const rows: Row[] = []
  const head = await page(match, 200, 0)
  rows.push(...head.requests)
  for (let offset = 200; offset < head.total; offset += 200) {
    rows.push(...(await page(match, 200, offset)).requests)
  }

  const seen = new Set<string>()
  const counts = new Map<string, { pooled: boolean; n: number }>()
  let wouldDecide = 0, noPool = 0, needsAPerson = 0, notARequest = 0

  for (const r of rows) {
    const text = r.shortDescription.trim()
    if (!text || seen.has(text.toLowerCase())) continue
    seen.add(text.toLowerCase())
    const read = readLicenceRequest(text)
    if (read.notARequest) { notARequest++; continue }
    const name = read.product?.name ?? read.unpooled
    if (name) {
      const held = counts.get(name) ?? { pooled: Boolean(read.product), n: 0 }
      held.n++
      counts.set(name, held)
    }
    if (read.termUnreadable || (!read.product && !read.unpooled)) needsAPerson++
    else if (read.product) wouldDecide++
    else noPool++
  }

  return {
    loaded: first.total,
    mentioningLicence: head.total,
    distinctTexts: seen.size,
    wouldDecide,
    noPoolHeld: noPool,
    needsAPerson,
    notARequest,
    byProduct: [...counts]
      .map(([product, v]) => ({ product, pooled: v.pooled, requests: v.n }))
      .sort((a, b) => b.requests - a.requests),
    sample: rows
      .filter((r) => PRODUCTS.some((p) => readLicenceRequest(r.shortDescription).product?.id === p.id))
      .slice(0, 6)
      .map((r) => ({ ref: r.ref, text: r.shortDescription.trim(), state: r.state, openedAt: r.openedAt })),
  }
}
