import React from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import './styles/index.css'
import { Shell } from './app/Shell'
import { BriefHome } from './app/BriefHome'
import { Missions } from './surfaces/copilot/Missions'
import { Proposals } from './surfaces/governance/Proposals'
import { RunWatch } from './surfaces/operate/RunWatch'
import { OperationsRoom } from './surfaces/operate/OperationsRoom'
import { Copilot } from './surfaces/copilot/Copilot'
import { AgentWorkforce } from './surfaces/copilot/AgentWorkforce'
import { Connection } from './surfaces/settings/Connection'

import { TowerBoard } from './surfaces/operate/TowerBoard'
import { WorkObjectDetail } from './surfaces/operate/WorkObjectDetail'
import { ApprovalInbox } from './surfaces/operate/ApprovalInbox'
import { ResolverWorkspace } from './surfaces/operate/ResolverWorkspace'
import { ShiftBoard } from './surfaces/operate/ShiftBoard'
import { MimMode } from './surfaces/operate/MimMode'
import { ServiceGraph } from './surfaces/operate/ServiceGraph'

import { CoverageDashboard } from './surfaces/transition/CoverageDashboard'
import { VerificationQueue } from './surfaces/transition/VerificationQueue'
import { ShadowScoreboard } from './surfaces/transition/ShadowScoreboard'
import { CutoverReadiness } from './surfaces/transition/CutoverReadiness'

import { ExecutiveHome } from './surfaces/governance/ExecutiveHome'
import { SlaCompliance } from './surfaces/governance/SlaCompliance'
import { GlidepathLedgers } from './surfaces/governance/GlidepathLedgers'
import { AutonomyPosture } from './surfaces/governance/AutonomyPosture'
import { DemandElimination } from './surfaces/governance/DemandElimination'
import { InnovationRegister } from './surfaces/governance/InnovationRegister'
import { Registers } from './surfaces/governance/Registers'
import { EvidenceExplorer } from './surfaces/governance/EvidenceExplorer'
import { Reports } from './surfaces/governance/Reports'
import { AiIncidents } from './surfaces/governance/AiIncidents'
import { AssuranceSandbox } from './surfaces/governance/AssuranceSandbox'
import { AiGovernancePack } from './surfaces/governance/AiGovernancePack'
import { Objectives } from './surfaces/governance/Objectives'

import { FleetView } from './surfaces/atlas/FleetView'
import { AgentRecord } from './surfaces/atlas/AgentRecord'
import { EvaluationCenter } from './surfaces/atlas/EvaluationCenter'
import { PolicyStudio } from './surfaces/atlas/PolicyStudio'
import { TokenOpsStudio } from './surfaces/atlas/TokenOpsStudio'
import { AiSystems } from './surfaces/atlas/AiSystems'
import { ChangeLog } from './surfaces/atlas/ChangeLog'
import { ModelCards } from './surfaces/atlas/ModelCards'

const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <BriefHome /> },

      { path: 'copilot', element: <Copilot /> },
      { path: 'workforce', element: <AgentWorkforce /> },
      { path: 'missions', element: <Missions /> },
      { path: 'governance/proposals', element: <Proposals /> },
      { path: 'operate/run/:runId', element: <RunWatch /> },
      { path: 'operate/room', element: <OperationsRoom /> },
      { path: 'settings/connection', element: <Connection /> },

      { path: 'operate/board', element: <TowerBoard /> },
      { path: 'operate/work/:id', element: <WorkObjectDetail /> },
      { path: 'operate/approvals', element: <ApprovalInbox /> },
      { path: 'operate/resolver', element: <ResolverWorkspace /> },
      { path: 'operate/shift', element: <ShiftBoard /> },
      { path: 'operate/mim', element: <MimMode /> },
      { path: 'operate/graph', element: <ServiceGraph /> },

      { path: 'transition/coverage', element: <CoverageDashboard /> },
      { path: 'transition/verify', element: <VerificationQueue /> },
      { path: 'transition/shadow', element: <ShadowScoreboard /> },
      { path: 'transition/cutover', element: <CutoverReadiness /> },

      { path: 'governance/executive', element: <ExecutiveHome /> },
      { path: 'governance/sla', element: <SlaCompliance /> },
      { path: 'governance/glidepath', element: <GlidepathLedgers /> },
      { path: 'governance/autonomy', element: <AutonomyPosture /> },
      { path: 'governance/elimination', element: <DemandElimination /> },
      { path: 'governance/innovation', element: <InnovationRegister /> },
      { path: 'governance/registers', element: <Registers /> },
      { path: 'governance/evidence', element: <EvidenceExplorer /> },
      { path: 'governance/reports', element: <Reports /> },
      { path: 'governance/ai-incidents', element: <AiIncidents /> },
      { path: 'governance/assurance', element: <AssuranceSandbox /> },
      { path: 'governance/ai-pack', element: <AiGovernancePack /> },
      { path: 'governance/objectives', element: <Objectives /> },

      { path: 'atlas/fleet', element: <FleetView /> },
      { path: 'atlas/agent/:id', element: <AgentRecord /> },
      { path: 'atlas/evaluation', element: <EvaluationCenter /> },
      { path: 'atlas/policy', element: <PolicyStudio /> },
      { path: 'atlas/tokenops', element: <TokenOpsStudio /> },
      { path: 'atlas/systems', element: <AiSystems /> },
      { path: 'atlas/change-log', element: <ChangeLog /> },
      { path: 'atlas/model-cards', element: <ModelCards /> },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
