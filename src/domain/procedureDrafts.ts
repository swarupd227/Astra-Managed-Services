import { ENGAGEMENT, ENGAGEMENT_BY_ID } from './engagement'
import { AGENTS, SKILLS } from './estate'
import { REASON_FIX, REASON_LABEL, type EscalationReason } from './escalations'
import { HANDOVER } from './knowledge'
import { DEMAND_CLASSES } from './ledgers'
import { INVENTORY, LIFECYCLE } from './inventory'
import { STANDARD_BY_ID, type StandardArea } from './procedures'
import { ACTION_CLASSES } from './reference'
import { clustersWithCause, historyFor, recurring } from './ticketHistory'
import { thresholdsFor } from './thresholds'

/* ==========================================================================
   Drafting a maintenance procedure from the client's own records.

   The contract asks for procedures to be developed, documented, maintained
   and reviewed across eleven named areas. Every provider answers it with a
   runbook library written for somebody else and renamed, which is why the
   first incident out of scope of the library is handled by whoever is on
   shift and remembers.

   A draft here is assembled from what the registers already hold about that
   area: the shape of the client's own twelve months of tickets, the demand
   classes costed from them, their application inventory, and the action
   classes the policy engine will actually enforce. Every line carries what it
   was read from, so a reviewer can check the draft against the record rather
   than against their own memory.

   Two things this refuses to do. It does not write a procedure for an area
   the registers say nothing about: an area with no evidence gets a refusal
   naming what is missing, which is more useful than a page of plausible
   prose. And it does not invent an authorisation. The action classes on a
   draft are the ones whose domain covers the area and which some agent
   actually holds a grant for, and the verification pack is the one those
   classes already carry — so a procedure cannot authorise something the
   gateway would refuse, and an area with no executable class is marked as
   deciding rather than acting.

   A draft is a draft. It carries the author, the records it came from and no
   version, and somebody has to put their name to it before it is current.
   ========================================================================== */

/** One line of evidence behind a draft, with where it came from. */
export interface DraftBasis {
  what: string
  readFrom: string
}

export interface ProcedureDraft {
  standardAreaId: string
  area: StandardArea
  /** The procedure's name, which is what the area expects done. */
  name: string
  /** What the standard expects the area to cover. */
  expects: string
  /** The records it was written from. */
  basis: DraftBasis[]
  /** The steps, each standing on one of those records. */
  steps: string[]
  /** Classes whose domain covers the area and which an agent actually holds. */
  actionClasses: string[]
  /** The pack those classes already carry. Null where the procedure decides rather than acts. */
  verificationPack: string | null
  /** The agents holding those classes. */
  agents: string[]
  /** The strictest mode any of its classes is floored at. */
  floor: string | null
}

/** Why no draft could be written. */
export interface DraftRefusal {
  standardAreaId: string
  area: StandardArea | null
  because: string
}

export type DraftResult = { draft: ProcedureDraft } | { refusal: DraftRefusal }

/* --------------------------- What authorises what ---------------------------- */

/**
 * The action-class domains each area may draw on.
 *
 * This is the platform's own design rather than a derivation — it says which
 * kinds of action belong to which kind of procedure — but it is the only
 * place a draft's authorisations come from, and everything else about them
 * (the floor, the verification pack, who holds a grant) is read.
 */
const AREA_DOMAINS: Record<string, string[]> = {
  sa_triage: ['Observe'],
  sa_escalation: [],
  sa_corrective: ['Infrastructure', 'Change'],
  sa_problem: ['Observe'],
  sa_release: ['Change'],
  sa_regression: ['Change'],
  sa_patching: ['Security'],
  sa_saas: ['Change'],
  sa_config: ['Change'],
  sa_knowledge: ['Observe'],
  sa_handoff: [],
  sa_monitoring: ['Observe'],
  sa_capacity: ['Infrastructure', 'FinOps'],
}

const FLOOR_ORDER = ['advise', 'approve_first', 'supervised', 'autonomous']

