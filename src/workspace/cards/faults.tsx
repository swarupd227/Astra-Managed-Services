import React from 'react'
import { FAULT_ERROR, FAULT_LABEL, RETRYABLE, type Fault } from '@/domain/dataLoad'
import { Card, Chip } from '@/ui/primitives'
import { type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   The ways a nightly load goes wrong, as a thing you can point at.

   Four, because four is what the gate distinguishes — not four examples of
   many. Each says whether running it again fixes it, which is the only
   question anybody asks at 07:40 and the one a retry loop answers wrongly by
   default: three of these repeat identically however many times they run.
   ========================================================================== */

const ORDER: Fault[] = ['late', 'half_load', 'schema_change', 'zero_rows']

function FaultsBody({ size }: CardProps) {
  return (
    <div className="space-y-2">
      {ORDER.map((f) => {
        const { retry, because } = RETRYABLE[f]
        return (
          <Card key={f} title={FAULT_LABEL[f]} right={<Chip tone={retry ? 'ok' : 'crit'}>{retry ? 'a retry fixes it' : 'a retry does not'}</Chip>}>
            <p className="font-mono text-[10px] leading-relaxed text-ink-3">{FAULT_ERROR[f]}</p>
            {size !== 'card' && <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{because}</p>}
          </Card>
        )
      })}
    </div>
  )
}

export const faultsView: ArtifactView = {
  Body: FaultsBody,
  page: {
    title: 'How a load fails',
    subtitle: 'The four the gate tells apart, and whether running it again changes anything',
    agents: ['agt_custodian'],
    what: 'reading the fault register the publish gate decides against',
  },
}
