import React from 'react'
import { Copy, Mail } from 'lucide-react'
import { draftOwnerNotices } from '@/domain/ownerNotice'
import { readPublication } from '@/domain/publication'
import { useAstra } from '@/domain/store'
import { Button, Card, Chip, Empty } from '@/ui/primitives'
import { type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   The drafts, before anybody sends them.

   Shown as the message each owner would receive, because the only way to
   know whether a notification is worth sending is to read the thing itself.
   Nothing here sends: the platform has never sent anything outward and this
   is not where that starts.
   ========================================================================== */

function useDraft(props: Record<string, unknown>) {
  const log = useAstra((s) => s.publishLog)
  const id = String(props.id ?? '')
  return React.useMemo(() => {
    const pub = readPublication(log, id)
    return draftOwnerNotices(id, pub.state === 'held' ? pub.last : null)
  }, [id, log])
}

function NoticeBody({ props }: CardProps) {
  const draft = useDraft(props)
  const [copied, setCopied] = React.useState<string | null>(null)
  if (!draft) return <Empty title="No such item in the estate" />
  if (!draft.notices.length) {
    return draft.affected.length
      ? <Empty title="Nothing downstream has a named owner" body={`${draft.affected.length} affected, none owned`} />
      : <Empty title="Nothing mapped downstream" body="Unmapped, not unaffected" />
  }

  const copy = async (to: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(to)
      setTimeout(() => setCopied(null), 2000)
    } catch { setCopied(null) }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip tone="warn">not sent</Chip>
        <span className="text-2xs text-ink-3">
          {draft.notices.length} draft{draft.notices.length === 1 ? '' : 's'}, one per owner
        </span>
      </div>

      <div className="space-y-3">
        {draft.notices.map((n) => (
          <Card
            key={n.to}
            title={n.to}
            subtitle={n.subject}
            right={<Mail size={13} className="text-ink-3" />}
          >
            <pre className="whitespace-pre-wrap break-words rounded border border-line bg-sunken p-2.5 font-sans text-2xs leading-relaxed text-ink-2">
              {n.body}
            </pre>
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => copy(n.to, `${n.subject}\n\n${n.body}`)}>
                <Copy size={11} /> {copied === n.to ? 'Copied' : 'Copy'}
              </Button>
              <span className="text-[10px] text-ink-3">{n.owns.length} affected</span>
            </div>
          </Card>
        ))}
      </div>

      {draft.unassigned.length > 0 && (
        <Card className="mt-4" title="Nobody to tell" subtitle="Affected, with no owner in the register">
          <div className="flex flex-wrap gap-1.5">
            {draft.unassigned.map((u) => <Chip key={u.id} tone="crit">{u.name}</Chip>)}
          </div>
        </Card>
      )}
    </>
  )
}

export const ownerNoticeView: ArtifactView = {
  Body: NoticeBody,
  page: {
    title: 'Who to tell',
    subtitle: 'One draft per owner, naming only what they own — composed, and not sent',
    agents: ['agt_herald', 'agt_archivist'],
    what: 'drafting from the lineage and the gate’s own record',
  },
}
