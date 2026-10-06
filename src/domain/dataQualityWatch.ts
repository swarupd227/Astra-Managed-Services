import { DATA_LIFECYCLE, dataSummary, impact, isBreach, type DataReading } from './dataEstate'

/* ==========================================================================
   Custodian's data-quality watch.

   The data quality dimension had never carried a recommendation — not one,
   ever — while the conditions that would justify several were sitting in the
   estate register being counted every day. This closes that: Custodian reads
   the estate and states the conditions that hold, with what each one exposes
   downstream and what would end it.

   These are standing findings rather than one-off ideas. The platform does
   not pick a day to notice a dataset has no contract; the condition either
   holds or it does not, so a finding is re-stated for as long as it is true
   and disappears when somebody fixes it. That is also why none of them
   carries a dollar figure: the estate register counts datasets, reports and
   readers, and inventing a currency value from those would be exactly the
   kind of asserted number the rest of the platform refuses.
   ========================================================================== */

export interface DataQualityFinding {
  id: string
  /** The condition, and the fix, in one line. */
  title: string
  /** How many items the condition holds for. */
  items: number
  /** Reports and applications downstream of them. */
  consumersExposed: number
  /** The largest readership behind any affected report, where it is known. */
  largestAudience: number | null
  /** What the condition is read from. */
  readFrom: string
  /** A few of the items, named, so the finding can be checked. */
  examples: string[]
  /** What ends it. */
  fix: string
}

const name = (i: DataReading) => i.name

/** Downstream readers of a set of items, counted once each. */
function exposure(items: DataReading[]): { consumers: number; largest: number | null } {
  const seen = new Set<string>()
  let largest: number | null = null
  for (const i of items) {
    const x = impact(i.id)
    for (const c of x.consumers) seen.add(c.id)
    if (x.largestAudience !== null) largest = Math.max(largest ?? 0, x.largestAudience)
  }
  return { consumers: seen.size, largest }
}

function finding(
  id: string, items: DataReading[], title: (n: number) => string, readFrom: string, fix: string,
): DataQualityFinding | null {
  if (!items.length) return null
  const { consumers, largest } = exposure(items)
  return {
    id,
    title: title(items.length),
    items: items.length,
    consumersExposed: consumers,
    largestAudience: largest,
    readFrom,
    examples: items.slice(0, 3).map(name),
    fix,
  }
}

/**
 * What Custodian would raise today. Empty when the estate is in order, which
 * is the point: the list is the estate's state, not a quota to fill.
 */
export function dataQualityFindings(): DataQualityFinding[] {
  const s = dataSummary()
  const eligible = s.items.filter((i) => DATA_LIFECYCLE[i.kind].contracted)

  return [
    finding(
      'dq_no_contract',
      eligible.filter((i) => i.contractState === 'none'),
      (n) => `Write data contracts for the ${n} feeds and datasets that have none — today a break is found by whoever reads the report`,
      'The estate register: items whose kind can carry a contract and do not',
      'A contract per item with its freshness window and checks, enforced rather than declared',
    ),
    finding(
      'dq_declared_only',
      eligible.filter((i) => i.contractState === 'declared'),
      (n) => `Enforce the ${n} data contracts that are written but not enforced — a contract nobody checks is a comment`,
      'The estate register: contracts in the declared state',
      'Move each to enforced so a breach stops the run instead of reaching a consumer',
    ),
    finding(
      'dq_breaching',
      s.items.filter((i) => isBreach(i.own)),
      (n) => `Clear the ${n} items breaching their contract now, and keep the cause rather than the symptom`,
      'The estate register: items failing their own checks or past their freshness window',
      'Fix the cause, then verify the check passes for a full window before closing it',
    ),
    finding(
      'dq_unobserved',
      s.items.filter((i) => i.own === 'unobserved'),
      (n) => `Instrument the ${n} items the platform cannot see at all — nothing can be promised about data nobody is watching`,
      'The estate register: items with no telemetry of any kind',
      'Land run and freshness signals for each, so staleness is detected rather than reported',
    ),
    finding(
      'dq_unclassified',
      s.items.filter((i) => !i.classification),
      (n) => `Classify the ${n} items nobody has classified — until then no rule about personal data can be applied to them`,
      'The estate register: items with no classification',
      'Classify each, which also decides what may leave the estate and to whom',
    ),
    finding(
      'dq_no_steward',
      s.items.filter((i) => !i.steward),
      (n) => `Name a steward for the ${n} items that have none — a quality rule with nobody behind it is not a rule`,
      'The estate register: items with no steward',
      'A named steward per item, recorded against it rather than in a spreadsheet',
    ),
    finding(
      'dq_lineage',
      s.items.filter((i) => i.lineage !== 'mapped'),
      (n) => `Finish the lineage on ${n} items — without it the blast radius of a change is a guess`,
      'The estate register: items whose lineage is partial or unknown',
      'Map each item to what it reads from, so impact is computed rather than estimated',
    ),
  ].filter((f): f is DataQualityFinding => f !== null)
}
