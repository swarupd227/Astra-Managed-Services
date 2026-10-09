import { Rng } from './rng'

/* ==========================================================================
   Who may be given what, and whether there is one left to give.

   A licence request is the most ordinary thing a service desk does and the
   one most often done badly: a person asks in their own words, somebody
   reads it, checks a spreadsheet of seats, remembers a rule about
   contractors, and either grants it or forwards it to a manager who is in a
   meeting. The whole of it is decidable from three things the client already
   holds — who the person is, how many seats are left, and what the policy
   says — and none of those is a judgement call.

   So it is decided here, and every refusal names the rule it failed. An
   approval card that says "needs approval" without saying which rule tripped
   is a worse artefact than no card: the approver has to reconstruct the
   reasoning the platform already did.

   Three origins, kept apart. The directory and the seat pool are the
   client's own systems and sit behind connectors, so they may be sampled.
   The rules are policy: the platform carries a standard set and an
   engagement overrides them, the same arrangement as the operating
   thresholds. What is decided, and the seat that moves, are platform records.
   ========================================================================== */

export type RequestType = 'new' | 'renewal' | 'extension' | 'install' | 'access'

export const REQUEST_LABEL: Record<RequestType, string> = {
  new: 'A seat they do not have',
  renewal: 'Keeping a seat they already hold',
  extension: 'Longer on a seat they already hold',
  install: 'Software onto a machine',
  access: 'Access to something that exists',
}

/* -------------------------------- Directory -------------------------------- */

export interface Person {
  id: string
  name: string
  role: string
  practice: string
  /** Who approves for them. A role, not a person: people leave. */
  manager: string
  contractor: boolean
  /** Days since they last opened the product, or null where never. */
  lastUsedDaysAgo: number | null
}

const PRACTICES = ['Strategy & Value', 'Operations', 'Digital & Analytics', 'Energy', 'Consumer', 'Finance Operations']
const ROLES = ['Consultant', 'Senior Consultant', 'Manager', 'Principal', 'Analyst', 'Data Engineer']
const NAMES = [
  'A. Blackwood', 'P. Rautela', 'J. Mensah', 'L. Fontaine', 'D. Okoro', 'S. Varga', 'M. Lindqvist',
  'T. Abara', 'R. Castellanos', 'N. Pereira', 'H. Sultana', 'C. Dubois', 'F. Nakamura', 'G. Whitlock',
]

/**
 * The people a request can be about.
 *
 * Sampled from the client's directory until that connector is wired. Roles
 * and practices are theirs; the names are not, and are fictional on purpose.
 */
function buildDirectory(): Person[] {
  const rng = new Rng(55_013)
  return NAMES.map((name, i) => ({
    id: `per_${String(i + 1).padStart(3, '0')}`,
    name,
    role: ROLES[rng.int(0, ROLES.length - 1)],
    practice: PRACTICES[rng.int(0, PRACTICES.length - 1)],
    manager: 'Practice Lead',
    // A contractor every fifth person, which is roughly what a firm this
    // size carries and enough for the rule to bite in a demonstration.
    contractor: i % 5 === 4,
    lastUsedDaysAgo: i % 7 === 6 ? null : rng.int(1, 180),
  }))
}

export const DIRECTORY: Person[] = buildDirectory()
export const personByName = (q: string) =>
  DIRECTORY.find((p) => p.name.toLowerCase() === q.toLowerCase())
  ?? DIRECTORY.find((p) => p.name.toLowerCase().includes(q.toLowerCase().split(/\s+/).pop() ?? '\u0000'))

/* ------------------------------- The seat pool ------------------------------ */

export interface Product {
  id: string
  name: string
  seatsTotal: number
  /** Roles the policy admits without an approval. */
  eligibleRoles: string[]
  /** What one seat costs a year, as the client states it. */
  annualCost: number
}

export const PRODUCTS: Product[] = [
  {
    id: 'alteryx', name: 'Alteryx Designer', seatsTotal: 40,
    eligibleRoles: ['Analyst', 'Data Engineer', 'Senior Consultant', 'Manager', 'Principal'],
    annualCost: 4_950,
  },
  {
    id: 'powerbi_pro', name: 'Power BI Pro', seatsTotal: 250,
    eligibleRoles: ROLES,
    annualCost: 120,
  },
]

export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p])) as Record<string, Product>

