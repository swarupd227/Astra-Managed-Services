import { useAstra } from './store'
import type { Beat, RunOptions } from './agentRuntime'

/* ==========================================================================
   What a run's beats do to the platform, wherever the run was started.

   A run started from the conversation workspace and one started from the
   Copilot console must leave the same record: the routing and the policy
   decision sealed to the evidence chain, every model call charged to the
   mission it runs under, a detector finding raised as an AI incident, and a
   served model that differs from the registered one opened as a change.
   ========================================================================== */

export function makeRunEffects(runRef: string) {
  let missionId: string | null = null

  return (b: Beat) => {
    const s = useAstra.getState()
    if (b.t === 'route') s.logEvidence('observation', 'Astra Copilot', `Intent routed — ${b.intent}`, { confidence: b.confidence, agent: b.agent })
    if (b.t === 'policy') {
      // An advisory evaluation governed nothing, so it is not sealed as a
      // decision — that would claim a mode was decided for an action that was
      // never proposed.
      s.logEvidence(
        b.advisory ? 'observation' : 'decision',
        'Autonomy Policy Engine',
        b.advisory
          ? `No action proposed — autonomy decision not required (would-be mode ${b.result.mode} under ${b.policyName})`
          : `Execution mode ${b.result.mode} under ${b.policyName}`,
        {
          inputVector: { actionClasses: b.result.actionClasses, blast: b.result.blastRadius, grades: b.result.agentGrades, confidence: b.result.planConfidence },
          reasons: b.result.reasons,
        },
        { agentId: b.agentId, actionClass: b.result.actionClasses[0] },
      )
    }
    if (b.t === 'mission') missionId = b.missionId
    if (b.t === 'cost' && missionId) s.chargeMission(missionId, b.usd, 1)
    if (b.t === 'refuse') s.logEvidence('decision', b.agent, 'Action refused by platform rule', { rule: b.rule })
    if (b.t === 'incident') {
      s.raiseAiIncident(
        { class: b.class, detector: b.detector, summary: b.summary, details: b.details, consequential: b.consequential },
        { agentId: b.agent, systemId: b.systemId, runRef },
      )
    }
    if (b.t === 'cost' && b.mismatch && b.system && b.registered) s.recordModelChange(b.system, b.registered, b.model)
  }
}

/** The control plane a run is decided under, read off the live store. */
export function runOptions(): RunOptions {
  const s = useAstra.getState()
  const agents = Object.values(s.agents)
  return {
    suspensions: s.suspensions,
    suspendedAgents: agents.filter((a) => a.state === 'suspended').map((a) => a.id),
    driftingAgents: agents.filter((a) => a.driftAlarm).map((a) => a.id),
    changedSystems: s.modelChanges.filter((m) => m.state !== 'accepted').map((m) => m.systemId),
    majorActive: s.mi.active,
  }
}