/** Classes in the area's domains that some agent actually holds a grant for. */
function authorises(standardAreaId: string): { classes: string[]; pack: string | null; agents: string[]; floor: string | null } {
  const domains = AREA_DOMAINS[standardAreaId] ?? []
  const granted = new Set(AGENTS.flatMap((a) => Object.keys(a.grants)))
  const classes = ACTION_CLASSES.filter((c) => domains.includes(c.domain) && granted.has(c.id))
  // Every class, not any of them. AC-05 (read and collect diagnostics) is
  // granted to almost the whole fleet, so matching on any class named the
  // client's own KYC bot as able to execute incident triage. An agent can
  // carry out a procedure only if it holds everything the procedure does.
  const agents = classes.length
    ? AGENTS.filter((a) => classes.every((c) => a.grants[c.id])).map((a) => a.id)
    : []
  // The strictest floor among them: a procedure is only as free as its
  // tightest step, and saying otherwise would overstate what it authorises.
  const floor = classes
    .map((c) => c.floor)
    .sort((x, y) => FLOOR_ORDER.indexOf(x) - FLOOR_ORDER.indexOf(y))[0] ?? null
  const packs = classes.map((c) => c.verificationPack).filter((p) => p && p !== 'none' && p !== 'n/a')
  return { classes: classes.map((c) => c.id), pack: packs[0] ?? null, agents, floor }
}

/* ------------------------------ The derivations ------------------------------ */

const n = (x: number) => x.toLocaleString('en-GB')

/**
 * What each area can be written from, read per engagement.
 *
 * A builder returns nothing where its register says nothing, and the area is
 * then refused rather than drafted.
 */
