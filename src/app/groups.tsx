import { Grouped } from './Grouped'
import { AiGovernancePack } from '@/surfaces/governance/AiGovernancePack'
import { AssuranceSandbox } from '@/surfaces/governance/AssuranceSandbox'
import { ClientEffort } from '@/surfaces/governance/ClientEffort'
import { DemandElimination } from '@/surfaces/governance/DemandElimination'
import { EvidenceExplorer } from '@/surfaces/governance/EvidenceExplorer'
import { GlidepathLedgers } from '@/surfaces/governance/GlidepathLedgers'
import { Headroom } from '@/surfaces/governance/Headroom'
import { InnovationRegister } from '@/surfaces/governance/InnovationRegister'
import { Objectives } from '@/surfaces/governance/Objectives'
import { Programmes } from '@/surfaces/governance/Programmes'
import { DataEstate } from '@/surfaces/operate/DataEstate'
import { DataReliability } from '@/surfaces/operate/DataReliability'
import { OperationsRoom } from '@/surfaces/operate/OperationsRoom'
import { ShiftBoard } from '@/surfaces/operate/ShiftBoard'
import { TowerBoard } from '@/surfaces/operate/TowerBoard'
import { CoverageDashboard } from '@/surfaces/transition/CoverageDashboard'
import { CutoverReadiness } from '@/surfaces/transition/CutoverReadiness'
import { ShadowScoreboard } from '@/surfaces/transition/ShadowScoreboard'
import { VerificationQueue } from '@/surfaces/transition/VerificationQueue'
import { AiSystems } from '@/surfaces/atlas/AiSystems'
import { ChangeLog } from '@/surfaces/atlas/ChangeLog'
import { Coverage } from '@/surfaces/atlas/Coverage'
import { EvaluationCenter } from '@/surfaces/atlas/EvaluationCenter'
import { AgentLifecycle } from '@/surfaces/atlas/AgentLifecycle'
import { FleetView } from '@/surfaces/atlas/FleetView'
import { ModelCards } from '@/surfaces/atlas/ModelCards'
import { PolicyStudio } from '@/surfaces/atlas/PolicyStudio'
import { TokenOpsStudio } from '@/surfaces/atlas/TokenOpsStudio'

/* ==========================================================================
   The grouped entries: one per question a person actually has, each made of
   the screens that answer it. Every screen keeps its own route.
   ========================================================================== */

export const TransitionGroup = () => (
  <Grouped tabs={[
    { id: 'coverage', label: 'Estate coverage', element: <CoverageDashboard /> },
    { id: 'verify', label: 'Knowledge verification', element: <VerificationQueue /> },
    { id: 'shadow', label: 'Shadow scoreboard', element: <ShadowScoreboard /> },
    { id: 'cutover', label: 'Cutover readiness', element: <CutoverReadiness /> },
  ]} />
)

export const OperationsGroup = () => (
  <Grouped tabs={[
    { id: 'room', label: 'Operations room', element: <OperationsRoom /> },
    { id: 'board', label: 'Tower board', element: <TowerBoard /> },
    { id: 'shift', label: 'Shift & handover', element: <ShiftBoard /> },
  ]} />
)

export const DataGroup = () => (
  <Grouped tabs={[
    { id: 'estate', label: 'Estate', element: <DataEstate /> },
    { id: 'reliability', label: 'Reliability', element: <DataReliability /> },
  ]} />
)

export const SavingsGroup = () => (
  <Grouped tabs={[
    { id: 'elimination', label: 'Demand elimination', element: <DemandElimination /> },
    { id: 'glidepath', label: 'Glidepath & credits', element: <GlidepathLedgers /> },
    { id: 'innovation', label: 'Innovation register', element: <InnovationRegister /> },
  ]} />
)

export const OutcomesGroup = () => (
  <Grouped tabs={[
    { id: 'objectives', label: 'Objectives', element: <Objectives /> },
    { id: 'programmes', label: 'Programmes', element: <Programmes /> },
    { id: 'effort', label: 'Client effort', element: <ClientEffort /> },
    { id: 'headroom', label: 'Growth headroom', element: <Headroom /> },
  ]} />
)

export const ProofGroup = () => (
  <Grouped tabs={[
    { id: 'evidence', label: 'Evidence', element: <EvidenceExplorer /> },
    { id: 'assurance', label: 'Assurance sandbox', element: <AssuranceSandbox /> },
    { id: 'pack', label: 'AI governance pack', element: <AiGovernancePack /> },
  ]} />
)

export const FleetGroup = () => (
  <Grouped tabs={[
    { id: 'fleet', label: 'Agent fleet', element: <FleetView /> },
    { id: 'lifecycle', label: 'Lifecycle & readiness', element: <AgentLifecycle /> },
    { id: 'coverage', label: 'Capability coverage', element: <Coverage /> },
    { id: 'cards', label: 'Model cards', element: <ModelCards /> },
  ]} />
)

export const SystemsGroup = () => (
  <Grouped tabs={[
    { id: 'systems', label: 'AI systems', element: <AiSystems /> },
    { id: 'changes', label: 'Change log', element: <ChangeLog /> },
  ]} />
)

export const EvaluationGroup = () => (
  <Grouped tabs={[
    { id: 'evaluation', label: 'Evaluation & promotion', element: <EvaluationCenter /> },
    { id: 'policy', label: 'Policy & simulator', element: <PolicyStudio /> },
    { id: 'economics', label: 'Model economics', element: <TokenOpsStudio /> },
  ]} />
)
