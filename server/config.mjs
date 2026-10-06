import { query } from './db.mjs'

/* ==========================================================================
   The engagements, read from the database and shaped the way the browser's
   domain expects them.

   The shaping happens here rather than in the browser so the tables can be
   normalised without the application caring: the browser asks for
   engagements and gets engagements, whatever the schema does underneath.
   ========================================================================== */

export async function readEngagements() {
  const [engagements, regimes, ingested, lines, thresholds, filed] = await Promise.all([
    query('select * from engagement order by id'),
    query('select * from engagement_regime'),
    query('select * from engagement_ingested'),
    query('select * from engagement_service_line order by engagement_id, position'),
    query('select * from engagement_threshold'),
    query('select * from engagement_filed_item order by engagement_id, kind, position'),
  ])

  const by = (rows, id) => rows.filter((r) => r.engagement_id === id)
  const one = (rows, id) => rows.find((r) => r.engagement_id === id) ?? null

  return engagements.map((e) => {
    const regime = one(regimes, e.id)
    const ing = one(ingested, e.id)
    const areas = by(filed, e.id).filter((f) => f.kind === 'procedure_area')
    const dimensions = by(filed, e.id).filter((f) => f.kind === 'improvement_dimension')
    const item = (f) => ({ id: f.id, name: f.name, ...(f.standard_id ? { standardId: f.standard_id } : {}) })

    return {
      id: e.id,
      client: e.client,
      industry: e.industry,
      regions: e.regions,
      currency: e.currency,
      stage: e.stage,
      note: e.note,
      serviceLines: by(lines, e.id).map((l) => ({ id: l.id, name: l.name, packId: l.pack_id })),
      regime: regime
        ? {
          name: regime.name,
          responseDays: regime.response_days,
          extensionDays: regime.extension_days,
          clientNoticeHrs: regime.client_notice_hrs,
          regulatorNoticeHrs: regime.regulator_notice_hrs,
          adequate: regime.adequate,
        }
        : null,
      contract: {
        termMonths: e.term_months,
        startsAt: typeof e.starts_at === 'string' ? e.starts_at : e.starts_at.toISOString().slice(0, 10),
        baselineHrsPerYear: e.baseline_hrs_year,
        costReductionPct: e.cost_reduction_pct === null ? null : Number(e.cost_reduction_pct),
      },
      ingested: ing
        ? { contract: ing.contract, inventory: ing.inventory, tickets: ing.tickets, estate: ing.estate, telemetry: ing.telemetry }
        : { contract: false, inventory: false, tickets: false, estate: false, telemetry: false },
      // Only what this contract states. What it does not state takes the
      // platform's default, which is the browser's to apply.
      thresholds: Object.fromEntries(by(thresholds, e.id).map((t) => [t.key, Number(t.value)])),
      thresholdsStatedIn: Object.fromEntries(by(thresholds, e.id).map((t) => [t.key, t.stated_in])),
      ...(areas.length ? { procedureAreas: { reference: areas[0].reference, areas: areas.map(item) } } : {}),
      ...(dimensions.length ? { improvementDimensions: { reference: dimensions[0].reference, items: dimensions.map(item) } } : {}),
    }
  })
}