const BUILDERS: Record<string, (engagementId: string) => { basis: DraftBasis[]; steps: string[] } | null> = {
  sa_triage: (id) => {
    const h = historyFor(id)
    if (!h) return null
    const top = h.themes.slice(0, 3)
    const priority = h.cannot.find((c) => c.what === 'priority')
    return {
      basis: [
        { what: `${n(h.scope.inScope)} in-scope incidents across ${h.shape.subCategories} sub-categories in ${h.period.months} months`, readFrom: `${h.source}` },
        { what: `Scope decided by: ${h.scope.rule}`, readFrom: 'The scoping rule applied to the extract, reversible' },
        ...top.map((t) => ({ what: `${t.name}: ${n(t.incidents)} incidents, ${t.pctOfInScope}% of in-scope`, readFrom: 'Demand themes derived from the extract' })),
        ...(priority ? [{ what: `Priority cannot be read from the field: ${priority.because}`, readFrom: 'The limitations the extract states about itself' }] : []),
      ],
      steps: [
        `Classify against the ${h.shape.subCategories} sub-categories the extract carries, applying the scope rule in order so the decision is reversible.`,
        `Route by theme. The three heaviest — ${top.map((t) => t.name.toLowerCase()).join(', ')} — carry ${top.reduce((s, t) => s + t.pctOfInScope, 0).toFixed(1)}% of in-scope volume between them.`,
        priority
          ? 'Set priority from impact and urgency assessed at triage, not from the inbound field: the extract shows it carries the default on almost everything.'
          : 'Set priority from the inbound field where it is populated, and from impact and urgency where it is not.',
        `Anything that matches no sub-category stops and goes to a person, with the record of what was tried. ${h.shape.singletons} phrasings in the period were seen exactly once.`,
      ],
    }
  },

  sa_escalation: (id) => {
    const h = historyFor(id)
    const reasons = Object.keys(REASON_LABEL) as EscalationReason[]
    return {
      basis: [
        { what: `${reasons.length} reasons an agent stops and hands back, each with what fixes it`, readFrom: 'The platform’s escalation vocabulary, enforced in the gateway' },
        ...(h ? [{ what: `${h.shape.outOfHoursPct}% of in-scope incidents arrive out of hours, ${h.shape.weekendPct}% at weekends`, readFrom: 'Arrival times in the ingested extract' }] : []),
      ],
      steps: [
        `An agent escalates rather than guesses. The triggers are fixed: ${reasons.map((r) => REASON_LABEL[r].toLowerCase()).join('; ')}.`,
        ...reasons.slice(0, 3).map((r) => `On ${REASON_LABEL[r].toLowerCase()}: ${REASON_FIX[r].toLowerCase()}.`),
        h && h.shape.outOfHoursPct > 20
          ? `The first hop must be staffed out of hours: ${h.shape.outOfHoursPct}% of in-scope demand arrives then.`
          : 'The first hop is the resolver on shift, with the clock running from the hand-back and not from the original arrival.',
        'Every hand-back is a record carrying the reason, so the reason mix is reportable: a fleet escalating on missing runbooks has a knowledge gap, one escalating on unapproved data has a governance gap, and they want different work.',
      ],
    }
  },

  sa_corrective: (id) => {
    const classes = DEMAND_CLASSES.filter((d) => d.volumeBasis !== 'sampled' && d.hoursYr > 0 && (d.proposalType === 'engineering_fix' || d.proposalType === 'automation'))
    if (!classes.length) return null
    const skills = SKILLS.filter((s) => s.verificationPack && s.verificationPack !== 'none')
    const top = [...classes].sort((a, b) => b.hoursYr - a.hoursYr).slice(0, 3)
    return {
      basis: [
        { what: `${classes.length} costed classes answerable by a repair, ${n(classes.reduce((s, d) => s + d.hoursYr, 0))} hours a year between them`, readFrom: 'The demand ledger, costed from the client’s own ticket history' },
        ...top.map((d) => ({ what: `${d.name}: ${n(d.volumeYr)}/yr — ${d.cause}`, readFrom: 'The named cause recorded against the class' })),
        { what: `${skills.length} skills carry a verification pack that proves a repair worked`, readFrom: 'The skill registry' },
      ],
      steps: [
        'A repair is attempted only where the class has a named cause. A symptom with no cause goes to problem management instead, so the same repair is not made twice a week for ever.',
        ...top.map((d) => `${d.name}: the recorded cause is ${d.cause.toLowerCase()}.`),
        'Every mutating step declares its rollback before it runs, and the run is not closed until its verification pack passes.',
        'A repair outside the named classes stops and goes to a person: an unlisted host or service is a missing runbook, not an invitation to improvise.',
      ],
    }
  },

  sa_problem: (id) => {
    const h = historyFor(id)
    if (!h) return null
    const t = thresholdsFor(id)
    const clusters = recurring(h)
    const withCause = clustersWithCause(h)
    return {
      basis: [
        { what: `${clusters.length} phrasings recur ${t.recurringClusterThreshold} times or more; ${withCause.length} carry a costed cause`, readFrom: 'Recurring clusters derived from the extract' },
        { what: `${n(h.problems.records)} problem records exist, ${h.problems.open} open, against ${h.shape.repeatPct}% repeat demand`, readFrom: 'The problem records in the extract' },
        { what: `${h.problems.inScopeWithoutProblemPct}% of in-scope incidents have no problem record behind them`, readFrom: 'In-scope incidents reconciled against problem records' },
      ],
      steps: [
        `A phrasing seen ${t.recurringClusterThreshold} times or more is a problem, not ${t.recurringClusterThreshold} incidents. Raise one record per cluster with a named cause and an owner.`,
        `Price the fix against the class the cluster belongs to, so the decision to fix it is a number and not an argument. ${clusters.length - withCause.length} clusters currently have no costed cause.`,
        'Close a problem on a verification window, not on a deployment: the measure is the volume not arriving afterwards.',
        `Report the repeat rate every period. It is ${h.shape.repeatPct}% today and it is the only honest measure of whether problem management is working.`,
      ],
    }
  },

  sa_release: () => {
    const vendor = INVENTORY.filter((i) => LIFECYCLE[i.kind].codeReleasedBy === 'vendor')
    const ours = INVENTORY.filter((i) => LIFECYCLE[i.kind].codeReleasedBy !== 'vendor')
    const irreversible = INVENTORY.filter((i) => !LIFECYCLE[i.kind].canRollBackCode)
    if (!INVENTORY.length) return null
    return {
      basis: [
        { what: `${ours.length} applications whose code we release, ${vendor.length} released by a vendor`, readFrom: 'The application inventory, by kind' },
        { what: `${irreversible.length} applications whose code cannot be rolled back by us`, readFrom: 'What a release means for each kind of application' },
        { what: 'AC-37 (apply code fix via CI/CD) is floored at approve-first and carries release_pack_v9', readFrom: 'The action class register the gateway enforces' },
      ],
      steps: [
        'Gate every release on its regression pack. A failing pack blocks, and the override is a named person with a recorded reason, not a flag.',
        `Treat the ${irreversible.length} applications with no code rollback differently: the plan is forward-fix or compensate, decided before the window opens rather than during it.`,
        `A vendor release is coordinated, not controlled — ${vendor.length} of the estate. Hold the regression pack and the back-out plan anyway, because the vendor's schedule is not ours.`,
        'No release inside a change freeze without the freeze owner’s recorded approval.',
      ],
    }
  },

  sa_regression: () => {
    const packs = [...new Set(ACTION_CLASSES.map((c) => c.verificationPack).filter((p) => p && p !== 'none' && p !== 'n/a'))]
    const saas = INVENTORY.filter((i) => i.kind === 'saas')
    if (!packs.length) return null
    return {
      basis: [
        { what: `${packs.length} verification packs are already defined and enforced per action class`, readFrom: 'The action class register' },
        { what: `${saas.length} SaaS applications take vendor updates on the vendor’s schedule`, readFrom: 'The application inventory' },
        { what: `${SKILLS.filter((s) => s.verificationPack !== 'none').length} skills name the pack that proves their own work`, readFrom: 'The skill registry' },
      ],
      steps: [
        'Select the pack from the action class the change belongs to rather than per release: the class already names what proves it worked.',
        `Generate a pack where none exists, and record it against the class so the next change inherits it. ${packs.length} packs exist today.`,
        `Run against the ${saas.length} SaaS applications after every vendor update, not only after our own changes — the estate changes when the vendor ships.`,
        'A failing case stops the change. A pack that has never failed is reviewed for whether it tests anything.',
      ],
    }
  },

  sa_patching: () => {
    const drifted = INVENTORY.filter((i) => i.config.drift === 'drifted')
    const noBaseline = INVENTORY.filter((i) => i.config.drift === 'unknown')
    if (!INVENTORY.length) return null
    return {
      basis: [
        { what: 'AC-52 (patch wave, canaried) is floored at supervised and carries patch_wave_v2', readFrom: 'The action class register the gateway enforces' },
        { what: `${noBaseline.length} applications have no recorded configuration baseline`, readFrom: 'Configuration baselines in the inventory' },
        { what: `${drifted.length} applications have drifted from the baseline they do have`, readFrom: 'Drift state in the inventory' },
      ],
      steps: [
        'Compose each wave by risk, not by alphabet: a canary first, then the rest only once its health probe has passed.',
        `Do not patch the ${noBaseline.length} applications with no baseline until one is recorded — without it there is nothing to return to.`,
        `Resolve the ${drifted.length} drifted applications before the wave reaches them, or the patch is applied to a configuration nobody has described.`,
        'Every wave carries its health probe, and a failing probe stops the wave rather than the next one in it.',
      ],
    }
  },

  sa_saas: () => {
    const saas = INVENTORY.filter((i) => i.kind === 'saas')
    if (!saas.length) return null
    const primary = saas.filter((i) => LIFECYCLE[i.kind].vendorRole === 'primary')
    const tier1 = saas.filter((i) => i.tier <= 1)
    return {
      basis: [
        { what: `${saas.length} SaaS applications, ${primary.length} where the vendor is primary to keeping it running`, readFrom: 'The application inventory, by kind' },
        { what: `${tier1.length} of them are tier 1`, readFrom: 'Tier recorded against each application' },
        { what: 'SaaS code cannot be rolled back by us; configuration is the tenant', readFrom: 'What a change means for a SaaS application' },
      ],
      steps: [
        'Raise a vendor case with the evidence attached — the failing probe, the affected tenant, the window — rather than a description of the symptom.',
        `Chase against the vendor's contracted response, and record each chase. For the ${primary.length} applications where the vendor is primary, our own escalation path ends at them.`,
        'Hold the work object open against the vendor case rather than closing it: a ticket closed while the vendor still has the problem reports a resolution that has not happened.',
        'Where the vendor cannot fix it in the window, the decision is a workaround with a named owner and an expiry, recorded as such.',
      ],
    }
  },

  sa_config: () => {
    const noBaseline = INVENTORY.filter((i) => i.config.drift === 'unknown')
    const drifted = INVENTORY.filter((i) => i.config.drift === 'drifted')
    const inBaseline = INVENTORY.filter((i) => i.config.drift === 'in_baseline')
    if (!INVENTORY.length) return null
    return {
      basis: [
        { what: `${inBaseline.length} applications in baseline, ${drifted.length} drifted, ${noBaseline.length} with no baseline at all`, readFrom: 'Configuration baselines and drift state in the inventory' },
        { what: 'AC-31 (revert config to known-good) is floored at supervised, approve-first on tier 0, and carries canary_slo_v6', readFrom: 'The action class register the gateway enforces' },
        { what: 'What "configuration" means differs by kind — a tenant, an instance, a schema, an interface contract', readFrom: 'The configuration scope recorded per application kind' },
      ],
      steps: [
        'A change is made against a recorded baseline or it is not made: the baseline is what the revert returns to.',
        `Record a baseline for the ${noBaseline.length} applications that have none. Until then, revert-to-known-good is unavailable for them and the procedure says so rather than implying otherwise.`,
        `Detect drift continuously and treat it as work, not as a report. ${drifted.length} applications have drifted from their own baseline.`,
        'Revert through the pipeline, never the console: a console change is how the drift arrived.',
      ],
    }
  },

  sa_knowledge: () => {
    const failing = HANDOVER.filter((a) => a.state === 'fail')
    if (!HANDOVER.length) return null
    return {
      basis: [
        { what: `${HANDOVER.length} handover artefacts each with an acceptance test and what consumes it`, readFrom: 'The handover register' },
        { what: `${failing.length} currently fail their acceptance test`, readFrom: 'Acceptance state recorded against each artefact' },
        { what: 'AC-08 (correlate & classify) carries classification_agreement as its verification', readFrom: 'The action class register' },
      ],
      steps: [
        'A claim becomes knowledge when a named person confirms it, with an expiry. An unverified claim is readable but may not be relied on by an agent acting unattended.',
        'Capture at the point of resolution, not in a review afterwards: the person who knows is the one who just fixed it.',
        `Hold every artefact to its acceptance test. ${failing.length} fail today, and a failing artefact blocks what consumes it rather than being noted.`,
        'Re-verify on expiry. A claim that nobody will re-confirm is removed rather than aged quietly, because an agent reading a stale assertion acts on it.',
      ],
    }
  },

  sa_handoff: (id) => {
    const h = historyFor(id)
    const failing = HANDOVER.filter((a) => a.state === 'fail')
    if (!HANDOVER.length) return null
    return {
      basis: [
        { what: `${HANDOVER.length} artefacts pass between parties, each with an acceptance test`, readFrom: 'The handover register' },
        { what: `${failing.length} would not be accepted today`, readFrom: 'Acceptance state recorded against each artefact' },
        ...(h ? [{ what: `${h.shape.outOfHoursPct}% of demand arrives out of hours, ${h.shape.stillOpenPct}% of in-scope incidents are still open`, readFrom: 'The ingested extract' }] : []),
      ],
      steps: [
        'A handoff is a list of artefacts with acceptance tests, not a conversation. What passes is what the test says passes.',
        h ? `Cover the shift boundary explicitly: ${h.shape.outOfHoursPct}% of demand arrives out of hours and ${h.shape.stillOpenPct}% of in-scope work is still open at any time.` : 'Cover the shift boundary explicitly, naming what is open and what is waiting on somebody.',
        'Hand over what is waiting on a person as well as what is in flight: an agent escalation nobody picks up is the commonest thing lost at a boundary.',
        `Reject an incomplete handoff rather than accepting it with a note. ${failing.length} artefacts fail their test today, and accepting them would transfer the gap silently.`,
      ],
    }
  },
}

