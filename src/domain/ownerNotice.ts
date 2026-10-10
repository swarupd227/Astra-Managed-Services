import { DATA_ITEM_BY_ID, DATA_KIND_LABEL, descendants, isBreach, ownState, type DataItem } from './dataEstate'
import type { PublishRecord } from './publication'

/* ==========================================================================
   Telling the people downstream.

   The platform knows who they are — the lineage names every owner between a
   failing thing and the people reading the far end — and knowing is the hard
   part. What is left is a message, and a message is where a careful system
   usually starts inventing: a reassuring sentence about when it will be
   fixed, a severity nobody assigned, a recipient who left last year.

   So this composes and stops. It never sends, it says on its face that it
   has not been sent, and it writes nothing it cannot point at. No estimate
   of when the data will be back, because nothing in the estate knows. No
   apology on somebody else's behalf. One message per owner naming only what
   that owner owns, rather than one broadcast listing everybody's problems,
   because a person who has to search a list for their own name will not read
   the next one.
   ========================================================================== */

export interface OwnerNotice {
  /** The role it is addressed to. People leave; roles are what the register holds. */
  to: string
  /** Only the affected things this owner answers for. */
  owns: DataItem[]
  subject: string
  body: string
}

export interface NoticeDraft {
  item: DataItem
  notices: OwnerNotice[]
  /** Everything downstream, owned or not. Empty means the lineage maps nothing
   *  below it — which is an unknown, not a thing with no consequences, and the
   *  two must never read the same. */
  affected: DataItem[]
  /** Affected things whose owner the register does not name. */
  unassigned: DataItem[]
  /** Always false. Kept so no caller can mistake a draft for a sent message. */
  sent: false
}

const when = (iso: string) => iso.slice(0, 16).replace('T', ' ')

/**
 * Drafts one message per owner of anything downstream of a failing item.
 *
 * `held` is the publish gate's record where there is one: a load the gate
 * stopped is a different message from a pipeline that fell over, and the
 * difference matters to whoever reads it — in the first case their figures
 * are stale, in the second they may be wrong.
 */
export function draftOwnerNotices(itemId: string, held?: PublishRecord | null): NoticeDraft | null {
  const item = DATA_ITEM_BY_ID[itemId]
  if (!item) return null

  const down = descendants(item.id)
  const broken = isBreach(ownState(item))

  const byOwner = new Map<string, DataItem[]>()
  const unassigned: DataItem[] = []
  for (const d of down) {
    const who = d.steward ?? d.owner
    if (!who) { unassigned.push(d); continue }
    byOwner.set(who, [...(byOwner.get(who) ?? []), d])
  }

  // What happened, in one sentence, and only what is on record.
  const what = held
    ? `${item.name} did not reconcile against the totals its source declared, so the load of ${when(held.at)} was held and nothing downstream has taken it.`
    : broken
      ? `${item.name} is failing its own checks.`
      : `${item.name} has a fault.`

  const consequence = held
    ? 'What you are reading is the last set of figures that did reconcile. It is correct as at that time; it is not today’s.'
    : 'Figures downstream of it may be wrong rather than merely old, until it is confirmed either way.'

  const ticket = held?.workObjectId ? [`Raised as ${held.workObjectId}.`] : []

  const notices: OwnerNotice[] = [...byOwner]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([to, owns]) => {
      const reports = owns.filter((o) => o.kind === 'report')
      const external = owns.filter((o) => o.kind === 'recipient')
      const readers = reports.map((r) => r.consumers).filter((c): c is number => c !== undefined)

      const lines = [
        `${what}`,
        '',
        `This reaches ${owns.length} thing${owns.length === 1 ? '' : 's'} you own:`,
        ...owns.map((o) => `  · ${o.name} (${DATA_KIND_LABEL[o.kind]})${o.consumers ? ` — ${o.consumers.toLocaleString('en-GB')} readers` : ''}`),
        '',
        consequence,
        // Only stated where it is true, and never softened.
        ...(external.length
          ? ['', `${external.length} of these send data outside the estate: ${external.map((e) => e.party ?? e.name).join(', ')}.`]
          : []),
        ...(readers.length ? ['', `The widest readership affected is ${Math.max(...readers).toLocaleString('en-GB')}.`] : []),
        ...(ticket.length ? ['', ...ticket] : []),
        '',
        'No estimate of when it will be back: nothing on record supports one yet.',
      ]

      return {
        to,
        owns,
        subject: `${item.name}: ${owns.length} thing${owns.length === 1 ? '' : 's'} you own ${owns.length === 1 ? 'is' : 'are'} affected`,
        body: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
      }
    })

  return { item, notices, affected: down, unassigned, sent: false }
}
