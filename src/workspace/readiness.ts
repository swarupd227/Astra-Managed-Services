import React from 'react'
import { PHASE_LABEL, fleetLifecycle, type AgentReading, type FleetLifecycle } from '@/domain/agentLifecycle'
import { REASON_LABEL, escalationSummary, type FleetEscalations } from '@/domain/escalations'
import { approvedModels, approvedModelsNow } from '@/domain/registry'
import { useAstra } from '@/domain/store'

/* ==========================================================================
   One reader for agent readiness.

   The page and the tool behind it once fetched their own inputs and shaped
   their own output, and drifted: the tool told a client the model registry
   was unreachable on a platform where the page was reading it perfectly
   well. Both now come through here. This module gathers the inputs — the
   agents as the store holds them, the approved models from the registry —
   and describes the reading for a tool payload, so there is one place to
   change and one answer to give.
   ========================================================================== */

/** The reading, for anything that can wait: the tools. */
export async function readReadiness(signal?: AbortSignal): Promise<FleetLifecycle> {
  return fleetLifecycle(await approvedModels(signal), Object.values(useAstra.getState().agents))
}

/** The same reading, for anything that cannot: the views. */
export function useReadiness(): FleetLifecycle {
  const agents = useAstra((s) => s.agents)
  const [models, setModels] = React.useState<string[] | undefined>(approvedModelsNow)
  React.useEffect(() => {
    let live = true
    approvedModels().then((m) => { if (live) setModels(m) })
    return () => { live = false }
  }, [])
  return React.useMemo(() => fleetLifecycle(models, Object.values(agents)), [models, agents])
}

/** Escalations read the same way from both sides. */
export const readFleetEscalations = (): FleetEscalations => escalationSummary()

export function useFleetEscalations(): FleetEscalations {
  return React.useMemo(readFleetEscalations, [])
}

/* -------------------------------- Describing -------------------------------- */

/** One agent as a tool payload: the same figures the page draws, named for a reader. */
export function describeAgent(r: AgentReading) {
  return {
    id: r.agent.id,
    name: r.agent.name,
    owner: r.agent.ownerHuman,
    origin: r.agent.origin,
    stage: r.stage,
    checksPassed: r.passed,
    checksTotal: r.checks.length,
    nextStage: r.next,
    blockedBy: r.blockers.map((b) => ({ check: b.name, phase: PHASE_LABEL[b.phase], detail: b.detail, readFrom: b.source })),
    couldNotBeChecked: r.unverified.map((b) => ({ check: b.name, phase: PHASE_LABEL[b.phase], detail: b.detail, readFrom: b.source })),
    budgetPct: r.budgetPct,
    escalations: {
      count: r.escalations.count,
      ofRunsPct: r.escalations.ratePct,
      waiting: r.escalations.waiting,
      medianPickupMins: r.escalations.medianPickupMins,
      why: r.escalations.byReason.map((x) => ({ reason: REASON_LABEL[x.reason], count: x.count })),
    },
    setUp: r.ops
      ? {
        identity: r.agent.nhi,
        identityScope: r.ops.identityScope,
        model: r.ops.servedModel,
        budgetUsd30d: r.ops.budgetUsd30d,
        maxSteps: r.ops.maxSteps,
        escalatesTo: r.ops.escalateTo,
        stopTestedAt: r.ops.killSwitchTestedAt ?? null,
        changeRecord: r.ops.changeRef ?? null,
        contextSources: r.ops.contextSources,
      }
      : null,
  }
}

/** One agent's full checklist, for a question about that agent. */
export const describeChecks = (r: AgentReading) =>
  r.checks.map((c) => ({ check: c.name, phase: PHASE_LABEL[c.phase], state: c.state, detail: c.detail, readFrom: c.source, requiredFrom: c.requiredFrom }))

/** The fleet as a tool payload. */
export function describeFleet(f: FleetLifecycle) {
  const e = readFleetEscalations()
  return {
    byStage: f.byStage,
    readyToPromote: f.readyToPromote.map((r) => ({ id: r.agent.id, name: r.agent.name, to: r.next })),
    overBudget: f.overBudget.map((r) => ({ id: r.agent.id, name: r.agent.name, budgetPct: r.budgetPct })),
    fleetGaps: f.commonGaps.map((g) => ({ check: g.check, phase: PHASE_LABEL[g.phase], agentsFailing: g.agents })),
    escalations: {
      total: e.total,
      ofRunsPct: e.ratePct,
      waiting: e.waiting,
      medianPickupMins: e.medianPickupMins,
      why: e.byReason.map((x) => ({ reason: REASON_LABEL[x.reason], count: x.count, agents: x.agents, whatFixesIt: x.fix })),
    },
    agents: f.agents.map(describeAgent),
  }
}

/** One agent by id or name, or nothing. */
export const findReading = (f: FleetLifecycle, idOrName: string) =>
  f.agents.find((r) => r.agent.id.toLowerCase() === idOrName.toLowerCase() || r.agent.name.toLowerCase() === idOrName.toLowerCase())
