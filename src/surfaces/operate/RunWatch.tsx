import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { AGENT_BY_ID } from '@/domain/estate'
import { PageHeader } from '@/ui/domain'
import { RunTheater } from '@/ui/RunTheater'
import { Button, Card, Chip, Empty } from '@/ui/primitives'

/** The Watch verb (§A7.1) — open any run, live or historical, as playback. */
export function RunWatch() {
  const { runId = '' } = useParams()
  const run = useAstra((s) => s.runs[runId])
  const wo = useAstra((s) => (run ? s.work[run.workObjectId] : undefined))

  if (!run) {
    return (
      <>
        <PageHeader title="Run Theater" />
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Empty title="Run not found" body={`No run with id ${runId} is held in this session.`} />
        </div>
      </>
    )
  }

  const agents = [...new Set(run.steps.map((s) => s.agentId).filter(Boolean))] as string[]

  return (
    <>
      <PageHeader
        title={wo?.title ?? 'Run Theater'}
        subtitle={
          wo
            ? `${wo.ref} · skill ${run.skillId} · ${agents.map((a) => AGENT_BY_ID[a]?.name ?? a).join(', ')}`
            : `skill ${run.skillId}`
        }
        meta={<Chip tone={run.state === 'complete' ? 'ok' : run.state === 'gated' ? 'warn' : 'brand'}>{run.state}</Chip>}
        actions={
          wo && (
            <Button size="sm" variant="ghost">
              <Link to={`/operate/work/${wo.id}`} className="flex items-center gap-1.5">
                <ArrowLeft size={11} /> Work object
              </Link>
            </Button>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          <Card
            title="Run Theater"
            subtitle="Live execution"
            bodyClass="p-0"
          >
            <RunTheater run={run} className="min-h-[380px]" />
          </Card>
        </div>
      </div>
    </>
  )
}