/** A seat the platform has assigned. Written when it is granted. */
export interface SeatAssignment {
  id: string
  productId: string
  personId: string
  at: string
  by: string
  /** Months granted for. */
  months: number
  evidenceId?: string
}

/**
 * Seats already out, before anything this platform assigned.
 *
 * The vendor's own count, which is the number that matters: a pool read from
 * the platform's own grants alone would report seats free that the client has
 * already given away.
 */
export const SEATS_HELD_AT_TAKEOVER: Record<string, number> = { alteryx: 37, powerbi_pro: 188 }

export function seatsFree(productId: string, assigned: SeatAssignment[]): number {
  const p = PRODUCT_BY_ID[productId]
  if (!p) return 0
  const mine = assigned.filter((a) => a.productId === productId).length
  return p.seatsTotal - (SEATS_HELD_AT_TAKEOVER[productId] ?? 0) - mine
}

/* ---------------------------------- Rules ---------------------------------- */

export interface Rules {
  /** A renewal counts as one only if the product was opened this recently. */
  renewalWithinDays: number
  /** Longer than this needs somebody to say yes. */
  approvalOverMonths: number
  /** Contractors are approved by a person rather than by policy. */
  contractorNeedsApproval: boolean
}

/**
 * What the platform applies where an engagement states nothing.
 *
 * The same arrangement as the operating thresholds: a standard set here, a
 * contract's own values in the database, and the surface says which it used.
 * These are the platform's, not Kearney's, until Kearney files theirs.
 */
export const RULE_DEFAULTS: Rules = {
  renewalWithinDays: 90,
  approvalOverMonths: 12,
  contractorNeedsApproval: true,
}

export const RULE_META: Record<keyof Rules, { label: string; because: string }> = {
  renewalWithinDays: {
    label: 'A renewal needs recent use',
    because: 'Renewing a seat nobody has opened in months is how a licence estate grows without anybody deciding to grow it',
  },
  approvalOverMonths: {
    label: 'A long grant needs approval',
    because: 'A seat granted for longer than a budget cycle outlives the reason it was given',
  },
  contractorNeedsApproval: {
    label: 'A contractor needs their manager',
    because: 'A contractor’s access should end when their engagement does, and only their manager knows when that is',
  },
}

/* -------------------------------- Deciding --------------------------------- */

export type Verdict = 'granted' | 'needs_approval' | 'refused'

export interface RuleCheck {
  rule: keyof Rules | 'eligible_role' | 'seats_available' | 'known_person'
  passed: boolean
  /** What was checked, with the figures it was checked against. */
  detail: string
}

export interface Decision {
  verdict: Verdict
  product: Product
  person: Person | null
  type: RequestType
  months: number
  checks: RuleCheck[]
  /** The check that decided it, where one did. */
  decidedBy: RuleCheck | null
  /** Who must say yes, where somebody must. */
  approver: string | null
  seatsFreeAfter: number
}

/**
 * Decides one request against the directory, the pool and the rules.
 *
 * Every check runs and is reported, including the ones that passed: an
 * approver reading only the failure cannot tell whether anything else was
 * looked at. The first failure decides the verdict, and the rest are context.
 */