/* --------------------------------- Drafting ---------------------------------- */

/**
 * A draft for one area, or a refusal naming what is missing.
 *
 * The refusal is the useful half. An area the registers say nothing about
 * cannot be written from them, and a template filled in with plausible
 * sentences would be indistinguishable from one that was.
 */
export function draftProcedure(standardAreaId: string, engagementId = ENGAGEMENT.id): DraftResult {
  const area = STANDARD_BY_ID[standardAreaId] ?? null
  if (!area) {
    return { refusal: { standardAreaId, area: null, because: `No standard area has the id "${standardAreaId}".` } }
  }
  const engagement = ENGAGEMENT_BY_ID[engagementId] ?? ENGAGEMENT
  const builder = BUILDERS[standardAreaId]
  if (!builder) {
    return { refusal: { standardAreaId, area, because: `The platform holds nothing it could write a ${area.name.toLowerCase()} procedure from for ${engagement.client}.` } }
  }
  const built = builder(engagementId)
  if (!built || !built.basis.length) {
    return {
      refusal: {
        standardAreaId,
        area,
        because: `No register behind ${area.name.toLowerCase()} has anything recorded for ${engagement.client} yet, so there is nothing to write a procedure from. Ingesting the records it reads would change that.`,
      },
    }
  }

  const auth = authorises(standardAreaId)
  return {
    draft: {
      standardAreaId,
      area,
      name: area.name,
      expects: area.expects,
      basis: built.basis,
      steps: built.steps,
      actionClasses: auth.classes,
      // A procedure that authorises nothing executable decides rather than
      // acts, and carries no pack: there is no run for a pack to verify.
      verificationPack: auth.classes.length ? auth.pack : null,
      agents: auth.agents,
      floor: auth.floor,
    },
  }
}