export function decide(opts: {
  product: Product
  person: Person | null
  type: RequestType
  months: number
  assigned: SeatAssignment[]
  rules?: Rules
}): Decision {
  const r = opts.rules ?? RULE_DEFAULTS
  const free = seatsFree(opts.product.id, opts.assigned)
  const checks: RuleCheck[] = []

  checks.push({
    rule: 'known_person',
    passed: Boolean(opts.person),
    detail: opts.person
      ? `${opts.person.name}, ${opts.person.role}, ${opts.person.practice}${opts.person.contractor ? ', contractor' : ''}`
      : 'Nobody of that name is in the directory',
  })

  if (opts.person) {
    checks.push({
      rule: 'eligible_role',
      passed: opts.product.eligibleRoles.includes(opts.person.role),
      detail: opts.product.eligibleRoles.includes(opts.person.role)
        ? `${opts.person.role} is on the eligible list for ${opts.product.name}`
        : `${opts.person.role} is not on the eligible list for ${opts.product.name}`,
    })

    if (opts.type === 'renewal') {
      const d = opts.person.lastUsedDaysAgo
      checks.push({
        rule: 'renewalWithinDays',
        passed: d !== null && d <= r.renewalWithinDays,
        detail: d === null
          ? 'Never opened it, so there is nothing to renew'
          : `Last opened ${d} days ago, against ${r.renewalWithinDays} allowed`,
      })
    }

    if (r.contractorNeedsApproval) {
      checks.push({
        rule: 'contractorNeedsApproval',
        passed: !opts.person.contractor,
        detail: opts.person.contractor ? 'A contractor: their manager decides' : 'Not a contractor',
      })
    }
  }

  checks.push({
    rule: 'approvalOverMonths',
    passed: opts.months <= r.approvalOverMonths,
    detail: `${opts.months} months requested, against ${r.approvalOverMonths} allowed without approval`,
  })

  // A seat has to exist. Checked last so a request that fails on policy says
  // so rather than blaming the pool.
  const needsSeat = opts.type === 'new' || opts.type === 'renewal' || opts.type === 'extension'
  if (needsSeat) {
    checks.push({
      rule: 'seats_available',
      passed: free > 0,
      detail: free > 0
        ? `${free} of ${opts.product.seatsTotal} seats free`
        : `No seats free: ${opts.product.seatsTotal} held, none returned`,
    })
  }

  const failed = checks.find((c) => !c.passed) ?? null
  // A person nobody can find, or a seat that does not exist, cannot be fixed
  // by an approval. Everything else can.
  const unfixable = failed && (failed.rule === 'known_person' || failed.rule === 'seats_available' || failed.rule === 'eligible_role')

  return {
    verdict: !failed ? 'granted' : unfixable ? 'refused' : 'needs_approval',
    product: opts.product,
    person: opts.person,
    type: opts.type,
    months: opts.months,
    checks,
    decidedBy: failed,
    approver: failed && !unfixable ? opts.person?.manager ?? 'Practice Lead' : null,
    seatsFreeAfter: !failed && needsSeat ? free - 1 : free,
  }
}

/* ----------------------------- Reading a request ---------------------------- */

const CUES: { type: RequestType; words: string[] }[] = [
  { type: 'renewal', words: ['renew', 'renewal', 'expiring', 'expires', 'extend my existing', 're-issue'] },
  { type: 'extension', words: ['extend', 'extension', 'longer', 'another year', 'more months'] },
  { type: 'install', words: ['install', 'reinstall', 'set up on', 'new laptop', 'new machine', 'deploy'] },
  { type: 'access', words: ['access to', 'permission', 'add me to', 'cannot open', 'unlock'] },
  { type: 'new', words: ['new licence', 'new license', 'need a licence', 'need a license', 'request a', 'please provide'] },
]

export interface RequestReading {
  type: RequestType
  product: Product | null
  months: number | null
  /** The words that decided the type, so the reading can be checked. */
  on: string[]
  /** Set where the text does not say enough to act. */
  missing: string[]
}

/**
 * What a request in somebody's own words is asking for.
 *
 * Deliberately shallow and deliberately transparent: it reports the words it
 * matched on, so a wrong reading is visible rather than mysterious. What it
 * cannot find it lists as missing instead of assuming — a licence granted
 * for a duration nobody asked for is still a licence granted wrongly.
 */
export function readLicenceRequest(text: string): RequestReading {
  const t = text.toLowerCase()
  const on: string[] = []
  let type: RequestType = 'new'
  for (const c of CUES) {
    const hit = c.words.find((w) => t.includes(w))
    if (hit) { type = c.type; on.push(hit); break }
  }

  const product = PRODUCTS.find((p) => t.includes(p.name.toLowerCase()) || t.includes(p.id)) ?? null

  // "a year" and "12 months" are the same request. A reader that understands
  // only the second asks a question it already has the answer to.
  const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, six: 6, twelve: 12, eighteen: 18 }
  const m = /(\d+|a|an|one|two|three|six|twelve|eighteen)\s*(month|months|year|years)/.exec(t)
  const n = m ? (Number.isNaN(Number(m[1])) ? WORDS[m[1]] ?? null : Number(m[1])) : null
  const months = n === null ? null : m![2].startsWith('year') ? n * 12 : n

  // Only the kinds that hold a seat for a period need one. Asking how long an
  // install is for is a question with no answer.
  const needsDuration = type === 'new' || type === 'renewal' || type === 'extension'

  const missing: string[] = []
  if (!product) missing.push('which product')
  if (needsDuration && months === null) missing.push('how long for')

  return { type, product, months, on, missing }
}
